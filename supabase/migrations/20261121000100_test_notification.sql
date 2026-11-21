-- Lets a signed-in user send themselves a test notification (also delivered by push).
create or replace function public.send_test_notification()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  if exists (select 1 from public.notifications where user_id = v_uid and type = 'test' and created_at > now() - interval '30 seconds') then
    raise exception 'Please wait a few seconds before sending another test.' using errcode = 'P0001';
  end if;
  perform private.notify(v_uid, 'test', 'Notifications are working 🎉', 'You will now get class, deadline and grade alerts on this device.', '/notifications', '{}'::jsonb);
end $$;
revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
