-- Round 4 · Notify people about everything that concerns them: replies, questions,
-- board posts, group chat, @mentions, reactions, group changes, new discussions and
-- support requests. Chatty rooms are throttled so nobody is flooded.

-- Mentions are stored in message text as @[Name](user-uuid).
create or replace function private.plain_text(p_body text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(p_body, ''), '@\[([^\]]{1,80})\]\([0-9a-f-]{36}\)', '@\1', 'g');
$$;

create or replace function private.mentioned_users(p_body text)
returns uuid[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct m[1]::uuid), '{}') from (
    select regexp_matches(coalesce(p_body, ''), '@\[[^\]]{1,80}\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)', 'g') m limit 25) x;
$$;

-- Can this (other) user see the room? Used to decide who may be notified.
create or replace function private.user_in_room(p_type text, p_room uuid, p_user uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_s public.discussion_spaces;
begin
  if p_type = 'class' then
    return exists (select 1 from public.class_enrolments e where e.class_id = p_room and e.user_id = p_user and e.status = 'active')
        or private.user_teaches_class(p_room, p_user);
  elsif p_type = 'group' then
    return exists (select 1 from public.study_group_members m where m.group_id = p_room and m.user_id = p_user)
        or exists (select 1 from public.study_groups g where g.id = p_room and g.class_id is not null and private.user_teaches_class(g.class_id, p_user));
  elsif p_type = 'course' then
    return exists (select 1 from public.course_enrolments e where e.course_id = p_room and e.user_id = p_user and e.status in ('active', 'completed'))
        or exists (select 1 from public.courses c where c.id = p_room and c.owner_id = p_user)
        or exists (select 1 from public.course_instructors i where i.course_id = p_room and i.user_id = p_user);
  elsif p_type = 'session' then
    return exists (select 1 from public.live_sessions s where s.id = p_room and s.host_id = p_user)
        or exists (select 1 from private.session_audience(p_room) a where a.user_id = p_user);
  elsif p_type = 'space' then
    select * into v_s from public.discussion_spaces where id = p_room;
    if not found then return false; end if;
    return v_s.created_by = p_user or v_s.visibility = 'public'
        or (v_s.visibility = 'class' and private.user_in_room('class', v_s.class_id, p_user))
        or (v_s.visibility = 'group' and private.user_in_room('group', v_s.group_id, p_user));
  end if;
  return false;
end $$;

create or replace function private.room_label(p_type text, p_room uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(case p_type
    when 'class' then (select name from public.school_classes where id = p_room)
    when 'group' then (select name from public.study_groups where id = p_room)
    when 'course' then (select title from public.courses where id = p_room)
    when 'session' then (select title from public.live_sessions where id = p_room)
    when 'space' then (select title from public.discussion_spaces where id = p_room) end, 'your class');
$$;

create or replace function private.room_link(p_type text, p_room uuid, p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'class' then case when private.user_teaches_class(p_room, p_user) then '/teach/classes/' || p_room || '?tab=room' else '/learn/classes/' || p_room end
    when 'group' then '/connect/groups/' || p_room
    when 'course' then case when exists (select 1 from public.courses c where c.id = p_room and c.owner_id = p_user)
                              or exists (select 1 from public.course_instructors i where i.course_id = p_room and i.user_id = p_user)
                            then '/teach/courses/' || p_room else '/learn/courses/' || p_room end
    when 'session' then '/learn/live/' || p_room
    when 'space' then '/discussions/' || p_room
    else '/notifications' end;
$$;

-- Everyone who belongs to a room (for board posts) and the people who run it (for questions).
create or replace function private.room_people(p_type text, p_room uuid, p_managers_only boolean)
returns table (user_id uuid) language sql stable security definer set search_path = '' as $$
  select ct.user_id from public.class_teachers ct where p_type = 'class' and ct.class_id = p_room
  union select c.owner_id from public.school_classes c where p_type = 'class' and c.id = p_room and c.owner_id is not null
  union select e.user_id from public.class_enrolments e where p_type = 'class' and not p_managers_only and e.class_id = p_room and e.status = 'active'
  union select m.user_id from public.study_group_members m where p_type = 'group' and m.group_id = p_room and (not p_managers_only or m.role = 'leader')
  union select c.owner_id from public.courses c where p_type = 'course' and c.id = p_room
  union select i.user_id from public.course_instructors i where p_type = 'course' and i.course_id = p_room
  union select e.user_id from public.course_enrolments e where p_type = 'course' and not p_managers_only and e.course_id = p_room and e.status = 'active'
  union select s.host_id from public.live_sessions s where p_type = 'session' and s.id = p_room
  union select a.user_id from private.session_audience(p_room) a where p_type = 'session' and not p_managers_only;
$$;

create or replace function private.trg_message_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_done uuid[] := array[new.user_id];
  v_target uuid;
  v_who text := coalesce(nullif(new.author_name, ''), private.display_name(new.user_id));
  v_label text := private.room_label(new.room_type, new.room_id);
  v_text text := left(private.plain_text(new.body), 160);
  v_parent public.classroom_messages;
  v_data jsonb := jsonb_build_object('room_type', new.room_type, 'room_id', new.room_id, 'message_id', new.id);
begin
  if new.deleted_at is not null then return null; end if;

  -- 1. @mentions
  foreach v_target in array private.mentioned_users(new.body) loop
    if not v_target = any (v_done) and private.user_in_room(new.room_type, new.room_id, v_target) then
      perform private.notify(v_target, 'mention', v_who || ' mentioned you in ' || left(v_label, 60), v_text,
        private.room_link(new.room_type, new.room_id, v_target), v_data);
      v_done := v_done || v_target;
    end if;
  end loop;

  -- 2. Replies: the person who asked, then others in the thread.
  if new.parent_id is not null then
    select * into v_parent from public.classroom_messages where id = new.parent_id;
    if v_parent.id is not null and not v_parent.user_id = any (v_done) and v_parent.deleted_at is null then
      perform private.notify(v_parent.user_id, 'reply',
        v_who || case when v_parent.kind = 'question' then ' answered your question' else ' replied to you' end || ' · ' || left(v_label, 50),
        v_text, private.room_link(new.room_type, new.room_id, v_parent.user_id), v_data);
      v_done := v_done || v_parent.user_id;
    end if;
    for v_target in
      select distinct m.user_id from public.classroom_messages m
      where m.parent_id = new.parent_id and m.id <> new.id and m.deleted_at is null and not m.user_id = any (v_done) limit 30
    loop
      perform private.notify(v_target, 'reply', v_who || ' also replied in a thread you joined', v_text,
        private.room_link(new.room_type, new.room_id, v_target), v_data);
      v_done := v_done || v_target;
    end loop;
    return null;
  end if;

  if new.room_type = 'space' then return null; end if; -- discussion owners are notified by the space counter

  -- 3. Board posts reach the whole room.
  if new.kind = 'board' then
    insert into public.notifications (user_id, type, title, body, link, data)
    select p.user_id, 'board', 'New on the board · ' || left(v_label, 60), v_text, private.room_link(new.room_type, new.room_id, p.user_id), v_data
    from private.room_people(new.room_type, new.room_id, false) p where p.user_id is not null and not p.user_id = any (v_done);
    return null;
  end if;

  -- 4. Questions go to the people who run the room.
  if new.kind = 'question' then
    insert into public.notifications (user_id, type, title, body, link, data)
    select p.user_id, 'question', v_who || ' asked a question · ' || left(v_label, 50), v_text, private.room_link(new.room_type, new.room_id, p.user_id), v_data
    from private.room_people(new.room_type, new.room_id, true) p where p.user_id is not null and not p.user_id = any (v_done);
    return null;
  end if;

  -- 5. Ordinary chat: group members (or class/course teachers), at most one unread alert per room every 2 hours.
  insert into public.notifications (user_id, type, title, body, link, data)
  select p.user_id, 'chat', 'New messages in ' || left(v_label, 60), v_who || ': ' || v_text, private.room_link(new.room_type, new.room_id, p.user_id), v_data
  from private.room_people(new.room_type, new.room_id, new.room_type <> 'group') p
  where p.user_id is not null and not p.user_id = any (v_done)
    and not exists (select 1 from public.notifications n where n.user_id = p.user_id and n.type = 'chat' and n.read_at is null
                    and n.data ->> 'room_id' = new.room_id::text and n.created_at > now() - interval '2 hours');
  return null;
end $$;
create trigger classroom_messages_notify after insert on public.classroom_messages for each row execute function private.trg_message_notify();

-- The discussion counter's reply alert should show readable text, not mention tokens.
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
    perform private.notify(s.created_by, 'discussion', 'New reply in: ' || left(s.title, 80), left(private.plain_text(new.body), 120), '/discussions/' || s.id,
      jsonb_build_object('room_type', 'space', 'room_id', s.id, 'message_id', new.id))
    from public.discussion_spaces s where s.id = v_room and s.created_by <> new.user_id
      and not s.created_by = any (private.mentioned_users(new.body));
  end if;
  return null;
end $$;

-- New class/group discussions reach the members; mentions in the opening post too.
create or replace function private.trg_space_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_done uuid[] := array[new.created_by]; v_target uuid; v_who text := private.display_name(new.created_by);
begin
  foreach v_target in array private.mentioned_users(new.body) loop
    if not v_target = any (v_done) and private.user_in_room('space', new.id, v_target) then
      perform private.notify(v_target, 'mention', v_who || ' mentioned you in a discussion', left(new.title, 120), '/discussions/' || new.id, jsonb_build_object('room_type', 'space', 'room_id', new.id));
      v_done := v_done || v_target;
    end if;
  end loop;
  if new.visibility in ('class', 'group') then
    insert into public.notifications (user_id, type, title, body, link, data)
    select p.user_id, 'discussion', 'New discussion: ' || left(new.title, 90), v_who || ' started a discussion in ' || private.room_label(new.visibility, coalesce(new.class_id, new.group_id)),
      '/discussions/' || new.id, jsonb_build_object('room_type', 'space', 'room_id', new.id)
    from private.room_people(new.visibility, coalesce(new.class_id, new.group_id), false) p
    where p.user_id is not null and not p.user_id = any (v_done);
  end if;
  return new;
end $$;
create trigger discussion_spaces_notify after insert on public.discussion_spaces for each row execute function private.trg_space_created();

-- Helpful reactions (once per message per day).
create or replace function private.trg_reaction_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_m public.classroom_messages;
begin
  select * into v_m from public.classroom_messages where id = new.message_id;
  if v_m.id is null or v_m.user_id = new.user_id then return null; end if;
  if exists (select 1 from public.notifications n where n.user_id = v_m.user_id and n.type = 'reaction' and n.data ->> 'message_id' = v_m.id::text
             and n.created_at > now() - interval '1 day') then return null; end if;
  perform private.notify(v_m.user_id, 'reaction',
    private.display_name(new.user_id) || case new.kind when 'thanks' then ' thanked you 🙏' when 'insightful' then ' found your message insightful 💡' else ' found your message helpful 👍' end,
    left(private.plain_text(v_m.body), 120), private.room_link(v_m.room_type, v_m.room_id, v_m.user_id),
    jsonb_build_object('room_type', v_m.room_type, 'room_id', v_m.room_id, 'message_id', v_m.id));
  return null;
end $$;
create trigger message_reactions_notify after insert on public.message_reactions for each row execute function private.trg_reaction_notify();

-- Group membership changes.
create or replace function private.trg_group_member_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_g public.study_groups; v_actor uuid := (select auth.uid());
begin
  select * into v_g from public.study_groups where id = coalesce(new.group_id, old.group_id);
  if v_g.id is null then return null; end if;
  if tg_op = 'INSERT' then
    if v_actor is not null and v_actor <> new.user_id then
      perform private.notify(new.user_id, 'group', 'You were added to ' || left(v_g.name, 80), 'Say hello to your group.', '/connect/groups/' || v_g.id, jsonb_build_object('group_id', v_g.id));
    elsif new.user_id <> v_g.created_by then
      insert into public.notifications (user_id, type, title, body, link, data)
      select m.user_id, 'group', private.display_name(new.user_id) || ' joined ' || left(v_g.name, 80), null, '/connect/groups/' || v_g.id, jsonb_build_object('group_id', v_g.id)
      from public.study_group_members m where m.group_id = v_g.id and m.role = 'leader' and m.user_id <> new.user_id;
    end if;
  elsif tg_op = 'UPDATE' and new.role = 'leader' and old.role <> 'leader' then
    perform private.notify(new.user_id, 'group', 'You are now a leader of ' || left(v_g.name, 80), 'You can add members, schedule group live classes and start discussions.', '/connect/groups/' || v_g.id, jsonb_build_object('group_id', v_g.id));
  elsif tg_op = 'DELETE' and v_actor is not null and v_actor <> old.user_id then
    perform private.notify(old.user_id, 'group', 'You were moved out of ' || left(v_g.name, 80), null, '/learn/classes/' || coalesce(v_g.class_id::text, ''), jsonb_build_object('group_id', v_g.id));
  end if;
  return null;
end $$;
create trigger study_group_members_notify after insert or update of role or delete on public.study_group_members
  for each row execute function private.trg_group_member_notify();

-- Platform staff hear about new support requests, contact messages and teacher applications.
create or replace function private.notify_admins(p_type text, p_title text, p_body text, p_link text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link, data)
  select distinct r.user_id, p_type, p_title, p_body, p_link, coalesce(p_data, '{}'::jsonb)
  from public.user_roles r where r.role in ('platform_admin', 'owner');
$$;

create or replace function private.trg_ticket_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_admins('support_new', 'New help request: ' || left(new.subject, 90),
    private.official_name(new.user_id) || ' · ' || left(coalesce(new.description, ''), 140), '/admin/support', jsonb_build_object('ticket_id', new.id));
  return null;
end $$;
create trigger support_tickets_notify after insert on public.support_tickets for each row execute function private.trg_ticket_created();

create or replace function private.trg_ticket_reply_admins()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.support_tickets;
begin
  select * into v_t from public.support_tickets where id = new.ticket_id;
  if new.author_id = v_t.user_id then
    perform private.notify_admins('support_new', 'New reply on: ' || left(v_t.subject, 90), left(new.body, 160), '/admin/support', jsonb_build_object('ticket_id', v_t.id));
  end if;
  return null;
end $$;
create trigger support_replies_notify_admins after insert on public.support_replies for each row execute function private.trg_ticket_reply_admins();

create or replace function private.trg_contact_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_admins('contact', 'New message from ' || left(new.name, 60), left(new.message, 160), '/admin/inbox', jsonb_build_object('contact_id', new.id));
  return null;
end $$;
create trigger contact_messages_notify after insert on public.contact_messages for each row execute function private.trg_contact_created();

create or replace function private.trg_application_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_admins('teacher_application', 'Teacher application: ' || private.official_name(new.user_id), left(new.expertise, 160), '/admin/teachers',
    jsonb_build_object('application_id', new.id));
  return null;
end $$;
create trigger instructor_applications_notify after insert on public.instructor_applications for each row execute function private.trg_application_created();

revoke execute on function private.user_in_room(text, uuid, uuid), private.room_label(text, uuid), private.room_link(text, uuid, uuid),
  private.room_people(text, uuid, boolean), private.notify_admins(text, text, text, text, jsonb) from public, anon, authenticated;
