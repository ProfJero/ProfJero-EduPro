-- =============================================================================
-- 0005 RPC layer: trusted, transaction-safe operations
-- Every function re-checks the caller (auth.uid()) before acting.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Small utilities
-- -----------------------------------------------------------------------------
create or replace function private.require_user()
returns uuid language plpgsql stable set search_path = '' as $$
declare v uuid := (select auth.uid());
begin
  if v is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles p where p.id = v and p.status = 'suspended') then
    raise exception 'Your account is suspended. Contact support.' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function private.require_admin()
returns uuid language plpgsql stable set search_path = '' as $$
declare v uuid := private.require_user();
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required' using errcode = '42501'; end if;
  return v;
end $$;

create or replace function private.display_name(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Learner') from public.profiles p where p.id = p_user;
$$;

create or replace function private.norm_text(p text, p_case boolean)
returns text language sql immutable set search_path = '' as $$
  select case when p_case then btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))
              else lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))) end;
$$;

-- -----------------------------------------------------------------------------
-- Context / workspace switching
-- -----------------------------------------------------------------------------
create or replace function public.my_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'user_id', v_uid,
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = v_uid), '[]'::jsonb),
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'school_id', s.id, 'name', s.name, 'slug', s.slug, 'status', s.status, 'logo_url', s.logo_url,
        'roles', (select jsonb_agg(m2.role) from public.school_memberships m2
                  where m2.school_id = s.id and m2.user_id = v_uid and m2.status = 'active')
      ) order by s.name)
      from public.schools s
      where s.id in (select m.school_id from public.school_memberships m where m.user_id = v_uid and m.status = 'active')
    ), '[]'::jsonb),
    'school_applications', coalesce((
      select jsonb_agg(jsonb_build_object('school_id', s.id, 'name', s.name, 'status', s.status, 'created_at', s.created_at))
      from public.schools s where s.applied_by = v_uid and s.status in ('pending', 'rejected')
    ), '[]'::jsonb),
    'teaches_classes', exists (select 1 from public.class_teachers ct where ct.user_id = v_uid),
    'pending_invitations', (
      select count(*) from public.school_invitations i
      where i.email = (select (auth.jwt() ->> 'email'))::extensions.citext and i.status = 'pending' and i.expires_at > now()
    ),
    'entitlements', coalesce((
      select jsonb_object_agg(e.feature_key, jsonb_build_object('enabled', e.enabled, 'limit', e.limit_value, 'plans', e.source_plans))
      from private.entitlements_for(v_uid) e
    ), '{}'::jsonb),
    'is_edupro', exists (
      select 1 from private.entitlements_for(v_uid) e where e.enabled and exists (
        select 1 from unnest(e.source_plans) c join public.plans p on p.code = c where p.tier = 'edupro'))
  );
end $$;

-- -----------------------------------------------------------------------------
-- Public helpers (anon-safe)
-- -----------------------------------------------------------------------------
create or replace function public.course_instructor_cards(p_course_ids uuid[])
returns table (course_id uuid, user_id uuid, name text, headline text, avatar_url text, role text)
language sql stable security definer set search_path = '' as $$
  select c.id, p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.headline, p.avatar_url, 'owner'
  from public.courses c join public.profiles p on p.id = c.owner_id
  where c.id = any (p_course_ids) and private.can_view_course(c.id)
  union
  select i.course_id, p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.headline, p.avatar_url, i.role
  from public.course_instructors i join public.profiles p on p.id = i.user_id
  where i.course_id = any (p_course_ids) and private.can_view_course(i.course_id) and i.user_id <> (select c2.owner_id from public.courses c2 where c2.id = i.course_id);
$$;

create or replace function public.course_public_stats(p_course uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when private.can_view_course(p_course) then jsonb_build_object(
    'lessons', (select count(*) from public.lessons l join public.course_modules m on m.id = l.module_id
                where l.course_id = p_course and l.status = 'published' and m.status = 'published'),
    'modules', (select count(*) from public.course_modules m where m.course_id = p_course and m.status = 'published'),
    'learners', (select count(*) from public.course_enrolments e where e.course_id = p_course and e.status <> 'dropped'),
    'minutes', (select coalesce(sum(l.estimated_minutes), 0) from public.lessons l where l.course_id = p_course and l.status = 'published')
  ) end;
$$;

create or replace function public.verify_certificate(p_serial text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'serial', c.serial, 'learner_name', c.learner_name, 'course_title', c.course_title,
    'issuer_name', c.issuer_name, 'completed_on', c.completed_on, 'issued_at', c.issued_at,
    'status', c.status, 'course_slug', co.slug
  )
  from public.certificates c join public.courses co on co.id = c.course_id
  where c.serial = upper(btrim(p_serial));
$$;

-- Names of people in a classroom (for rosters / presence labels).
create or replace function public.room_members(p_type text, p_room uuid)
returns table (user_id uuid, name text, avatar_url text, member_role text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.can_join_room(p_type, p_room) then
    raise exception 'You are not a member of this classroom' using errcode = '42501';
  end if;
  if p_type = 'course' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url, 'teacher'::text
      from public.profiles p where p.id in (
        select c.owner_id from public.courses c where c.id = p_room
        union select i.user_id from public.course_instructors i where i.course_id = p_room)
      union
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url, 'learner'
      from public.course_enrolments e join public.profiles p on p.id = e.user_id
      where e.course_id = p_room and e.status in ('active', 'completed')
        and e.user_id not in (select c.owner_id from public.courses c where c.id = p_room
                              union select i.user_id from public.course_instructors i where i.course_id = p_room)
      limit 500;
  elsif p_type = 'class' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url, 'teacher'::text
      from public.class_teachers ct join public.profiles p on p.id = ct.user_id where ct.class_id = p_room
      union
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url, 'learner'
      from public.class_enrolments ce join public.profiles p on p.id = ce.user_id
      where ce.class_id = p_room and ce.status = 'active'
      limit 500;
  else
    return query
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url, 'teacher'::text
      from public.live_sessions s join public.profiles p on p.id = s.host_id where s.id = p_room
      union
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url, 'learner'
      from public.live_sessions s
      join private.audience(s.course_id, s.class_id) a on true
      join public.profiles p on p.id = a.user_id
      where s.id = p_room and a.user_id <> s.host_id
      limit 500;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Enrolment
-- -----------------------------------------------------------------------------
create or replace function public.enrol_in_course(p_course uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_c public.courses;
  v_id uuid;
  v_limit integer;
  v_active integer;
begin
  select * into v_c from public.courses where id = p_course;
  if not found or v_c.status <> 'published' then
    raise exception 'This course is not open for enrolment' using errcode = 'P0001';
  end if;
  if not (v_c.visibility in ('public', 'unlisted') or (v_c.visibility = 'school' and private.is_school_member(v_c.school_id))) then
    raise exception 'This course is not available to you' using errcode = '42501';
  end if;
  if v_c.enrolment_method <> 'open' then
    raise exception 'Enrolment for this course is by invitation from the instructor or school' using errcode = 'P0001';
  end if;
  select id into v_id from public.course_enrolments where course_id = p_course and user_id = v_uid;
  if v_id is not null then
    update public.course_enrolments set status = 'active' where id = v_id and status = 'dropped';
    return v_id;
  end if;
  if v_c.is_premium and not private.has_feature('premium_courses') then
    raise exception 'This is an EduPro course. Ask your school or the ProfJero team about EduPro access.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.course_prerequisites pr
    where pr.course_id = p_course and not exists (
      select 1 from public.course_enrolments e where e.course_id = pr.prerequisite_id and e.user_id = v_uid and e.status = 'completed')
  ) then
    raise exception 'Complete the prerequisite courses first' using errcode = 'P0001';
  end if;
  v_limit := private.feature_limit('active_enrolments');
  if v_limit is not null then
    select count(*) into v_active from public.course_enrolments where user_id = v_uid and status = 'active' and source = 'self';
    if v_active >= v_limit then
      raise exception 'You can study up to % self-enrolled courses at a time on your plan. Finish or leave one to continue.', v_limit using errcode = 'P0001';
    end if;
  end if;
  insert into public.course_enrolments (course_id, user_id, source, enrolled_by)
  values (p_course, v_uid, 'self', v_uid) returning id into v_id;
  return v_id;
end $$;

-- Teachers / course managers enrol learners they are responsible for.
create or replace function public.enrol_users(p_course uuid, p_user_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_count integer := 0;
  v_user uuid;
  v_school uuid;
begin
  if not private.can_manage_course(p_course) then
    raise exception 'You cannot manage this course' using errcode = '42501';
  end if;
  select school_id into v_school from public.courses where id = p_course;
  foreach v_user in array coalesce(p_user_ids, '{}') loop
    if private.is_platform_admin() or private.is_staff_of_user(v_user) then
      insert into public.course_enrolments (course_id, user_id, source, enrolled_by, school_id)
      values (p_course, v_user, 'teacher', v_uid, v_school)
      on conflict (course_id, user_id) do update set status = 'active' where public.course_enrolments.status = 'dropped';
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- Assigning a course to a class enrols the class's students (school source).
create or replace function private.on_class_course()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.course_enrolments (course_id, user_id, source, school_id, class_id, enrolled_by)
  select new.course_id, ce.user_id, 'school', c.school_id, new.class_id, new.assigned_by
  from public.class_enrolments ce join public.school_classes c on c.id = ce.class_id
  where ce.class_id = new.class_id and ce.status = 'active'
  on conflict (course_id, user_id) do nothing;
  return new;
end $$;
create trigger class_courses_enrol after insert on public.class_courses
  for each row execute function private.on_class_course();

-- Adding a student to a class enrols them in the class's courses.
create or replace function private.on_class_enrolment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' then
    insert into public.course_enrolments (course_id, user_id, source, school_id, class_id, enrolled_by)
    select cc.course_id, new.user_id, 'school', c.school_id, new.class_id, (select auth.uid())
    from public.class_courses cc join public.school_classes c on c.id = cc.class_id
    where cc.class_id = new.class_id
    on conflict (course_id, user_id) do nothing;
  end if;
  return new;
end $$;
create trigger class_enrolments_courses after insert or update on public.class_enrolments
  for each row execute function private.on_class_enrolment();

-- Only school students can be placed in a class.
create or replace function private.guard_class_enrolment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.school_memberships m join public.school_classes c on c.school_id = m.school_id
    where c.id = new.class_id and m.user_id = new.user_id and m.role = 'student' and m.status = 'active'
  ) then
    raise exception 'Only active students of this school can join the class' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger class_enrolments_guard before insert on public.class_enrolments
  for each row execute function private.guard_class_enrolment();

create or replace function private.guard_class_teacher()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.school_memberships m join public.school_classes c on c.school_id = m.school_id
    where c.id = new.class_id and m.user_id = new.user_id and m.role in ('teacher', 'school_admin') and m.status = 'active'
  ) then
    raise exception 'Only active teachers of this school can be assigned to the class' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger class_teachers_guard before insert or update on public.class_teachers
  for each row execute function private.guard_class_teacher();

-- -----------------------------------------------------------------------------
-- Progress
-- -----------------------------------------------------------------------------
create or replace function private.issue_certificate(p_user uuid, p_course uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_c public.courses;
  v_issuer text;
begin
  select * into v_c from public.courses where id = p_course;
  if not v_c.certificate_enabled then return null; end if;
  select id into v_id from public.certificates where user_id = p_user and course_id = p_course;
  if v_id is not null then return v_id; end if;
  v_issuer := coalesce((select s.name from public.schools s where s.id = v_c.school_id), 'ProfJero Edu · ProfJero Digital Studio');
  insert into public.certificates (serial, user_id, course_id, template_id, learner_name, course_title, issuer_name, completed_on)
  values (
    'PJE-' || to_char(now(), 'YYYY') || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
    p_user, p_course, (select t.id from public.certificate_templates t where t.is_default limit 1),
    coalesce(nullif((select p.full_name from public.profiles p where p.id = p_user), ''), 'Learner'),
    v_c.title, v_issuer, (now() at time zone 'Africa/Accra')::date
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function private.recompute_course_progress(p_user uuid, p_course uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_c public.courses;
  v_total integer;
  v_done integer;
  v_pct numeric;
  v_assess_ok boolean := true;
  v_enr public.course_enrolments;
begin
  select * into v_c from public.courses where id = p_course;
  select * into v_enr from public.course_enrolments where course_id = p_course and user_id = p_user;
  if not found then return 0; end if;

  select count(*) into v_total from public.lessons l join public.course_modules m on m.id = l.module_id
    where l.course_id = p_course and l.status = 'published' and m.status = 'published';
  select count(*) into v_done from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id join public.course_modules m on m.id = l.module_id
    where lp.user_id = p_user and lp.course_id = p_course and lp.status = 'completed'
      and l.status = 'published' and m.status = 'published';
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_done / v_total, 2) end;

  if v_c.completion_requires_assessments then
    v_assess_ok := not exists (
      select 1 from public.assessments a
      where a.course_id = p_course and a.status = 'published' and a.kind <> 'practice'
        and not exists (select 1 from public.assessment_results r where r.assessment_id = a.id and r.user_id = p_user and r.passed)
    );
  end if;

  update public.course_enrolments set progress_pct = v_pct, last_activity_at = now() where id = v_enr.id;

  if v_enr.status = 'active' and v_total > 0 and v_pct >= v_c.completion_lesson_pct and v_assess_ok then
    update public.course_enrolments set status = 'completed', completed_at = now() where id = v_enr.id;
    insert into public.learning_activity (user_id, kind, course_id) values (p_user, 'course_completed', p_course);
    perform private.notify(p_user, 'course_completed', 'Course completed: ' || v_c.title,
      'Congratulations! You have met all the completion requirements.', '/learn/certificates', jsonb_build_object('course_id', p_course));
    if private.issue_certificate(p_user, p_course) is not null then
      perform private.notify(p_user, 'certificate_issued', 'Your certificate is ready',
        'Your certificate for ' || v_c.title || ' has been issued.', '/learn/certificates', jsonb_build_object('course_id', p_course));
    end if;
  end if;
  return v_pct;
end $$;

create or replace function public.touch_lesson(p_lesson uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_course uuid;
begin
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null or not private.is_enrolled(v_course) or not private.can_access_lesson_content(p_lesson) then
    return; -- previews / managers: no progress tracking
  end if;
  insert into public.lesson_progress (user_id, lesson_id, course_id)
  values (v_uid, p_lesson, v_course)
  on conflict (user_id, lesson_id) do update set last_opened_at = now();
  update public.course_enrolments set last_lesson_id = p_lesson, last_activity_at = now()
    where course_id = v_course and user_id = v_uid;
end $$;

create or replace function public.complete_lesson(p_lesson uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_l public.lessons;
  v_pct numeric;
  v_status public.enrolment_status;
begin
  select * into v_l from public.lessons where id = p_lesson;
  if not found or v_l.status <> 'published' then raise exception 'Lesson not found' using errcode = 'P0002'; end if;
  if not private.is_enrolled(v_l.course_id) then raise exception 'Enrol in this course to track progress' using errcode = '42501'; end if;

  if v_l.completion_rule = 'quiz_pass' and v_l.quiz_assessment_id is not null then
    if not exists (select 1 from public.assessment_results r where r.assessment_id = v_l.quiz_assessment_id and r.user_id = v_uid and r.passed) then
      raise exception 'Pass the lesson quiz to complete this lesson' using errcode = 'P0001';
    end if;
  elsif v_l.completion_rule = 'assignment_submit' and v_l.assignment_id is not null then
    if not exists (select 1 from public.assignment_submissions s where s.assignment_id = v_l.assignment_id and s.user_id = v_uid and s.status in ('submitted', 'graded')) then
      raise exception 'Submit the lesson assignment to complete this lesson' using errcode = 'P0001';
    end if;
  end if;

  insert into public.lesson_progress (user_id, lesson_id, course_id, status, completed_at)
  values (v_uid, p_lesson, v_l.course_id, 'completed', now())
  on conflict (user_id, lesson_id) do update set status = 'completed', completed_at = coalesce(public.lesson_progress.completed_at, now()), last_opened_at = now();
  insert into public.learning_activity (user_id, kind, course_id, lesson_id) values (v_uid, 'lesson_completed', v_l.course_id, p_lesson);

  v_pct := private.recompute_course_progress(v_uid, v_l.course_id);
  select status into v_status from public.course_enrolments where course_id = v_l.course_id and user_id = v_uid;
  return jsonb_build_object('progress_pct', v_pct, 'course_status', v_status);
end $$;

create or replace function public.claim_certificate(p_course uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  if not exists (select 1 from public.course_enrolments e where e.course_id = p_course and e.user_id = v_uid and e.status = 'completed') then
    raise exception 'Complete the course requirements to receive a certificate' using errcode = 'P0001';
  end if;
  return private.issue_certificate(v_uid, p_course);
end $$;

-- -----------------------------------------------------------------------------
-- Lesson authoring (atomic block save with revision history)
-- -----------------------------------------------------------------------------
create or replace function public.save_lesson_content(p_lesson uuid, p_title text, p_summary text, p_blocks jsonb, p_revision_note text default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_course uuid;
  v_block jsonb;
  v_pos integer := 0;
begin
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null or not private.can_manage_course(v_course) then
    raise exception 'You cannot edit this lesson' using errcode = '42501';
  end if;
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) > 300 then
    raise exception 'Invalid lesson content' using errcode = '22023';
  end if;
  update public.lessons set title = left(coalesce(nullif(btrim(p_title), ''), title), 160), summary = p_summary where id = p_lesson;
  delete from public.lesson_blocks where lesson_id = p_lesson;
  for v_block in select * from jsonb_array_elements(p_blocks) loop
    insert into public.lesson_blocks (id, lesson_id, type, position, content)
    values (
      coalesce((v_block ->> 'id')::uuid, gen_random_uuid()), p_lesson,
      (v_block ->> 'type')::public.lesson_block_type, v_pos, coalesce(v_block -> 'content', '{}'::jsonb)
    );
    v_pos := v_pos + 1;
  end loop;
  if p_revision_note is not null then
    insert into public.lesson_revisions (lesson_id, title, blocks, note, created_by)
    values (p_lesson, coalesce(p_title, ''), p_blocks, p_revision_note, v_uid);
    -- keep the 30 most recent revisions per lesson
    delete from public.lesson_revisions where id in (
      select id from public.lesson_revisions where lesson_id = p_lesson order by created_at desc offset 30);
  end if;
  return now();
end $$;

create or replace function public.restore_lesson_revision(p_revision uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_r public.lesson_revisions;
begin
  perform private.require_user();
  select * into v_r from public.lesson_revisions where id = p_revision;
  if not found then raise exception 'Revision not found' using errcode = 'P0002'; end if;
  perform public.save_lesson_content(v_r.lesson_id, v_r.title, (select summary from public.lessons where id = v_r.lesson_id),
    (select coalesce(jsonb_agg(b - 'id'), '[]'::jsonb) from jsonb_array_elements(v_r.blocks) b),
    'Restored revision from ' || to_char(v_r.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC');
end $$;

create or replace function public.duplicate_lesson(p_lesson uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_l public.lessons;
  v_new uuid;
begin
  select * into v_l from public.lessons where id = p_lesson;
  if not found or not private.can_manage_course(v_l.course_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.lessons (course_id, module_id, title, summary, position, status, estimated_minutes, completion_rule, created_by)
  values (v_l.course_id, v_l.module_id, left(v_l.title || ' (copy)', 160), v_l.summary, v_l.position + 1, 'draft', v_l.estimated_minutes, 'mark_complete', v_uid)
  returning id into v_new;
  insert into public.lesson_blocks (lesson_id, type, position, content)
  select v_new, type, position, content from public.lesson_blocks where lesson_id = p_lesson;
  update public.lessons set position = position + 1 where module_id = v_l.module_id and position > v_l.position and id <> v_new;
  return v_new;
end $$;

create or replace function public.reorder_modules(p_course uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.can_manage_course(p_course) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.course_modules m set position = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where m.id = x.id and m.course_id = p_course;
end $$;

-- Reorders lessons within a module; lessons from other modules of the SAME
-- course are moved into this module.
create or replace function public.reorder_lessons(p_module uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_course uuid;
begin
  perform private.require_user();
  select course_id into v_course from public.course_modules where id = p_module;
  if v_course is null or not private.can_manage_course(v_course) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.lessons l set position = x.ord - 1, module_id = p_module
  from unnest(p_ids) with ordinality as x(id, ord)
  where l.id = x.id and l.course_id = v_course;
end $$;

create or replace function public.submit_course_for_review(p_course uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_c public.courses;
  v_admin record;
begin
  perform private.require_user();
  select * into v_c from public.courses where id = p_course;
  if not found or not private.can_manage_course(p_course) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.lessons l where l.course_id = p_course and l.status = 'published') then
    raise exception 'Publish at least one lesson before submitting the course for review' using errcode = 'P0001';
  end if;
  update public.courses set status = 'in_review' where id = p_course;
  for v_admin in select distinct r.user_id from public.user_roles r where r.role in ('platform_admin', 'owner') loop
    perform private.notify(v_admin.user_id, 'course_review', 'Course submitted for review', v_c.title, '/admin/courses', jsonb_build_object('course_id', p_course));
  end loop;
  perform private.audit('course.submitted_for_review', 'course', p_course::text, '{}'::jsonb, v_c.school_id);
end $$;

create or replace function public.review_course(p_course uuid, p_action text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_c public.courses;
  v_status public.content_status;
begin
  perform private.require_user();
  select * into v_c from public.courses where id = p_course;
  if not found then raise exception 'Course not found' using errcode = 'P0002'; end if;
  if not (private.is_platform_admin() or (v_c.school_id is not null and private.is_school_admin(v_c.school_id))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_status := case p_action when 'publish' then 'published' when 'reject' then 'draft' when 'unpublish' then 'unpublished'
                            when 'archive' then 'archived' else null end;
  if v_status is null then raise exception 'Unknown action' using errcode = '22023'; end if;
  update public.courses set status = v_status, review_notes = p_notes where id = p_course;
  perform private.notify(v_c.owner_id, 'course_review',
    case p_action when 'publish' then 'Your course is live: ' when 'reject' then 'Changes requested: ' else 'Course status updated: ' end || v_c.title,
    p_notes, '/teach/courses/' || p_course, jsonb_build_object('course_id', p_course, 'action', p_action));
  perform private.audit('course.' || p_action, 'course', p_course::text, jsonb_build_object('notes', p_notes), v_c.school_id);
end $$;

-- -----------------------------------------------------------------------------
-- Assessment engine
-- -----------------------------------------------------------------------------
create or replace function private.grade_response(p_type public.question_type, p_response jsonb, p_key jsonb, p_marks numeric)
returns table (awarded numeric, correct boolean, manual boolean)
language plpgsql immutable set search_path = '' as $$
declare
  v_sel text[];
  v_corr text[];
  v_right integer;
  v_wrong integer;
  v_n integer;
  v_case boolean := coalesce((p_key ->> 'case_sensitive')::boolean, false);
  v_text text;
begin
  if p_response is null or p_response = '{}'::jsonb then
    if p_type in ('essay', 'file_upload') then return query select 0::numeric, false, false; return; end if;
    return query select 0::numeric, false, false; return;
  end if;
  case p_type
    when 'multiple_choice', 'true_false' then
      v_corr := array(select jsonb_array_elements_text(coalesce(p_key -> 'correct', '[]')));
      if (p_response ->> 'option_id') = any (v_corr) then return query select p_marks, true, false;
      else return query select 0::numeric, false, false; end if;
    when 'multiple_select' then
      v_corr := array(select jsonb_array_elements_text(coalesce(p_key -> 'correct', '[]')));
      v_sel := array(select distinct jsonb_array_elements_text(coalesce(p_response -> 'option_ids', '[]')));
      v_n := greatest(cardinality(v_corr), 1);
      select count(*) into v_right from unnest(v_sel) s where s = any (v_corr);
      v_wrong := cardinality(v_sel) - v_right;
      return query select round(p_marks * greatest(0, v_right - v_wrong)::numeric / v_n, 2),
        (v_right = cardinality(v_corr) and v_wrong = 0), false;
    when 'fill_blank', 'short_answer' then
      v_text := p_response ->> 'text';
      if jsonb_array_length(coalesce(p_key -> 'accepted', '[]')) = 0 then
        return query select null::numeric, null::boolean, true; return;
      end if;
      if exists (select 1 from jsonb_array_elements_text(p_key -> 'accepted') a
                 where private.norm_text(a, v_case) = private.norm_text(v_text, v_case)) then
        return query select p_marks, true, false;
      elsif p_type = 'short_answer' then
        return query select null::numeric, null::boolean, true; -- teacher reviews non-matching short answers
      else
        return query select 0::numeric, false, false;
      end if;
    when 'matching' then
      select count(*) into v_n from jsonb_object_keys(coalesce(p_key -> 'pairs', '{}')) k;
      select count(*) into v_right from jsonb_each_text(coalesce(p_key -> 'pairs', '{}')) kv
        where (p_response -> 'pairs' ->> kv.key) = kv.value;
      v_n := greatest(v_n, 1);
      return query select round(p_marks * v_right / v_n, 2), v_right = v_n, false;
    when 'ordering' then
      v_corr := array(select jsonb_array_elements_text(coalesce(p_key -> 'order', '[]')));
      v_sel := array(select jsonb_array_elements_text(coalesce(p_response -> 'order', '[]')));
      v_n := greatest(cardinality(v_corr), 1);
      select count(*) into v_right from generate_subscripts(v_corr, 1) i where v_sel[i] is not distinct from v_corr[i];
      return query select round(p_marks * v_right / v_n, 2), v_sel = v_corr, false;
    else -- essay, file_upload
      return query select null::numeric, null::boolean, true;
  end case;
end $$;

create or replace function private.question_marks(p_assessment uuid, p_question uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(aq.marks_override, q.marks) from public.assessment_questions aq
  join public.questions q on q.id = aq.question_id where aq.assessment_id = p_assessment and aq.question_id = p_question;
$$;

create or replace function private.refresh_result(p_attempt uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_t public.assessment_attempts;
  v_a public.assessments;
  v_max numeric;
  v_score numeric;
  v_pending boolean;
  v_pct numeric;
  v_course uuid;
begin
  select * into v_t from public.assessment_attempts where id = p_attempt;
  select * into v_a from public.assessments where id = v_t.assessment_id;
  select coalesce(sum(coalesce(aq.marks_override, q.marks)), 0) into v_max
    from unnest(v_t.question_order) qid join public.assessment_questions aq on aq.question_id = qid and aq.assessment_id = v_a.id
    join public.questions q on q.id = qid;
  select coalesce(sum(awarded_marks), 0), coalesce(bool_or(needs_manual and awarded_marks is null), false)
    into v_score, v_pending from public.attempt_answers where attempt_id = p_attempt;
  v_pct := case when v_max = 0 then 0 else round(100 * v_score / v_max, 2) end;
  insert into public.assessment_results (attempt_id, assessment_id, user_id, score, max_score, percentage, passed, pending_manual, graded_at)
  values (p_attempt, v_a.id, v_t.user_id, v_score, v_max, v_pct, (not v_pending and v_pct >= v_a.pass_mark_pct), v_pending, now())
  on conflict (attempt_id) do update set score = excluded.score, max_score = excluded.max_score, percentage = excluded.percentage,
    passed = excluded.passed, pending_manual = excluded.pending_manual, graded_at = now();
  update public.assessment_attempts set status = case when v_pending then 'submitted' else 'graded' end where id = p_attempt;
  v_course := v_a.course_id;
  if v_course is not null and not v_pending then
    perform private.recompute_course_progress(v_t.user_id, v_course);
  end if;
end $$;

create or replace function private.finalize_attempt(p_attempt uuid, p_auto boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_t public.assessment_attempts;
  v_q record;
  v_g record;
begin
  select * into v_t from public.assessment_attempts where id = p_attempt for update;
  if v_t.status <> 'in_progress' then return; end if;
  -- ensure every question has an answer row, then grade
  insert into public.attempt_answers (attempt_id, question_id)
  select p_attempt, qid from unnest(v_t.question_order) qid
  on conflict do nothing;
  for v_q in
    select aa.question_id, aa.response, q.type, k.answer, private.question_marks(v_t.assessment_id, q.id) as marks
    from public.attempt_answers aa join public.questions q on q.id = aa.question_id
    left join public.question_answer_keys k on k.question_id = q.id
    where aa.attempt_id = p_attempt
  loop
    select * into v_g from private.grade_response(v_q.type, v_q.response, coalesce(v_q.answer, '{}'::jsonb), v_q.marks);
    update public.attempt_answers set awarded_marks = v_g.awarded, is_correct = v_g.correct, needs_manual = v_g.manual,
      graded_at = case when v_g.manual then null else now() end
    where attempt_id = p_attempt and question_id = v_q.question_id;
  end loop;
  update public.assessment_attempts set status = 'submitted', submitted_at = now(), auto_submitted = p_auto where id = p_attempt;
  perform private.refresh_result(p_attempt);
end $$;

create or replace function public.start_attempt(p_assessment uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_a public.assessments;
  v_open public.assessment_attempts;
  v_count integer;
  v_order uuid[];
  v_id uuid;
begin
  select * into v_a from public.assessments where id = p_assessment;
  if not found or not private.can_take_assessment(p_assessment) then
    raise exception 'This assessment is not available to you' using errcode = '42501';
  end if;
  select * into v_open from public.assessment_attempts where assessment_id = p_assessment and user_id = v_uid and status = 'in_progress';
  if found then
    if v_open.deadline_at is not null and now() > v_open.deadline_at then
      perform private.finalize_attempt(v_open.id, true);
    else
      return v_open.id;
    end if;
  end if;
  if v_a.opens_at is not null and now() < v_a.opens_at then raise exception 'This assessment has not opened yet' using errcode = 'P0001'; end if;
  if v_a.closes_at is not null and now() >= v_a.closes_at then raise exception 'This assessment has closed' using errcode = 'P0001'; end if;
  select count(*) into v_count from public.assessment_attempts where assessment_id = p_assessment and user_id = v_uid;
  if v_count >= v_a.max_attempts then raise exception 'You have used all % attempt(s)', v_a.max_attempts using errcode = 'P0001'; end if;
  v_order := array(
    select aq.question_id from public.assessment_questions aq where aq.assessment_id = p_assessment
    order by case when v_a.shuffle_questions then random() else aq.position end, aq.position);
  if cardinality(v_order) = 0 then raise exception 'This assessment has no questions yet' using errcode = 'P0001'; end if;
  insert into public.assessment_attempts (assessment_id, user_id, attempt_no, question_order, deadline_at)
  values (p_assessment, v_uid, v_count + 1, v_order,
    case when v_a.duration_minutes is not null or v_a.closes_at is not null then
      least(coalesce(now() + make_interval(mins => v_a.duration_minutes), 'infinity'::timestamptz), coalesce(v_a.closes_at, 'infinity'::timestamptz))
    end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_answer(p_attempt uuid, p_question uuid, p_response jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_t public.assessment_attempts;
begin
  select * into v_t from public.assessment_attempts where id = p_attempt;
  if not found or v_t.user_id <> v_uid then raise exception 'Attempt not found' using errcode = '42501'; end if;
  if v_t.status <> 'in_progress' then raise exception 'This attempt has already been submitted' using errcode = 'P0001'; end if;
  if v_t.deadline_at is not null and now() > v_t.deadline_at + interval '30 seconds' then
    perform private.finalize_attempt(p_attempt, true);
    raise exception 'Time is up — your attempt was submitted automatically' using errcode = 'P0001';
  end if;
  if not (p_question = any (v_t.question_order)) then raise exception 'Question is not part of this attempt' using errcode = '22023'; end if;
  if jsonb_typeof(p_response) <> 'object' then raise exception 'Invalid response' using errcode = '22023'; end if;
  insert into public.attempt_answers (attempt_id, question_id, response, updated_at)
  values (p_attempt, p_question, p_response, now())
  on conflict (attempt_id, question_id) do update set response = excluded.response, updated_at = now();
  return now();
end $$;

create or replace function public.submit_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_t public.assessment_attempts;
begin
  select * into v_t from public.assessment_attempts where id = p_attempt;
  if not found or v_t.user_id <> v_uid then raise exception 'Attempt not found' using errcode = '42501'; end if;
  perform private.finalize_attempt(p_attempt, false); -- idempotent
  return public.get_attempt(p_attempt);
end $$;

create or replace function public.get_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_t public.assessment_attempts;
  v_a public.assessments;
  v_manager boolean;
  v_released boolean;
  v_reveal boolean;
  v_questions jsonb;
  v_result jsonb;
begin
  select * into v_t from public.assessment_attempts where id = p_attempt;
  if not found then raise exception 'Attempt not found' using errcode = 'P0002'; end if;
  v_manager := private.can_manage_assessment(v_t.assessment_id);
  if v_t.user_id <> v_uid and not v_manager then raise exception 'Attempt not found' using errcode = '42501'; end if;
  if v_t.status = 'in_progress' and v_t.deadline_at is not null and now() > v_t.deadline_at + interval '30 seconds' then
    perform private.finalize_attempt(p_attempt, true);
    select * into v_t from public.assessment_attempts where id = p_attempt;
  end if;
  select * into v_a from public.assessments where id = v_t.assessment_id;
  v_released := v_manager or (v_t.status <> 'in_progress' and private.results_released(v_a.id));
  v_reveal := v_manager or (v_released and v_a.show_correct_answers);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'type', q.type, 'prompt', q.prompt, 'marks', coalesce(aq.marks_override, q.marks),
      'options', (
        select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
          order by case when v_a.shuffle_options then md5(p_attempt::text || o.id::text) else lpad(o.position::text, 6, '0') end), '[]'::jsonb)
        from public.question_options o where o.question_id = q.id),
      'data', case q.type
        when 'matching' then jsonb_build_object(
          'left', coalesce(q.data -> 'left', '[]'::jsonb),
          'right', (select coalesce(jsonb_agg(r order by md5(p_attempt::text || (r ->> 'id'))), '[]'::jsonb) from jsonb_array_elements(coalesce(q.data -> 'right', '[]'::jsonb)) r))
        when 'ordering' then jsonb_build_object(
          'items', (select coalesce(jsonb_agg(r order by md5(p_attempt::text || (r ->> 'id'))), '[]'::jsonb) from jsonb_array_elements(coalesce(q.data -> 'items', '[]'::jsonb)) r))
        else '{}'::jsonb end,
      'response', coalesce(aa.response, '{}'::jsonb)
    ) || case when v_released then jsonb_build_object(
      'awarded_marks', aa.awarded_marks, 'is_correct', aa.is_correct, 'needs_manual', aa.needs_manual,
      'feedback', aa.feedback, 'explanation', q.explanation) else '{}'::jsonb end
      || case when v_reveal then jsonb_build_object('answer_key', (select k.answer from public.question_answer_keys k where k.question_id = q.id)) else '{}'::jsonb end
    order by array_position(v_t.question_order, q.id)), '[]'::jsonb)
  into v_questions
  from unnest(v_t.question_order) qid
  join public.questions q on q.id = qid
  join public.assessment_questions aq on aq.assessment_id = v_a.id and aq.question_id = q.id
  left join public.attempt_answers aa on aa.attempt_id = p_attempt and aa.question_id = q.id;

  if v_released then
    select jsonb_build_object('score', r.score, 'max_score', r.max_score, 'percentage', r.percentage, 'passed', r.passed, 'pending_manual', r.pending_manual)
    into v_result from public.assessment_results r where r.attempt_id = p_attempt;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object('id', v_t.id, 'status', v_t.status, 'attempt_no', v_t.attempt_no, 'started_at', v_t.started_at,
      'deadline_at', v_t.deadline_at, 'submitted_at', v_t.submitted_at, 'auto_submitted', v_t.auto_submitted, 'user_id', v_t.user_id,
      'learner_name', private.display_name(v_t.user_id)),
    'assessment', jsonb_build_object('id', v_a.id, 'title', v_a.title, 'instructions', v_a.instructions, 'kind', v_a.kind,
      'course_id', v_a.course_id, 'class_id', v_a.class_id, 'pass_mark_pct', v_a.pass_mark_pct, 'max_attempts', v_a.max_attempts,
      'closes_at', v_a.closes_at, 'results_visibility', v_a.results_visibility),
    'server_now', now(),
    'released', v_released,
    'is_manager', v_manager,
    'questions', v_questions,
    'result', v_result
  );
end $$;

create or replace function public.grade_answer(p_attempt uuid, p_question uuid, p_marks numeric, p_feedback text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_t public.assessment_attempts;
  v_max numeric;
begin
  select * into v_t from public.assessment_attempts where id = p_attempt;
  if not found or not private.can_manage_assessment(v_t.assessment_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_t.status = 'in_progress' then raise exception 'The learner has not submitted this attempt yet' using errcode = 'P0001'; end if;
  v_max := private.question_marks(v_t.assessment_id, p_question);
  if p_marks is null or p_marks < 0 or p_marks > v_max then raise exception 'Marks must be between 0 and %', v_max using errcode = '22023'; end if;
  update public.attempt_answers set awarded_marks = p_marks, is_correct = (p_marks = v_max), feedback = p_feedback,
    graded_by = v_uid, graded_at = now()
  where attempt_id = p_attempt and question_id = p_question;
  if not found then raise exception 'Answer not found' using errcode = 'P0002'; end if;
  perform private.refresh_result(p_attempt);
  if (select status from public.assessment_attempts where id = p_attempt) = 'graded' and private.results_released(v_t.assessment_id) then
    perform private.notify(v_t.user_id, 'assessment_graded', 'Your assessment has been graded',
      (select title from public.assessments where id = v_t.assessment_id), '/learn/assessments/attempt/' || p_attempt, '{}'::jsonb);
  end if;
end $$;

create or replace function public.release_results(p_assessment uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_a public.assessments;
  v_user record;
  v_n integer := 0;
begin
  perform private.require_user();
  if not private.can_manage_assessment(p_assessment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.assessments set results_released = true where id = p_assessment returning * into v_a;
  for v_user in select distinct t.user_id, t.id from public.assessment_attempts t where t.assessment_id = p_assessment and t.status <> 'in_progress' loop
    perform private.notify(v_user.user_id, 'results_released', 'Results released: ' || v_a.title, null, '/learn/assessments/attempt/' || v_user.id, '{}'::jsonb);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- -----------------------------------------------------------------------------
-- Live classes
-- -----------------------------------------------------------------------------
create or replace function public.join_live_session(p_session uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_s public.live_sessions;
begin
  select * into v_s from public.live_sessions where id = p_session;
  if not found or not private.can_view_session(p_session) then raise exception 'Session not found' using errcode = '42501'; end if;
  if v_s.status = 'cancelled' then raise exception 'This session was cancelled' using errcode = 'P0001'; end if;
  if v_s.host_id <> v_uid and private.session_scope_ok(v_s.course_id, v_s.class_id)
     and now() between v_s.starts_at - interval '30 minutes' and v_s.starts_at + make_interval(mins => v_s.duration_minutes) then
    insert into public.live_session_attendance (session_id, user_id, status, source, joined_at)
    values (p_session, v_uid, case when now() > v_s.starts_at + interval '10 minutes' then 'late' else 'present' end, 'join_click', now())
    on conflict (session_id, user_id) do nothing;
  end if;
  return v_s.join_url;
end $$;

-- -----------------------------------------------------------------------------
-- Schools
-- -----------------------------------------------------------------------------
create or replace function public.review_school(p_school uuid, p_approve boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := private.require_admin();
  v_s public.schools;
begin
  select * into v_s from public.schools where id = p_school for update;
  if not found then raise exception 'School not found' using errcode = 'P0002'; end if;
  update public.schools set status = case when p_approve then 'approved'::public.school_status else 'rejected'::public.school_status end,
    reviewed_by = v_admin, reviewed_at = now(), review_notes = p_notes where id = p_school;
  if p_approve and v_s.applied_by is not null then
    insert into public.school_memberships (school_id, user_id, role, status, invited_by)
    values (p_school, v_s.applied_by, 'school_admin', 'active', v_admin)
    on conflict (school_id, user_id, role) do update set status = 'active';
    insert into public.user_roles (user_id, role, granted_by) values (v_s.applied_by, 'school_admin', v_admin) on conflict do nothing;
  end if;
  if v_s.applied_by is not null then
    perform private.notify(v_s.applied_by, 'school_review',
      case when p_approve then v_s.name || ' has been approved' else 'Update on your school application' end,
      coalesce(p_notes, case when p_approve then 'Your school workspace is ready.' else 'Your application was not approved.' end),
      case when p_approve then '/school/' || p_school else '/schools/apply' end, jsonb_build_object('school_id', p_school));
  end if;
  perform private.audit(case when p_approve then 'school.approved' else 'school.rejected' end, 'school', p_school::text, jsonb_build_object('notes', p_notes), p_school);
end $$;

create or replace function public.set_school_status(p_school uuid, p_status public.school_status, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.schools set status = p_status, review_notes = coalesce(p_notes, review_notes) where id = p_school;
  perform private.audit('school.status_' || p_status, 'school', p_school::text, jsonb_build_object('notes', p_notes), p_school);
end $$;

-- Add one person to a school by email: existing account -> active membership
-- (and class placement); otherwise a pending invitation. Returns outcome.
create or replace function private.add_school_person(p_school uuid, p_email text, p_name text, p_role public.school_role, p_class uuid, p_student_number text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_user uuid;
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email address: %', p_email using errcode = '22023'; end if;
  if p_class is not null and not exists (select 1 from public.school_classes c where c.id = p_class and c.school_id = p_school) then
    raise exception 'Class does not belong to this school' using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where u.email = v_email::text;
  if v_user is not null then
    insert into public.school_memberships (school_id, user_id, role, status, invited_by, student_number)
    values (p_school, v_user, p_role, 'active', v_uid, p_student_number)
    on conflict (school_id, user_id, role) do update set status = 'active', student_number = coalesce(excluded.student_number, public.school_memberships.student_number);
    if p_class is not null and p_role = 'student' then
      insert into public.class_enrolments (class_id, user_id) values (p_class, v_user)
      on conflict (class_id, user_id) do update set status = 'active';
    elsif p_class is not null and p_role = 'teacher' then
      insert into public.class_teachers (class_id, user_id) values (p_class, v_user) on conflict do nothing;
    end if;
    perform private.notify(v_user, 'school_membership', 'You were added to ' || (select name from public.schools where id = p_school),
      'Role: ' || replace(p_role::text, '_', ' '), case when p_role = 'student' then '/learn/classes' else '/teach' end, jsonb_build_object('school_id', p_school));
    return 'added';
  end if;
  insert into public.school_invitations (school_id, email, full_name, role, class_id, invited_by)
  values (p_school, v_email, p_name, p_role, p_class, v_uid)
  on conflict (school_id, email, role) where status = 'pending' do update set class_id = excluded.class_id, full_name = excluded.full_name;
  return 'invited';
end $$;

create or replace function public.add_school_member(p_school uuid, p_email text, p_full_name text, p_role public.school_role, p_class uuid default null, p_student_number text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_res text;
begin
  perform private.require_user();
  if not (private.is_school_admin(p_school) or private.is_platform_admin()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_role not in ('student', 'teacher', 'school_admin') then raise exception 'Unsupported role' using errcode = '22023'; end if;
  v_res := private.add_school_person(p_school, p_email, p_full_name, p_role, p_class, p_student_number);
  perform private.audit('school.member_' || v_res, 'school_membership', p_email, jsonb_build_object('role', p_role), p_school);
  return v_res;
end $$;

-- Bulk CSV import. p_rows: [{email, full_name, student_number}]. Never aborts
-- on a single bad row: returns a per-row report.
create or replace function public.import_students(p_school uuid, p_class uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_i integer := 0;
  v_report jsonb := '[]'::jsonb;
  v_res text;
  v_seen text[] := '{}';
  v_email text;
begin
  perform private.require_user();
  if not (private.is_school_admin(p_school) or private.is_platform_admin()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Provide up to 1000 rows per import' using errcode = '22023';
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    v_email := lower(btrim(coalesce(v_row ->> 'email', '')));
    begin
      if v_email = '' then raise exception 'Email is required'; end if;
      if v_email = any (v_seen) then raise exception 'Duplicate email in file'; end if;
      v_seen := v_seen || v_email;
      v_res := private.add_school_person(p_school, v_email, nullif(btrim(v_row ->> 'full_name'), ''), 'student', p_class, nullif(btrim(v_row ->> 'student_number'), ''));
      v_report := v_report || jsonb_build_object('row', v_i, 'email', v_email, 'status', v_res);
    exception when others then
      v_report := v_report || jsonb_build_object('row', v_i, 'email', v_email, 'status', 'error', 'message', sqlerrm);
    end;
  end loop;
  perform private.audit('school.students_imported', 'school', p_school::text,
    jsonb_build_object('rows', v_i, 'class_id', p_class), p_school);
  return v_report;
end $$;

create or replace function public.my_invitations()
returns table (id uuid, school_id uuid, school_name text, role public.school_role, class_name text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.school_id, s.name, i.role, c.name, i.expires_at
  from public.school_invitations i
  join public.schools s on s.id = i.school_id and s.status = 'approved'
  left join public.school_classes c on c.id = i.class_id
  where i.email = (select (auth.jwt() ->> 'email'))::extensions.citext and i.status = 'pending' and i.expires_at > now();
$$;

create or replace function public.respond_invitation(p_invitation uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_i public.school_invitations;
begin
  select * into v_i from public.school_invitations where id = p_invitation for update;
  if not found or v_i.email <> (select (auth.jwt() ->> 'email'))::extensions.citext or v_i.status <> 'pending' or v_i.expires_at < now() then
    raise exception 'Invitation not found or expired' using errcode = 'P0002';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'Verify your email address before accepting invitations' using errcode = '42501';
  end if;
  if not p_accept then
    update public.school_invitations set status = 'revoked', accepted_by = v_uid where id = p_invitation;
    return;
  end if;
  insert into public.school_memberships (school_id, user_id, role, status, invited_by)
  values (v_i.school_id, v_uid, v_i.role, 'active', v_i.invited_by)
  on conflict (school_id, user_id, role) do update set status = 'active';
  if v_i.class_id is not null and v_i.role = 'student' then
    insert into public.class_enrolments (class_id, user_id) values (v_i.class_id, v_uid) on conflict (class_id, user_id) do update set status = 'active';
  elsif v_i.class_id is not null and v_i.role = 'teacher' then
    insert into public.class_teachers (class_id, user_id) values (v_i.class_id, v_uid) on conflict do nothing;
  end if;
  if v_i.role = 'school_admin' then
    insert into public.user_roles (user_id, role) values (v_uid, 'school_admin') on conflict do nothing;
  end if;
  update public.school_invitations set status = 'accepted', accepted_by = v_uid where id = p_invitation;
  perform private.audit('school.invitation_accepted', 'school_invitation', p_invitation::text, jsonb_build_object('role', v_i.role), v_i.school_id);
end $$;

-- Members list with names for school staff.
create or replace function public.school_people(p_school uuid, p_role public.school_role default null)
returns table (membership_id uuid, user_id uuid, full_name text, email text, avatar_url text, role public.school_role,
               status public.membership_status, student_number text, classes text[], joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.is_school_staff(p_school) or private.is_platform_admin()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select m.id, m.user_id, p.full_name,
      case when private.is_school_admin(p_school) or private.is_platform_admin() then u.email::text end,
      p.avatar_url, m.role, m.status, m.student_number,
      array(select c.name from public.class_enrolments ce join public.school_classes c on c.id = ce.class_id
            where ce.user_id = m.user_id and c.school_id = p_school and ce.status = 'active'
            union select c.name from public.class_teachers ct join public.school_classes c on c.id = ct.class_id
            where ct.user_id = m.user_id and c.school_id = p_school),
      m.created_at
    from public.school_memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.school_id = p_school and (p_role is null or m.role = p_role) and m.status <> 'removed'
    order by p.full_name;
end $$;

-- -----------------------------------------------------------------------------
-- Platform administration
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, full_name text, status public.account_status, roles public.app_role[],
               email_confirmed boolean, created_at timestamptz, last_sign_in_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select u.id, u.email::text, p.full_name, p.status,
      array(select r.role from public.user_roles r where r.user_id = u.id order by r.role),
      u.email_confirmed_at is not null, u.created_at, u.last_sign_in_at, count(*) over ()
    from auth.users u join public.profiles p on p.id = u.id
    where p_search is null or u.email ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%'
    order by u.created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

create or replace function public.set_user_role(p_user uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin();
begin
  if p_role = 'owner' and not private.is_owner() then raise exception 'Only the owner can manage owner roles' using errcode = '42501'; end if;
  if p_role = 'platform_admin' and not private.is_owner() then raise exception 'Only the owner can manage platform administrators' using errcode = '42501'; end if;
  if p_user = v_admin and p_role in ('owner', 'platform_admin') and not p_grant then
    raise exception 'You cannot remove your own administrative role' using errcode = '42501';
  end if;
  if p_role = 'learner' and not p_grant then raise exception 'Every account keeps the learner role' using errcode = '22023'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, v_admin) on conflict do nothing;
    perform private.notify(p_user, 'role_granted', 'New role: ' || replace(p_role::text, '_', ' '), null, '/dashboard', '{}'::jsonb);
  else
    delete from public.user_roles where user_id = p_user and role = p_role;
  end if;
  perform private.audit(case when p_grant then 'user.role_granted' else 'user.role_revoked' end, 'user', p_user::text, jsonb_build_object('role', p_role));
end $$;

create or replace function public.set_user_status(p_user uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin();
begin
  if p_user = v_admin then raise exception 'You cannot change your own status' using errcode = '42501'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = 'owner') then
    raise exception 'The owner account cannot be suspended' using errcode = '42501';
  end if;
  update public.profiles set status = p_status where id = p_user;
  perform private.audit('user.' || p_status::text, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.review_instructor_application(p_application uuid, p_approve boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := private.require_admin();
  v_app public.instructor_applications;
begin
  select * into v_app from public.instructor_applications where id = p_application for update;
  if not found or v_app.status <> 'pending' then raise exception 'Application not found' using errcode = 'P0002'; end if;
  update public.instructor_applications set status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = v_admin, reviewed_at = now(), review_notes = p_notes where id = p_application;
  if p_approve then
    insert into public.user_roles (user_id, role, granted_by) values (v_app.user_id, 'teacher', v_admin) on conflict do nothing;
  end if;
  perform private.notify(v_app.user_id, 'instructor_application',
    case when p_approve then 'You are now a ProfJero Edu instructor' else 'Update on your instructor application' end,
    p_notes, case when p_approve then '/teach' else '/learn/settings' end, '{}'::jsonb);
  perform private.audit(case when p_approve then 'instructor.approved' else 'instructor.rejected' end, 'user', v_app.user_id::text, jsonb_build_object('notes', p_notes));
end $$;

create or replace function public.grant_subscription(p_plan_code text, p_user uuid, p_school uuid, p_ends_at timestamptz, p_notes text default null, p_source text default 'manual')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := private.require_admin();
  v_plan public.plans;
  v_id uuid;
begin
  select * into v_plan from public.plans where code = p_plan_code and is_active;
  if not found then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  if (p_user is null) = (p_school is null) then raise exception 'Choose exactly one user or school' using errcode = '22023'; end if;
  if v_plan.scope = 'school' and p_school is null then raise exception 'This plan is for schools' using errcode = '22023'; end if;
  if v_plan.scope <> 'school' and p_user is null then raise exception 'This plan is for individual accounts' using errcode = '22023'; end if;
  insert into public.subscriptions (plan_id, user_id, school_id, status, source, ends_at, notes, granted_by)
  values (v_plan.id, p_user, p_school, 'active', coalesce(p_source, 'manual'), p_ends_at, p_notes, v_admin) returning id into v_id;
  insert into public.subscription_events (subscription_id, event, actor_id, details)
  values (v_id, 'granted', v_admin, jsonb_build_object('plan', p_plan_code, 'ends_at', p_ends_at, 'notes', p_notes));
  if p_user is not null then
    perform private.notify(p_user, 'subscription', v_plan.name || ' activated', 'Enjoy your EduPro features.', '/learn/settings', '{}'::jsonb);
  end if;
  perform private.audit('subscription.granted', 'subscription', v_id::text, jsonb_build_object('plan', p_plan_code, 'user', p_user, 'school', p_school), p_school);
  return v_id;
end $$;

create or replace function public.revoke_subscription(p_subscription uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin();
begin
  update public.subscriptions set status = 'cancelled', ends_at = least(coalesce(ends_at, now()), now())
    where id = p_subscription and status in ('active', 'trialing');
  if not found then raise exception 'Active subscription not found' using errcode = 'P0002'; end if;
  insert into public.subscription_events (subscription_id, event, actor_id, details) values (p_subscription, 'revoked', v_admin, jsonb_build_object('reason', p_reason));
  perform private.audit('subscription.revoked', 'subscription', p_subscription::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_users_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'active_learners_30d', (select count(distinct user_id) from public.learning_activity where created_at > now() - interval '30 days'),
    'teachers', (select count(distinct user_id) from (
        select user_id from public.user_roles where role = 'teacher'
        union select user_id from public.school_memberships where role = 'teacher' and status = 'active') t),
    'schools_approved', (select count(*) from public.schools where status = 'approved'),
    'schools_pending', (select count(*) from public.schools where status = 'pending'),
    'courses_published', (select count(*) from public.courses where status = 'published'),
    'courses_in_review', (select count(*) from public.courses where status = 'in_review'),
    'enrolments', (select count(*) from public.course_enrolments where status <> 'dropped'),
    'completions', (select count(*) from public.course_enrolments where status = 'completed'),
    'attempts_30d', (select count(*) from public.assessment_attempts where started_at > now() - interval '30 days'),
    'submissions_30d', (select count(*) from public.assignment_submissions where submitted_at > now() - interval '30 days'),
    'certificates', (select count(*) from public.certificates where status = 'valid'),
    'open_tickets', (select count(*) from public.support_tickets where status in ('open', 'in_progress')),
    'pending_instructors', (select count(*) from public.instructor_applications where status = 'pending'),
    'edupro_active', (select count(*) from public.subscriptions s join public.plans p on p.id = s.plan_id
                      where p.tier = 'edupro' and s.status in ('active', 'trialing') and (s.ends_at is null or s.ends_at > now())),
    'signups_by_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', c) order by w), '[]'::jsonb) from (
        select date_trunc('week', created_at)::date w, count(*) c from public.profiles
        where created_at > now() - interval '12 weeks' group by 1) x)
  );
end $$;

-- -----------------------------------------------------------------------------
-- Analytics
-- -----------------------------------------------------------------------------
create or replace function public.course_analytics(p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.can_manage_course(p_course) or private.teaches_course_class(p_course)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'enrolled', (select count(*) from public.course_enrolments where course_id = p_course and status <> 'dropped'),
    'completed', (select count(*) from public.course_enrolments where course_id = p_course and status = 'completed'),
    'avg_progress', (select coalesce(round(avg(progress_pct), 1), 0) from public.course_enrolments where course_id = p_course and status <> 'dropped'),
    'inactive_14d', (select count(*) from public.course_enrolments where course_id = p_course and status = 'active'
                     and coalesce(last_activity_at, enrolled_at) < now() - interval '14 days'),
    'learners', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', e.user_id, 'name', private.display_name(e.user_id), 'progress', e.progress_pct, 'status', e.status,
        'last_activity_at', e.last_activity_at, 'enrolled_at', e.enrolled_at,
        'avg_score', (select round(avg(r.percentage), 1) from public.assessment_results r join public.assessments a on a.id = r.assessment_id
                      where a.course_id = p_course and r.user_id = e.user_id)
      ) order by e.progress_pct asc), '[]'::jsonb)
      from public.course_enrolments e where e.course_id = p_course and e.status <> 'dropped'),
    'assessments', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title,
        'attempts', (select count(*) from public.assessment_attempts t where t.assessment_id = a.id),
        'avg_pct', (select round(avg(r.percentage), 1) from public.assessment_results r where r.assessment_id = a.id),
        'pass_rate', (select round(100.0 * avg(case when r.passed then 1 else 0 end), 1) from public.assessment_results r where r.assessment_id = a.id)
      )), '[]'::jsonb) from public.assessments a where a.course_id = p_course),
    'advanced', (private.has_feature('advanced_analytics') or private.is_platform_admin()),
    'missed_questions', case when not (private.has_feature('advanced_analytics') or private.is_platform_admin()) then null else
      (select coalesce(jsonb_agg(x order by (x ->> 'wrong_rate')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('question_id', q.id, 'prompt', left(q.prompt, 160),
          'answers', count(*), 'wrong_rate', round(100.0 * avg(case when aa.is_correct then 0 else 1 end), 1)) x
        from public.attempt_answers aa
        join public.assessment_attempts t on t.id = aa.attempt_id
        join public.assessments a on a.id = t.assessment_id and a.course_id = p_course
        join public.questions q on q.id = aa.question_id
        where aa.is_correct is not null
        group by q.id, q.prompt having count(*) >= 1
        order by avg(case when aa.is_correct then 0 else 1 end) desc limit 10) s) end
  );
end $$;

create or replace function public.school_report(p_school uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.is_school_admin(p_school) or private.is_platform_admin()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students', (select count(*) from public.school_memberships where school_id = p_school and role = 'student' and status = 'active'),
    'teachers', (select count(*) from public.school_memberships where school_id = p_school and role = 'teacher' and status = 'active'),
    'pending_invitations', (select count(*) from public.school_invitations where school_id = p_school and status = 'pending'),
    'classes', (select count(*) from public.school_classes where school_id = p_school and not is_archived),
    'active_learners_30d', (select count(distinct la.user_id) from public.learning_activity la
        join public.school_memberships m on m.user_id = la.user_id and m.school_id = p_school and m.role = 'student'
        where la.created_at > now() - interval '30 days'),
    'class_summary', (select coalesce(jsonb_agg(jsonb_build_object(
        'class_id', c.id, 'name', c.name, 'stream', c.stream,
        'students', (select count(*) from public.class_enrolments ce where ce.class_id = c.id and ce.status = 'active'),
        'courses', (select count(*) from public.class_courses cc where cc.class_id = c.id),
        'avg_progress', (select round(avg(e.progress_pct), 1) from public.course_enrolments e where e.class_id = c.id),
        'completions', (select count(*) from public.course_enrolments e where e.class_id = c.id and e.status = 'completed'),
        'avg_score', (select round(avg(r.percentage), 1) from public.assessment_results r
                       join public.class_enrolments ce on ce.user_id = r.user_id and ce.class_id = c.id
                       join public.assessments a on a.id = r.assessment_id and (a.class_id = c.id or a.course_id in (select cc.course_id from public.class_courses cc where cc.class_id = c.id))),
        'attendance_rate', (select round(100.0 * avg(case when ca.status in ('present', 'late') then 1 else 0 end), 1)
                             from public.class_attendance ca where ca.class_id = c.id),
        'submission_rate', (select round(100.0 * count(*) filter (where s.status in ('submitted', 'graded', 'returned'))
                                 / nullif(count(*), 0), 1)
                             from public.assignments a
                             join public.class_enrolments ce on ce.class_id = c.id and ce.status = 'active'
                             left join public.assignment_submissions s on s.assignment_id = a.id and s.user_id = ce.user_id
                             where a.class_id = c.id and a.status = 'published')
      ) order by c.name), '[]'::jsonb) from public.school_classes c where c.school_id = p_school and not c.is_archived),
    'teacher_activity', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'name', private.display_name(m.user_id),
        'classes', (select count(*) from public.class_teachers ct join public.school_classes c on c.id = ct.class_id where ct.user_id = m.user_id and c.school_id = p_school),
        'sessions_30d', (select count(*) from public.live_sessions ls join public.school_classes c on c.id = ls.class_id
                         where ls.host_id = m.user_id and c.school_id = p_school and ls.starts_at > now() - interval '30 days'),
        'grades_30d', (select count(*) from public.submission_grades g join public.assignment_submissions s on s.id = g.submission_id
                       join public.assignments a on a.id = s.assignment_id join public.school_classes c on c.id = a.class_id
                       where g.graded_by = m.user_id and c.school_id = p_school and g.graded_at > now() - interval '30 days')
      )), '[]'::jsonb) from public.school_memberships m where m.school_id = p_school and m.role = 'teacher' and m.status = 'active')
  );
end $$;

create or replace function public.teacher_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'courses', (select count(*) from public.courses c where c.owner_id = v_uid or exists (select 1 from public.course_instructors i where i.course_id = c.id and i.user_id = v_uid)),
    'classes', (select count(*) from public.class_teachers where user_id = v_uid),
    'learners', (select count(distinct u) from (
        select e.user_id u from public.course_enrolments e join public.courses c on c.id = e.course_id
        where e.status <> 'dropped' and (c.owner_id = v_uid or exists (select 1 from public.course_instructors i where i.course_id = c.id and i.user_id = v_uid))
        union select ce.user_id from public.class_enrolments ce join public.class_teachers ct on ct.class_id = ce.class_id
        where ct.user_id = v_uid and ce.status = 'active') x),
    'pending_submissions', (select count(*) from public.assignment_submissions s join public.assignments a on a.id = s.assignment_id
        where s.status = 'submitted' and private.can_manage_assignment(a.id)),
    'pending_manual_grading', (select count(*) from public.assessment_results r where r.pending_manual and private.can_manage_assessment(r.assessment_id)),
    'upcoming_sessions', (select count(*) from public.live_sessions s where s.host_id = v_uid and s.status = 'scheduled' and s.starts_at > now())
  );
end $$;

create or replace function public.mark_all_notifications_read()
returns integer language sql security definer set search_path = '' as $$
  with u as (update public.notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null returning 1)
  select count(*)::integer from u;
$$;

-- -----------------------------------------------------------------------------
-- Notification triggers
-- -----------------------------------------------------------------------------
create or replace function private.trg_enrolment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_title text;
begin
  select title into v_title from public.courses where id = new.course_id;
  perform private.notify(new.user_id, 'course_enrolment', 'Enrolled: ' || v_title,
    case new.source when 'self' then 'Welcome to your new course.' else 'You were enrolled by your teacher or school.' end,
    '/learn/courses/' || new.course_id, jsonb_build_object('course_id', new.course_id));
  insert into public.learning_activity (user_id, kind, course_id) values (new.user_id, 'enrolled', new.course_id);
  return new;
end $$;
create trigger enrolment_notify after insert on public.course_enrolments for each row execute function private.trg_enrolment_notify();

create or replace function private.trg_lesson_published()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_course public.courses;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select * into v_course from public.courses where id = new.course_id;
    if v_course.status = 'published' then
      insert into public.notifications (user_id, type, title, body, link, data)
      select a.user_id, 'new_lesson', 'New lesson in ' || v_course.title, new.title,
        '/learn/courses/' || new.course_id || '/lessons/' || new.id, jsonb_build_object('course_id', new.course_id)
      from private.audience(new.course_id, null) a;
    end if;
  end if;
  return new;
end $$;
create trigger lesson_published_notify after insert or update of status on public.lessons for each row execute function private.trg_lesson_published();

create or replace function private.trg_assignment_published()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.notifications (user_id, type, title, body, link, data)
    select a.user_id, 'new_assignment', 'New assignment: ' || new.title,
      case when new.due_at is not null then 'Due ' || to_char(new.due_at at time zone 'Africa/Accra', 'Dy DD Mon, HH24:MI') || ' GMT' end,
      '/learn/assignments/' || new.id, jsonb_build_object('assignment_id', new.id)
    from private.audience(new.course_id, new.class_id) a;
  end if;
  return new;
end $$;
create trigger assignment_published_notify after insert or update of status on public.assignments for each row execute function private.trg_assignment_published();

create or replace function private.trg_assessment_published()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.notifications (user_id, type, title, body, link, data)
    select a.user_id, 'new_assessment', 'New ' || new.kind || ': ' || new.title,
      case when new.closes_at is not null then 'Closes ' || to_char(new.closes_at at time zone 'Africa/Accra', 'Dy DD Mon, HH24:MI') || ' GMT' end,
      '/learn/assessments', jsonb_build_object('assessment_id', new.id)
    from private.audience(new.course_id, new.class_id) a;
  end if;
  return new;
end $$;
create trigger assessment_published_notify after insert or update of status on public.assessments for each row execute function private.trg_assessment_published();

create or replace function private.trg_submission_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_a public.assignments;
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    select * into v_a from public.assignments where id = new.assignment_id;
    perform private.notify(new.user_id, 'submission_received', 'Submission received', v_a.title, '/learn/assignments/' || v_a.id, '{}'::jsonb);
    perform private.notify(v_a.created_by, 'submission_to_grade', 'New submission: ' || v_a.title,
      private.display_name(new.user_id) || case when new.is_late then ' (late)' else '' end,
      '/teach/assignments/' || v_a.id, jsonb_build_object('submission_id', new.id));
  elsif new.status = 'returned' and old.status is distinct from 'returned' then
    select * into v_a from public.assignments where id = new.assignment_id;
    perform private.notify(new.user_id, 'submission_returned', 'Work returned for correction', v_a.title, '/learn/assignments/' || v_a.id, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger submission_notify after insert or update of status on public.assignment_submissions for each row execute function private.trg_submission_notify();

create or replace function private.trg_grade_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_s public.assignment_submissions; v_title text;
begin
  if new.released then
    select * into v_s from public.assignment_submissions where id = new.submission_id;
    select title into v_title from public.assignments where id = v_s.assignment_id;
    perform private.notify(v_s.user_id, 'assignment_graded', 'Feedback on ' || v_title,
      'Score: ' || new.score::text, '/learn/assignments/' || v_s.assignment_id, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger grade_notify after insert or update on public.submission_grades for each row execute function private.trg_grade_notify();

create or replace function private.trg_live_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_title text; v_body text;
begin
  if tg_op = 'INSERT' then
    v_title := 'Live class scheduled: ' || new.title;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    v_title := 'Live class cancelled: ' || new.title; v_body := new.cancel_reason;
  elsif new.starts_at <> old.starts_at then
    v_title := 'Live class rescheduled: ' || new.title;
  else
    return new;
  end if;
  v_body := coalesce(v_body, to_char(new.starts_at at time zone 'Africa/Accra', 'Dy DD Mon YYYY, HH24:MI') || ' GMT');
  insert into public.notifications (user_id, type, title, body, link, data)
  select a.user_id, 'live_class', v_title, v_body, '/learn/live/' || new.id, jsonb_build_object('session_id', new.id)
  from private.audience(new.course_id, new.class_id) a where a.user_id <> new.host_id;
  return new;
end $$;
create trigger live_notify after insert or update on public.live_sessions for each row execute function private.trg_live_notify();

create or replace function private.trg_announcement_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, body, link, data)
  select x.user_id, 'announcement', new.title, left(new.body, 240), '/notifications', jsonb_build_object('announcement_id', new.id)
  from (
    select p.id as user_id from public.profiles p where new.scope = 'platform' and p.status = 'active'
    union select m.user_id from public.school_memberships m where new.scope = 'school' and m.school_id = new.school_id and m.status = 'active'
    union select a.user_id from private.audience(case when new.scope = 'course' then new.course_id end, case when new.scope = 'class' then new.class_id end) a
      where new.scope in ('course', 'class')
  ) x where x.user_id <> new.author_id;
  return new;
end $$;
create trigger announcement_notify after insert on public.announcements for each row execute function private.trg_announcement_notify();

create or replace function private.trg_reply_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.support_tickets;
begin
  select * into v_t from public.support_tickets where id = new.ticket_id;
  if not new.is_internal and new.author_id <> v_t.user_id then
    perform private.notify(v_t.user_id, 'support_reply', 'Support replied: ' || v_t.subject, left(new.body, 200), '/support/' || v_t.id, '{}'::jsonb);
    update public.support_tickets set status = 'awaiting_user' where id = v_t.id and status in ('open', 'in_progress');
  elsif new.author_id = v_t.user_id then
    update public.support_tickets set status = 'open', updated_at = now() where id = v_t.id and status = 'awaiting_user';
  end if;
  return new;
end $$;
create trigger reply_notify after insert on public.support_replies for each row execute function private.trg_reply_notify();

-- Deadline / upcoming reminders (scheduled hourly by pg_cron when available).
create or replace function private.send_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer := 0; v_c integer;
begin
  insert into public.notifications (user_id, type, title, body, link, data)
  select a.user_id, 'assignment_deadline', 'Due within 24 hours: ' || asg.title, null, '/learn/assignments/' || asg.id,
    jsonb_build_object('assignment_id', asg.id, 'reminder', 'due24')
  from public.assignments asg cross join lateral private.audience(asg.course_id, asg.class_id) a
  where asg.status = 'published' and asg.due_at between now() and now() + interval '24 hours'
    and not exists (select 1 from public.assignment_submissions s where s.assignment_id = asg.id and s.user_id = a.user_id and s.status in ('submitted', 'graded'))
    and not exists (select 1 from public.notifications n where n.user_id = a.user_id and n.type = 'assignment_deadline' and n.data ->> 'assignment_id' = asg.id::text);
  get diagnostics v_c = row_count; v_n := v_n + v_c;

  insert into public.notifications (user_id, type, title, body, link, data)
  select a.user_id, 'assessment_deadline', 'Closing within 24 hours: ' || asm.title, null, '/learn/assessments',
    jsonb_build_object('assessment_id', asm.id, 'reminder', 'close24')
  from public.assessments asm cross join lateral private.audience(asm.course_id, asm.class_id) a
  where asm.status = 'published' and asm.closes_at between now() and now() + interval '24 hours'
    and not exists (select 1 from public.assessment_attempts t where t.assessment_id = asm.id and t.user_id = a.user_id)
    and not exists (select 1 from public.notifications n where n.user_id = a.user_id and n.type = 'assessment_deadline' and n.data ->> 'assessment_id' = asm.id::text);
  get diagnostics v_c = row_count; v_n := v_n + v_c;

  insert into public.notifications (user_id, type, title, body, link, data)
  select a.user_id, 'live_class_soon', 'Starting within the hour: ' || s.title,
    to_char(s.starts_at at time zone 'Africa/Accra', 'HH24:MI') || ' GMT', '/learn/live/' || s.id,
    jsonb_build_object('session_id', s.id, 'reminder', 'soon')
  from public.live_sessions s cross join lateral private.audience(s.course_id, s.class_id) a
  where s.status = 'scheduled' and s.starts_at between now() and now() + interval '65 minutes'
    and not exists (select 1 from public.notifications n where n.user_id = a.user_id and n.type = 'live_class_soon' and n.data ->> 'session_id' = s.id::text);
  get diagnostics v_c = row_count; v_n := v_n + v_c;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('profjero-edu-reminders', '7 * * * *', 'select private.send_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;
