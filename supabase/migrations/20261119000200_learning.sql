-- =============================================================================
-- 0002 Learning: academic structure, catalogue, courses, lessons, enrolment, progress
-- =============================================================================

create type public.content_status as enum ('draft', 'in_review', 'published', 'unpublished', 'archived');
create type public.course_visibility as enum ('public', 'unlisted', 'school', 'private');
create type public.enrolment_method as enum ('open', 'invite', 'closed');
create type public.course_level as enum ('beginner', 'intermediate', 'advanced', 'all_levels');
create type public.enrolment_source as enum ('self', 'teacher', 'school', 'admin');
create type public.enrolment_status as enum ('active', 'completed', 'dropped');
create type public.lesson_block_type as enum (
  'heading', 'paragraph', 'image', 'video', 'audio', 'code', 'callout', 'activity',
  'quiz', 'resource', 'link', 'table', 'steps', 'embed', 'divider'
);
create type public.lesson_completion_rule as enum ('mark_complete', 'quiz_pass', 'assignment_submit');

-- -----------------------------------------------------------------------------
-- Academic structure (per school)
-- -----------------------------------------------------------------------------
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (school_id, name)
);
create unique index academic_years_one_current on public.academic_years (school_id) where is_current;

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (academic_year_id, name)
);
create index academic_terms_school_idx on public.academic_terms (school_id);
create index academic_terms_year_idx on public.academic_terms (academic_year_id);
create unique index academic_terms_one_current on public.academic_terms (school_id) where is_current;

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  stream text,
  level text,
  description text,
  room_label text,
  color text not null default 'blue' check (color in ('blue', 'green', 'amber', 'rose', 'violet', 'teal', 'slate')),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, name, stream)
);
create index school_classes_school_idx on public.school_classes (school_id);
create index school_classes_year_idx on public.school_classes (academic_year_id);
create trigger school_classes_touch before update on public.school_classes
  for each row execute function private.touch_updated_at();

alter table public.school_invitations
  add constraint school_invitations_class_fk foreign key (class_id) references public.school_classes (id) on delete set null;

create table public.class_teachers (
  class_id uuid not null references public.school_classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_class_teacher boolean not null default false,
  subject text,
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_teachers_user_idx on public.class_teachers (user_id);

create table public.class_enrolments (
  class_id uuid not null references public.school_classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_enrolments_user_idx on public.class_enrolments (user_id);

create table public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  note text,
  marked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, user_id, attendance_date)
);
create index class_attendance_class_date_idx on public.class_attendance (class_id, attendance_date);
create index class_attendance_user_idx on public.class_attendance (user_id);

-- Class helpers ---------------------------------------------------------------
create or replace function private.class_school(p_class uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select school_id from public.school_classes where id = p_class;
$$;

create or replace function private.is_class_teacher(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_teachers ct
    join public.school_classes c on c.id = ct.class_id
    where ct.class_id = p_class and ct.user_id = (select auth.uid())
      and private.has_school_role(c.school_id, array['teacher', 'school_admin']::public.school_role[])
  );
$$;

create or replace function private.can_manage_class(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_class_teacher(p_class)
      or private.is_school_admin(private.class_school(p_class))
      or private.is_platform_admin();
$$;

create or replace function private.is_class_student(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_enrolments e
    join public.school_classes c on c.id = e.class_id
    where e.class_id = p_class and e.user_id = (select auth.uid()) and e.status = 'active'
      and private.has_school_role(c.school_id, array['student']::public.school_role[])
  );
$$;

create or replace function private.is_class_member(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_class_student(p_class) or private.can_manage_class(p_class);
$$;

-- Teacher of a class the given user is in?
create or replace function private.teaches_user(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_teachers ct
    join public.class_enrolments e on e.class_id = ct.class_id and e.status = 'active'
    where ct.user_id = (select auth.uid()) and e.user_id = p_user
  );
$$;

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  icon text not null default 'book-open',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 3 and 160),
  short_description text not null default '' check (char_length(short_description) <= 280),
  description text not null default '',
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  category_id uuid references public.categories (id) on delete set null,
  subject text,
  target_audience text,
  level public.course_level not null default 'all_levels',
  objectives text[] not null default '{}',
  prerequisites_text text,
  estimated_hours numeric(6, 1) check (estimated_hours is null or estimated_hours >= 0),
  language text not null default 'en',
  visibility public.course_visibility not null default 'public',
  enrolment_method public.enrolment_method not null default 'open',
  status public.content_status not null default 'draft',
  is_premium boolean not null default false,
  owner_id uuid not null references auth.users (id) on delete restrict,
  school_id uuid references public.schools (id) on delete cascade,
  completion_lesson_pct integer not null default 100 check (completion_lesson_pct between 1 and 100),
  completion_requires_assessments boolean not null default true,
  certificate_enabled boolean not null default true,
  review_notes text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility <> 'school' or school_id is not null)
);
create index courses_status_vis_idx on public.courses (status, visibility);
create index courses_owner_idx on public.courses (owner_id);
create index courses_school_idx on public.courses (school_id);
create index courses_category_idx on public.courses (category_id);
create index courses_search_idx on public.courses using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(short_description, '') || ' ' || coalesce(subject, ''))
);
create trigger courses_touch before update on public.courses
  for each row execute function private.touch_updated_at();

create table public.course_instructors (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'instructor' check (role in ('lead', 'instructor', 'assistant')),
  created_at timestamptz not null default now(),
  primary key (course_id, user_id)
);
create index course_instructors_user_idx on public.course_instructors (user_id);

create table public.course_prerequisites (
  course_id uuid not null references public.courses (id) on delete cascade,
  prerequisite_id uuid not null references public.courses (id) on delete cascade,
  primary key (course_id, prerequisite_id),
  check (course_id <> prerequisite_id)
);
create index course_prereq_prereq_idx on public.course_prerequisites (prerequisite_id);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  position integer not null default 0,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_modules_course_idx on public.course_modules (course_id, position);
create trigger course_modules_touch before update on public.course_modules
  for each row execute function private.touch_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid not null references public.course_modules (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  summary text,
  position integer not null default 0,
  status public.content_status not null default 'draft',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 600),
  completion_rule public.lesson_completion_rule not null default 'mark_complete',
  quiz_assessment_id uuid, -- FK added in 0003
  assignment_id uuid,      -- FK added in 0003
  is_preview boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id, status);
create trigger lessons_touch before update on public.lessons
  for each row execute function private.touch_updated_at();

-- Ordered, typed content blocks. `content` holds the block-type-specific
-- payload (validated by the app; size-limited here).
create table public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  type public.lesson_block_type not null,
  position integer not null default 0,
  content jsonb not null default '{}'::jsonb check (pg_column_size(content) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lesson_blocks_lesson_idx on public.lesson_blocks (lesson_id, position);
create trigger lesson_blocks_touch before update on public.lesson_blocks
  for each row execute function private.touch_updated_at();

create table public.lesson_revisions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null,
  blocks jsonb not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index lesson_revisions_lesson_idx on public.lesson_revisions (lesson_id, created_at desc);

create table public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  kind text not null default 'link' check (kind in ('link', 'document', 'image', 'video', 'audio', 'other')),
  url text not null check (url ~ '^https://'),
  cloudinary_public_id text,
  bytes bigint,
  allow_offline boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index course_resources_course_idx on public.course_resources (course_id);
create index course_resources_lesson_idx on public.course_resources (lesson_id);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  cover_url text,
  status public.content_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.learning_path_courses (
  path_id uuid not null references public.learning_paths (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  position integer not null default 0,
  primary key (path_id, course_id)
);
create index learning_path_courses_course_idx on public.learning_path_courses (course_id);

create table public.class_courses (
  class_id uuid not null references public.school_classes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, course_id)
);
create index class_courses_course_idx on public.class_courses (course_id);

-- -----------------------------------------------------------------------------
-- Enrolment & progress
-- -----------------------------------------------------------------------------
create table public.course_enrolments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source public.enrolment_source not null default 'self',
  school_id uuid references public.schools (id) on delete set null,
  class_id uuid references public.school_classes (id) on delete set null,
  status public.enrolment_status not null default 'active',
  progress_pct numeric(5, 2) not null default 0,
  last_lesson_id uuid references public.lessons (id) on delete set null,
  last_activity_at timestamptz,
  enrolled_by uuid references auth.users (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (course_id, user_id)
);
create index course_enrolments_user_idx on public.course_enrolments (user_id, status);
create index course_enrolments_course_idx on public.course_enrolments (course_id, status);
create index course_enrolments_class_idx on public.course_enrolments (class_id);

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress (course_id, user_id);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index bookmarks_lesson_idx on public.bookmarks (lesson_id);

create table public.learning_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  course_id uuid references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index learning_activity_user_idx on public.learning_activity (user_id, created_at desc);
create index learning_activity_course_idx on public.learning_activity (course_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Course access helpers
-- -----------------------------------------------------------------------------
create or replace function private.is_course_instructor(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.courses c where c.id = p_course and c.owner_id = (select auth.uid()))
      or exists (select 1 from public.course_instructors i where i.course_id = p_course and i.user_id = (select auth.uid()));
$$;

create or replace function private.can_manage_course(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_course_instructor(p_course)
      or private.is_platform_admin()
      or exists (select 1 from public.courses c where c.id = p_course and c.school_id is not null and private.is_school_admin(c.school_id));
$$;

create or replace function private.is_enrolled(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_enrolments e
    where e.course_id = p_course and e.user_id = (select auth.uid()) and e.status in ('active', 'completed')
  );
$$;

-- Teacher of a class that this course is assigned to?
create or replace function private.teaches_course_class(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_courses cc
    join public.class_teachers ct on ct.class_id = cc.class_id
    where cc.course_id = p_course and ct.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_course(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and (
      (c.status = 'published' and c.visibility in ('public', 'unlisted'))
      or (c.status = 'published' and c.visibility = 'school' and private.is_school_member(c.school_id))
      or (c.status in ('published', 'unpublished') and private.is_enrolled(c.id))
      or private.can_manage_course(c.id)
      or private.teaches_course_class(c.id)
    )
  );
$$;

create or replace function private.can_access_lesson_content(p_lesson uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = p_lesson and (
      private.can_manage_course(c.id)
      or private.teaches_course_class(c.id)
      or (l.status = 'published' and c.status in ('published', 'unpublished') and private.is_enrolled(c.id))
      or (l.status = 'published' and l.is_preview and c.status = 'published' and c.visibility in ('public', 'unlisted'))
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.academic_years enable row level security;
alter table public.academic_terms enable row level security;
alter table public.school_classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_enrolments enable row level security;
alter table public.class_attendance enable row level security;
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_instructors enable row level security;
alter table public.course_prerequisites enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_blocks enable row level security;
alter table public.lesson_revisions enable row level security;
alter table public.course_resources enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_path_courses enable row level security;
alter table public.class_courses enable row level security;
alter table public.course_enrolments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.learning_activity enable row level security;

-- Academic structure: members of the school read; school admins write.
create policy years_select on public.academic_years for select to authenticated
  using (private.is_school_member(school_id) or (select private.is_platform_admin()));
create policy years_write on public.academic_years for all to authenticated
  using (private.is_school_admin(school_id) or (select private.is_platform_admin()))
  with check (private.is_school_admin(school_id) or (select private.is_platform_admin()));
create policy terms_select on public.academic_terms for select to authenticated
  using (private.is_school_member(school_id) or (select private.is_platform_admin()));
create policy terms_write on public.academic_terms for all to authenticated
  using (private.is_school_admin(school_id) or (select private.is_platform_admin()))
  with check (private.is_school_admin(school_id) or (select private.is_platform_admin()));

create policy classes_select on public.school_classes for select to authenticated
  using (private.is_school_staff(school_id) or private.is_class_student(id) or (select private.is_platform_admin()));
create policy classes_write on public.school_classes for all to authenticated
  using (private.is_school_admin(school_id) or (select private.is_platform_admin()))
  with check (private.is_school_admin(school_id) or (select private.is_platform_admin()));

create policy class_teachers_select on public.class_teachers for select to authenticated
  using (private.is_class_member(class_id) or private.is_school_staff(private.class_school(class_id)));
create policy class_teachers_write on public.class_teachers for all to authenticated
  using (private.is_school_admin(private.class_school(class_id)) or (select private.is_platform_admin()))
  with check (private.is_school_admin(private.class_school(class_id)) or (select private.is_platform_admin()));

-- Classmates can see the roster (the "classroom" feel); writes by class managers.
create policy class_enrolments_select on public.class_enrolments for select to authenticated
  using (user_id = (select auth.uid()) or private.is_class_member(class_id));
create policy class_enrolments_write on public.class_enrolments for all to authenticated
  using (private.can_manage_class(class_id)) with check (private.can_manage_class(class_id));

create policy class_attendance_select on public.class_attendance for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_class(class_id));
create policy class_attendance_write on public.class_attendance for all to authenticated
  using (private.can_manage_class(class_id)) with check (private.can_manage_class(class_id) and marked_by = (select auth.uid()));

-- Catalogue
create policy categories_read on public.categories for select to anon, authenticated using (is_active or (select private.is_platform_admin()));
create policy categories_write on public.categories for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

create policy courses_read on public.courses for select to anon, authenticated
  using (owner_id = (select auth.uid()) or (status = 'published' and visibility in ('public', 'unlisted')) or private.can_view_course(id));
create policy courses_insert on public.courses for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (status in ('draft', 'in_review') or private.is_platform_admin())
    and (
      (school_id is null and (private.has_role('teacher') or private.is_platform_admin()))
      or (school_id is not null and private.is_school_staff(school_id))
    )
  );
create policy courses_update on public.courses for update to authenticated
  using (private.can_manage_course(id)) with check (private.can_manage_course(id));
create policy courses_delete on public.courses for delete to authenticated
  using ((owner_id = (select auth.uid()) and status = 'draft') or (select private.is_platform_admin()));

-- Publishing guard: only platform admins (any course) or school admins (their
-- school's courses) may set status = published. Independent instructors submit
-- for review. is_premium is admin-only.
create or replace function private.guard_course_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean := private.is_platform_admin();
begin
  if (select auth.uid()) is null then return new; end if; -- service role / migrations
  if new.status = 'published' and old.status is distinct from 'published' then
    if not (v_admin or (new.school_id is not null and private.is_school_admin(new.school_id))
            or (new.school_id is not null and private.is_school_staff(new.school_id)
                and exists (select 1 from public.platform_settings s where s.key = 'courses.school_teachers_can_publish' and s.value = 'true'::jsonb))) then
      raise exception 'You need publishing rights for this course. Submit it for review instead.' using errcode = '42501';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.is_premium is distinct from old.is_premium and not v_admin then
    raise exception 'Only platform administrators can change premium status' using errcode = '42501';
  end if;
  if new.owner_id is distinct from old.owner_id and not v_admin then
    raise exception 'Only platform administrators can transfer ownership' using errcode = '42501';
  end if;
  if new.school_id is distinct from old.school_id and not v_admin then
    raise exception 'Only platform administrators can move a course between schools' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger courses_guard before update on public.courses
  for each row execute function private.guard_course_update();

create or replace function private.guard_course_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_platform_admin() then
    new.is_premium := false;
  end if;
  return new;
end $$;
create trigger courses_guard_insert before insert on public.courses
  for each row execute function private.guard_course_insert();

create policy course_instructors_read on public.course_instructors for select to anon, authenticated
  using (private.can_view_course(course_id));
create policy course_instructors_write on public.course_instructors for all to authenticated
  using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy prereq_read on public.course_prerequisites for select to anon, authenticated using (private.can_view_course(course_id));
create policy prereq_write on public.course_prerequisites for all to authenticated
  using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy modules_read on public.course_modules for select to anon, authenticated
  using (private.can_manage_course(course_id) or (status = 'published' and private.can_view_course(course_id)));
create policy modules_write on public.course_modules for all to authenticated
  using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

-- Lesson outline (titles) is visible to anyone who can view the course;
-- the actual content lives in lesson_blocks with stricter rules.
create policy lessons_read on public.lessons for select to anon, authenticated
  using (private.can_manage_course(course_id) or private.teaches_course_class(course_id)
         or (status = 'published' and private.can_view_course(course_id)));
create policy lessons_write on public.lessons for all to authenticated
  using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy blocks_read on public.lesson_blocks for select to anon, authenticated
  using (private.can_access_lesson_content(lesson_id));
create policy blocks_write on public.lesson_blocks for all to authenticated
  using (private.can_manage_course((select l.course_id from public.lessons l where l.id = lesson_id)))
  with check (private.can_manage_course((select l.course_id from public.lessons l where l.id = lesson_id)));

create policy revisions_read on public.lesson_revisions for select to authenticated
  using (private.can_manage_course((select l.course_id from public.lessons l where l.id = lesson_id)));

create policy resources_read on public.course_resources for select to authenticated
  using (private.can_manage_course(course_id) or private.teaches_course_class(course_id) or private.is_enrolled(course_id));
create policy resources_write on public.course_resources for all to authenticated
  using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy paths_read on public.learning_paths for select to anon, authenticated
  using (status = 'published' or (select private.is_platform_admin()));
create policy paths_write on public.learning_paths for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy path_courses_read on public.learning_path_courses for select to anon, authenticated using (true);
create policy path_courses_write on public.learning_path_courses for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

create policy class_courses_select on public.class_courses for select to authenticated
  using (private.is_class_member(class_id));
create policy class_courses_write on public.class_courses for all to authenticated
  using (private.can_manage_class(class_id)) with check (private.can_manage_class(class_id));

-- Enrolments: learners see own; course managers & class teachers see their learners.
-- All writes go through RPCs (enrol_in_course, enrol_users, class assignment trigger).
create policy enrolments_select on public.course_enrolments for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_manage_course(course_id)
    or (class_id is not null and private.can_manage_class(class_id))
    or private.teaches_user(user_id)
    or (school_id is not null and private.is_school_admin(school_id))
  );
create policy enrolments_drop_self on public.course_enrolments for update to authenticated
  using (user_id = (select auth.uid()) and source = 'self')
  with check (user_id = (select auth.uid()) and source = 'self' and status in ('active', 'dropped'));

-- Progress: own rows; teachers/managers read. Writes via RPCs only.
create policy progress_select on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_course(course_id) or private.teaches_user(user_id));

create policy bookmarks_own on public.bookmarks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.can_access_lesson_content(lesson_id));

create policy activity_select on public.learning_activity for select to authenticated
  using (user_id = (select auth.uid()) or (course_id is not null and private.can_manage_course(course_id)));

-- Guard for the self-drop policy: only status may change.
create or replace function private.guard_enrolment_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Clients can only UPDATE (status) (column grant) and only 'active'/'dropped'
  -- for their own self-enrolments (RLS). Trusted RPCs move enrolments to
  -- 'completed'. A completed enrolment can never be re-opened by its learner.
  if (select auth.uid()) is not null and old.status = 'completed' and new.status <> 'completed'
     and not private.is_platform_admin() and not private.can_manage_course(old.course_id) then
    raise exception 'Completed enrolments cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger enrolments_guard before update on public.course_enrolments
  for each row execute function private.guard_enrolment_update();
