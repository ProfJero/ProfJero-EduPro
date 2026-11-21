-- =============================================================================
-- 0014 Push notifications, gradebook, calendar, private comments, scheduled
--      announcements, live-provider token vault (server-only)
-- =============================================================================

-- Server-side configuration (never exposed). Set by the platform owner:
--   insert into private.app_config values ('api_url','https://…workers.dev'), ('worker_secret','<random>');
create table if not exists private.app_config (
  key text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

create or replace function private.config(p_key text)
returns text language sql stable security definer set search_path = '' as $$
  select value from private.app_config where key = p_key;
$$;
revoke execute on function private.config(text) from public, anon, authenticated;

create or replace function private.worker_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_secret is not null and length(p_secret) >= 24 and p_secret = private.config('worker_secret'), false);
$$;

-- ---------------------------------------------------------------------------
-- Web Push subscriptions & dispatch
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create extension if not exists pg_net with schema extensions;

-- After a notification is created, ask the API worker to deliver Web Push.
create or replace function private.trg_push_dispatch()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text := private.config('api_url'); v_secret text := private.config('worker_secret'); v_subs jsonb;
begin
  if v_url is null or v_secret is null then return new; end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
    into v_subs from public.push_subscriptions s where s.user_id = new.user_id;
  if v_subs is null then return new; end if;
  perform net.http_post(
    url := v_url || '/api/push/dispatch',
    body := jsonb_build_object('subscriptions', v_subs, 'notification',
      jsonb_build_object('id', new.id, 'title', new.title, 'body', coalesce(new.body, ''), 'link', coalesce(new.link, '/notifications'), 'type', new.type)),
    headers := jsonb_build_object('content-type', 'application/json', 'x-worker-secret', v_secret),
    timeout_milliseconds := 5000);
  return new;
exception when others then
  return new; -- push is best-effort; never block the notification itself
end $$;
create trigger notifications_push after insert on public.notifications for each row execute function private.trg_push_dispatch();

-- Worker reports expired endpoints (HTTP 404/410) for removal.
create or replace function public.push_prune(p_secret text, p_endpoints text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not private.worker_secret_ok(p_secret) then raise exception 'Forbidden' using errcode = '42501'; end if;
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.push_prune(text, text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Live provider OAuth tokens (Google Meet, Zoom). Only the API worker, which
-- knows the worker secret, can store or read them — on behalf of the signed-in
-- user. Clients never see tokens.
-- ---------------------------------------------------------------------------
create or replace function public.provider_store_tokens(p_secret text, p_provider text, p_access text, p_refresh text, p_expires_at timestamptz, p_email text, p_scopes text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_id uuid;
begin
  if not private.worker_secret_ok(p_secret) then raise exception 'Forbidden' using errcode = '42501'; end if;
  insert into public.provider_connections (user_id, provider, account_email, status, scopes)
  values (v_uid, p_provider::public.meeting_provider, p_email, 'connected', coalesce(p_scopes, '{}'))
  on conflict (user_id, provider) do update set account_email = excluded.account_email, status = 'connected', scopes = excluded.scopes, connected_at = now()
  returning id into v_id;
  insert into private.provider_tokens (connection_id, access_token, refresh_token, expires_at)
  values (v_id, p_access, p_refresh, p_expires_at)
  on conflict (connection_id) do update set access_token = excluded.access_token,
    refresh_token = coalesce(excluded.refresh_token, private.provider_tokens.refresh_token), expires_at = excluded.expires_at, updated_at = now();
  return v_id;
end $$;

create or replace function public.provider_get_tokens(p_secret text, p_provider text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  if not private.worker_secret_ok(p_secret) then raise exception 'Forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object('access_token', t.access_token, 'refresh_token', t.refresh_token, 'expires_at', t.expires_at, 'email', c.account_email)
          from public.provider_connections c join private.provider_tokens t on t.connection_id = c.id
          where c.user_id = v_uid and c.provider = p_provider::public.meeting_provider and c.status = 'connected');
end $$;
grant execute on function public.provider_store_tokens(text, text, text, text, timestamptz, text, text[]), public.provider_get_tokens(text, text) to authenticated;
revoke execute on function public.provider_store_tokens(text, text, text, text, timestamptz, text, text[]), public.provider_get_tokens(text, text) from anon;

-- Role of the caller in a live session (for in-app Jitsi moderator rights).
create or replace function public.session_role(p_session uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when private.can_manage_session(p_session) then 'host' when private.can_view_session(p_session) then 'participant' end;
$$;
grant execute on function public.session_role(uuid) to authenticated;

alter table public.live_sessions add column if not exists embed_in_app boolean not null default false;

-- ---------------------------------------------------------------------------
-- Gradebook: weights, per-class/course gradebook, learner "My grades"
-- ---------------------------------------------------------------------------
alter table public.assessments add column if not exists weight numeric(5, 2) not null default 1 check (weight >= 0);
alter table public.assignments add column if not exists weight numeric(5, 2) not null default 1 check (weight >= 0);

create or replace function public.gradebook(p_course uuid default null, p_class uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cols jsonb; v_rows jsonb;
begin
  perform private.require_user();
  if (p_course is null) = (p_class is null) then raise exception 'Choose a course or a class' using errcode = '22023'; end if;
  if not ((p_course is not null and private.can_manage_course(p_course)) or (p_class is not null and private.can_manage_class(p_class))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  with cols as (
    select a.id, 'assessment' as type, a.title, a.weight, a.created_at, coalesce((select sum(coalesce(aq.marks_override, q.marks)) from public.assessment_questions aq join public.questions q on q.id = aq.question_id where aq.assessment_id = a.id), 0) as max
    from public.assessments a where a.status = 'published' and ((p_course is not null and a.course_id = p_course) or (p_class is not null and a.class_id = p_class))
    union all
    select s.id, 'assignment', s.title, s.weight, s.created_at, s.max_marks
    from public.assignments s where s.status = 'published' and ((p_course is not null and s.course_id = p_course) or (p_class is not null and s.class_id = p_class))
  ), learners as (
    select e.user_id from public.course_enrolments e where p_course is not null and e.course_id = p_course and e.status <> 'dropped'
    union select ce.user_id from public.class_enrolments ce where p_class is not null and ce.class_id = p_class and ce.status = 'active'
  ), cells as (
    select l.user_id, c.id as col_id, c.weight,
      case c.type
        when 'assessment' then (select max(r.percentage) from public.assessment_results r where r.assessment_id = c.id and r.user_id = l.user_id and not r.pending_manual)
        else (select round(100 * g.score / nullif(c.max, 0), 2) from public.assignment_submissions sb join public.submission_grades g on g.submission_id = sb.id where sb.assignment_id = c.id and sb.user_id = l.user_id)
      end as pct,
      case c.type
        when 'assessment' then (select case when bool_or(r.pending_manual) then 'marking' when count(*) > 0 then 'done' end from public.assessment_results r where r.assessment_id = c.id and r.user_id = l.user_id)
        else (select sb.status from public.assignment_submissions sb where sb.assignment_id = c.id and sb.user_id = l.user_id)
      end as status
    from learners l cross join cols c
  )
  select coalesce((select jsonb_agg(jsonb_build_object('id', id, 'type', type, 'title', title, 'weight', weight, 'max', max) order by created_at) from cols), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('user_id', l.user_id, 'name', private.display_name(l.user_id),
        'cells', (select coalesce(jsonb_object_agg(x.col_id, jsonb_build_object('pct', x.pct, 'status', x.status)), '{}'::jsonb) from cells x where x.user_id = l.user_id),
        'average', (select round(sum(x.pct * x.weight) / nullif(sum(x.weight) filter (where x.pct is not null), 0), 1) from cells x where x.user_id = l.user_id and x.pct is not null))
        order by private.display_name(l.user_id)) from learners l), '[]'::jsonb)
  into v_cols, v_rows;
  return jsonb_build_object('columns', v_cols, 'rows', v_rows);
end $$;

create or replace function public.my_grades()
returns table (kind text, item_id uuid, title text, context text, pct numeric, score numeric, max_score numeric, graded_at timestamptz, link text)
language sql stable security definer set search_path = '' as $$
  select 'assessment', a.id, a.title, coalesce(c.title, k.name), max(r.percentage), max(r.score), max(r.max_score), max(r.graded_at), '/learn/assessments/' || a.id
  from public.assessment_results r join public.assessments a on a.id = r.assessment_id
  left join public.courses c on c.id = a.course_id left join public.school_classes k on k.id = a.class_id
  where r.user_id = (select auth.uid()) and private.results_released(a.id) and not r.pending_manual
  group by a.id, a.title, c.title, k.name
  union all
  select 'assignment', s.id, s.title, coalesce(c.title, k.name), round(100 * g.score / nullif(s.max_marks, 0), 2), g.score, s.max_marks, g.graded_at, '/learn/assignments/' || s.id
  from public.submission_grades g join public.assignment_submissions sb on sb.id = g.submission_id join public.assignments s on s.id = sb.assignment_id
  left join public.courses c on c.id = s.course_id left join public.school_classes k on k.id = s.class_id
  where sb.user_id = (select auth.uid()) and g.released
  order by 8 desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- Calendar: everything with a date that the caller can see
-- ---------------------------------------------------------------------------
create or replace function public.my_calendar(p_from timestamptz, p_to timestamptz)
returns table (kind text, id uuid, title text, starts_at timestamptz, ends_at timestamptz, context text, link text, status text)
language sql stable security definer set search_path = '' as $$
  select 'live', s.id, s.title, s.starts_at, s.starts_at + make_interval(mins => s.duration_minutes), coalesce(c.title, k.name), '/learn/live/' || s.id, s.status
  from public.live_sessions s left join public.courses c on c.id = s.course_id left join public.school_classes k on k.id = s.class_id
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
  select 'term', t.id, t.name || ' begins', t.starts_on::timestamptz, t.ends_on::timestamptz, sc.name, null, null
  from public.academic_terms t join public.schools sc on sc.id = t.school_id
  where t.starts_on between p_from::date and p_to::date and private.is_school_member(t.school_id)
  order by 4;
$$;

-- ---------------------------------------------------------------------------
-- Private comments on submissions (learner ↔ teacher)
-- ---------------------------------------------------------------------------
create table public.submission_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index submission_comments_sub_idx on public.submission_comments (submission_id, created_at);
alter table public.submission_comments enable row level security;
create policy sub_comments_read on public.submission_comments for select to authenticated
  using (private.submission_owner(submission_id) = (select auth.uid()) or private.can_manage_assignment(private.submission_assignment(submission_id)));
create policy sub_comments_insert on public.submission_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (private.submission_owner(submission_id) = (select auth.uid())
    or private.can_manage_assignment(private.submission_assignment(submission_id))));
grant select, insert on public.submission_comments to authenticated;

create or replace function private.trg_comment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := private.submission_owner(new.submission_id); v_a public.assignments;
begin
  select a.* into v_a from public.assignments a join public.assignment_submissions s on s.assignment_id = a.id where s.id = new.submission_id;
  if new.author_id = v_owner then
    perform private.notify(v_a.created_by, 'private_comment', 'Private comment on ' || v_a.title, left(new.body, 160), '/teach/assignments/' || v_a.id, '{}'::jsonb);
  else
    perform private.notify(v_owner, 'private_comment', 'Your teacher commented on ' || v_a.title, left(new.body, 160), '/learn/assignments/' || v_a.id, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger submission_comments_notify after insert on public.submission_comments for each row execute function private.trg_comment_notify();

-- ---------------------------------------------------------------------------
-- Scheduled announcements (publish later)
-- ---------------------------------------------------------------------------
alter table public.announcements add column if not exists notified boolean not null default false;
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to authenticated
  using (
    author_id = (select auth.uid()) or (select private.is_platform_admin())
    or (published_at <= now() and (
      scope = 'platform'
      or (scope = 'school' and private.is_school_member(school_id))
      or (scope = 'course' and (private.is_enrolled(course_id) or private.can_manage_course(course_id)))
      or (scope = 'class' and private.is_class_member(class_id))))
  );

create or replace function private.notify_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.announcements;
begin
  update public.announcements set notified = true where id = p_id and not notified returning * into a;
  if a.id is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link, data)
  select x.user_id, 'announcement', a.title, left(a.body, 240), '/notifications', jsonb_build_object('announcement_id', a.id)
  from (
    select p.id as user_id from public.profiles p where a.scope = 'platform' and p.status = 'active' and not p.is_guest
    union select m.user_id from public.school_memberships m where a.scope = 'school' and m.school_id = a.school_id and m.status = 'active'
    union select au.user_id from private.audience(case when a.scope = 'course' then a.course_id end, case when a.scope = 'class' then a.class_id end) au
      where a.scope in ('course', 'class')
  ) x where x.user_id <> a.author_id;
end $$;

create or replace function private.trg_announcement_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.published_at <= now() + interval '1 minute' then perform private.notify_announcement(new.id); end if;
  return new;
end $$;

create or replace function private.publish_scheduled()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select id from public.announcements where not notified and published_at <= now() loop
    perform private.notify_announcement(r.id); n := n + 1;
  end loop;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('profjero-edu-scheduled-posts', '*/5 * * * *', 'select private.publish_scheduled()');
  end if;
exception when others then raise notice 'scheduled posts cron not created: %', sqlerrm;
end $$;

grant execute on function public.gradebook(uuid, uuid), public.my_grades(), public.my_calendar(timestamptz, timestamptz) to authenticated;
revoke execute on function public.gradebook(uuid, uuid), public.my_grades(), public.my_calendar(timestamptz, timestamptz) from anon;
grant execute on all functions in schema private to anon, authenticated;
revoke execute on function private.config(text), private.notify_announcement(uuid), private.publish_scheduled(), private.award_badge(uuid, text), private.add_xp(uuid, integer) from anon, authenticated;
