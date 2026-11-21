-- =============================================================================
-- Teacher schedules: lessons, tests, revision, trips… on the calendar of a class
-- or course. Members are notified when an event is scheduled, reminded before it
-- starts, and see it in their calendar.
-- =============================================================================
create table public.class_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.school_classes (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  description text check (char_length(description) <= 2000),
  kind text not null default 'lesson' check (kind in ('lesson', 'test', 'revision', 'deadline', 'event', 'trip', 'holiday', 'reminder')),
  location text check (char_length(location) <= 140),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  remind_minutes integer not null default 60 check (remind_minutes between 0 and 10080),
  reminded_at timestamptz,
  is_cancelled boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((class_id is not null) <> (course_id is not null)),
  check (ends_at is null or ends_at >= starts_at)
);
create index class_events_class_idx on public.class_events (class_id, starts_at);
create index class_events_course_idx on public.class_events (course_id, starts_at);
create index class_events_reminders_idx on public.class_events (starts_at) where reminded_at is null and not is_cancelled;

alter table public.class_events enable row level security;
create policy class_events_select on public.class_events for select to authenticated
  using (created_by = (select auth.uid()) or private.in_scope(class_id, course_id) or (class_id is not null and private.can_manage_class(class_id)));
create policy class_events_write on public.class_events for insert to authenticated
  with check (created_by = (select auth.uid()) and ((class_id is not null and (private.can_manage_class(class_id) or private.leader_can(class_id, 'post_announcements')))
              or (course_id is not null and private.can_manage_course(course_id))));
create policy class_events_update on public.class_events for update to authenticated
  using (created_by = (select auth.uid()) or (class_id is not null and private.can_manage_class(class_id)) or (course_id is not null and private.can_manage_course(course_id)))
  with check (true);
create policy class_events_delete on public.class_events for delete to authenticated
  using (created_by = (select auth.uid()) or (class_id is not null and private.can_manage_class(class_id)) or (course_id is not null and private.can_manage_course(course_id)));
grant select, insert, update, delete on public.class_events to authenticated;

create or replace function private.event_audience(p_class uuid, p_course uuid)
returns table (user_id uuid) language sql stable security definer set search_path = '' as $$
  select e.user_id from public.class_enrolments e where p_class is not null and e.class_id = p_class and e.status = 'active'
  union select e.user_id from public.course_enrolments e where p_course is not null and e.course_id = p_course and e.status = 'active';
$$;

create or replace function private.trg_class_event_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; v_ctx text; v_link text;
begin
  v_ctx := coalesce((select name from public.school_classes where id = new.class_id), (select title from public.courses where id = new.course_id));
  v_link := '/calendar?d=' || to_char(new.starts_at at time zone 'Africa/Accra', 'YYYY-MM-DD');
  if tg_op = 'INSERT' then
    for r in select a.user_id from private.event_audience(new.class_id, new.course_id) a where a.user_id <> new.created_by loop
      perform private.notify(r.user_id, 'schedule', 'New on your calendar: ' || left(new.title, 90),
        v_ctx || ' · ' || to_char(new.starts_at at time zone 'Africa/Accra', 'Dy DD Mon, HH24:MI'), v_link, jsonb_build_object('event_id', new.id));
    end loop;
  elsif new.is_cancelled and not old.is_cancelled then
    for r in select a.user_id from private.event_audience(new.class_id, new.course_id) a where a.user_id <> new.created_by loop
      perform private.notify(r.user_id, 'schedule', 'Cancelled: ' || left(new.title, 100), v_ctx, v_link, jsonb_build_object('event_id', new.id));
    end loop;
  elsif new.starts_at is distinct from old.starts_at and not new.is_cancelled then
    new.reminded_at := null;
    for r in select a.user_id from private.event_audience(new.class_id, new.course_id) a where a.user_id <> new.created_by loop
      perform private.notify(r.user_id, 'schedule', 'Rescheduled: ' || left(new.title, 90),
        'Now ' || to_char(new.starts_at at time zone 'Africa/Accra', 'Dy DD Mon, HH24:MI') || ' · ' || v_ctx, v_link, jsonb_build_object('event_id', new.id));
    end loop;
  end if;
  return new;
end $$;
create trigger class_events_notify_ins after insert on public.class_events for each row execute function private.trg_class_event_notify();
create trigger class_events_notify_upd before update on public.class_events for each row execute function private.trg_class_event_notify();

-- Reminders (runs every 10 minutes; one cheap indexed query when nothing is due).
create or replace function private.event_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare ev record; r record;
begin
  for ev in select * from public.class_events
            where reminded_at is null and not is_cancelled and remind_minutes > 0
              and starts_at > now() and starts_at <= now() + make_interval(mins => remind_minutes)
            order by starts_at limit 200 loop
    for r in select a.user_id from private.event_audience(ev.class_id, ev.course_id) a loop
      perform private.notify(r.user_id, 'reminder', 'Starting soon: ' || left(ev.title, 100),
        to_char(ev.starts_at at time zone 'Africa/Accra', 'HH24:MI') || coalesce(' · ' || ev.location, ''), '/calendar', jsonb_build_object('event_id', ev.id));
    end loop;
    update public.class_events set reminded_at = now() where id = ev.id;
  end loop;
end $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('profjero-edu-event-reminders', '*/10 * * * *', 'select private.event_reminders()');
  end if;
end $$;

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
grant execute on all functions in schema private to anon, authenticated;
revoke execute on function private.event_reminders() from anon, authenticated;
