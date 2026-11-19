# Features & implementation status

Legend: ✅ implemented and tested · 🟡 implemented, needs external credentials or a manual step · ⬜ not implemented

## Public website
✅ Home (hero, how it works, categories, featured courses from the database, classroom experience, audiences, Edu vs EduPro, CTA) · ✅ Course catalogue with search/category/level/pagination · ✅ Course detail with curriculum, free-preview lessons, instructors, enrolment · ✅ About, For Schools, For Educators, Edu & EduPro (plans read live from the database), Contact (stored in the database), Privacy, Terms, Accessibility, certificate verification · ✅ Testimonials appear only when an admin adds genuine ones (`home.testimonials`). No invented stats, partners or testimonials.

## Accounts
✅ Registration with role intent, email verification, login, logout (this device / everywhere), password reset, onboarding, profile & settings, plan view, roles view · ✅ Suspension enforced · 🟡 Production email delivery uses Supabase's built-in mailer (low hourly limit). Configure SMTP before launch.

## Learner workspace
✅ Overview (continue learning, today's timetable, work due, recent feedback, activity) · ✅ My Learning · ✅ Explore · ✅ Course home (lessons, classroom, live classes, assessments & work, announcements, resources, leave/rejoin) · ✅ Lesson player (rule-based completion, bookmarks, save offline, "classmates studying now", prev/next) · ✅ Classes & timetable · ✅ Class room (board, presence, raise hand, discussion, subjects, own attendance) · ✅ Assessments (timed attempts, autosave, flagging, review) · ✅ Assignments (text/link/file, drafts, late handling, feedback, rubric scores) · ✅ Resources (bookmarks, materials, offline lessons) · ✅ Progress · ✅ Certificates (printable, verifiable) · ✅ Notifications (realtime badge) · ✅ Support

## Teaching
✅ Overview · ✅ Course creation & details · ✅ Curriculum (modules, lessons, reorder, move, duplicate, archive, delete, preview as student) · ✅ Block lesson editor (15 block types, autosave, revisions + restore, preview, publish/unpublish/review states) · ✅ Course review workflow · ✅ Team (co-instructors) & enrol by email · ✅ Learner insights (progress, falling behind, assessment stats, CSV export; most-missed questions on EduPro) · ✅ Question banks (9 question types) · ✅ Assessment builder (windows, time limit, pass mark, attempts, shuffling, result visibility, release, CSV) · ✅ Manual grading · ✅ Assignments (rubrics, grading, return for correction, missing/late tracking) · ✅ Live classes (schedule, edit/reschedule, cancel, recording link, attendance) · ✅ Classes (classroom moderation, roll call, roster, assign courses) · ✅ Students · ✅ Resources · ✅ Announcements · ✅ Reports

## Schools
✅ Registration + approval workflow · ✅ Overview & setup guide · ✅ Students (add, invite, CSV import with per-row report, assign to class, suspend/remove, export) · ✅ Teachers (invite, admins, assign) · ✅ Classes/streams (teachers, students, courses → auto-enrolment, register, classroom) · ✅ Academic years & terms · ✅ School courses · ✅ Attendance · ✅ Announcements · ✅ Reports (participation, enrolment, completion, assessment, submissions, attendance, class comparison, teacher activity, CSV) · ✅ Settings · ⬜ Bulk teacher CSV import · ⬜ Parent/guardian portal (data model only)

## Live classes
✅ Manual links for Google Meet / Zoom / Jitsi / Teams / any https link (validated per provider), with Jitsi room generation · ✅ Notifications (scheduled/rescheduled/cancelled, 1-hour reminder) · ✅ One-tap join records attendance; manual attendance fallback · ✅ Session lobby with chat/presence · 🟡 Google Meet API / Zoom Meetings API OAuth meeting creation: the adapter registry and token storage table exist, but **the OAuth flows are not implemented**. They need credentials (see INTEGRATIONS.md). No automated attendance import from providers.

## Platform console
✅ Overview metrics (all live) · ✅ Users (search, roles, suspend, grant EduPro) · ✅ Schools (approve/reject/suspend, EduPro for Schools) · ✅ Instructor applications · ✅ Courses & content review, EduPro flag · ✅ Categories · ✅ Assessments/assignments oversight · ✅ Certificates (revoke) · ✅ Live classes · ✅ Plans & features matrix, subscription grants/revokes · ✅ Platform announcements · ✅ Support desk (assign, internal notes, status) · ✅ Contact inbox · ✅ Audit log · ✅ Settings

## Edu / EduPro
✅ Central plans/features/limits (no hard-coded limits) · ✅ Individual, teacher and school scopes; a school's plan covers its members · ✅ Enforced server-side limits: premium courses, active self-enrolments, independent courses, monthly live sessions, school seats, advanced analytics · ✅ Manual grants for pilots · ⬜ Payments (deliberately not connected)

## Media
🟡 Cloudinary signed uploads (avatars, course media, submission files as authenticated assets) and 5-minute private links are implemented and the signing is unit-tested, but **they await Cloudinary credentials**. Until then the UI offers links instead of uploads.

## PWA & offline
✅ Installable manifest and icons, app-shell service worker, update prompt, connection banner, offline lessons, offline completion queue.

## Not implemented (planned)
⬜ Interactive in-browser code execution · ⬜ Email notifications (in-app only; architecture ready) · ⬜ Learning-path UI (tables exist) · ⬜ Course prerequisites editor UI (enforced in the database) · ⬜ Proctoring · ⬜ Payment gateway.
