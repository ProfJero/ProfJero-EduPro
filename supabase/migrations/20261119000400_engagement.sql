-- =============================================================================
-- 0004 Live classes, classroom, announcements, notifications, certificates,
--      support, Edu/EduPro plans & entitlements
-- =============================================================================

create type public.meeting_provider as enum ('manual', 'google_meet', 'zoom', 'jitsi', 'teams', 'other');

-- -----------------------------------------------------------------------------
-- Live sessions (provider-agnostic). We never host video ourselves.
-- -----------------------------------------------------------------------------
create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text,
  agenda text,
  provider public.meeting_provider not null default 'manual',
  join_url text not null check (join_url ~ '^https://'),
  provider_meeting_id text,
  provider_meta jsonb not null default '{}'::jsonb,
  course_id uuid references public.courses (id) on delete cascade,
  class_id uuid references public.school_classes (id) on delete cascade,
  host_id uuid not null references auth.users (id) on delete restrict,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 600),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  cancel_reason text,
  recording_url text check (recording_url is null or recording_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_id is not null or class_id is not null)
);
create index live_sessions_course_idx on public.live_sessions (course_id, starts_at);
create index live_sessions_class_idx on public.live_sessions (class_id, starts_at);
create index live_sessions_host_idx on public.live_sessions (host_id, starts_at);
create index live_sessions_starts_idx on public.live_sessions (starts_at);
create trigger live_sessions_touch before update on public.live_sessions
  for each row execute function private.touch_updated_at();

create table public.live_session_attendance (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'present' check (status in ('present', 'late', 'absent', 'excused')),
  source text not null default 'join_click' check (source in ('join_click', 'manual', 'provider')),
  joined_at timestamptz,
  marked_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index live_attendance_user_idx on public.live_session_attendance (user_id);

-- OAuth connection metadata (no tokens here — tokens are in private schema).
create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.meeting_provider not null check (provider in ('google_meet', 'zoom')),
  account_email text,
  status text not null default 'connected' check (status in ('connected', 'revoked', 'error')),
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  unique (user_id, provider)
);
create table private.provider_tokens (
  connection_id uuid primary key references public.provider_connections (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on private.provider_tokens from public, anon, authenticated;

create or replace function private.session_scope_ok(p_course uuid, p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_course is not null and private.is_enrolled(p_course))
      or (p_class is not null and private.is_class_student(p_class));
$$;

create or replace function private.can_manage_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.live_sessions s where s.id = p_session and (
      s.host_id = (select auth.uid())
      or (s.course_id is not null and private.can_manage_course(s.course_id))
      or (s.class_id is not null and private.can_manage_class(s.class_id))
      or private.is_platform_admin()
    )
  );
$$;

create or replace function private.can_view_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_session(p_session) or exists (
    select 1 from public.live_sessions s where s.id = p_session and private.session_scope_ok(s.course_id, s.class_id)
  );
$$;

-- -----------------------------------------------------------------------------
-- Classroom: realtime discussion / Q&A per course, class or live session.
-- -----------------------------------------------------------------------------
create table public.classroom_messages (
  id uuid primary key default gen_random_uuid(),
  room_type text not null check (room_type in ('course', 'class', 'session')),
  room_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  kind text not null default 'message' check (kind in ('message', 'question', 'answer', 'board')),
  body text not null check (char_length(body) between 1 and 4000),
  parent_id uuid references public.classroom_messages (id) on delete cascade,
  is_pinned boolean not null default false,
  is_resolved boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index classroom_messages_room_idx on public.classroom_messages (room_type, room_id, created_at desc);
create index classroom_messages_parent_idx on public.classroom_messages (parent_id);
create index classroom_messages_user_idx on public.classroom_messages (user_id);

create or replace function private.can_join_room(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'course' then private.is_enrolled(p_room) or private.can_manage_course(p_room) or private.teaches_course_class(p_room)
    when 'class' then private.is_class_member(p_room)
    when 'session' then private.can_view_session(p_room)
    else false end;
$$;

create or replace function private.can_moderate_room(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'course' then private.can_manage_course(p_room)
    when 'class' then private.can_manage_class(p_room)
    when 'session' then private.can_manage_session(p_room)
    else false end;
$$;

create or replace function private.guard_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_mod boolean := private.can_moderate_room(coalesce(new.room_type, old.room_type), coalesce(new.room_id, old.room_id));
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    new.author_name := coalesce((select coalesce(nullif(p.display_name, ''), p.full_name) from public.profiles p where p.id = new.user_id), '');
    if new.kind = 'board' and not v_mod then
      raise exception 'Only teachers can post to the class board' using errcode = '42501';
    end if;
    if new.is_pinned and not v_mod then new.is_pinned := false; end if;
    return new;
  end if;
  -- UPDATE
  if not v_mod then
    if new.user_id <> (select auth.uid()) then raise exception 'Not allowed' using errcode = '42501'; end if;
    if new.is_pinned is distinct from old.is_pinned or new.kind is distinct from old.kind
       or new.room_id <> old.room_id or new.room_type <> old.room_type then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger classroom_messages_guard before insert or update on public.classroom_messages
  for each row execute function private.guard_message();

-- -----------------------------------------------------------------------------
-- Announcements & notifications
-- -----------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform', 'school', 'course', 'class')),
  school_id uuid references public.schools (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  class_id uuid references public.school_classes (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 1 and 10000),
  is_pinned boolean not null default false,
  author_id uuid not null references auth.users (id) on delete restrict,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (scope = 'platform' and school_id is null and course_id is null and class_id is null)
    or (scope = 'school' and school_id is not null)
    or (scope = 'course' and course_id is not null)
    or (scope = 'class' and class_id is not null)
  )
);
create index announcements_scope_idx on public.announcements (scope, published_at desc);
create index announcements_school_idx on public.announcements (school_id);
create index announcements_course_idx on public.announcements (course_id);
create index announcements_class_idx on public.announcements (class_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create or replace function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_user, p_type, p_title, p_body, p_link, coalesce(p_data, '{}'::jsonb));
$$;

-- Fan-out helper: all active learners of a course and/or class.
create or replace function private.audience(p_course uuid, p_class uuid)
returns table (user_id uuid) language sql stable security definer set search_path = '' as $$
  select e.user_id from public.course_enrolments e where p_course is not null and e.course_id = p_course and e.status in ('active', 'completed')
  union
  select ce.user_id from public.class_enrolments ce where p_class is not null and ce.class_id = p_class and ce.status = 'active';
$$;

-- -----------------------------------------------------------------------------
-- Certificates
-- -----------------------------------------------------------------------------
create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  accent_color text not null default '#1554D6' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  signatory_name text,
  signatory_title text,
  footer_text text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index certificate_templates_default on public.certificate_templates (is_default) where is_default;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  template_id uuid references public.certificate_templates (id) on delete set null,
  learner_name text not null,
  course_title text not null,
  issuer_name text not null,
  completed_on date not null,
  issued_at timestamptz not null default now(),
  status text not null default 'valid' check (status in ('valid', 'revoked')),
  revoked_reason text,
  unique (user_id, course_id)
);
create index certificates_course_idx on public.certificates (course_id);

-- -----------------------------------------------------------------------------
-- Support & contact
-- -----------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 160),
  category text not null default 'general' check (category in ('general', 'account', 'course', 'technical', 'school', 'billing', 'safety', 'other')),
  description text not null check (char_length(description) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'awaiting_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index support_tickets_assignee_idx on public.support_tickets (assigned_to);
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function private.touch_updated_at();

create table public.support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index support_replies_ticket_idx on public.support_replies (ticket_id, created_at);
create index support_replies_author_idx on public.support_replies (author_id);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic text not null default 'general' check (topic in ('general', 'schools', 'educators', 'partnership', 'press', 'other')),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now()
);

create or replace function private.guard_ticket()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_platform_admin() then
    if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then new.resolved_at := now(); end if;
    return new;
  end if;
  if new.assigned_to is distinct from old.assigned_to or new.priority is distinct from old.priority
     or new.user_id <> old.user_id or new.subject <> old.subject or new.description <> old.description then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- Ticket owners may only close or reopen their own ticket.
  if new.status is distinct from old.status and new.status not in ('closed', 'open') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger support_tickets_guard before update on public.support_tickets
  for each row execute function private.guard_ticket();

-- -----------------------------------------------------------------------------
-- Plans, features, subscriptions, entitlements (Edu / EduPro)
-- -----------------------------------------------------------------------------
create table public.features (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  name text not null,
  description text,
  kind text not null default 'boolean' check (kind in ('boolean', 'limit')),
  sort_order integer not null default 0
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  tier text not null check (tier in ('edu', 'edupro')),
  scope text not null check (scope in ('individual', 'teacher', 'school')),
  description text,
  price_label text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index plans_one_default_per_scope on public.plans (scope) where is_default;

create table public.plan_features (
  plan_id uuid not null references public.plans (id) on delete cascade,
  feature_key text not null references public.features (key) on delete cascade,
  enabled boolean not null default true,
  limit_value integer check (limit_value is null or limit_value >= 0), -- null = unlimited
  primary key (plan_id, feature_key)
);
create index plan_features_feature_idx on public.plan_features (feature_key);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete restrict,
  user_id uuid references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'trialing', 'cancelled', 'expired')),
  source text not null default 'manual' check (source in ('manual', 'pilot', 'payment')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  notes text,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) <> (school_id is not null)),
  check (ends_at is null or ends_at > starts_at)
);
create index subscriptions_user_idx on public.subscriptions (user_id, status);
create index subscriptions_school_idx on public.subscriptions (school_id, status);
create index subscriptions_plan_idx on public.subscriptions (plan_id);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function private.touch_updated_at();

create table public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  event text not null,
  actor_id uuid references auth.users (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index subscription_events_sub_idx on public.subscription_events (subscription_id, created_at desc);

-- Effective entitlements for a user: default plans for each scope the user is
-- in, plus active personal subscriptions, plus active subscriptions of any
-- approved school where the user is an active member. Most generous wins
-- (enabled = any; limit = max, null = unlimited).
create or replace function private.entitlements_for(p_user uuid)
returns table (feature_key text, enabled boolean, limit_value integer, source_plans text[])
language sql stable security definer set search_path = '' as $$
  with applicable_plans as (
    select p.id, p.code from public.plans p where p.is_active and p.is_default and p.scope = 'individual'
    union
    select p.id, p.code from public.plans p
      where p.is_active and p.is_default and p.scope = 'teacher'
        and exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = 'teacher')
    union
    select p.id, p.code from public.subscriptions s join public.plans p on p.id = s.plan_id
      where s.user_id = p_user and s.status in ('active', 'trialing') and p.is_active
        and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
    union
    select p.id, p.code from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      join public.school_memberships m on m.school_id = s.school_id and m.user_id = p_user and m.status = 'active'
      join public.schools sc on sc.id = s.school_id and sc.status = 'approved'
      where s.status in ('active', 'trialing') and p.is_active
        and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
  )
  select f.key,
         coalesce(bool_or(pf.enabled), false),
         case when bool_or(pf.enabled and pf.limit_value is null) then null else max(pf.limit_value) filter (where pf.enabled) end,
         coalesce(array_agg(distinct ap.code) filter (where pf.enabled), '{}')
  from public.features f
  left join public.plan_features pf on pf.feature_key = f.key and pf.plan_id in (select id from applicable_plans)
  left join applicable_plans ap on ap.id = pf.plan_id
  group by f.key;
$$;

create or replace function private.has_feature(p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select e.enabled from private.entitlements_for((select auth.uid())) e where e.feature_key = p_feature), false);
$$;

create or replace function private.feature_limit(p_feature text)
returns integer language sql stable security definer set search_path = '' as $$
  select e.limit_value from private.entitlements_for((select auth.uid())) e where e.feature_key = p_feature and e.enabled;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.live_sessions enable row level security;
alter table public.live_session_attendance enable row level security;
alter table public.provider_connections enable row level security;
alter table public.classroom_messages enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.certificate_templates enable row level security;
alter table public.certificates enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_replies enable row level security;
alter table public.contact_messages enable row level security;
alter table public.features enable row level security;
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;

create policy live_read on public.live_sessions for select to authenticated
  using (host_id = (select auth.uid()) or private.can_view_session(id));
create policy live_insert on public.live_sessions for insert to authenticated
  with check (host_id = (select auth.uid()) and (
    (course_id is not null and private.can_manage_course(course_id))
    or (class_id is not null and private.can_manage_class(class_id))));
create policy live_update on public.live_sessions for update to authenticated
  using (private.can_manage_session(id)) with check (private.can_manage_session(id));
create policy live_delete on public.live_sessions for delete to authenticated using (private.can_manage_session(id));

create policy live_att_read on public.live_session_attendance for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_session(session_id));
create policy live_att_write on public.live_session_attendance for all to authenticated
  using (private.can_manage_session(session_id))
  with check (private.can_manage_session(session_id) and marked_by = (select auth.uid()));

create policy provider_conn_own on public.provider_connections for select to authenticated using (user_id = (select auth.uid()));
create policy provider_conn_delete on public.provider_connections for delete to authenticated using (user_id = (select auth.uid()));

create policy messages_read on public.classroom_messages for select to authenticated
  using (private.can_join_room(room_type, room_id));
create policy messages_insert on public.classroom_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_join_room(room_type, room_id));
create policy messages_update on public.classroom_messages for update to authenticated
  using (user_id = (select auth.uid()) or private.can_moderate_room(room_type, room_id))
  with check (private.can_join_room(room_type, room_id));

create policy announcements_read on public.announcements for select to authenticated
  using (
    scope = 'platform'
    or (scope = 'school' and private.is_school_member(school_id))
    or (scope = 'course' and (private.is_enrolled(course_id) or private.can_manage_course(course_id)))
    or (scope = 'class' and private.is_class_member(class_id))
    or (select private.is_platform_admin())
  );
create policy announcements_write on public.announcements for insert to authenticated
  with check (
    author_id = (select auth.uid()) and (
      (scope = 'platform' and (select private.is_platform_admin()))
      or (scope = 'school' and private.is_school_admin(school_id))
      or (scope = 'course' and private.can_manage_course(course_id))
      or (scope = 'class' and private.can_manage_class(class_id))
    )
  );
create policy announcements_modify on public.announcements for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_platform_admin()))
  with check (author_id = (select auth.uid()) or (select private.is_platform_admin()));
create policy announcements_delete on public.announcements for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_platform_admin()));

create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

create policy cert_templates_read on public.certificate_templates for select to authenticated using (true);
create policy cert_templates_write on public.certificate_templates for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy certificates_read on public.certificates for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_course(course_id) or (select private.is_platform_admin()));
-- Certificates are issued only by claim_certificate(); revocation by admins.
create policy certificates_admin_update on public.certificates for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

create policy tickets_read on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and assigned_to is null);
create policy tickets_update on public.support_tickets for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_platform_admin()));

create policy replies_read on public.support_replies for select to authenticated
  using ((select private.is_platform_admin())
         or (not is_internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid()))));
create policy replies_insert on public.support_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and (
    (select private.is_platform_admin())
    or (not is_internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid()) and t.status <> 'closed'))
  ));

create policy contact_insert on public.contact_messages for insert to anon, authenticated with check (status = 'new');
create policy contact_admin on public.contact_messages for select to authenticated using ((select private.is_platform_admin()));
create policy contact_admin_update on public.contact_messages for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

create policy features_read on public.features for select to anon, authenticated using (true);
create policy features_write on public.features for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy plans_read on public.plans for select to anon, authenticated using (is_active or (select private.is_platform_admin()));
create policy plans_write on public.plans for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy plan_features_read on public.plan_features for select to anon, authenticated using (true);
create policy plan_features_write on public.plan_features for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

-- Subscriptions: subjects can read their own; ONLY platform admins write
-- (self-assignment of EduPro is impossible).
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid())
         or (school_id is not null and private.is_school_admin(school_id))
         or (select private.is_platform_admin()));
create policy subscriptions_admin on public.subscriptions for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy sub_events_read on public.subscription_events for select to authenticated using ((select private.is_platform_admin()));
