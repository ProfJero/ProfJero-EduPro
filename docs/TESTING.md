# Testing

| Suite | Command | Count | Last result |
|---|---|---|---|
| Unit (Vitest) | `npm test` | 18 | ✅ pass |
| Database security & integration | `npm run test:db` | 19 | ✅ pass |
| Grading engine (SQL) | part of `npm run test:db` | 5 | ✅ pass |
| End-to-end (Playwright) | `npm run test:e2e` | 7 | ✅ pass |
| Lint / typecheck / build | `npm run lint && npm run typecheck && npm run build` | — | ✅ |
| Postgres function lint | `npx supabase db lint` | — | ✅ no issues |

All database and E2E tests run against the **local** Supabase stack (`npx supabase start`, `npx supabase db reset`). They sign in as real seeded users through the public API, so RLS is exercised exactly as in production.

## Security tests (`tests/db/security.test.mjs`)
Owner bootstrap; role/status self-escalation; anonymous catalogue vs locked content; direct-enrolment bypass; answer-key secrecy; attempt isolation (read/write/submit/grade by others); direct result/answer injection; completion → certificate → public verification; forged certificates; cross-school isolation (classes, memberships, people, reports, inserts); school auto-enrolment; submission privacy, self-grading, grader tampering, over-max scores; course publish/premium guards and the review workflow; EduPro self-assignment and grant/revoke; live-session creation/visibility/join attendance; classroom privacy and board moderation; notification privacy and spoofing; school self-approval; CSV import report; support ticket privacy and self-assignment; suspension and audit logging.

## End-to-end journeys (`tests/e2e/journeys.spec.ts`)
1. **Learner**: register → email verification (Mailpit) → onboarding → sign out/in → explore → enrol → lesson → mark complete → timed quiz with autosave → passed → progress.
2. **Teacher**: create course → module → lesson with blocks → autosave → publish lesson → submit for review → owner publishes → visible in catalogue → assessment from question bank → publish.
3. **Assignment & grading**: student submits → class teacher marks with feedback → student sees score.
4. **Live class**: teacher schedules a Jitsi session → learner notified → timetable → Join opens the meeting (external host stubbed).
5. **School**: register school → owner approves → workspace appears → academic year → class → invite teacher → add student → invitation for a new email → assign course → reports.
6. **Platform owner**: overview → users → grant EduPro → subscriptions → audit log → learner sees EduPro plan.
7. **Security UX**: learner blocked from console and other schools.

Not yet automated: mobile-viewport E2E, accessibility audit (axe), load testing, and Cloudinary upload against a real account.
