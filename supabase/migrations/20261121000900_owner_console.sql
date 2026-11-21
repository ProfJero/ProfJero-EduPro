-- =============================================================================
-- Owner console: pricing, system switches, daily operations, on-demand
-- monitoring (free-tier usage) and client error reports.
-- =============================================================================
alter table public.plans
  add column if not exists price_amount numeric(10, 2) check (price_amount is null or price_amount >= 0),
  add column if not exists currency text not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists billing_period text not null default 'month' check (billing_period in ('month', 'term', 'year', 'once', 'free'));

insert into public.platform_settings (key, value, is_public, description) values
  ('maintenance.banner', '""', true, 'Message shown to everyone at the top of the app (empty = hidden)'),
  ('maintenance.read_only', 'false', true, 'Show that the platform is in maintenance (informational)'),
  ('signups.enabled', 'true', true, 'Allow new account registration'),
  ('discussions.public_enabled', 'true', true, 'Allow open (cross-class) discussions'),
  ('arena.enabled', 'true', true, 'Show the Challenge Arena'),
  ('app.release_notes', '[]', true, 'What''s new — [{"date":"2026-11-21","title":"…","body":"…"}]')
on conflict (key) do nothing;

-- Browser errors, de-duplicated per day by fingerprint (one small row per distinct error).
create table if not exists public.app_errors (
  fingerprint text not null,
  day date not null default (now() at time zone 'Africa/Accra')::date,
  message text not null,
  stack text,
  path text,
  user_agent text,
  release text,
  count integer not null default 1,
  users integer not null default 1,
  last_seen_at timestamptz not null default now(),
  primary key (fingerprint, day)
);
alter table public.app_errors enable row level security;
create policy app_errors_admin on public.app_errors for select to authenticated using ((select private.is_platform_admin()));
create policy app_errors_delete on public.app_errors for delete to authenticated using ((select private.is_platform_admin()));
grant select, delete on public.app_errors to authenticated;

create or replace function public.report_client_error(p_message text, p_stack text default null, p_path text default null, p_release text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_fp text := md5(left(coalesce(p_message, ''), 300) || '|' || coalesce(split_part(coalesce(p_stack, ''), E'\n', 2), ''));
begin
  if coalesce(btrim(p_message), '') = '' then return; end if;
  -- Hard cap so a broken page can never fill the database.
  if (select count(*) from public.app_errors where day = (now() at time zone 'Africa/Accra')::date) > 500 then return; end if;
  insert into public.app_errors (fingerprint, message, stack, path, user_agent, release)
  values (v_fp, left(p_message, 500), left(p_stack, 4000), left(p_path, 300), left(current_setting('request.headers', true)::jsonb ->> 'user-agent', 300), left(p_release, 40))
  on conflict (fingerprint, day) do update set count = public.app_errors.count + 1, last_seen_at = now(), path = excluded.path;
exception when others then return;
end $$;
grant execute on function public.report_client_error(text, text, text, text) to anon, authenticated;

-- Daily operations (cheap aggregate queries; admin only).
create or replace function public.owner_daily_stats(p_days integer default 30)
returns table (day date, signups bigint, active_learners bigint, lessons_completed bigint, submissions bigint, attempts bigint, ai_requests bigint, messages bigint, arena_plays bigint, notifications bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_from date := (now() at time zone 'Africa/Accra')::date - least(greatest(p_days, 1), 120) + 1;
begin
  perform private.require_admin();
  return query
  with days as (select generate_series(v_from, (now() at time zone 'Africa/Accra')::date, interval '1 day')::date d)
  select d.d,
    (select count(*) from public.profiles p where (p.created_at at time zone 'Africa/Accra')::date = d.d),
    (select count(distinct a.user_id) from public.learning_activity a where (a.created_at at time zone 'Africa/Accra')::date = d.d),
    (select count(*) from public.lesson_progress lp where lp.completed_at is not null and (lp.completed_at at time zone 'Africa/Accra')::date = d.d),
    (select count(*) from public.assignment_submissions s where s.submitted_at is not null and (s.submitted_at at time zone 'Africa/Accra')::date = d.d),
    (select count(*) from public.assessment_attempts t where (t.started_at at time zone 'Africa/Accra')::date = d.d),
    (select coalesce(sum(u.requests), 0)::bigint from public.ai_usage u where u.day = d.d),
    (select count(*) from public.classroom_messages m where (m.created_at at time zone 'Africa/Accra')::date = d.d),
    (select count(*) from public.arena_attempts x where (x.started_at at time zone 'Africa/Accra')::date = d.d),
    (select count(*) from public.notifications n where (n.created_at at time zone 'Africa/Accra')::date = d.d)
  from days d order by d.d;
end $$;
revoke execute on function public.owner_daily_stats(integer) from public, anon;
grant execute on function public.owner_daily_stats(integer) to authenticated;

-- On-demand system monitor. Only runs when the owner presses "Run check".
create or replace function public.owner_system_monitor()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'checked_at', now(),
    'database_bytes', pg_database_size(current_database()),
    'free_tier', jsonb_build_object('database_bytes', 500 * 1024 * 1024, 'mau', 50000, 'realtime_connections', 200, 'egress_gb', 5, 'storage_bytes', 1024 * 1024 * 1024),
    'auth_users', (select count(*) from auth.users),
    'mau_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'active_7d', (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'online_15m', (select count(*) from public.profiles where last_seen_at > now() - interval '15 minutes'),
    'storage_bytes', coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects), 0),
    'push_subscriptions', (select count(*) from public.push_subscriptions),
    'tables', (select coalesce(jsonb_agg(t order by (t ->> 'bytes')::bigint desc), '[]'::jsonb) from (
       select jsonb_build_object('name', c.relname, 'bytes', pg_total_relation_size(c.oid), 'rows', greatest(c.reltuples, 0)::bigint) t
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 15) x),
    'connections', (select count(*) from pg_stat_activity where datname = current_database()),
    'cron', (select coalesce(jsonb_agg(jsonb_build_object('job', j.jobname, 'schedule', j.schedule, 'active', j.active,
              'last_run', (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
              'failures_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours'))), '[]'::jsonb) from cron.job j),
    'push_24h', (select jsonb_build_object('sent', count(*) filter (where status_code between 200 and 299), 'failed', count(*) filter (where status_code is null or status_code >= 300))
                 from net._http_response where created > now() - interval '24 hours'),
    'errors_today', (select coalesce(sum(count), 0) from public.app_errors where day = (now() at time zone 'Africa/Accra')::date),
    'notifications_7d', (select count(*) from public.notifications where created_at > now() - interval '7 days'),
    'ai_requests_today', (select coalesce(sum(requests), 0) from public.ai_usage where day = (now() at time zone 'Africa/Accra')::date)
  ) into v;
  return v;
end $$;
revoke execute on function public.owner_system_monitor() from public, anon;
grant execute on function public.owner_system_monitor() to authenticated;

-- Housekeeping the owner can run from the console (keeps the free tier lean).
create or replace function public.owner_housekeeping()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a int; b int; c int; d int;
begin
  perform private.require_admin();
  delete from public.notifications where read_at is not null and created_at < now() - interval '90 days'; get diagnostics a = row_count;
  delete from public.arena_attempts where status <> 'finished' and started_at < now() - interval '2 days'; get diagnostics b = row_count;
  delete from public.app_errors where day < (now() at time zone 'Africa/Accra')::date - 30; get diagnostics c = row_count;
  delete from net._http_response where created < now() - interval '2 days'; get diagnostics d = row_count;
  perform private.audit('system.housekeeping', 'system', null, jsonb_build_object('notifications', a, 'attempts', b, 'errors', c, 'http_log', d));
  return jsonb_build_object('old_notifications', a, 'stale_attempts', b, 'old_errors', c, 'http_log', d);
end $$;
revoke execute on function public.owner_housekeeping() from public, anon;
grant execute on function public.owner_housekeeping() to authenticated;

-- Owner switches are enforced in the database, not only in the UI.
create or replace function public.ai_consume(p_tokens integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_limit integer := private.feature_limit('ai_requests_per_day');
  v_enabled boolean := private.has_feature('ai_requests_per_day');
  v_used integer;
  v_day date := (now() at time zone 'Africa/Accra')::date;
  v_busy boolean;
begin
  if exists (select 1 from public.platform_settings s where s.key = 'ai.enabled' and s.value = 'false'::jsonb) then
    return jsonb_build_object('allowed', false, 'reason', 'The AI Companion is switched off for now. Please try again later.');
  end if;
  if not v_enabled then return jsonb_build_object('allowed', false, 'reason', 'AI Companion is not included in your plan.'); end if;
  -- Academic integrity: no AI help while a timed or graded attempt is open.
  v_busy := exists (select 1 from public.assessment_attempts t join public.assessments a on a.id = t.assessment_id
                    where t.user_id = v_uid and t.status = 'in_progress' and a.kind <> 'practice' and (t.deadline_at is null or t.deadline_at > now()));
  if v_busy then return jsonb_build_object('allowed', false, 'reason', 'The AI Companion is paused while you have an assessment in progress. Good luck!'); end if;
  insert into public.ai_usage (user_id, day, requests, tokens) values (v_uid, v_day, 0, 0) on conflict do nothing;
  select requests into v_used from public.ai_usage where user_id = v_uid and day = v_day for update;
  if v_limit is not null and v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', format('You have used all %s AI requests for today. Your allowance resets tomorrow.', v_limit), 'limit', v_limit, 'remaining', 0);
  end if;
  update public.ai_usage set requests = requests + 1, tokens = tokens + greatest(p_tokens, 0) where user_id = v_uid and day = v_day;
  return jsonb_build_object('allowed', true, 'limit', v_limit, 'remaining', case when v_limit is null then null else v_limit - v_used - 1 end,
    'is_teacher', private.has_role('teacher') or exists (select 1 from public.school_memberships m where m.user_id = v_uid and m.status = 'active' and m.role in ('teacher', 'school_admin'))
       or exists (select 1 from public.class_teachers ct where ct.user_id = v_uid));
end $$;

drop policy if exists spaces_insert on public.discussion_spaces;
create policy spaces_insert on public.discussion_spaces for insert to authenticated
  with check (created_by = (select auth.uid()) and not private.is_guest() and message_count = 0 and not is_pinned and (
    (visibility = 'public' and not exists (select 1 from public.platform_settings s where s.key = 'discussions.public_enabled' and s.value = 'false'::jsonb))
    or (visibility = 'class' and private.is_class_member(class_id))
    or (visibility = 'group' and private.can_manage_group(group_id))));
