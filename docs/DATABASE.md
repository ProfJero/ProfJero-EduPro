# Database

PostgreSQL 17 on Supabase. All changes go through ordered migrations in `supabase/migrations/`. There are 63 tables and about 130 RLS policies. `supabase/seed.sql` is **local development data only** and is never applied to production.

| Migration | Contents |
|---|---|
| 0001 foundation | enums, `private` schema, `profiles`, `user_roles`, `platform_settings`, `schools`, `school_memberships`, `school_invitations`, `guardian_links`, `instructor_applications`, `audit_logs`, authorisation helpers, new-user bootstrap (profile + learner role + owner bootstrap), guards |
| 0002 learning | `academic_years`, `academic_terms`, `school_classes`, `class_teachers`, `class_enrolments`, `class_attendance`, `categories`, `courses`, `course_instructors`, `course_prerequisites`, `course_modules`, `lessons`, `lesson_blocks`, `lesson_revisions`, `course_resources`, `learning_paths`, `learning_path_courses`, `class_courses`, `course_enrolments`, `lesson_progress`, `bookmarks`, `learning_activity` |
| 0003 assessment | `question_banks`, `questions`, `question_options`, `question_answer_keys`, `assessments`, `assessment_questions`, `assessment_attempts`, `attempt_answers`, `assessment_results`, `assignments`, `rubric_criteria`, `assignment_submissions`, `submission_files`, `submission_grades` |
| 0004 engagement | `live_sessions`, `live_session_attendance`, `provider_connections` (+ `private.provider_tokens`), `classroom_messages`, `announcements`, `notifications`, `certificate_templates`, `certificates`, `support_tickets`, `support_replies`, `contact_messages`, `features`, `plans`, `plan_features`, `subscriptions`, `subscription_events`, entitlement functions |
| 0005 rpc | All trusted operations (see below), notification triggers, hourly reminders (pg_cron) |
| 0006 config & grants | plan-limit guards, API grants, realtime publication, configuration seed (categories, plans, features, settings, certificate template) |
| 0007 realtime auth | private-channel authorisation for classroom presence |
| 0008–0011 | co-instructors and enrol-by-email; atomic question save and grader overviews; media permission check; public school names |

## Design notes

- UUID primary keys, `timestamptz` stored in UTC (displayed in the user's time zone, default `Africa/Accra`). Foreign keys are indexed and constraints validate inputs.
- **Lesson blocks** use `jsonb` per block: each block type has its own payload, validated by Zod in the app and size-limited in the database. Everything else is relational.
- **Answer keys** live in `question_answer_keys`, which only authors can read. Learners receive questions only through `get_attempt`, which strips keys until results are released.
- **Scores** live in `assessment_results`, separately from attempts, so release rules (`immediate` / `after_close` / `manual`) are enforced by RLS.
- **Simplifications vs the suggested list:** `course_versions` → `lesson_revisions` (the last 30 per lesson). `submission_feedback` + `submission_grades` → one table. `entitlements` / `entitlement_assignments` → computed by `private.entitlements_for()` from plans and subscriptions. `school_roles` → enum `school_role`. `live_session_participants` → the audience is derived from course/class enrolment, with attendance in `live_session_attendance`.

## Key RPCs (all re-check the caller)

`my_context`, `enrol_in_course`, `enrol_users`, `enrol_by_email`, `touch_lesson`, `complete_lesson`, `claim_certificate`, `verify_certificate` (public), `save_lesson_content`, `restore_lesson_revision`, `duplicate_lesson`, `reorder_modules`, `reorder_lessons`, `submit_course_for_review`, `review_course`, `save_question`, `get_question`, `start_attempt`, `save_answer`, `submit_attempt`, `get_attempt`, `grade_answer`, `release_results`, `assessment_results_overview`, `assignment_submissions_overview`, `join_live_session`, `review_school`, `set_school_status`, `add_school_member`, `import_students`, `my_invitations`, `respond_invitation`, `school_people`, `school_report`, `admin_overview`, `admin_list_users`, `set_user_role`, `set_user_status`, `review_instructor_application`, `grant_subscription`, `revoke_subscription`, `course_analytics`, `teacher_overview`, `my_students`, `room_members`, `course_team`, `add_course_instructor`, `media_permissions`, `mark_all_notifications_read`, `course_instructor_cards` / `course_public_stats` / `school_directory` (public).

## Applying to a Supabase project

```bash
npx supabase link --project-ref <ref>
npx supabase db push          # applies supabase/migrations in order (never seed.sql)
```
