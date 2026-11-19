# Security

## Principles

1. **RLS on every table** in `public`, enforced for every query. Frontend route guards are UX only.
2. **Least privilege grants**: anonymous visitors can read only the public catalogue, plans and public settings, and can insert contact messages. Append-only/system tables (`audit_logs`, `user_roles`, `course_enrolments`, `lesson_progress`, `assessment_*`, `certificates`, `notifications`, …) accept no direct client writes; column-level grants allow only safe updates (e.g. `notifications.read_at`).
3. **Privileged operations are RPCs** (`SECURITY DEFINER`, `search_path = ''`) that verify `auth.uid()`, account status and the caller's authority. Helper predicates live in the non-exposed `private` schema.
4. **No secrets in the browser.** Only `VITE_SUPABASE_URL`, the publishable anon key and the Cloudinary cloud name are public. The Cloudinary secret exists only as a Cloudflare secret. No service-role key is used anywhere.
5. **Audit log** for privileged actions: role changes, suspensions, approvals, grants and revocations, imports, course reviews and invitations.

## Enforced guarantees (each covered by `tests/db/security.test.mjs`)

| Requirement | Mechanism |
|---|---|
| Students only see their own private records | RLS on progress, attempts, results, submissions, grades, notifications, tickets, certificates |
| Teachers only see authorised courses/classes | `can_manage_course`, `can_manage_class`, `teaches_user`; staff profile access via `is_staff_of_user` |
| School admins only see their own school | `is_school_admin(school_id)` on every school table; reports/people RPCs check it |
| Schools cannot see each other | All school data is keyed by `school_id`; cross-school queries return nothing (tested) |
| Provider credentials isolated | tokens in `private.provider_tokens` (no API access); `provider_connections` readable only by owner |
| No answer keys before release | `question_answer_keys` author-only; `get_attempt` reveals keys only if released and `show_correct_answers` |
| Users can't change their own privileged roles | `user_roles` has no write policy; `set_user_role` requires admin, and admin roles require the owner |
| EduPro can't be self-assigned | `subscriptions` writes are admin-only; `grant_subscription` requires admin |
| Private submissions not public | uploaded with Cloudinary `type=authenticated`; the 5-minute signed link is issued only after an RLS check of `submission_files` |
| Owner operations need verified privileges | `require_admin()` checks role + active status on every call |
| Timed assessments | server-side deadline (`deadline_at`, 30 s grace); late saves auto-submit; attempt limits and windows checked server-side |
| Marks can't be tampered | learners can't write answers/results; graders can't edit learner work (trigger); scores capped at max marks |
| Course publishing | trigger: only platform admins or that school's admins can publish; premium/ownership/school changes admin-only |
| Realtime presence | private channels authorised by RLS on `realtime.messages` |

## Web security

The worker adds a strict Content-Security-Policy (no inline scripts; Supabase and Cloudinary allowed; embeds restricted to approved learning tools), plus HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. Lesson embeds are sandboxed iframes from an allow-list. External links are checked to be http(s). CSV exports neutralise formula injection.

## Privacy

Data minimisation by design: no date of birth, national ID or location; no time-on-page tracking. Offline lesson copies are per-user and deleted at sign-out. The privacy policy and terms are **drafts pending legal review**. No claim of compliance with Ghana's Data Protection Act 2012 (Act 843) is made until that review happens.

## Not provided

Exam proctoring, malware scanning of uploads (Cloudinary `allowed_formats` restricts types), and rate limiting beyond Supabase Auth's built-in limits.
