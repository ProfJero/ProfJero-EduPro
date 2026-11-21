-- =============================================================================
-- Discussion spaces: student-created discussions that are public (anyone with an
-- account, across classes and schools), for a class, or for a study group.
-- Each space is a full classroom room (board, replies, helpful votes, polls).
-- =============================================================================
create table public.discussion_spaces (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 140),
  body text check (char_length(body) <= 4000),
  subject text check (char_length(subject) <= 60),
  visibility text not null default 'public' check (visibility in ('public', 'class', 'group')),
  class_id uuid references public.school_classes (id) on delete cascade,
  group_id uuid references public.study_groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  is_locked boolean not null default false,
  is_pinned boolean not null default false,
  message_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((visibility = 'public' and class_id is null and group_id is null)
      or (visibility = 'class' and class_id is not null and group_id is null)
      or (visibility = 'group' and group_id is not null and class_id is null))
);
create index discussion_spaces_public_idx on public.discussion_spaces (last_activity_at desc) where visibility = 'public';
create index discussion_spaces_class_idx on public.discussion_spaces (class_id, last_activity_at desc);
create index discussion_spaces_group_idx on public.discussion_spaces (group_id, last_activity_at desc);
create index discussion_spaces_search_idx on public.discussion_spaces using gin (to_tsvector('english', title || ' ' || coalesce(body, '') || ' ' || coalesce(subject, '')));

create or replace function private.can_view_space(p_space uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.discussion_spaces s where s.id = p_space and (
    (s.visibility = 'public' and (select auth.uid()) is not null)
    or (s.visibility = 'class' and (private.is_class_member(s.class_id) or private.can_manage_class(s.class_id)))
    or (s.visibility = 'group' and (private.is_group_member(s.group_id) or private.can_manage_group(s.group_id)))
    or private.is_platform_admin()));
$$;
create or replace function private.can_moderate_space(p_space uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.discussion_spaces s where s.id = p_space and (
    s.created_by = (select auth.uid())
    or (s.class_id is not null and (private.can_manage_class(s.class_id) or private.leader_can(s.class_id, 'moderate_discussion')))
    or (s.group_id is not null and private.can_manage_group(s.group_id))
    or private.is_platform_admin()));
$$;

alter table public.discussion_spaces enable row level security;
-- Direct column checks (not a lookup by id) so INSERT … RETURNING works.
create policy spaces_select on public.discussion_spaces for select to authenticated using (
  created_by = (select auth.uid())
  or visibility = 'public'
  or (visibility = 'class' and (private.is_class_member(class_id) or private.can_manage_class(class_id)))
  or (visibility = 'group' and (private.is_group_member(group_id) or private.can_manage_group(group_id)))
  or (select private.is_platform_admin()));
create policy spaces_insert on public.discussion_spaces for insert to authenticated
  with check (created_by = (select auth.uid()) and not private.is_guest() and message_count = 0 and not is_pinned and (
    visibility = 'public'
    or (visibility = 'class' and private.is_class_member(class_id))
    or (visibility = 'group' and private.can_manage_group(group_id))));
create policy spaces_update on public.discussion_spaces for update to authenticated
  using (private.can_moderate_space(id)) with check (private.can_moderate_space(id));
create policy spaces_delete on public.discussion_spaces for delete to authenticated using (private.can_moderate_space(id));
grant select, insert, update, delete on public.discussion_spaces to authenticated;

-- Counters/pinning are only changed by moderators; creators cannot inflate counts.
create or replace function private.guard_space_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('app.space_counter', true), '') = 'on' then return new; end if;
  new.message_count := old.message_count; new.last_activity_at := old.last_activity_at;
  new.visibility := old.visibility; new.class_id := old.class_id; new.group_id := old.group_id; new.created_by := old.created_by;
  if new.is_pinned is distinct from old.is_pinned and not (
       (old.class_id is not null and private.can_manage_class(old.class_id)) or (old.group_id is not null and private.can_manage_group(old.group_id)) or private.is_platform_admin()) then
    new.is_pinned := old.is_pinned;
  end if;
  return new;
end $$;
create trigger discussion_spaces_guard before update on public.discussion_spaces for each row execute function private.guard_space_update();

-- Rooms: allow the 'space' type everywhere rooms are used.
alter table public.classroom_messages drop constraint if exists classroom_messages_room_type_check;
alter table public.classroom_messages add constraint classroom_messages_room_type_check check (room_type in ('course', 'class', 'session', 'group', 'space'));
alter table public.polls drop constraint if exists polls_room_type_check;
alter table public.polls add constraint polls_room_type_check check (room_type in ('course', 'class', 'session', 'group', 'space'));

create or replace function private.can_join_room(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'course' then private.is_enrolled(p_room) or private.can_manage_course(p_room) or private.teaches_course_class(p_room)
    when 'class' then private.is_class_member(p_room)
    when 'session' then private.can_view_session(p_room)
    when 'group' then private.is_group_member(p_room) or exists (select 1 from public.study_groups g where g.id = p_room and private.manages_scope(g.class_id, g.course_id))
    when 'space' then private.can_view_space(p_room) and not private.is_guest()
    else false end;
$$;
create or replace function private.can_moderate_room(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'course' then private.can_manage_course(p_room)
    when 'class' then private.can_manage_class(p_room) or private.leader_can(p_room, 'moderate_discussion')
    when 'session' then private.can_manage_session(p_room)
    when 'group' then private.can_manage_group(p_room)
    when 'space' then private.can_moderate_space(p_room)
    else false end;
$$;
create or replace function private.realtime_room_allowed(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_type text := split_part(p_topic, ':', 2);
  v_id text := split_part(p_topic, ':', 3);
begin
  if split_part(p_topic, ':', 1) <> 'room' or v_type not in ('course', 'class', 'session', 'group', 'space')
     or v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.can_join_room(v_type, v_id::uuid);
end $$;
create or replace function private.can_create_poll(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_moderate_room(p_type, p_room)
      or (p_type = 'class' and private.leader_can(p_room, 'create_polls'))
      or (p_type = 'group' and private.is_group_member(p_room));
$$;

-- Locked spaces accept no new messages; activity counters stay in sync.
create or replace function private.trg_space_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_s public.discussion_spaces; v_n integer;
begin
  if new.room_type <> 'space' then return new; end if;
  select * into v_s from public.discussion_spaces where id = new.room_id;
  if tg_op = 'INSERT' then
    if v_s.is_locked and not private.can_moderate_space(v_s.id) then raise exception 'This discussion is locked' using errcode = 'P0001'; end if;
    if new.kind = 'board' and not private.can_moderate_space(v_s.id) then raise exception 'Only the discussion starter can update the summary' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger classroom_messages_space_guard before insert on public.classroom_messages for each row execute function private.trg_space_message();

create or replace function private.trg_space_counter()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_room uuid := coalesce(new.room_id, old.room_id);
begin
  if coalesce(new.room_type, old.room_type) <> 'space' then return null; end if;
  perform set_config('app.space_counter', 'on', true);
  update public.discussion_spaces s set
    message_count = (select count(*) from public.classroom_messages m where m.room_type = 'space' and m.room_id = v_room and m.deleted_at is null and m.kind <> 'board'),
    last_activity_at = greatest(s.last_activity_at, coalesce(new.created_at, now()))
  where s.id = v_room;
  perform set_config('app.space_counter', '', true);
  if tg_op = 'INSERT' and new.parent_id is null and new.kind <> 'board' then
    perform private.notify(s.created_by, 'discussion', 'New reply in: ' || left(s.title, 80), left(new.body, 120), '/discussions/' || s.id, '{}'::jsonb)
    from public.discussion_spaces s where s.id = v_room and s.created_by <> new.user_id;
  end if;
  return null;
end $$;
create trigger classroom_messages_space_counter after insert or update of deleted_at on public.classroom_messages for each row execute function private.trg_space_counter();

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
  elsif p_type = 'space' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url,
        case when p.id = s.created_by then 'teacher' else 'learner' end::text
      from public.discussion_spaces s
      join public.profiles p on p.id = s.created_by or p.id in (select m.user_id from public.classroom_messages m where m.room_type = 'space' and m.room_id = s.id and m.deleted_at is null)
      where s.id = p_room
      limit 200;
  elsif p_type = 'group' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), p.full_name), p.avatar_url,
        case when m.role = 'leader' then 'teacher' else 'learner' end::text
      from public.study_group_members m join public.profiles p on p.id = m.user_id
      where m.group_id = p_room
      limit 200;
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


grant execute on all functions in schema private to anon, authenticated;
