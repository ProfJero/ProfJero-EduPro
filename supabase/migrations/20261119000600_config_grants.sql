-- =============================================================================
-- 0006 Plan-limit guards, API grants, realtime, configuration seed
-- =============================================================================

-- -----------------------------------------------------------------------------
-- School-scoped entitlements (default school plan + school subscriptions)
-- -----------------------------------------------------------------------------
create or replace function private.school_limit(p_school uuid, p_feature text)
returns integer language sql stable security definer set search_path = '' as $$
  with plans as (
    select p.id from public.plans p where p.is_active and p.is_default and p.scope = 'school'
    union
    select p.id from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.school_id = p_school and s.status in ('active', 'trialing') and p.is_active
      and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
  )
  select case when bool_or(pf.enabled and pf.limit_value is null) then null else max(pf.limit_value) filter (where pf.enabled) end
  from public.plan_features pf where pf.feature_key = p_feature and pf.plan_id in (select id from plans);
$$;

create or replace function private.guard_school_student_cap()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_count integer;
begin
  if new.role = 'student' and new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active' or old.role <> 'student') then
    v_limit := private.school_limit(new.school_id, 'school_students');
    if v_limit is not null then
      select count(*) into v_count from public.school_memberships
        where school_id = new.school_id and role = 'student' and status = 'active' and id <> new.id;
      if v_count >= v_limit then
        raise exception 'This school has reached its plan limit of % active students. Contact ProfJero about EduPro for Schools.', v_limit using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger school_student_cap before insert or update on public.school_memberships
  for each row execute function private.guard_school_student_cap();

-- Independent (non-school) course creation limit per instructor plan.
create or replace function private.guard_course_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_count integer;
begin
  if (select auth.uid()) is null or private.is_platform_admin() or new.school_id is not null then return new; end if;
  v_limit := private.feature_limit('course_creation');
  if v_limit is not null then
    select count(*) into v_count from public.courses where owner_id = new.owner_id and school_id is null and status <> 'archived';
    if v_count >= v_limit then
      raise exception 'Your plan allows % active independent courses. Archive one or ask about EduPro for Teachers.', v_limit using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger courses_limit before insert on public.courses
  for each row execute function private.guard_course_limit();

-- Monthly live-session hosting limit for independent course sessions.
create or replace function private.guard_live_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_count integer;
begin
  if (select auth.uid()) is null or private.is_platform_admin() or new.class_id is not null then return new; end if;
  if exists (select 1 from public.courses c where c.id = new.course_id and c.school_id is not null) then return new; end if;
  v_limit := private.feature_limit('live_sessions_per_month');
  if v_limit is not null then
    select count(*) into v_count from public.live_sessions
      where host_id = new.host_id and class_id is null and status <> 'cancelled'
        and date_trunc('month', starts_at) = date_trunc('month', new.starts_at);
    if v_count >= v_limit then
      raise exception 'Your plan allows % live sessions per month for independent courses.', v_limit using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger live_limit before insert on public.live_sessions
  for each row execute function private.guard_live_limit();

-- -----------------------------------------------------------------------------
-- Grants. RLS is the gatekeeper; grants define which roles reach the table.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Append-only / system-written tables: no direct writes from clients.
revoke insert, update, delete on public.audit_logs, public.user_roles, public.course_enrolments,
  public.lesson_progress, public.learning_activity, public.assessment_attempts, public.attempt_answers,
  public.assessment_results, public.certificates, public.subscription_events, public.lesson_revisions,
  public.notifications
  from authenticated;
grant update (status) on public.course_enrolments to authenticated;           -- self-drop (guarded)
grant update (read_at) on public.notifications to authenticated;              -- mark read
grant delete on public.notifications to authenticated;
grant update (status, revoked_reason) on public.certificates to authenticated; -- admin revoke (RLS)

-- Anonymous visitors: catalogue + public config + contact form only.
grant select on public.categories, public.courses, public.course_instructors, public.course_prerequisites,
  public.course_modules, public.lessons, public.lesson_blocks, public.learning_paths, public.learning_path_courses,
  public.platform_settings, public.features, public.plans, public.plan_features to anon;
grant insert on public.contact_messages to anon;

-- Functions: lock everything down, then open the API surface explicitly.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.school_directory(text), public.course_instructor_cards(uuid[]),
  public.course_public_stats(uuid), public.verify_certificate(text) to anon;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated;
-- Internal mutators must never be callable directly by API roles.
revoke execute on function private.audit(text, text, text, jsonb, uuid), private.notify(uuid, text, text, text, text, jsonb),
  private.issue_certificate(uuid, uuid), private.recompute_course_progress(uuid, uuid), private.finalize_attempt(uuid, boolean),
  private.refresh_result(uuid), private.add_school_person(uuid, text, text, public.school_role, uuid, text),
  private.send_reminders(), private.entitlements_for(uuid)
  from anon, authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;

-- -----------------------------------------------------------------------------
-- Realtime (classroom chat + notifications)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.classroom_messages, public.notifications, public.live_sessions;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Configuration seed (real product configuration — no fake users or stats)
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value, is_public, description) values
  ('brand.name', '"ProfJero Edu"', true, 'Product name'),
  ('brand.premium_name', '"ProfJero EduPro"', true, 'Premium offering name'),
  ('brand.parent', '"ProfJero Digital Studio"', true, 'Parent brand'),
  ('brand.tagline', '"Unveiling the Extraordinary"', true, 'Tagline'),
  ('platform.default_timezone', '"Africa/Accra"', true, 'Default timezone for new users and schools'),
  ('platform.default_country', '"GH"', true, 'Default country code'),
  ('registration.open', 'true', true, 'Whether new self-registration is allowed'),
  ('edupro.payments_enabled', 'false', true, 'Payments are not enabled; EduPro is granted manually during pilots'),
  ('legal.review_status', '"pending_legal_review"', true, 'Privacy policy / terms are drafts pending legal review'),
  ('courses.school_teachers_can_publish', 'false', false, 'Allow school teachers (not only school admins) to publish school courses'),
  ('support.response_target_hours', '48', true, 'Target first-response time shown to users')
on conflict (key) do nothing;

insert into public.categories (name, slug, description, icon, sort_order) values
  ('Mathematics', 'mathematics', 'Core and elective mathematics, from foundations to calculus.', 'sigma', 1),
  ('English Language', 'english-language', 'Reading, writing, comprehension and communication.', 'languages', 2),
  ('Science', 'science', 'Integrated science, physics, chemistry and biology.', 'flask-conical', 3),
  ('Computing & ICT', 'computing-ict', 'Computer fundamentals, ICT and digital literacy.', 'monitor', 4),
  ('Programming', 'programming', 'Learn to code: Python, web development and more.', 'code', 5),
  ('Data & AI', 'data-ai', 'Data analysis, statistics and artificial intelligence.', 'brain-circuit', 6),
  ('Business & Entrepreneurship', 'business', 'Business management, accounting and starting ventures.', 'briefcase', 7),
  ('Social Studies & Humanities', 'humanities', 'Social studies, history, government and economics.', 'landmark', 8),
  ('Exam Preparation', 'exam-preparation', 'Structured preparation for BECE, WASSCE and other exams.', 'clipboard-check', 9),
  ('Teacher Development', 'teacher-development', 'Professional development for educators.', 'presentation', 10),
  ('Digital & Career Skills', 'career-skills', 'Practical skills for work and life.', 'rocket', 11)
on conflict (slug) do nothing;

insert into public.features (key, name, description, kind, sort_order) values
  ('certificates', 'Verified certificates', 'Earn verifiable certificates on course completion', 'boolean', 1),
  ('offline_downloads', 'Offline learning', 'Save lessons for low-connectivity study', 'boolean', 2),
  ('active_enrolments', 'Active self-enrolled courses', 'How many self-enrolled courses can be active at once', 'limit', 3),
  ('premium_courses', 'EduPro courses', 'Access courses marked as EduPro', 'boolean', 4),
  ('course_creation', 'Independent courses', 'Number of active independent courses an instructor can run', 'limit', 5),
  ('live_sessions_per_month', 'Live sessions per month', 'Independent live sessions an instructor can schedule per month', 'limit', 6),
  ('advanced_analytics', 'Advanced analytics', 'Question-level insights and learner risk signals', 'boolean', 7),
  ('school_students', 'School students', 'Active student seats in a school workspace', 'limit', 8),
  ('priority_support', 'Priority support', 'Faster support response', 'boolean', 9)
on conflict (key) do nothing;

insert into public.plans (code, name, tier, scope, description, price_label, is_default, sort_order) values
  ('edu_free', 'ProfJero Edu', 'edu', 'individual', 'Free, full-featured learning for everyone.', 'Free', true, 1),
  ('edu_teacher', 'ProfJero Edu for Teachers', 'edu', 'teacher', 'Free teaching tools for independent instructors.', 'Free', true, 2),
  ('edu_school', 'ProfJero Edu for Schools', 'edu', 'school', 'Free school workspace for approved institutions.', 'Free', true, 3),
  ('edupro_individual', 'ProfJero EduPro', 'edupro', 'individual', 'Premium courses and unlimited learning.', 'Pricing to be announced', false, 4),
  ('edupro_teacher', 'ProfJero EduPro for Teachers', 'edupro', 'teacher', 'Unlimited courses, sessions and advanced analytics.', 'Pricing to be announced', false, 5),
  ('edupro_school', 'ProfJero EduPro for Schools', 'edupro', 'school', 'Unlimited seats, premium content for every member and advanced reporting.', 'Pricing to be announced', false, 6)
on conflict (code) do nothing;

insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, f.key, x.enabled, x.limit_value
from (values
  ('edu_free', 'certificates', true, null), ('edu_free', 'offline_downloads', true, null),
  ('edu_free', 'active_enrolments', true, 10), ('edu_free', 'premium_courses', false, null),
  ('edu_teacher', 'course_creation', true, 5), ('edu_teacher', 'live_sessions_per_month', true, 30),
  ('edu_school', 'school_students', true, 500),
  ('edupro_individual', 'certificates', true, null), ('edupro_individual', 'offline_downloads', true, null),
  ('edupro_individual', 'active_enrolments', true, null), ('edupro_individual', 'premium_courses', true, null),
  ('edupro_individual', 'priority_support', true, null),
  ('edupro_teacher', 'course_creation', true, null), ('edupro_teacher', 'live_sessions_per_month', true, null),
  ('edupro_teacher', 'advanced_analytics', true, null), ('edupro_teacher', 'premium_courses', true, null),
  ('edupro_teacher', 'priority_support', true, null),
  ('edupro_school', 'school_students', true, null), ('edupro_school', 'premium_courses', true, null),
  ('edupro_school', 'advanced_analytics', true, null), ('edupro_school', 'active_enrolments', true, null),
  ('edupro_school', 'priority_support', true, null)
) as x(plan_code, feature_key, enabled, limit_value)
join public.plans p on p.code = x.plan_code
join public.features f on f.key = x.feature_key
on conflict do nothing;

insert into public.certificate_templates (name, accent_color, signatory_name, signatory_title, footer_text, is_default)
values ('ProfJero Edu Standard', '#1554D6', null, 'ProfJero Digital Studio', 'Verify this certificate at profjero-edupro.pages.dev/verify', true)
on conflict do nothing;
