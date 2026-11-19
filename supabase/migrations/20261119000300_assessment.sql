-- =============================================================================
-- 0003 Assessments (question banks, server-side grading) & Assignments
-- =============================================================================
-- Answer keys live in `question_answer_keys`, readable only by authors.
-- Learners never read questions/options/keys directly: they receive their
-- attempt through SECURITY DEFINER RPCs that strip keys until release.
-- =============================================================================

create type public.question_type as enum (
  'multiple_choice', 'multiple_select', 'true_false', 'fill_blank',
  'short_answer', 'essay', 'matching', 'ordering', 'file_upload'
);
create type public.results_visibility as enum ('immediate', 'after_close', 'manual');

create table public.question_banks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  school_id uuid references public.schools (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index question_banks_owner_idx on public.question_banks (owner_id);
create index question_banks_course_idx on public.question_banks (course_id);
create index question_banks_school_idx on public.question_banks (school_id);
create trigger question_banks_touch before update on public.question_banks
  for each row execute function private.touch_updated_at();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.question_banks (id) on delete cascade,
  type public.question_type not null,
  prompt text not null check (char_length(prompt) between 1 and 5000),
  explanation text,
  category text,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  marks numeric(6, 2) not null default 1 check (marks > 0),
  tags text[] not null default '{}',
  -- Public, non-secret structure: matching {left:[{id,text}], right:[{id,text}]},
  -- ordering {items:[{id,text}]}. Never contains the solution.
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_bank_idx on public.questions (bank_id);
create index questions_tags_idx on public.questions using gin (tags);
create trigger questions_touch before update on public.questions
  for each row execute function private.touch_updated_at();

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 1000),
  position integer not null default 0
);
create index question_options_q_idx on public.question_options (question_id, position);

-- Solutions: choice {correct:[option_id...]}, fill_blank/short_answer
-- {accepted:[...], case_sensitive:bool}, matching {pairs:{leftId:rightId}},
-- ordering {order:[itemId...]}.
create table public.question_answer_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  answer jsonb not null default '{}'::jsonb
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  instructions text not null default '',
  kind text not null default 'quiz' check (kind in ('quiz', 'test', 'exam', 'practice')),
  course_id uuid references public.courses (id) on delete cascade,
  class_id uuid references public.school_classes (id) on delete cascade,
  opens_at timestamptz,
  closes_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 600),
  pass_mark_pct numeric(5, 2) not null default 50 check (pass_mark_pct between 0 and 100),
  max_attempts integer not null default 1 check (max_attempts between 1 and 50),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  results_visibility public.results_visibility not null default 'immediate',
  show_correct_answers boolean not null default true,
  results_released boolean not null default false,
  status public.content_status not null default 'draft',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_id is not null or class_id is not null),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create index assessments_course_idx on public.assessments (course_id);
create index assessments_class_idx on public.assessments (class_id);
create index assessments_creator_idx on public.assessments (created_by);
create trigger assessments_touch before update on public.assessments
  for each row execute function private.touch_updated_at();

alter table public.lessons
  add constraint lessons_quiz_fk foreign key (quiz_assessment_id) references public.assessments (id) on delete set null;
create index lessons_quiz_idx on public.lessons (quiz_assessment_id);

create table public.assessment_questions (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  position integer not null default 0,
  marks_override numeric(6, 2) check (marks_override is null or marks_override > 0),
  primary key (assessment_id, question_id)
);
create index assessment_questions_q_idx on public.assessment_questions (question_id);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_no integer not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  question_order uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  auto_submitted boolean not null default false,
  unique (assessment_id, user_id, attempt_no)
);
create index attempts_user_idx on public.assessment_attempts (user_id, assessment_id);
create index attempts_assessment_idx on public.assessment_attempts (assessment_id, status);
create unique index attempts_one_open on public.assessment_attempts (assessment_id, user_id) where status = 'in_progress';

create table public.attempt_answers (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  response jsonb not null default '{}'::jsonb check (pg_column_size(response) < 60000),
  is_correct boolean,
  awarded_marks numeric(6, 2),
  needs_manual boolean not null default false,
  feedback text,
  graded_by uuid references auth.users (id) on delete set null,
  graded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create index attempt_answers_question_idx on public.attempt_answers (question_id);

-- Scores live apart from attempts so release rules can be enforced by RLS.
create table public.assessment_results (
  attempt_id uuid primary key references public.assessment_attempts (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric(8, 2) not null default 0,
  max_score numeric(8, 2) not null default 0,
  percentage numeric(5, 2) not null default 0,
  passed boolean not null default false,
  pending_manual boolean not null default false,
  graded_at timestamptz not null default now()
);
create index results_user_idx on public.assessment_results (user_id, assessment_id);
create index results_assessment_idx on public.assessment_results (assessment_id);

-- -----------------------------------------------------------------------------
-- Assignments
-- -----------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  instructions text not null default '',
  course_id uuid references public.courses (id) on delete cascade,
  class_id uuid references public.school_classes (id) on delete cascade,
  due_at timestamptz,
  allow_late boolean not null default true,
  max_marks numeric(6, 2) not null default 100 check (max_marks > 0),
  submission_types text[] not null default '{text}'
    check (submission_types <@ array['text', 'file', 'link']::text[] and cardinality(submission_types) > 0),
  attachments jsonb not null default '[]'::jsonb,
  status public.content_status not null default 'draft',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_id is not null or class_id is not null)
);
create index assignments_course_idx on public.assignments (course_id);
create index assignments_class_idx on public.assignments (class_id);
create index assignments_creator_idx on public.assignments (created_by);
create trigger assignments_touch before update on public.assignments
  for each row execute function private.touch_updated_at();

alter table public.lessons
  add constraint lessons_assignment_fk foreign key (assignment_id) references public.assignments (id) on delete set null;
create index lessons_assignment_idx on public.lessons (assignment_id);

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  title text not null,
  description text,
  max_points numeric(6, 2) not null check (max_points > 0),
  position integer not null default 0
);
create index rubric_criteria_assignment_idx on public.rubric_criteria (assignment_id, position);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'graded')),
  text_response text check (char_length(text_response) <= 50000),
  link_url text check (link_url is null or link_url ~ '^https?://'),
  submitted_at timestamptz,
  is_late boolean not null default false,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);
create index submissions_user_idx on public.assignment_submissions (user_id);
create index submissions_assignment_idx on public.assignment_submissions (assignment_id, status);
create trigger submissions_touch before update on public.assignment_submissions
  for each row execute function private.touch_updated_at();

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  public_id text not null,
  resource_type text not null default 'raw' check (resource_type in ('image', 'video', 'raw')),
  delivery_type text not null default 'authenticated' check (delivery_type in ('authenticated', 'private')),
  format text,
  version text,
  filename text not null,
  bytes bigint check (bytes is null or bytes >= 0),
  created_at timestamptz not null default now(),
  unique (submission_id, public_id)
);
create index submission_files_submission_idx on public.submission_files (submission_id);

create table public.submission_grades (
  submission_id uuid primary key references public.assignment_submissions (id) on delete cascade,
  score numeric(6, 2) not null check (score >= 0),
  feedback text,
  rubric_scores jsonb not null default '{}'::jsonb,
  released boolean not null default true,
  graded_by uuid not null references auth.users (id) on delete restrict,
  graded_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function private.can_manage_assessment(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessments a where a.id = p_assessment and (
      (a.course_id is not null and private.can_manage_course(a.course_id))
      or (a.class_id is not null and private.can_manage_class(a.class_id))
      or private.is_platform_admin()
    )
  );
$$;

create or replace function private.can_take_assessment(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessments a where a.id = p_assessment and a.status = 'published' and (
      (a.course_id is not null and private.is_enrolled(a.course_id))
      or (a.class_id is not null and private.is_class_student(a.class_id))
    )
  );
$$;

create or replace function private.results_released(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessments a where a.id = p_assessment and (
      a.results_released
      or a.results_visibility = 'immediate'
      or (a.results_visibility = 'after_close' and a.closes_at is not null and a.closes_at <= now())
    )
  );
$$;

create or replace function private.can_access_bank(p_bank uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.question_banks b where b.id = p_bank and (
      b.owner_id = (select auth.uid())
      or (b.course_id is not null and private.can_manage_course(b.course_id))
      or (b.school_id is not null and private.is_school_staff(b.school_id))
      or private.is_platform_admin()
    )
  );
$$;

create or replace function private.can_manage_assignment(p_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a where a.id = p_assignment and (
      (a.course_id is not null and private.can_manage_course(a.course_id))
      or (a.class_id is not null and private.can_manage_class(a.class_id))
      or private.is_platform_admin()
    )
  );
$$;

create or replace function private.can_submit_assignment(p_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a where a.id = p_assignment and a.status = 'published' and (
      (a.course_id is not null and private.is_enrolled(a.course_id))
      or (a.class_id is not null and private.is_class_student(a.class_id))
    )
  );
$$;

create or replace function private.submission_assignment(p_submission uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select assignment_id from public.assignment_submissions where id = p_submission;
$$;

create or replace function private.submission_owner(p_submission uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select user_id from public.assignment_submissions where id = p_submission;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.question_banks enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.assessment_results enable row level security;
alter table public.assignments enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.submission_grades enable row level security;

create policy banks_rw on public.question_banks for all to authenticated
  using (owner_id = (select auth.uid()) or private.can_access_bank(id))
  with check (
    (owner_id = (select auth.uid()) and (private.has_role('teacher') or private.is_platform_admin()
      or (school_id is not null and private.is_school_staff(school_id))
      or (course_id is not null and private.can_manage_course(course_id))))
    or private.is_platform_admin()
  );

create policy questions_rw on public.questions for all to authenticated
  using (private.can_access_bank(bank_id)) with check (private.can_access_bank(bank_id));
create policy options_rw on public.question_options for all to authenticated
  using (private.can_access_bank((select q.bank_id from public.questions q where q.id = question_id)))
  with check (private.can_access_bank((select q.bank_id from public.questions q where q.id = question_id)));
create policy keys_rw on public.question_answer_keys for all to authenticated
  using (private.can_access_bank((select q.bank_id from public.questions q where q.id = question_id)))
  with check (private.can_access_bank((select q.bank_id from public.questions q where q.id = question_id)));

create policy assessments_read on public.assessments for select to authenticated
  using ((course_id is not null and private.can_manage_course(course_id))
         or (class_id is not null and private.can_manage_class(class_id))
         or private.can_manage_assessment(id) or private.can_take_assessment(id));
create policy assessments_insert on public.assessments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((course_id is not null and private.can_manage_course(course_id))
      or (class_id is not null and private.can_manage_class(class_id)))
  );
create policy assessments_update on public.assessments for update to authenticated
  using (private.can_manage_assessment(id)) with check (private.can_manage_assessment(id));
create policy assessments_delete on public.assessments for delete to authenticated
  using (private.can_manage_assessment(id) and not exists (select 1 from public.assessment_attempts t where t.assessment_id = id));

create policy aq_manage on public.assessment_questions for all to authenticated
  using (private.can_manage_assessment(assessment_id))
  with check (private.can_manage_assessment(assessment_id)
              and private.can_access_bank((select q.bank_id from public.questions q where q.id = question_id)));

-- Attempts: own rows readable (no scores here). Writes via RPC only.
create policy attempts_read on public.assessment_attempts for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_assessment(assessment_id));
-- Answers: graders only (learners use get_attempt RPC).
create policy answers_read on public.attempt_answers for select to authenticated
  using (private.can_manage_assessment((select t.assessment_id from public.assessment_attempts t where t.id = attempt_id)));
-- Results: graders, or the learner once released.
create policy results_read on public.assessment_results for select to authenticated
  using (private.can_manage_assessment(assessment_id)
         or (user_id = (select auth.uid()) and private.results_released(assessment_id)));

create policy assignments_read on public.assignments for select to authenticated
  using ((course_id is not null and private.can_manage_course(course_id))
         or (class_id is not null and private.can_manage_class(class_id))
         or private.can_manage_assignment(id) or private.can_submit_assignment(id));
create policy assignments_insert on public.assignments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((course_id is not null and private.can_manage_course(course_id))
      or (class_id is not null and private.can_manage_class(class_id)))
  );
create policy assignments_update on public.assignments for update to authenticated
  using (private.can_manage_assignment(id)) with check (private.can_manage_assignment(id));
create policy assignments_delete on public.assignments for delete to authenticated
  using (private.can_manage_assignment(id) and not exists (select 1 from public.assignment_submissions s where s.assignment_id = id and s.status <> 'draft'));

create policy rubric_read on public.rubric_criteria for select to authenticated
  using (private.can_manage_assignment(assignment_id) or private.can_submit_assignment(assignment_id));
create policy rubric_write on public.rubric_criteria for all to authenticated
  using (private.can_manage_assignment(assignment_id)) with check (private.can_manage_assignment(assignment_id));

create policy submissions_read on public.assignment_submissions for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_assignment(assignment_id));
create policy submissions_insert on public.assignment_submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_submit_assignment(assignment_id) and status in ('draft', 'submitted'));
create policy submissions_update_own on public.assignment_submissions for update to authenticated
  using ((user_id = (select auth.uid()) and status in ('draft', 'returned')) or private.can_manage_assignment(assignment_id))
  with check ((user_id = (select auth.uid()) and private.can_submit_assignment(assignment_id)) or private.can_manage_assignment(assignment_id));

create policy sub_files_read on public.submission_files for select to authenticated
  using (private.submission_owner(submission_id) = (select auth.uid())
         or private.can_manage_assignment(private.submission_assignment(submission_id)));
create policy sub_files_insert on public.submission_files for insert to authenticated
  with check (
    private.submission_owner(submission_id) = (select auth.uid())
    and exists (select 1 from public.assignment_submissions s where s.id = submission_id and s.status in ('draft', 'returned'))
    and public_id like 'profjero-edu/submissions/' || (select auth.uid())::text || '/%'
  );
create policy sub_files_delete on public.submission_files for delete to authenticated
  using (
    private.submission_owner(submission_id) = (select auth.uid())
    and exists (select 1 from public.assignment_submissions s where s.id = submission_id and s.status in ('draft', 'returned'))
  );

create policy grades_read on public.submission_grades for select to authenticated
  using (private.can_manage_assignment(private.submission_assignment(submission_id))
         or (released and private.submission_owner(submission_id) = (select auth.uid())));
create policy grades_write on public.submission_grades for all to authenticated
  using (private.can_manage_assignment(private.submission_assignment(submission_id)))
  with check (private.can_manage_assignment(private.submission_assignment(submission_id)) and graded_by = (select auth.uid()));

-- Submission guard: learners may only edit content & move draft->submitted.
create or replace function private.guard_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_a public.assignments;
  v_manager boolean;
begin
  select * into v_a from public.assignments where id = new.assignment_id;
  if (select auth.uid()) is null then return new; end if;
  v_manager := private.can_manage_assignment(new.assignment_id);

  if tg_op = 'UPDATE' and v_manager and new.user_id <> (select auth.uid()) then
    -- Graders may only change status (return/graded); content is the learner's.
    if new.text_response is distinct from old.text_response or new.link_url is distinct from old.link_url
       or new.submitted_at is distinct from old.submitted_at or new.user_id <> old.user_id then
      raise exception 'Graders cannot modify learner work' using errcode = '42501';
    end if;
    if new.status not in ('returned', 'graded', 'submitted') then
      raise exception 'Invalid status' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.user_id <> (select auth.uid()) then
    raise exception 'Not your submission' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.assignment_id <> old.assignment_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'Learners can only save drafts or submit' using errcode = '42501';
  end if;
  if new.status = 'submitted' then
    if v_a.due_at is not null and now() > v_a.due_at and not v_a.allow_late then
      raise exception 'The deadline for this assignment has passed' using errcode = 'P0001';
    end if;
    if (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
      new.submitted_at := now();
      new.revision := coalesce(case when tg_op = 'UPDATE' then old.revision end, 0) + 1;
    end if;
    new.is_late := v_a.due_at is not null and now() > v_a.due_at;
    if coalesce(nullif(trim(new.text_response), ''), new.link_url) is null
       and not exists (select 1 from public.submission_files f where f.submission_id = new.id) then
      raise exception 'Add a response, link or file before submitting' using errcode = '22023';
    end if;
  else
    new.submitted_at := case when tg_op = 'UPDATE' then old.submitted_at end;
    new.is_late := case when tg_op = 'UPDATE' then old.is_late else false end;
  end if;
  return new;
end $$;
create trigger submissions_guard before insert or update on public.assignment_submissions
  for each row execute function private.guard_submission();

-- When a grade is written, mark the submission graded.
create or replace function private.after_grade()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max numeric;
begin
  select a.max_marks into v_max from public.assignments a
    join public.assignment_submissions s on s.assignment_id = a.id where s.id = new.submission_id;
  if new.score > v_max then
    raise exception 'Score exceeds the maximum marks (%)', v_max using errcode = '22023';
  end if;
  update public.assignment_submissions set status = 'graded' where id = new.submission_id and status <> 'graded';
  return new;
end $$;
create trigger grades_after after insert or update on public.submission_grades
  for each row execute function private.after_grade();
