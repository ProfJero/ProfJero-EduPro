-- =============================================================================
-- LOCAL DEVELOPMENT / TEST SEED ONLY.
-- Runs on `supabase db reset` against the local stack. NEVER run in production.
-- Accounts use the reserved `.test` TLD and the password: DevPassw0rd!
-- =============================================================================

insert into private.owner_emails (email) values ('owner@profjero.test') on conflict do nothing;

create or replace function pg_temp.mk_user(p_id uuid, p_email text, p_name text, p_intent text default 'learner')
returns void language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('DevPassw0rd!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name, 'intended_role', p_intent),
    now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now());
  update public.profiles set onboarding_completed = true where id = p_id;
end $$;

select pg_temp.mk_user('00000000-0000-4000-a000-000000000001', 'owner@profjero.test', 'Platform Owner', 'learner');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000002', 'teacher@profjero.test', 'Ama Mensah', 'educator');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000003', 'learner@profjero.test', 'Kwame Owusu', 'learner');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000004', 'learner2@profjero.test', 'Efua Boateng', 'learner');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000005', 'schooladmin@profjero.test', 'Yaw Asante', 'institution');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000006', 'schoolteacher@profjero.test', 'Akosua Darko', 'educator');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000007', 'student@profjero.test', 'Kofi Appiah', 'learner');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000008', 'otheradmin@profjero.test', 'Abena Ofori', 'institution');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000009', 'otherstudent@profjero.test', 'Kojo Badu', 'learner');

insert into public.user_roles (user_id, role) values ('00000000-0000-4000-a000-000000000002', 'teacher') on conflict do nothing;

-- Two approved schools for isolation testing.
insert into public.schools (id, name, slug, institution_type, region, city, contact_email, status, applied_by, reviewed_at)
values
  ('00000000-0000-4000-b000-000000000001', 'Dev Academy SHS', 'dev-academy-shs', 'shs', 'Greater Accra', 'Accra', 'office@devacademy.test', 'approved', '00000000-0000-4000-a000-000000000005', now()),
  ('00000000-0000-4000-b000-000000000002', 'Other Academy', 'other-academy', 'shs', 'Ashanti', 'Kumasi', 'office@otheracademy.test', 'approved', '00000000-0000-4000-a000-000000000008', now());

insert into public.school_memberships (school_id, user_id, role, status) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000005', 'school_admin', 'active'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000006', 'teacher', 'active'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000007', 'student', 'active'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000008', 'school_admin', 'active'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000009', 'student', 'active');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-a000-000000000005', 'school_admin'), ('00000000-0000-4000-a000-000000000008', 'school_admin')
on conflict do nothing;

insert into public.academic_years (id, school_id, name, starts_on, ends_on, is_current)
values ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', '2026/2027', '2026-09-01', '2027-07-31', true);
insert into public.academic_terms (school_id, academic_year_id, name, starts_on, ends_on, is_current)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001', 'Term 1', '2026-09-01', '2026-12-18', true);
insert into public.school_classes (id, school_id, academic_year_id, name, stream, level, color)
values ('00000000-0000-4000-c000-000000000010', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001', 'SHS 2 Science', 'A', 'SHS 2', 'green'),
       ('00000000-0000-4000-c000-000000000020', '00000000-0000-4000-b000-000000000002', null, 'Form 1 General Arts', 'B', 'SHS 1', 'amber');
insert into public.class_teachers (class_id, user_id, is_class_teacher, subject)
values ('00000000-0000-4000-c000-000000000010', '00000000-0000-4000-a000-000000000006', true, 'Computing');
insert into public.class_enrolments (class_id, user_id) values
  ('00000000-0000-4000-c000-000000000010', '00000000-0000-4000-a000-000000000007'),
  ('00000000-0000-4000-c000-000000000020', '00000000-0000-4000-a000-000000000009');

-- A sample published course by the independent teacher.
insert into public.courses (id, slug, title, short_description, description, category_id, subject, target_audience, level,
  objectives, estimated_hours, visibility, enrolment_method, status, owner_id, published_at)
values ('00000000-0000-4000-d000-000000000001', 'python-foundations', 'Python Foundations',
  'Write your first real programs in Python — variables, decisions, loops and functions.',
  'A practical, project-driven introduction to programming with Python. Each lesson explains a concept, shows working code with its output, and gives you a hands-on task.',
  (select id from public.categories where slug = 'programming'), 'Programming', 'SHS & university students, beginners', 'beginner',
  array['Write and run Python programs', 'Use variables, conditions and loops', 'Break problems into functions'],
  6, 'public', 'open', 'published', '00000000-0000-4000-a000-000000000002', now());

insert into public.course_modules (id, course_id, title, position) values
  ('00000000-0000-4000-d100-000000000001', '00000000-0000-4000-d000-000000000001', 'Getting started', 0),
  ('00000000-0000-4000-d100-000000000002', '00000000-0000-4000-d000-000000000001', 'Making decisions', 1);

insert into public.lessons (id, course_id, module_id, title, summary, position, status, estimated_minutes, is_preview) values
  ('00000000-0000-4000-d200-000000000001', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d100-000000000001', 'Your first program', 'Print text to the screen.', 0, 'published', 10, true),
  ('00000000-0000-4000-d200-000000000002', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d100-000000000001', 'Variables and types', 'Store and reuse values.', 1, 'published', 15, false),
  ('00000000-0000-4000-d200-000000000003', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d100-000000000002', 'If statements', 'Make your program decide.', 0, 'published', 15, false);

insert into public.lesson_blocks (lesson_id, type, position, content) values
  ('00000000-0000-4000-d200-000000000001', 'heading', 0, '{"text":"Hello, Python!","level":2}'),
  ('00000000-0000-4000-d200-000000000001', 'paragraph', 1, '{"text":"Every programmer starts by making the computer say something. In Python we use the print() function."}'),
  ('00000000-0000-4000-d200-000000000001', 'code', 2, '{"language":"python","code":"print(\"Akwaaba to ProfJero Edu!\")","output":"Akwaaba to ProfJero Edu!"}'),
  ('00000000-0000-4000-d200-000000000001', 'activity', 3, '{"title":"Try it","instructions":"Change the message to greet your class, then run it again."}'),
  ('00000000-0000-4000-d200-000000000002', 'paragraph', 0, '{"text":"A variable is a name that refers to a value."}'),
  ('00000000-0000-4000-d200-000000000002', 'code', 1, '{"language":"python","code":"name = \"Kwame\"\nage = 17\nprint(name, age)","output":"Kwame 17"}'),
  ('00000000-0000-4000-d200-000000000003', 'paragraph', 0, '{"text":"Use if, elif and else to choose what happens."}'),
  ('00000000-0000-4000-d200-000000000003', 'callout', 1, '{"tone":"tip","text":"Indentation matters in Python: the indented block belongs to the if."}');

-- Quiz for the course
insert into public.question_banks (id, title, owner_id, course_id)
values ('00000000-0000-4000-e000-000000000001', 'Python Foundations bank', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-d000-000000000001');
insert into public.questions (id, bank_id, type, prompt, explanation, marks) values
  ('00000000-0000-4000-e100-000000000001', '00000000-0000-4000-e000-000000000001', 'multiple_choice', 'Which function displays text in Python?', 'print() writes to standard output.', 1),
  ('00000000-0000-4000-e100-000000000002', '00000000-0000-4000-e000-000000000001', 'true_false', 'Indentation is optional in Python.', 'Indentation defines blocks in Python.', 1),
  ('00000000-0000-4000-e100-000000000003', '00000000-0000-4000-e000-000000000001', 'fill_blank', 'The keyword used to define a function is ____.', 'def starts a function definition.', 1);
insert into public.question_options (id, question_id, label, position) values
  ('00000000-0000-4000-e200-000000000001', '00000000-0000-4000-e100-000000000001', 'echo()', 0),
  ('00000000-0000-4000-e200-000000000002', '00000000-0000-4000-e100-000000000001', 'print()', 1),
  ('00000000-0000-4000-e200-000000000003', '00000000-0000-4000-e100-000000000001', 'write()', 2),
  ('00000000-0000-4000-e200-000000000004', '00000000-0000-4000-e100-000000000002', 'True', 0),
  ('00000000-0000-4000-e200-000000000005', '00000000-0000-4000-e100-000000000002', 'False', 1);
insert into public.question_answer_keys (question_id, answer) values
  ('00000000-0000-4000-e100-000000000001', '{"correct":["00000000-0000-4000-e200-000000000002"]}'),
  ('00000000-0000-4000-e100-000000000002', '{"correct":["00000000-0000-4000-e200-000000000005"]}'),
  ('00000000-0000-4000-e100-000000000003', '{"accepted":["def"],"case_sensitive":false}');
insert into public.assessments (id, title, instructions, kind, course_id, pass_mark_pct, max_attempts, status, created_by)
values ('00000000-0000-4000-e300-000000000001', 'Python Foundations check-in', 'Answer all questions. You have 3 attempts.', 'quiz',
  '00000000-0000-4000-d000-000000000001', 60, 3, 'published', '00000000-0000-4000-a000-000000000002');
insert into public.assessment_questions (assessment_id, question_id, position) values
  ('00000000-0000-4000-e300-000000000001', '00000000-0000-4000-e100-000000000001', 0),
  ('00000000-0000-4000-e300-000000000001', '00000000-0000-4000-e100-000000000002', 1),
  ('00000000-0000-4000-e300-000000000001', '00000000-0000-4000-e100-000000000003', 2);

-- A school course assigned to SHS 2 Science (auto-enrols the class).
insert into public.courses (id, slug, title, short_description, category_id, level, visibility, enrolment_method, status, owner_id, school_id, published_at)
values ('00000000-0000-4000-d000-000000000002', 'dev-academy-ict', 'SHS 2 ICT (Dev Academy)', 'Core ICT for SHS 2 students at Dev Academy.',
  (select id from public.categories where slug = 'computing-ict'), 'intermediate', 'school', 'invite', 'published',
  '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-b000-000000000001', now());
insert into public.course_modules (id, course_id, title, position) values ('00000000-0000-4000-d100-000000000010', '00000000-0000-4000-d000-000000000002', 'Term 1', 0);
insert into public.lessons (id, course_id, module_id, title, position, status) values
  ('00000000-0000-4000-d200-000000000010', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-d100-000000000010', 'Computer systems', 0, 'published');
insert into public.lesson_blocks (lesson_id, type, position, content) values
  ('00000000-0000-4000-d200-000000000010', 'paragraph', 0, '{"text":"A computer system is made up of hardware, software and people."}');
insert into public.class_courses (class_id, course_id, assigned_by)
values ('00000000-0000-4000-c000-000000000010', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-a000-000000000005');

insert into public.assignments (id, title, instructions, class_id, due_at, max_marks, submission_types, status, created_by)
values ('00000000-0000-4000-f000-000000000001', 'Describe a computer system', 'In 150 words, describe the computer system at your school.',
  '00000000-0000-4000-c000-000000000010', now() + interval '7 days', 20, '{text,link}', 'published', '00000000-0000-4000-a000-000000000006');
