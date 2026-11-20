-- Study-group rooms list their members (leaders shown as moderators).
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
