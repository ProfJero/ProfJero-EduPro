# Implementation plan & checklist

| Phase | Status |
|---|---|
| 1 Foundation: setup, design system, public site, auth, profiles, roles & context, schema, RLS | ✅ |
| 2 Core learning: catalogue, course management, modules, lessons, editor, enrolment, progress, learner dashboard | ✅ |
| 3 Teaching & assessment: teacher dashboard, assessments, banks, attempts, assignments, submissions, grading, feedback | ✅ |
| 4 Institutions: registration, approval, years, terms, classes, teachers, students, course assignment, reports | ✅ |
| 5 Communication & live: notifications, announcements, live scheduling, manual links, provider architecture, attendance | ✅ (OAuth providers 🟡) |
| 6 Administration & commercial readiness: console, users, course admin, certificates, support, entitlements, analytics, audit | ✅ |
| 7 Polish: PWA, offline, accessibility basics, performance, security tests, E2E, docs | ✅ |
| Production infrastructure | 🟡 Pages project created; Supabase project and first deploy blocked (see DEPLOYMENT.md) |

Next candidates: Google/Zoom OAuth adapters, email notifications (SMTP/Resend), learning-path & prerequisite editors, guardian portal, axe accessibility CI, in-browser code runner, payment gateway (only with approval).
