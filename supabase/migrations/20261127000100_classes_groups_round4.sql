-- Round 4 · Classes: school-class sections, official names, roster, groups (one per class,
-- management, auto-split) and group-only live classes.

-- ---------------------------------------------------------------------------
-- Names: teachers see the official full name; classmates see the display name.
-- ---------------------------------------------------------------------------
create or replace function private.official_name(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), 'Learner') from public.profiles p where p.id = p_user;
$$;
create or replace function private.member_name(p_user uuid, p_official boolean)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_official then private.official_name(p_user) else private.display_name(p_user) end;
$$;

-- ---------------------------------------------------------------------------
-- Sections: the real school classes a ProfJero class is made of
-- (e.g. "General Arts A2", "Science B2" inside "Ctrl + Alt + Learn").
-- ---------------------------------------------------------------------------
create table public.class_sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);
create index class_sections_class_idx on public.class_sections (class_id, position);
alter table public.class_sections enable row level security;
create policy class_sections_select on public.class_sections for select to authenticated using (private.is_class_member(class_id));
create policy class_sections_write on public.class_sections for all to authenticated
  using (private.can_manage_class(class_id)) with check (private.can_manage_class(class_id));
grant select, insert, update, delete on public.class_sections to authenticated;

alter table public.class_enrolments add column if not exists section_id uuid references public.class_sections (id) on delete set null;
create index if not exists class_enrolments_section_idx on public.class_enrolments (section_id);
alter table public.school_classes add column if not exists ask_section boolean not null default true;

-- Section changes must not re-run course enrolment logic.
drop trigger if exists class_enrolments_courses on public.class_enrolments;
create trigger class_enrolments_courses after insert or update of status on public.class_enrolments
  for each row execute function private.on_class_enrolment();

create or replace function public.set_class_section(p_class uuid, p_section uuid, p_user uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_target uuid := coalesce(p_user, v_uid);
begin
  if v_target <> v_uid and not private.can_manage_class(p_class) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_section is not null and not exists (select 1 from public.class_sections s where s.id = p_section and s.class_id = p_class) then
    raise exception 'That section is not part of this class' using errcode = '22023';
  end if;
  update public.class_enrolments set section_id = p_section where class_id = p_class and user_id = v_target and status = 'active';
  if not found then raise exception 'Not an active member of this class' using errcode = 'P0002'; end if;
end $$;

create or replace function public.my_class_section(p_class uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select e.section_id from public.class_enrolments e where e.class_id = p_class and e.user_id = (select auth.uid()) and e.status = 'active';
$$;

create or replace function private.is_class_leader(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_leaders l join public.class_enrolments e on e.class_id = l.class_id and e.user_id = l.user_id and e.status = 'active'
                 where l.class_id = p_class and l.user_id = (select auth.uid()));
$$;

-- Full class register for teachers (and class leaders): official names, section, group, leadership.
create or replace function public.class_roster(p_class uuid)
returns table (user_id uuid, full_name text, display_name text, avatar_url text, section_id uuid, section_name text,
               group_id uuid, group_name text, group_role text, leader_title text, joined_at timestamptz, last_seen_at timestamptz, is_guest boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.can_manage_class(p_class) or private.is_class_leader(p_class)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select e.user_id, private.official_name(e.user_id), nullif(btrim(p.display_name), ''), p.avatar_url, e.section_id, s.name,
      g.id, g.name, g.role, l.title, e.created_at, p.last_seen_at, coalesce(u.is_anonymous, false)
    from public.class_enrolments e
    join public.profiles p on p.id = e.user_id
    left join auth.users u on u.id = e.user_id
    left join public.class_sections s on s.id = e.section_id
    left join public.class_leaders l on l.class_id = e.class_id and l.user_id = e.user_id
    left join lateral (select sg.id, sg.name, m.role from public.study_group_members m join public.study_groups sg on sg.id = m.group_id
                       where m.user_id = e.user_id and sg.class_id = e.class_id order by m.joined_at limit 1) g on true
    where e.class_id = p_class and e.status = 'active'
    order by 2;
end $$;

-- Progress table uses official names for teachers.
create or replace function public.class_progress(p_class uuid)
returns table (user_id uuid, name text, avatar_url text, avg_progress numeric, last_activity_at timestamptz, attendance_rate numeric, submissions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.can_manage_class(p_class) or private.leader_can(p_class, 'view_progress')) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select e.user_id, private.official_name(e.user_id), (select p.avatar_url from public.profiles p where p.id = e.user_id),
      (select round(avg(ce.progress_pct), 1) from public.course_enrolments ce where ce.user_id = e.user_id and ce.class_id = p_class),
      (select max(ce.last_activity_at) from public.course_enrolments ce where ce.user_id = e.user_id),
      (select round(100.0 * avg(case when a.status in ('present', 'late') then 1 else 0 end), 1) from public.class_attendance a where a.class_id = p_class and a.user_id = e.user_id),
      (select count(*) from public.assignment_submissions s join public.assignments asg on asg.id = s.assignment_id where asg.class_id = p_class and s.user_id = e.user_id and s.status in ('submitted', 'graded'))
    from public.class_enrolments e where e.class_id = p_class and e.status = 'active' order by 2;
end $$;

-- ---------------------------------------------------------------------------
-- Groups: one group per learner per class; teacher/leader management.
-- ---------------------------------------------------------------------------
create or replace function private.user_teaches_class(p_class uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.school_classes c where c.id = p_class and (c.owner_id = p_user
    or exists (select 1 from public.class_teachers ct where ct.class_id = c.id and ct.user_id = p_user)));
$$;

create or replace function private.guard_one_group()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_class uuid; v_other text;
begin
  select class_id into v_class from public.study_groups where id = new.group_id;
  if v_class is null or private.user_teaches_class(v_class, new.user_id) then return new; end if;
  select g.name into v_other from public.study_group_members m join public.study_groups g on g.id = m.group_id
    where m.user_id = new.user_id and g.class_id = v_class and g.id <> new.group_id limit 1;
  if v_other is not null then
    raise exception 'Already in the group "%" in this class. Leave that group first, then join another.', v_other using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger study_group_members_one_per_class before insert on public.study_group_members
  for each row execute function private.guard_one_group();

-- Teachers who create groups manage them without becoming members.
create or replace function private.on_group_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.class_id is not null and private.user_teaches_class(new.class_id, new.created_by) then return new; end if;
  insert into public.study_group_members (group_id, user_id, role) values (new.id, new.created_by, 'leader') on conflict do nothing;
  return new;
end $$;

-- Add or move a learner into a group (teachers and leaders with "manage groups" can move
-- people between groups; group leaders can add people who are not yet in a group).
create or replace function public.assign_group_member(p_group uuid, p_user uuid, p_role text default 'member')
returns void language plpgsql security definer set search_path = '' as $$
declare v_g public.study_groups; v_count integer;
begin
  perform private.require_user();
  if p_role not in ('member', 'leader') then raise exception 'Unknown role' using errcode = '22023'; end if;
  select * into v_g from public.study_groups where id = p_group;
  if not found or not private.can_manage_group(p_group) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_g.class_id is not null then
    if not exists (select 1 from public.class_enrolments e where e.class_id = v_g.class_id and e.user_id = p_user and e.status = 'active') then
      raise exception 'That person is not an active member of this class' using errcode = 'P0001';
    end if;
    if private.manages_scope(v_g.class_id, null) then
      delete from public.study_group_members m using public.study_groups x
        where x.id = m.group_id and x.class_id = v_g.class_id and m.user_id = p_user and m.group_id <> p_group;
    end if;
  end if;
  if not exists (select 1 from public.study_group_members where group_id = p_group and user_id = p_user) then
    select count(*) into v_count from public.study_group_members where group_id = p_group;
    if v_count >= v_g.max_members then raise exception 'This group is full (% members)', v_g.max_members using errcode = 'P0001'; end if;
  end if;
  insert into public.study_group_members (group_id, user_id, role) values (p_group, p_user, p_role)
    on conflict (group_id, user_id) do update set role = excluded.role;
end $$;

-- Split the learners who are not yet in a group into N new groups (optionally one set per section).
create or replace function public.auto_group_class(p_class uuid, p_groups integer, p_prefix text default 'Group', p_by_section boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_sec record; v_ids uuid[]; v_gid uuid; v_n integer := 0; i integer; v_learner record; v_label text;
begin
  if not private.can_manage_class(p_class) then raise exception 'Only teachers can auto-split a class into groups' using errcode = '42501'; end if;
  if p_groups < 1 or p_groups > 40 then raise exception 'Choose between 1 and 40 groups' using errcode = '22023'; end if;
  for v_sec in
    select s.id, s.name from public.class_sections s where p_by_section and s.class_id = p_class
    union all select null::uuid, null::text where not p_by_section
  loop
    v_ids := '{}';
    for i in 1..p_groups loop
      v_label := btrim(coalesce(nullif(btrim(p_prefix), ''), 'Group') || ' ' || i || coalesce(' · ' || v_sec.name, ''));
      insert into public.study_groups (class_id, name, visibility, max_members, created_by)
      values (p_class, left(v_label, 80), 'invite', 100, v_uid) returning id into v_gid;
      v_ids := v_ids || v_gid;
    end loop;
    i := 0;
    for v_learner in
      select e.user_id from public.class_enrolments e
      where e.class_id = p_class and e.status = 'active' and (v_sec.id is null or e.section_id = v_sec.id)
        and not private.user_teaches_class(p_class, e.user_id)
        and not exists (select 1 from public.study_group_members m join public.study_groups g on g.id = m.group_id where m.user_id = e.user_id and g.class_id = p_class)
      order by random()
    loop
      insert into public.study_group_members (group_id, user_id) values (v_ids[(i % p_groups) + 1], v_learner.user_id);
      i := i + 1; v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Group live classes: visible only to members of the group.
-- ---------------------------------------------------------------------------
alter table public.live_sessions add column if not exists group_id uuid references public.study_groups (id) on delete cascade;
create index if not exists live_sessions_group_idx on public.live_sessions (group_id, starts_at);
alter table public.live_sessions drop constraint if exists live_sessions_check;
alter table public.live_sessions add constraint live_sessions_check check (course_id is not null or class_id is not null or group_id is not null);
alter table public.live_sessions add constraint live_sessions_group_only check (group_id is null or (course_id is null and class_id is null));

create or replace function private.session_audience(p_session uuid)
returns table (user_id uuid) language sql stable security definer set search_path = '' as $$
  select a.user_id from public.live_sessions s cross join lateral private.audience(s.course_id, s.class_id) a where s.id = p_session
  union
  select m.user_id from public.live_sessions s join public.study_group_members m on m.group_id = s.group_id where s.id = p_session;
$$;

create or replace function private.can_manage_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.live_sessions s where s.id = p_session and (
      s.host_id = (select auth.uid())
      or (s.course_id is not null and private.can_manage_course(s.course_id))
      or (s.class_id is not null and private.can_manage_class(s.class_id))
      or (s.group_id is not null and private.can_manage_group(s.group_id))
      or private.is_platform_admin()));
$$;

create or replace function private.can_view_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_session(p_session) or exists (
    select 1 from public.live_sessions s where s.id = p_session and (
      private.session_scope_ok(s.course_id, s.class_id)
      or (s.group_id is not null and private.is_group_member(s.group_id))));
$$;

drop policy if exists live_insert on public.live_sessions;
create policy live_insert on public.live_sessions for insert to authenticated
  with check (host_id = (select auth.uid()) and (
    (course_id is not null and private.can_manage_course(course_id))
    or (class_id is not null and private.can_manage_class(class_id))
    or (group_id is not null and (private.is_group_member(group_id) or private.can_manage_group(group_id)))));

create or replace function private.trg_live_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_title text; v_body text; v_label text;
begin
  v_label := case when new.group_id is not null then 'Group live class' else 'Live class' end;
  if tg_op = 'INSERT' then
    v_title := v_label || ' scheduled: ' || new.title;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    v_title := v_label || ' cancelled: ' || new.title; v_body := new.cancel_reason;
  elsif new.starts_at <> old.starts_at then
    v_title := v_label || ' rescheduled: ' || new.title;
  else
    return new;
  end if;
  v_body := coalesce(v_body, to_char(new.starts_at at time zone 'Africa/Accra', 'Dy DD Mon YYYY, HH24:MI') || ' GMT'
    || coalesce(' · ' || (select g.name from public.study_groups g where g.id = new.group_id), ''));
  insert into public.notifications (user_id, type, title, body, link, data)
  select a.user_id, 'live_class', v_title, v_body, '/learn/live/' || new.id, jsonb_build_object('session_id', new.id)
  from private.session_audience(new.id) a where a.user_id <> new.host_id;
  return new;
end $$;

create or replace function public.my_calendar(p_from timestamptz, p_to timestamptz)
returns table (kind text, id uuid, title text, starts_at timestamptz, ends_at timestamptz, context text, link text, status text)
language sql stable security definer set search_path = '' as $$
  select 'live', s.id, s.title, s.starts_at, s.starts_at + make_interval(mins => s.duration_minutes), coalesce(c.title, k.name, g.name), '/learn/live/' || s.id, s.status
  from public.live_sessions s left join public.courses c on c.id = s.course_id left join public.school_classes k on k.id = s.class_id
    left join public.study_groups g on g.id = s.group_id
  where s.starts_at between p_from and p_to and private.can_view_session(s.id)
  union all
  select 'assignment', a.id, a.title, a.due_at, a.due_at, coalesce(c.title, k.name),
    case when private.can_manage_assignment(a.id) then '/teach/assignments/' || a.id else '/learn/assignments/' || a.id end, a.status::text
  from public.assignments a left join public.courses c on c.id = a.course_id left join public.school_classes k on k.id = a.class_id
  where a.due_at between p_from and p_to and a.status = 'published' and (private.can_submit_assignment(a.id) or private.can_manage_assignment(a.id))
  union all
  select 'assessment', a.id, a.title, coalesce(a.closes_at, a.opens_at), a.closes_at, coalesce(c.title, k.name),
    case when private.can_manage_assessment(a.id) then '/teach/assessments/' || a.id else '/learn/assessments/' || a.id end, a.status::text
  from public.assessments a left join public.courses c on c.id = a.course_id left join public.school_classes k on k.id = a.class_id
  where coalesce(a.closes_at, a.opens_at) between p_from and p_to and a.status = 'published' and (private.can_take_assessment(a.id) or private.can_manage_assessment(a.id))
  union all
  select 'event:' || e.kind, e.id, e.title, e.starts_at, e.ends_at, coalesce(k.name, c.title) || coalesce(' · ' || e.location, ''),
    case when e.class_id is not null then (case when private.can_manage_class(e.class_id) then '/teach/classes/' else '/learn/classes/' end) || e.class_id
         else (case when private.can_manage_course(e.course_id) then '/teach/courses/' else '/learn/courses/' end) || e.course_id end,
    case when e.is_cancelled then 'cancelled' else 'scheduled' end
  from public.class_events e left join public.school_classes k on k.id = e.class_id left join public.courses c on c.id = e.course_id
  where e.starts_at between p_from and p_to
    and (e.created_by = (select auth.uid()) or private.in_scope(e.class_id, e.course_id) or (e.class_id is not null and private.can_manage_class(e.class_id)))
  union all
  select 'term', t.id, t.name || ' begins', t.starts_on::timestamptz, t.ends_on::timestamptz, sc.name, null, null
  from public.academic_terms t join public.schools sc on sc.id = t.school_id
  where t.starts_on between p_from::date and p_to::date and private.is_school_member(t.school_id)
  order by 4;
$$;

CREATE OR REPLACE FUNCTION public.room_members(p_type text, p_room uuid)
 RETURNS TABLE(user_id uuid, name text, avatar_url text, member_role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_official boolean;
begin
  perform private.require_user();
  if not private.can_join_room(p_type, p_room) then
    raise exception 'You are not a member of this classroom' using errcode = '42501';
  end if;
  -- Teachers and moderators see learners' official names; classmates see display names.
  v_official := private.can_moderate_room(p_type, p_room);
  if p_type = 'course' then
    return query
      select p.id, private.member_name(p.id, v_official), p.avatar_url, 'teacher'::text
      from public.profiles p where p.id in (
        select c.owner_id from public.courses c where c.id = p_room
        union select i.user_id from public.course_instructors i where i.course_id = p_room)
      union
      select p.id, private.member_name(p.id, v_official), p.avatar_url, 'learner'
      from public.course_enrolments e join public.profiles p on p.id = e.user_id
      where e.course_id = p_room and e.status in ('active', 'completed')
        and e.user_id not in (select c.owner_id from public.courses c where c.id = p_room
                              union select i.user_id from public.course_instructors i where i.course_id = p_room)
      limit 500;
  elsif p_type = 'class' then
    return query
      select p.id, private.member_name(p.id, v_official), p.avatar_url, 'teacher'::text
      from public.class_teachers ct join public.profiles p on p.id = ct.user_id where ct.class_id = p_room
      union
      select p.id, private.member_name(p.id, v_official), p.avatar_url, 'learner'
      from public.class_enrolments ce join public.profiles p on p.id = ce.user_id
      where ce.class_id = p_room and ce.status = 'active'
      limit 500;
  elsif p_type = 'space' then
    return query
      select p.id, private.member_name(p.id, v_official), p.avatar_url,
        case when p.id = s.created_by then 'teacher' else 'learner' end::text
      from public.discussion_spaces s
      join public.profiles p on p.id = s.created_by or p.id in (select m.user_id from public.classroom_messages m where m.room_type = 'space' and m.room_id = s.id and m.deleted_at is null)
      where s.id = p_room
      limit 200;
  elsif p_type = 'group' then
    return query
      select p.id, private.member_name(p.id, v_official), p.avatar_url,
        case when m.role = 'leader' then 'teacher' else 'learner' end::text
      from public.study_group_members m join public.profiles p on p.id = m.user_id
      where m.group_id = p_room
      limit 200;
  else
    return query
      select p.id, private.member_name(p.id, v_official), p.avatar_url, 'teacher'::text
      from public.live_sessions s join public.profiles p on p.id = s.host_id where s.id = p_room
      union
      select p.id, private.member_name(p.id, v_official), p.avatar_url, 'learner'
      from public.live_sessions s
      join private.session_audience(s.id) a on true
      join public.profiles p on p.id = a.user_id
      where s.id = p_room and a.user_id <> s.host_id
      limit 500;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION private.send_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  from public.live_sessions s cross join lateral private.session_audience(s.id) a
  where s.status = 'scheduled' and s.starts_at between now() and now() + interval '65 minutes'
    and not exists (select 1 from public.notifications n where n.user_id = a.user_id and n.type = 'live_class_soon' and n.data ->> 'session_id' = s.id::text);
  get diagnostics v_c = row_count; v_n := v_n + v_c;
  return v_n;
end $function$;

revoke execute on function private.official_name(uuid), private.member_name(uuid, boolean), private.is_class_leader(uuid),
  private.user_teaches_class(uuid, uuid), private.session_audience(uuid) from public, anon;
grant execute on function public.set_class_section(uuid, uuid, uuid), public.my_class_section(uuid), public.class_roster(uuid),
  public.assign_group_member(uuid, uuid, text), public.auto_group_class(uuid, integer, text, boolean) to authenticated;
revoke execute on function public.set_class_section(uuid, uuid, uuid), public.my_class_section(uuid), public.class_roster(uuid),
  public.assign_group_member(uuid, uuid, text), public.auto_group_class(uuid, integer, text, boolean) from anon;
