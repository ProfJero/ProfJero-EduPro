-- =============================================================================
-- 0007 Realtime authorization for classroom presence & broadcast channels.
-- Private channels named  room:<course|class|session>:<uuid>  are only
-- joinable by members of that classroom (same rule as classroom_messages).
-- =============================================================================

create or replace function private.realtime_room_allowed(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_type text := split_part(p_topic, ':', 2);
  v_id text := split_part(p_topic, ':', 3);
begin
  if split_part(p_topic, ':', 1) <> 'room' or v_type not in ('course', 'class', 'session')
     or v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.can_join_room(v_type, v_id::uuid);
end $$;
grant execute on function private.realtime_room_allowed(text) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$create policy "classroom members receive" on realtime.messages for select to authenticated
      using (realtime.messages.extension in ('presence', 'broadcast') and private.realtime_room_allowed((select realtime.topic())))$p$;
    execute $p$create policy "classroom members send" on realtime.messages for insert to authenticated
      with check (realtime.messages.extension in ('presence', 'broadcast') and private.realtime_room_allowed((select realtime.topic())))$p$;
  end if;
end $$;
