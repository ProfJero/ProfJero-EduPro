-- =============================================================================
-- 0008 Course people: co-instructors and enrolment by email
-- =============================================================================

create or replace function public.add_course_instructor(p_course uuid, p_email text, p_role text default 'instructor')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_school uuid;
begin
  perform private.require_user();
  if not private.can_manage_course(p_course) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_role not in ('lead', 'instructor', 'assistant') then raise exception 'Invalid role' using errcode = '22023'; end if;
  select u.id into v_user from auth.users u where u.email = lower(btrim(p_email));
  if v_user is null then raise exception 'No ProfJero Edu account uses that email. Ask them to sign up first.' using errcode = 'P0002'; end if;
  select school_id into v_school from public.courses where id = p_course;
  -- School courses: co-teachers must be staff of that school. Independent: must be an instructor.
  if v_school is not null and not exists (
      select 1 from public.school_memberships m where m.school_id = v_school and m.user_id = v_user and m.status = 'active' and m.role in ('teacher', 'school_admin')) then
    raise exception 'Co-teachers of a school course must be teachers at that school' using errcode = '42501';
  elsif v_school is null and not exists (select 1 from public.user_roles r where r.user_id = v_user and r.role in ('teacher', 'platform_admin', 'owner')) then
    raise exception 'That person is not an approved instructor yet' using errcode = '42501';
  end if;
  insert into public.course_instructors (course_id, user_id, role) values (p_course, v_user, p_role)
  on conflict (course_id, user_id) do update set role = excluded.role;
  perform private.notify(v_user, 'course_instructor', 'You were added as a co-instructor', (select title from public.courses where id = p_course), '/teach/courses/' || p_course, '{}'::jsonb);
end $$;

-- Enrol existing accounts by email into a course the caller manages.
-- Returns counts only (does not reveal which emails have accounts).
create or replace function public.enrol_by_email(p_course uuid, p_emails text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_email text;
  v_user uuid;
  v_ok integer := 0;
  v_missing integer := 0;
  v_school uuid;
begin
  if not private.can_manage_course(p_course) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if cardinality(p_emails) > 300 then raise exception 'Up to 300 emails at a time' using errcode = '22023'; end if;
  select school_id into v_school from public.courses where id = p_course;
  foreach v_email in array p_emails loop
    select u.id into v_user from auth.users u where u.email = lower(btrim(v_email));
    if v_user is null then
      v_missing := v_missing + 1;
    else
      insert into public.course_enrolments (course_id, user_id, source, enrolled_by, school_id)
      values (p_course, v_user, 'teacher', v_uid, v_school)
      on conflict (course_id, user_id) do update set status = 'active' where public.course_enrolments.status = 'dropped';
      v_ok := v_ok + 1;
    end if;
  end loop;
  perform private.audit('course.enrolled_by_email', 'course', p_course::text, jsonb_build_object('enrolled', v_ok, 'not_found', v_missing), v_school);
  return jsonb_build_object('enrolled', v_ok, 'not_found', v_missing);
end $$;

-- Instructor names for a course team (managers only).
create or replace function public.course_team(p_course uuid)
returns table (user_id uuid, name text, avatar_url text, role text, is_owner boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_course(p_course) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url, coalesce(i.role, 'lead'), p.id = c.owner_id
    from public.courses c
    join public.profiles p on p.id = c.owner_id or p.id in (select i2.user_id from public.course_instructors i2 where i2.course_id = c.id)
    left join public.course_instructors i on i.course_id = c.id and i.user_id = p.id
    where c.id = p_course;
end $$;

revoke execute on function public.add_course_instructor(uuid, text, text), public.enrol_by_email(uuid, text[]), public.course_team(uuid) from public, anon;
grant execute on function public.add_course_instructor(uuid, text, text), public.enrol_by_email(uuid, text[]), public.course_team(uuid) to authenticated;
