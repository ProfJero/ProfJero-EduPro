-- =============================================================================
-- ProfJero Edu / EduPro — 0001 Foundation: identity, roles, schools, settings
-- =============================================================================
-- Conventions
--   * UUID primary keys (gen_random_uuid), timestamptz everywhere (stored UTC).
--   * Every table in `public` has RLS enabled. Helper functions that need to
--     bypass RLS live in the `private` schema (NOT exposed through the Data API).
--   * Privileged writes go through SECURITY DEFINER RPCs that re-check auth.uid().
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('learner', 'teacher', 'school_admin', 'platform_admin', 'owner', 'guardian');
create type public.school_role as enum ('school_admin', 'teacher', 'student', 'guardian');
create type public.membership_status as enum ('pending', 'invited', 'active', 'suspended', 'removed');
create type public.school_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.account_status as enum ('active', 'suspended');

-- -----------------------------------------------------------------------------
-- Generic updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users). Data-minimised: no DOB, no national IDs.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  display_name text check (char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  headline text check (char_length(headline) <= 140),
  bio text check (char_length(bio) <= 2000),
  country_code text not null default 'GH' check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'Africa/Accra',
  locale text not null default 'en',
  learner_stage text check (learner_stage in ('shs', 'university', 'professional', 'other')),
  intended_role text not null default 'learner' check (intended_role in ('learner', 'educator', 'institution')),
  onboarding_completed boolean not null default false,
  marketing_opt_in boolean not null default false,
  status public.account_status not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Platform-level roles. A user may hold many. Never writable by the user.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_idx on public.user_roles (user_id);

-- Owner bootstrap list (private, never exposed).
create table private.owner_emails (email extensions.citext primary key);
insert into private.owner_emails (email) values ('profjero947@gmail.com');

-- Platform settings (key/value). `is_public` rows are readable by everyone.
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Schools / institutions
-- -----------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  institution_type text not null default 'shs'
    check (institution_type in ('basic', 'jhs', 'shs', 'tertiary', 'vocational', 'training_centre', 'other')),
  country_code text not null default 'GH' check (country_code ~ '^[A-Z]{2}$'),
  region text,
  city text,
  address text,
  contact_email extensions.citext not null,
  contact_phone text,
  website text check (website is null or website ~ '^https?://'),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  motto text,
  timezone text not null default 'Africa/Accra',
  estimated_learners integer check (estimated_learners is null or estimated_learners >= 0),
  applicant_role text,
  application_notes text,
  status public.school_status not null default 'pending',
  applied_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index schools_status_idx on public.schools (status);
create index schools_applied_by_idx on public.schools (applied_by);
create trigger schools_touch before update on public.schools
  for each row execute function private.touch_updated_at();

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.school_role not null,
  status public.membership_status not null default 'active',
  student_number text,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id, role)
);
create index school_memberships_user_idx on public.school_memberships (user_id, status);
create index school_memberships_school_idx on public.school_memberships (school_id, role, status);
create trigger school_memberships_touch before update on public.school_memberships
  for each row execute function private.touch_updated_at();

-- Invitations by email; accepted by a signed-in user whose email matches.
create table public.school_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  email extensions.citext not null,
  full_name text,
  role public.school_role not null check (role in ('teacher', 'student', 'school_admin')),
  class_id uuid, -- FK added once classes exist
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
create index school_invitations_email_idx on public.school_invitations (email, status);
create index school_invitations_school_idx on public.school_invitations (school_id, status);
create unique index school_invitations_pending_uniq on public.school_invitations (school_id, email, role) where status = 'pending';

-- Future-ready guardian linkage (no UI beyond admin view at launch).
create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users (id) on delete cascade,
  learner_id uuid not null references auth.users (id) on delete cascade,
  relationship text,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (guardian_id, learner_id),
  check (guardian_id <> learner_id)
);

-- Independent instructor applications (platform-level teacher role).
create table public.instructor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expertise text not null check (char_length(expertise) between 3 and 300),
  motivation text not null check (char_length(motivation) between 20 and 3000),
  portfolio_url text check (portfolio_url is null or portfolio_url ~ '^https?://'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);
create index instructor_applications_user_idx on public.instructor_applications (user_id);
create unique index instructor_applications_one_pending on public.instructor_applications (user_id) where status = 'pending';

-- -----------------------------------------------------------------------------
-- Audit log (append-only; written by SECURITY DEFINER functions only)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  school_id uuid references public.schools (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_school_idx on public.audit_logs (school_id, created_at desc);

create or replace function private.audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb, p_school uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details, school_id)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb), p_school);
$$;

-- -----------------------------------------------------------------------------
-- Authorisation helpers (SECURITY DEFINER so they can read role tables
-- without recursive RLS). They only ever answer about the *calling* user.
-- -----------------------------------------------------------------------------
create or replace function private.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = (select auth.uid()) and r.role = p_role and p.status = 'active'
  );
$$;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = (select auth.uid()) and r.role in ('platform_admin', 'owner') and p.status = 'active'
  );
$$;

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('owner');
$$;

create or replace function private.is_school_approved(p_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.schools s where s.id = p_school and s.status = 'approved');
$$;

create or replace function private.has_school_role(p_school uuid, p_roles public.school_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.school_memberships m
    join public.schools s on s.id = m.school_id
    where m.school_id = p_school and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = any (p_roles)
      and s.status = 'approved'
  );
$$;

create or replace function private.is_school_admin(p_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_school_role(p_school, array['school_admin']::public.school_role[]);
$$;

create or replace function private.is_school_staff(p_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_school_role(p_school, array['school_admin', 'teacher']::public.school_role[]);
$$;

create or replace function private.is_school_member(p_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_school_role(p_school, array['school_admin', 'teacher', 'student', 'guardian']::public.school_role[]);
$$;

-- Does the calling user share an active school with p_user where the caller is staff?
create or replace function private.is_staff_of_user(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.school_memberships mine
    join public.school_memberships theirs on theirs.school_id = mine.school_id
    join public.schools s on s.id = mine.school_id and s.status = 'approved'
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and mine.role in ('school_admin', 'teacher')
      and theirs.user_id = p_user and theirs.status in ('active', 'invited', 'pending')
  );
$$;

-- -----------------------------------------------------------------------------
-- New user bootstrap: profile + learner role (+ owner roles for bootstrap list)
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_intent text := coalesce(nullif(v_meta ->> 'intended_role', ''), 'learner');
begin
  if v_intent not in ('learner', 'educator', 'institution') then
    v_intent := 'learner';
  end if;

  insert into public.profiles (id, full_name, intended_role, learner_stage, country_code)
  values (
    new.id,
    left(coalesce(v_meta ->> 'full_name', ''), 120),
    v_intent,
    case when v_meta ->> 'learner_stage' in ('shs', 'university', 'professional', 'other') then v_meta ->> 'learner_stage' end,
    case when coalesce(v_meta ->> 'country_code', '') ~ '^[A-Z]{2}$' then v_meta ->> 'country_code' else 'GH' end
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'learner') on conflict do nothing;

  -- Owner bootstrap (email list is private and admin-controlled).
  if exists (select 1 from private.owner_emails o where o.email = new.email::extensions.citext) then
    insert into public.user_roles (user_id, role) values (new.id, 'owner'), (new.id, 'platform_admin'), (new.id, 'teacher')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Protect privileged profile columns from self-modification.
create or replace function private.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_platform_admin() then
    if new.status is distinct from old.status then
      raise exception 'Only platform administrators can change account status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

-- Protect privileged school columns (status/review) from non-admins.
create or replace function private.guard_school_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_platform_admin() then
    if new.status is distinct from old.status
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.review_notes is distinct from old.review_notes
       or new.applied_by is distinct from old.applied_by
       or new.slug is distinct from old.slug then
      raise exception 'Not allowed to change review fields' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger schools_guard before update on public.schools
  for each row execute function private.guard_school_update();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.school_invitations enable row level security;
alter table public.guardian_links enable row level security;
alter table public.instructor_applications enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: self, admins, school staff sharing a school. Public instructor
-- card data is exposed via the `public_instructors` view (see 0002).
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()) or private.is_staff_of_user(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()))
  with check (id = (select auth.uid()) or (select private.is_platform_admin()));

-- user_roles: read own (and admins read all). Writes only via RPC.
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

-- platform_settings
create policy settings_public_read on public.platform_settings for select to anon, authenticated
  using (is_public or (select private.is_platform_admin()));
create policy settings_admin_write on public.platform_settings for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

-- schools: approved schools are publicly listable (directory-safe columns via view);
-- applicants see their own application; members see their school; admins all.
create policy schools_select on public.schools for select to authenticated
  using (
    applied_by = (select auth.uid())
    or private.is_school_member(id)
    or (select private.is_platform_admin())
  );
create policy schools_apply on public.schools for insert to authenticated
  with check (applied_by = (select auth.uid()) and status = 'pending');
create policy schools_update on public.schools for update to authenticated
  using (private.is_school_admin(id) or (select private.is_platform_admin())
         or (applied_by = (select auth.uid()) and status = 'pending'))
  with check (private.is_school_admin(id) or (select private.is_platform_admin())
         or (applied_by = (select auth.uid()) and status = 'pending'));

-- memberships
create policy memberships_select on public.school_memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_school_staff(school_id) or (select private.is_platform_admin()));
create policy memberships_admin_write on public.school_memberships for insert to authenticated
  with check (private.is_school_admin(school_id) or (select private.is_platform_admin()));
create policy memberships_admin_update on public.school_memberships for update to authenticated
  using (private.is_school_admin(school_id) or (select private.is_platform_admin()))
  with check (private.is_school_admin(school_id) or (select private.is_platform_admin()));
create policy memberships_admin_delete on public.school_memberships for delete to authenticated
  using (private.is_school_admin(school_id) or (select private.is_platform_admin()));

-- invitations: school admins manage; invitee can see invitations for their email.
create policy invitations_select on public.school_invitations for select to authenticated
  using (
    private.is_school_admin(school_id) or (select private.is_platform_admin())
    or email = (select (auth.jwt() ->> 'email'))::extensions.citext
  );
create policy invitations_admin_insert on public.school_invitations for insert to authenticated
  with check (private.is_school_admin(school_id) or (select private.is_platform_admin()));
create policy invitations_admin_update on public.school_invitations for update to authenticated
  using (private.is_school_admin(school_id) or (select private.is_platform_admin()))
  with check (private.is_school_admin(school_id) or (select private.is_platform_admin()));

-- guardian links: either party or admin can read; admins write (future UI).
create policy guardian_select on public.guardian_links for select to authenticated
  using (guardian_id = (select auth.uid()) or learner_id = (select auth.uid()) or (select private.is_platform_admin()));
create policy guardian_admin_write on public.guardian_links for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

-- instructor applications
create policy instr_app_select on public.instructor_applications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));
create policy instr_app_insert on public.instructor_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null);

-- audit logs: platform admins see all; school admins see their school's.
create policy audit_select on public.audit_logs for select to authenticated
  using ((select private.is_platform_admin()) or (school_id is not null and private.is_school_admin(school_id)));

-- Public directory of approved schools (safe columns only).
create or replace function public.school_directory(p_search text default null)
returns table (id uuid, name text, slug text, institution_type text, country_code text, region text, city text, logo_url text, motto text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.slug, s.institution_type, s.country_code, s.region, s.city, s.logo_url, s.motto
  from public.schools s
  where s.status = 'approved'
    and (p_search is null or s.name ilike '%' || p_search || '%')
  order by s.name
  limit 200;
$$;
