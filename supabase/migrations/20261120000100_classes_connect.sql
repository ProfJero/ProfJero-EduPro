-- =============================================================================
-- 0012 EduConnect: teacher-owned classes, join codes & guests, student
--      leadership, study groups, peer help, polls, Class Pulse, preferences
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: preferences, guests, leaderboard privacy
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb check (pg_column_size(preferences) < 8000),
  add column if not exists is_guest boolean not null default false,
  add column if not exists leaderboard_opt_out boolean not null default false;

create or replace function private.is_guest()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_intent text := coalesce(nullif(v_meta ->> 'intended_role', ''), 'learner');
  v_guest boolean := coalesce(new.is_anonymous, false);
begin
  if v_intent not in ('learner', 'educator', 'institution') then v_intent := 'learner'; end if;
  insert into public.profiles (id, full_name, intended_role, learner_stage, country_code, is_guest, onboarding_completed)
  values (
    new.id,
    left(coalesce(v_meta ->> 'full_name', case when v_guest then 'Guest learner' else '' end), 120),
    case when v_guest then 'learner' else v_intent end,
    case when v_meta ->> 'learner_stage' in ('shs', 'university', 'professional', 'other') then v_meta ->> 'learner_stage' end,
    case when coalesce(v_meta ->> 'country_code', '') ~ '^[A-Z]{2}$' then v_meta ->> 'country_code' else 'GH' end,
    v_guest, v_guest
  ) on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'learner') on conflict do nothing;
  if not v_guest and new.email is not null and exists (select 1 from private.owner_emails o where o.email = new.email::extensions.citext) then
    insert into public.user_roles (user_id, role) values (new.id, 'owner'), (new.id, 'platform_admin'), (new.id, 'teacher') on conflict do nothing;
  end if;
  return new;
end $$;

-- When a guest upgrades to a full account (adds an email), clear the guest flag.
create or replace function private.handle_user_upgrade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    update public.profiles set is_guest = false where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_upgraded on auth.users;
create trigger on_auth_user_upgraded after update of is_anonymous on auth.users
  for each row execute function private.handle_user_upgrade();

-- Guests may not register schools, apply as instructors or self-enrol.
drop policy if exists schools_apply on public.schools;
create policy schools_apply on public.schools for insert to authenticated
  with check (applied_by = (select auth.uid()) and status = 'pending' and not private.is_guest());
drop policy if exists instr_app_insert on public.instructor_applications;
create policy instr_app_insert on public.instructor_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and not private.is_guest());

-- ---------------------------------------------------------------------------
-- Teacher-owned (independent) classes
-- ---------------------------------------------------------------------------
alter table public.school_classes alter column school_id drop not null;
alter table public.school_classes
  add column if not exists owner_id uuid references auth.users (id) on delete cascade,
  add column if not exists subject text,
  add column if not exists join_code text unique,
  add column if not exists join_enabled boolean not null default true,
  add column if not exists allow_guests boolean not null default false,
  add column if not exists join_requires_approval boolean not null default false,
  add column if not exists cover_url text check (cover_url is null or cover_url ~ '^https://');
alter table public.school_classes add constraint school_classes_owner_or_school check (school_id is not null or owner_id is not null);
create index if not exists school_classes_owner_idx on public.school_classes (owner_id);

alter table public.class_enrolments drop constraint if exists class_enrolments_status_check;
alter table public.class_enrolments add constraint class_enrolments_status_check check (status in ('active', 'pending', 'invited', 'removed'));
alter table public.class_enrolments add column if not exists joined_via text not null default 'school'
  check (joined_via in ('school', 'code', 'invite', 'teacher', 'guest'));

create or replace function private.gen_join_code()
returns text language plpgsql volatile set search_path = '' as $$
declare v text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    v := '';
    for i in 1..7 loop v := v || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.school_classes c where c.join_code = v);
  end loop;
  return v;
end $$;

-- Re-define class helpers so they work for both school and independent classes.
create or replace function private.is_class_teacher(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.school_classes c
    where c.id = p_class and (
      c.owner_id = (select auth.uid())
      or exists (
        select 1 from public.class_teachers ct where ct.class_id = c.id and ct.user_id = (select auth.uid())
          and (c.school_id is null or private.has_school_role(c.school_id, array['teacher', 'school_admin']::public.school_role[]))
      )
    )
  );
$$;

create or replace function private.can_manage_class(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_class_teacher(p_class)
      or (private.class_school(p_class) is not null and private.is_school_admin(private.class_school(p_class)))
      or private.is_platform_admin();
$$;

create or replace function private.is_class_student(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_enrolments e
    join public.school_classes c on c.id = e.class_id
    where e.class_id = p_class and e.user_id = (select auth.uid()) and e.status = 'active'
      and (c.school_id is null or private.has_school_role(c.school_id, array['student']::public.school_role[]))
  );
$$;

create or replace function private.guard_class_enrolment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_school uuid;
begin
  select school_id into v_school from public.school_classes where id = new.class_id;
  if v_school is null then return new; end if; -- independent classes: membership is managed by join/invite rules
  if not exists (
    select 1 from public.school_memberships m
    where m.school_id = v_school and m.user_id = new.user_id and m.role = 'student' and m.status = 'active'
  ) then
    raise exception 'Only active students of this school can join the class' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function private.guard_class_teacher()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_school uuid;
begin
  select school_id into v_school from public.school_classes where id = new.class_id;
  if v_school is null then return new; end if;
  if not exists (
    select 1 from public.school_memberships m
    where m.school_id = v_school and m.user_id = new.user_id and m.role in ('teacher', 'school_admin') and m.status = 'active'
  ) then
    raise exception 'Only active teachers of this school can be assigned to the class' using errcode = '23514';
  end if;
  return new;
end $$;

-- New independent class: owner becomes class teacher; join code generated.
create or replace function private.on_class_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    insert into public.class_teachers (class_id, user_id, is_class_teacher) values (new.id, new.owner_id, true) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger school_classes_created after insert on public.school_classes
  for each row execute function private.on_class_created();

create or replace function private.before_class_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_count integer;
begin
  if new.join_code is null then new.join_code := private.gen_join_code(); end if;
  if new.school_id is null and (select auth.uid()) is not null and not private.is_platform_admin() then
    v_limit := private.feature_limit('teacher_classes');
    if v_limit is not null then
      select count(*) into v_count from public.school_classes where owner_id = new.owner_id and school_id is null and not is_archived;
      if v_count >= v_limit then
        raise exception 'Your plan allows % active classes of your own. Archive one or ask about EduPro for Teachers.', v_limit using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger school_classes_before_insert before insert on public.school_classes
  for each row execute function private.before_class_insert();

-- Policies (replace the school-only ones)
drop policy if exists classes_select on public.school_classes;
drop policy if exists classes_write on public.school_classes;
create policy classes_select on public.school_classes for select to authenticated
  using (owner_id = (select auth.uid()) or (school_id is not null and private.is_school_staff(school_id))
         or private.is_class_teacher(id) or private.is_class_student(id) or (select private.is_platform_admin()));
create policy classes_insert on public.school_classes for insert to authenticated
  with check (
    (school_id is null and owner_id = (select auth.uid()) and not private.is_guest())
    or (school_id is not null and (private.is_school_admin(school_id) or (select private.is_platform_admin())))
  );
create policy classes_update on public.school_classes for update to authenticated
  using (private.can_manage_class(id)) with check (private.can_manage_class(id));
create policy classes_delete on public.school_classes for delete to authenticated
  using (owner_id = (select auth.uid()) or (school_id is not null and private.is_school_admin(school_id)) or (select private.is_platform_admin()));

-- Only the owner/school admin may change ownership or school.
create or replace function private.guard_class_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_platform_admin() then return new; end if;
  if new.owner_id is distinct from old.owner_id or new.school_id is distinct from old.school_id then
    raise exception 'Class ownership cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger school_classes_guard before update on public.school_classes
  for each row execute function private.guard_class_update();

drop policy if exists class_teachers_write on public.class_teachers;
create policy class_teachers_write on public.class_teachers for all to authenticated
  using ((private.class_school(class_id) is not null and private.is_school_admin(private.class_school(class_id)))
         or exists (select 1 from public.school_classes c where c.id = class_id and c.owner_id = (select auth.uid()))
         or (select private.is_platform_admin()))
  with check ((private.class_school(class_id) is not null and private.is_school_admin(private.class_school(class_id)))
         or exists (select 1 from public.school_classes c where c.id = class_id and c.owner_id = (select auth.uid()))
         or (select private.is_platform_admin()));

-- Class course assignment: the teacher must manage the course, or it must be public.
drop policy if exists class_courses_write on public.class_courses;
create policy class_courses_write on public.class_courses for all to authenticated
  using (private.can_manage_class(class_id))
  with check (private.can_manage_class(class_id) and (
    private.can_manage_course(course_id)
    or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'
               and (c.visibility in ('public', 'unlisted') or (c.visibility = 'school' and c.school_id = private.class_school(class_id))))
  ));

-- Pending members see the class name only via RPC; classmates see active roster.
drop policy if exists class_enrolments_select on public.class_enrolments;
create policy class_enrolments_select on public.class_enrolments for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_class(class_id) or (status = 'active' and private.is_class_student(class_id)));

-- Class invitations by email (independent classes).
create table public.class_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes (id) on delete cascade,
  email extensions.citext not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create unique index class_invitations_pending_uniq on public.class_invitations (class_id, email) where status = 'pending';
create index class_invitations_email_idx on public.class_invitations (email, status);
alter table public.class_invitations enable row level security;
create policy class_invites_select on public.class_invitations for select to authenticated
  using (private.can_manage_class(class_id) or email = (select (auth.jwt() ->> 'email'))::extensions.citext);
create policy class_invites_manage on public.class_invitations for all to authenticated
  using (private.can_manage_class(class_id)) with check (private.can_manage_class(class_id));

-- Public class preview by join code (for the join page; no private data).
create or replace function public.class_preview(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'class_id', c.id, 'name', c.name, 'stream', c.stream, 'subject', c.subject, 'description', c.description, 'color', c.color,
    'teacher', private.display_name(c.owner_id), 'school', (select s.name from public.schools s where s.id = c.school_id),
    'allow_guests', c.allow_guests, 'requires_approval', c.join_requires_approval, 'join_enabled', c.join_enabled,
    'members', (select count(*) from public.class_enrolments e where e.class_id = c.id and e.status = 'active'))
  from public.school_classes c
  where c.join_code = upper(btrim(p_code)) and not c.is_archived and c.school_id is null;
$$;

create or replace function public.join_class_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_c public.school_classes;
  v_status text;
  v_guest boolean := private.is_guest();
begin
  select * into v_c from public.school_classes where join_code = upper(btrim(p_code)) and not is_archived and school_id is null;
  if not found or not v_c.join_enabled then raise exception 'That class code is not valid or joining is closed' using errcode = 'P0002'; end if;
  if v_guest and not v_c.allow_guests then raise exception 'This class requires a free ProfJero Edu account. Please sign up to join.' using errcode = '42501'; end if;
  if v_c.owner_id = v_uid then return jsonb_build_object('class_id', v_c.id, 'status', 'owner'); end if;
  v_status := case when v_c.join_requires_approval then 'pending' else 'active' end;
  insert into public.class_enrolments (class_id, user_id, status, joined_via)
  values (v_c.id, v_uid, v_status, case when v_guest then 'guest' else 'code' end)
  on conflict (class_id, user_id) do update set status = case when public.class_enrolments.status = 'active' then 'active' else excluded.status end
  returning status into v_status;
  perform private.notify(v_c.owner_id, 'class_join',
    case when v_status = 'pending' then 'Join request: ' else 'New member in ' end || v_c.name,
    private.display_name(v_uid) || case when v_guest then ' (guest)' else '' end, '/teach/classes/' || v_c.id, jsonb_build_object('class_id', v_c.id));
  return jsonb_build_object('class_id', v_c.id, 'status', v_status);
end $$;

create or replace function public.regenerate_join_code(p_class uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  perform private.require_user();
  if not private.can_manage_class(p_class) then raise exception 'Not allowed' using errcode = '42501'; end if;
  v := private.gen_join_code();
  update public.school_classes set join_code = v where id = p_class;
  return v;
end $$;

-- Invite people to an independent class by email. Existing accounts get an
-- in-app invitation; others see it after signing up with that email.
create or replace function public.invite_to_class(p_class uuid, p_emails text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_email text; v_user uuid; v_n integer := 0; v_name text;
begin
  if not private.can_manage_class(p_class) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if cardinality(p_emails) > 300 then raise exception 'Up to 300 emails at a time' using errcode = '22023'; end if;
  select name into v_name from public.school_classes where id = p_class;
  foreach v_email in array p_emails loop
    v_email := lower(btrim(v_email));
    continue when v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
    insert into public.class_invitations (class_id, email, invited_by) values (p_class, v_email, v_uid) on conflict do nothing;
    select u.id into v_user from auth.users u where u.email = v_email;
    if v_user is not null then
      perform private.notify(v_user, 'class_invitation', 'You are invited to ' || v_name, 'Accept to join the class.', '/invitations', jsonb_build_object('class_id', p_class));
    end if;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('invited', v_n);
end $$;

create or replace function public.my_class_invitations()
returns table (id uuid, class_id uuid, class_name text, teacher text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, c.id, c.name, private.display_name(c.owner_id), i.created_at
  from public.class_invitations i join public.school_classes c on c.id = i.class_id
  where i.email = (select (auth.jwt() ->> 'email'))::extensions.citext and i.status = 'pending' and i.expires_at > now() and not c.is_archived;
$$;

create or replace function public.respond_class_invitation(p_invitation uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_i public.class_invitations;
begin
  select * into v_i from public.class_invitations where id = p_invitation for update;
  if not found or v_i.status <> 'pending' or v_i.email <> (select (auth.jwt() ->> 'email'))::extensions.citext then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  update public.class_invitations set status = case when p_accept then 'accepted' else 'declined' end where id = p_invitation;
  if p_accept then
    insert into public.class_enrolments (class_id, user_id, status, joined_via) values (v_i.class_id, v_uid, 'active', 'invite')
    on conflict (class_id, user_id) do update set status = 'active';
  end if;
  return v_i.class_id;
end $$;

-- Approve / decline a join request (teacher or a leader with that permission).
create or replace function public.review_join_request(p_class uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.can_manage_class(p_class) or private.leader_can(p_class, 'approve_join_requests')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.class_enrolments set status = case when p_approve then 'active' else 'removed' end
  where class_id = p_class and user_id = p_user and status = 'pending';
  if p_approve then
    perform private.notify(p_user, 'class_join', 'You have been admitted to ' || (select name from public.school_classes where id = p_class), null, '/learn/classes/' || p_class, '{}'::jsonb);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Student leadership
-- ---------------------------------------------------------------------------
create table public.class_leaders (
  class_id uuid not null references public.school_classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 60),
  permissions text[] not null default '{}' check (permissions <@ array[
    'post_board', 'moderate_discussion', 'pin_messages', 'take_attendance', 'create_polls',
    'manage_groups', 'post_announcements', 'view_progress', 'approve_join_requests']::text[]),
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_leaders_user_idx on public.class_leaders (user_id);

create or replace function private.leader_can(p_class uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_leaders l
    join public.class_enrolments e on e.class_id = l.class_id and e.user_id = l.user_id and e.status = 'active'
    where l.class_id = p_class and l.user_id = (select auth.uid()) and p_perm = any (l.permissions)
  );
$$;

create or replace function private.guard_class_leader()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.class_enrolments e where e.class_id = new.class_id and e.user_id = new.user_id and e.status = 'active') then
    raise exception 'Leaders must be active members of the class' using errcode = '23514';
  end if;
  new.assigned_by := (select auth.uid());
  return new;
end $$;
create trigger class_leaders_guard before insert or update on public.class_leaders
  for each row execute function private.guard_class_leader();

create or replace function private.trg_leader_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.user_id, 'leadership', 'You are now ' || new.title || ' of ' || (select name from public.school_classes where id = new.class_id),
    'Your teacher has given you leadership responsibilities.', '/learn/classes/' || new.class_id, '{}'::jsonb);
  return new;
end $$;
create trigger class_leaders_notify after insert on public.class_leaders for each row execute function private.trg_leader_notify();

alter table public.class_leaders enable row level security;
create policy leaders_select on public.class_leaders for select to authenticated using (private.is_class_member(class_id));
create policy leaders_manage on public.class_leaders for all to authenticated
  using (private.can_manage_class(class_id)) with check (private.can_manage_class(class_id));

-- Leaders with take_attendance can mark the register.
drop policy if exists class_attendance_select on public.class_attendance;
drop policy if exists class_attendance_write on public.class_attendance;
create policy class_attendance_select on public.class_attendance for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_class(class_id) or private.leader_can(class_id, 'take_attendance'));
create policy class_attendance_write on public.class_attendance for all to authenticated
  using (private.can_manage_class(class_id) or private.leader_can(class_id, 'take_attendance'))
  with check ((private.can_manage_class(class_id) or private.leader_can(class_id, 'take_attendance')) and marked_by = (select auth.uid()));

-- Leaders with post_announcements can post class announcements.
drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements for insert to authenticated
  with check (
    author_id = (select auth.uid()) and (
      (scope = 'platform' and (select private.is_platform_admin()))
      or (scope = 'school' and private.is_school_admin(school_id))
      or (scope = 'course' and private.can_manage_course(course_id))
      or (scope = 'class' and (private.can_manage_class(class_id) or private.leader_can(class_id, 'post_announcements')))
    )
  );

-- ---------------------------------------------------------------------------
-- Study groups & peer learning
-- ---------------------------------------------------------------------------
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.school_classes (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 1000),
  topic text,
  visibility text not null default 'open' check (visibility in ('open', 'invite')),
  max_members integer not null default 8 check (max_members between 2 and 100),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((class_id is not null) <> (course_id is not null))
);
create index study_groups_class_idx on public.study_groups (class_id);
create index study_groups_course_idx on public.study_groups (course_id);

create table public.study_group_members (
  group_id uuid not null references public.study_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index study_group_members_user_idx on public.study_group_members (user_id);

create or replace function private.in_scope(p_class uuid, p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_class is not null and private.is_class_member(p_class))
      or (p_course is not null and (private.is_enrolled(p_course) or private.can_manage_course(p_course)));
$$;
create or replace function private.manages_scope(p_class uuid, p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_class is not null and (private.can_manage_class(p_class) or private.leader_can(p_class, 'manage_groups')))
      or (p_course is not null and private.can_manage_course(p_course));
$$;
create or replace function private.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_group_members m where m.group_id = p_group and m.user_id = (select auth.uid()));
$$;
create or replace function private.can_manage_group(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_groups g where g.id = p_group and (
    g.created_by = (select auth.uid())
    or exists (select 1 from public.study_group_members m where m.group_id = g.id and m.user_id = (select auth.uid()) and m.role = 'leader')
    or private.manages_scope(g.class_id, g.course_id)));
$$;

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
create policy groups_select on public.study_groups for select to authenticated
  using (created_by = (select auth.uid()) or private.in_scope(class_id, course_id) or (select private.is_platform_admin()));
create policy groups_insert on public.study_groups for insert to authenticated
  with check (created_by = (select auth.uid()) and private.in_scope(class_id, course_id));
create policy groups_update on public.study_groups for update to authenticated
  using (private.can_manage_group(id)) with check (private.can_manage_group(id));
create policy groups_delete on public.study_groups for delete to authenticated using (private.can_manage_group(id));
create policy group_members_select on public.study_group_members for select to authenticated
  using (exists (select 1 from public.study_groups g where g.id = group_id and private.in_scope(g.class_id, g.course_id)));
create policy group_members_leave on public.study_group_members for delete to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_group(group_id));
create policy group_members_manage on public.study_group_members for update to authenticated
  using (private.can_manage_group(group_id)) with check (private.can_manage_group(group_id));

create or replace function private.on_group_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.study_group_members (group_id, user_id, role) values (new.id, new.created_by, 'leader') on conflict do nothing;
  return new;
end $$;
create trigger study_groups_created after insert on public.study_groups for each row execute function private.on_group_created();

-- Join an open group (or add someone, if you manage the group).
create or replace function public.join_study_group(p_group uuid, p_user uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_target uuid := coalesce(p_user, v_uid);
  v_g public.study_groups;
  v_count integer;
begin
  select * into v_g from public.study_groups where id = p_group;
  if not found or not private.in_scope(v_g.class_id, v_g.course_id) then raise exception 'Group not found' using errcode = 'P0002'; end if;
  if v_target <> v_uid and not private.can_manage_group(p_group) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_target = v_uid and v_g.visibility = 'invite' and not private.can_manage_group(p_group) then
    raise exception 'This group is invite-only' using errcode = '42501';
  end if;
  select count(*) into v_count from public.study_group_members where group_id = p_group;
  if v_count >= v_g.max_members then raise exception 'This group is full' using errcode = 'P0001'; end if;
  insert into public.study_group_members (group_id, user_id) values (p_group, v_target) on conflict do nothing;
end $$;

-- Extend classroom rooms with study-group rooms.
alter table public.classroom_messages drop constraint if exists classroom_messages_room_type_check;
alter table public.classroom_messages add constraint classroom_messages_room_type_check check (room_type in ('course', 'class', 'session', 'group'));
alter table public.classroom_messages add column if not exists is_accepted boolean not null default false;

create or replace function private.can_join_room(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'course' then private.is_enrolled(p_room) or private.can_manage_course(p_room) or private.teaches_course_class(p_room)
    when 'class' then private.is_class_member(p_room)
    when 'session' then private.can_view_session(p_room)
    when 'group' then private.is_group_member(p_room) or exists (select 1 from public.study_groups g where g.id = p_room and private.manages_scope(g.class_id, g.course_id))
    else false end;
$$;

create or replace function private.can_moderate_room(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'course' then private.can_manage_course(p_room)
    when 'class' then private.can_manage_class(p_room) or private.leader_can(p_room, 'moderate_discussion')
    when 'session' then private.can_manage_session(p_room)
    when 'group' then private.can_manage_group(p_room)
    else false end;
$$;

create or replace function private.guard_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type text := coalesce(new.room_type, old.room_type);
  v_room uuid := coalesce(new.room_id, old.room_id);
  v_mod boolean := private.can_moderate_room(v_type, v_room);
  v_board boolean := v_mod or (v_type = 'class' and private.leader_can(v_room, 'post_board'));
  v_pin boolean := v_mod or (v_type = 'class' and private.leader_can(v_room, 'pin_messages'));
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    new.author_name := coalesce((select coalesce(nullif(p.display_name, ''), p.full_name) from public.profiles p where p.id = new.user_id), '');
    if new.kind = 'board' and not v_board then raise exception 'Only teachers and class leaders can post to the class board' using errcode = '42501'; end if;
    if new.is_pinned and not v_pin then new.is_pinned := false; end if;
    new.is_accepted := false;
    return new;
  end if;
  if new.is_accepted is distinct from old.is_accepted and not v_mod and coalesce(current_setting('app.accept_answer', true), '') <> 'on' then
    raise exception 'Use accept_answer to accept an answer' using errcode = '42501';
  end if;
  if coalesce(current_setting('app.accept_answer', true), '') = 'on' then return new; end if;
  if not v_mod then
    if new.is_pinned is distinct from old.is_pinned and not v_pin then raise exception 'Not allowed' using errcode = '42501'; end if;
    if new.user_id <> (select auth.uid()) and not (v_pin and new.body = old.body and new.deleted_at is not distinct from old.deleted_at) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.kind is distinct from old.kind or new.room_id <> old.room_id or new.room_type <> old.room_type then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop policy if exists messages_update on public.classroom_messages;
create policy messages_update on public.classroom_messages for update to authenticated
  using (user_id = (select auth.uid()) or private.can_moderate_room(room_type, room_id)
         or (room_type = 'class' and private.leader_can(room_id, 'pin_messages')))
  with check (private.can_join_room(room_type, room_id));

create or replace function private.realtime_room_allowed(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_type text := split_part(p_topic, ':', 2);
  v_id text := split_part(p_topic, ':', 3);
begin
  if split_part(p_topic, ':', 1) <> 'room' or v_type not in ('course', 'class', 'session', 'group')
     or v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.can_join_room(v_type, v_id::uuid);
end $$;

-- Peer help: reactions and accepted answers.
create table public.message_reactions (
  message_id uuid not null references public.classroom_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'helpful' check (kind in ('helpful', 'thanks', 'insightful')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, kind)
);
create index message_reactions_user_idx on public.message_reactions (user_id);
alter table public.message_reactions enable row level security;
create policy reactions_select on public.message_reactions for select to authenticated
  using (exists (select 1 from public.classroom_messages m where m.id = message_id and private.can_join_room(m.room_type, m.room_id)));
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.classroom_messages m where m.id = message_id and m.user_id <> (select auth.uid()) and private.can_join_room(m.room_type, m.room_id)));
create policy reactions_delete on public.message_reactions for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.accept_answer(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.classroom_messages; v_parent public.classroom_messages;
begin
  perform private.require_user();
  select * into v_m from public.classroom_messages where id = p_message;
  select * into v_parent from public.classroom_messages where id = v_m.parent_id;
  if v_m.id is null or v_parent.id is null then raise exception 'Answer not found' using errcode = 'P0002'; end if;
  if not (v_parent.user_id = (select auth.uid()) or private.can_moderate_room(v_m.room_type, v_m.room_id)) then
    raise exception 'Only the person who asked (or the teacher) can accept an answer' using errcode = '42501';
  end if;
  perform set_config('app.accept_answer', 'on', true);
  update public.classroom_messages set is_accepted = (id = p_message) where parent_id = v_parent.id;
  update public.classroom_messages set is_resolved = true where id = v_parent.id;
  perform set_config('app.accept_answer', '', true);
  if v_m.user_id <> (select auth.uid()) then
    perform private.notify(v_m.user_id, 'peer_help', 'Your answer was accepted 🎉', left(v_parent.body, 120), null, '{}'::jsonb);
  end if;
end $$;

-- Top peer helpers in a room (by helpful reactions + accepted answers).
create or replace function public.peer_helpers(p_type text, p_room uuid)
returns table (user_id uuid, name text, helpful bigint, accepted bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_join_room(p_type, p_room) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select m.user_id, private.display_name(m.user_id),
      count(r.*) filter (where r.kind = 'helpful'), count(distinct m.id) filter (where m.is_accepted)
    from public.classroom_messages m left join public.message_reactions r on r.message_id = m.id
    where m.room_type = p_type and m.room_id = p_room and m.deleted_at is null and m.parent_id is not null
    group by m.user_id
    having count(r.*) filter (where r.kind = 'helpful') + count(distinct m.id) filter (where m.is_accepted) > 0
    order by 4 desc, 3 desc limit 10;
end $$;

-- ---------------------------------------------------------------------------
-- Polls & voting (decision making)
-- ---------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  room_type text not null check (room_type in ('course', 'class', 'session', 'group')),
  room_id uuid not null,
  question text not null check (char_length(question) between 3 and 300),
  description text check (char_length(description) <= 1000),
  multiple boolean not null default false,
  anonymous boolean not null default true,
  show_results text not null default 'after_vote' check (show_results in ('always', 'after_vote', 'after_close')),
  closes_at timestamptz,
  is_closed boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index polls_room_idx on public.polls (room_type, room_id, created_at desc);
create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  position integer not null default 0
);
create index poll_options_poll_idx on public.poll_options (poll_id);
create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);
create index poll_votes_user_idx on public.poll_votes (user_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
create policy polls_select on public.polls for select to authenticated using (private.can_join_room(room_type, room_id));
create policy polls_close on public.polls for update to authenticated
  using (created_by = (select auth.uid()) or private.can_moderate_room(room_type, room_id))
  with check (created_by = (select auth.uid()) or private.can_moderate_room(room_type, room_id));
create policy polls_delete on public.polls for delete to authenticated
  using (created_by = (select auth.uid()) or private.can_moderate_room(room_type, room_id));
create policy poll_options_select on public.poll_options for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and private.can_join_room(p.room_type, p.room_id)));
create policy poll_votes_own on public.poll_votes for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.can_create_poll(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_moderate_room(p_type, p_room)
      or (p_type = 'class' and private.leader_can(p_room, 'create_polls'))
      or (p_type = 'group' and private.is_group_member(p_room));
$$;

create or replace function public.create_poll(p_room_type text, p_room uuid, p_question text, p_options text[], p_multiple boolean default false,
  p_anonymous boolean default true, p_show_results text default 'after_vote', p_closes_at timestamptz default null, p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_id uuid; v_opt text; v_pos integer := 0; v_audience record;
begin
  if not private.can_create_poll(p_room_type, p_room) then raise exception 'You cannot create polls here' using errcode = '42501'; end if;
  if cardinality(p_options) < 2 or cardinality(p_options) > 12 then raise exception 'Provide between 2 and 12 options' using errcode = '22023'; end if;
  insert into public.polls (room_type, room_id, question, description, multiple, anonymous, show_results, closes_at, created_by)
  values (p_room_type, p_room, btrim(p_question), p_description, p_multiple, p_anonymous, p_show_results, p_closes_at, v_uid) returning id into v_id;
  foreach v_opt in array p_options loop
    if btrim(v_opt) <> '' then insert into public.poll_options (poll_id, label, position) values (v_id, btrim(v_opt), v_pos); v_pos := v_pos + 1; end if;
  end loop;
  if p_room_type = 'class' then
    for v_audience in select e.user_id from public.class_enrolments e where e.class_id = p_room and e.status = 'active' and e.user_id <> v_uid loop
      perform private.notify(v_audience.user_id, 'poll', 'New poll: ' || left(p_question, 100), 'Cast your vote.', '/learn/classes/' || p_room, jsonb_build_object('poll_id', v_id));
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.cast_vote(p_poll uuid, p_option_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_p public.polls;
begin
  select * into v_p from public.polls where id = p_poll;
  if not found or not private.can_join_room(v_p.room_type, v_p.room_id) then raise exception 'Poll not found' using errcode = 'P0002'; end if;
  if v_p.is_closed or (v_p.closes_at is not null and v_p.closes_at <= now()) then raise exception 'This poll is closed' using errcode = 'P0001'; end if;
  if cardinality(p_option_ids) = 0 then raise exception 'Choose an option' using errcode = '22023'; end if;
  if not v_p.multiple and cardinality(p_option_ids) > 1 then raise exception 'Choose only one option' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_option_ids) o where not exists (select 1 from public.poll_options po where po.id = o and po.poll_id = p_poll)) then
    raise exception 'Invalid option' using errcode = '22023';
  end if;
  delete from public.poll_votes where poll_id = p_poll and user_id = v_uid;
  insert into public.poll_votes (poll_id, option_id, user_id) select p_poll, o, v_uid from unnest(p_option_ids) o;
end $$;

create or replace function public.poll_results(p_poll uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user(); v_p public.polls; v_mod boolean; v_voted boolean; v_closed boolean; v_show boolean;
begin
  select * into v_p from public.polls where id = p_poll;
  if not found or not private.can_join_room(v_p.room_type, v_p.room_id) then raise exception 'Poll not found' using errcode = 'P0002'; end if;
  v_mod := private.can_moderate_room(v_p.room_type, v_p.room_id) or v_p.created_by = v_uid;
  v_voted := exists (select 1 from public.poll_votes where poll_id = p_poll and user_id = v_uid);
  v_closed := v_p.is_closed or (v_p.closes_at is not null and v_p.closes_at <= now());
  v_show := v_mod or v_p.show_results = 'always' or (v_p.show_results = 'after_vote' and (v_voted or v_closed)) or (v_p.show_results = 'after_close' and v_closed);
  return jsonb_build_object(
    'closed', v_closed, 'voted', v_voted, 'can_manage', v_mod, 'visible', v_show,
    'my_votes', coalesce((select jsonb_agg(option_id) from public.poll_votes where poll_id = p_poll and user_id = v_uid), '[]'::jsonb),
    'total_voters', case when v_show then (select count(distinct user_id) from public.poll_votes where poll_id = p_poll) end,
    'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
        'votes', case when v_show then (select count(*) from public.poll_votes v where v.option_id = o.id) end,
        'voters', case when v_show and not v_p.anonymous then (select coalesce(jsonb_agg(private.display_name(v.user_id)), '[]'::jsonb) from public.poll_votes v where v.option_id = o.id) end
      ) order by o.position) from public.poll_options o where o.poll_id = p_poll)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Class Pulse: quick, anonymous understanding/mood check-ins
-- ---------------------------------------------------------------------------
create table public.pulse_checks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.school_classes (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  kind text not null default 'understanding' check (kind in ('understanding', 'confidence', 'pace', 'mood')),
  question text not null check (char_length(question) between 3 and 200),
  created_by uuid not null references auth.users (id) on delete cascade,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  check ((class_id is not null) <> (course_id is not null))
);
create index pulse_checks_class_idx on public.pulse_checks (class_id, created_at desc);
create index pulse_checks_course_idx on public.pulse_checks (course_id, created_at desc);
create table public.pulse_responses (
  check_id uuid not null references public.pulse_checks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  primary key (check_id, user_id)
);
alter table public.pulse_checks enable row level security;
alter table public.pulse_responses enable row level security;
create policy pulse_select on public.pulse_checks for select to authenticated using (private.in_scope(class_id, course_id));
create policy pulse_insert on public.pulse_checks for insert to authenticated
  with check (created_by = (select auth.uid()) and ((class_id is not null and private.can_manage_class(class_id)) or (course_id is not null and private.can_manage_course(course_id))));
create policy pulse_delete on public.pulse_checks for delete to authenticated using (created_by = (select auth.uid()));
create policy pulse_resp_own on public.pulse_responses for select to authenticated using (user_id = (select auth.uid()));
create policy pulse_resp_insert on public.pulse_responses for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.pulse_checks c where c.id = check_id and private.in_scope(c.class_id, c.course_id)
    and (c.closes_at is null or c.closes_at > now())));
create policy pulse_resp_update on public.pulse_responses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.pulse_summary(p_check uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_c public.pulse_checks;
begin
  perform private.require_user();
  select * into v_c from public.pulse_checks where id = p_check;
  if not found or not ((v_c.class_id is not null and private.can_manage_class(v_c.class_id)) or (v_c.course_id is not null and private.can_manage_course(v_c.course_id))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- Responses are anonymous to teachers: distribution + comments only.
  return jsonb_build_object(
    'responses', (select count(*) from public.pulse_responses where check_id = p_check),
    'average', (select round(avg(value), 2) from public.pulse_responses where check_id = p_check),
    'distribution', (select jsonb_object_agg(v, coalesce(n, 0)) from generate_series(1, 5) v
                     left join (select value, count(*) n from public.pulse_responses where check_id = p_check group by value) x on x.value = v),
    'comments', (select coalesce(jsonb_agg(comment order by created_at desc), '[]'::jsonb) from public.pulse_responses where check_id = p_check and coalesce(comment, '') <> '')
  );
end $$;

-- Class progress for teachers and leaders with view_progress.
create or replace function public.class_progress(p_class uuid)
returns table (user_id uuid, name text, avatar_url text, avg_progress numeric, last_activity_at timestamptz, attendance_rate numeric, submissions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.can_manage_class(p_class) or private.leader_can(p_class, 'view_progress')) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select e.user_id, private.display_name(e.user_id), (select p.avatar_url from public.profiles p where p.id = e.user_id),
      (select round(avg(ce.progress_pct), 1) from public.course_enrolments ce where ce.user_id = e.user_id and ce.class_id = p_class),
      (select max(ce.last_activity_at) from public.course_enrolments ce where ce.user_id = e.user_id),
      (select round(100.0 * avg(case when a.status in ('present', 'late') then 1 else 0 end), 1) from public.class_attendance a where a.class_id = p_class and a.user_id = e.user_id),
      (select count(*) from public.assignment_submissions s join public.assignments asg on asg.id = s.assignment_id where asg.class_id = p_class and s.user_id = e.user_id and s.status in ('submitted', 'graded'))
    from public.class_enrolments e where e.class_id = p_class and e.status = 'active' order by 2;
end $$;

-- Pending join requests (teachers / leaders).
create or replace function public.class_join_requests(p_class uuid)
returns table (user_id uuid, name text, is_guest boolean, requested_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not (private.can_manage_class(p_class) or private.leader_can(p_class, 'approve_join_requests')) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query select e.user_id, private.display_name(e.user_id), coalesce(p.is_guest, false), e.created_at
    from public.class_enrolments e left join public.profiles p on p.id = e.user_id
    where e.class_id = p_class and e.status = 'pending' order by e.created_at;
end $$;

-- Guests cannot self-enrol in courses (they join classes only).
create or replace function private.guard_guest_enrol()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'self' and private.is_guest() then
    raise exception 'Create a free account to enrol in courses.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger course_enrolments_guest before insert on public.course_enrolments for each row execute function private.guard_guest_enrol();

-- Realtime for polls (new polls appear live).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.polls, public.message_reactions;
  end if;
end $$;

-- Grants for new objects
grant select, insert, update, delete on public.class_invitations, public.class_leaders, public.study_groups, public.study_group_members,
  public.message_reactions, public.polls, public.pulse_checks, public.pulse_responses to authenticated;
grant select on public.poll_options, public.poll_votes to authenticated;
grant execute on function public.class_preview(text) to anon, authenticated;
grant execute on function public.join_class_by_code(text), public.regenerate_join_code(uuid), public.invite_to_class(uuid, text[]),
  public.my_class_invitations(), public.respond_class_invitation(uuid, boolean), public.review_join_request(uuid, uuid, boolean),
  public.join_study_group(uuid, uuid), public.accept_answer(uuid), public.peer_helpers(text, uuid), public.create_poll(text, uuid, text, text[], boolean, boolean, text, timestamptz, text),
  public.cast_vote(uuid, uuid[]), public.poll_results(uuid), public.pulse_summary(uuid), public.class_progress(uuid), public.class_join_requests(uuid) to authenticated;
revoke execute on function public.join_class_by_code(text), public.regenerate_join_code(uuid), public.invite_to_class(uuid, text[]),
  public.my_class_invitations(), public.respond_class_invitation(uuid, boolean), public.review_join_request(uuid, uuid, boolean),
  public.join_study_group(uuid, uuid), public.accept_answer(uuid), public.peer_helpers(text, uuid), public.create_poll(text, uuid, text, text[], boolean, boolean, text, timestamptz, text),
  public.cast_vote(uuid, uuid[]), public.poll_results(uuid), public.pulse_summary(uuid), public.class_progress(uuid), public.class_join_requests(uuid) from anon;
grant execute on all functions in schema private to anon, authenticated;

-- Plan feature for teacher-owned classes
insert into public.features (key, name, description, kind, sort_order) values
  ('teacher_classes', 'Own classes', 'Number of active classes a teacher can run outside a school', 'limit', 10)
on conflict (key) do nothing;
insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, 'teacher_classes', true, case when p.tier = 'edupro' then null else 10 end
from public.plans p where p.scope in ('individual', 'teacher')
on conflict do nothing;
