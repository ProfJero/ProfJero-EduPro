# Architecture

## Overview

```
Browser (React SPA, PWA)
  │  supabase-js (anon key + user JWT)        ──►  Supabase: Postgres + RLS + RPC, Auth, Realtime
  │  fetch /api/*  (user JWT)                 ──►  Cloudflare Pages worker (worker/index.ts)
  │                                                   ├─ verifies JWT with Supabase Auth
  │                                                   ├─ asks Postgres (as the user) for permission
  │                                                   └─ signs Cloudinary uploads / private download URLs
  └─ direct signed upload                     ──►  Cloudinary
```

- **One application.** ProfJero Edu and EduPro share the codebase, database, auth and deployment. Entitlements (`plans`, `features`, `plan_features`, `subscriptions`) decide what is enabled.
- **Security lives in the database.** Every table has RLS. Multi-step or privileged operations (enrolment, grading, certificates, school approval, role changes, entitlement grants, CSV import) are `SECURITY DEFINER` RPCs that re-check `auth.uid()`. The UI's route guards are only for user experience.
- **Trusted server work** (Cloudinary secret) runs in the Pages worker, never in the browser. Supabase Edge Functions are not used: the worker covers the one server-side need without duplicating it.

## Frontend layout

```
src/
  app/App.tsx                 router (lazy routes), providers
  components/ui/              design system (Button, Field, Card, Dialog, Tabs, DataTable, Toast, …)
  components/brand/           logo (mark cropped from the supplied ProfJero artwork)
  layouts/                    PublicLayout, AuthLayout, AppShell (workspace switcher, realtime bell, mobile nav)
  pages/public/               home, catalogue, course detail, info, pricing, contact, legal, verify
  features/
    authentication/           AuthProvider (session, profile, my_context), guards, auth pages
    profiles/                 onboarding, settings
    courses/  lessons/        catalogue, course editor, block-based lesson editor + renderer
    learning/                 learner home, my learning, course home, lesson player, resources, offline sync
    classroom/                realtime classroom (board, presence, raise hand, Q&A), classes, roll call
    live/                     provider adapter registry, scheduling, session lobby
    assessments/              question banks, builder, timed attempts, review & manual grading
    assignments/              submissions, rubrics, grading, return for correction
    schools/                  school workspace (people, CSV import, classes, academic, attendance, reports)
    administration/           platform console
    subscriptions/            Edu/EduPro plan matrix and grants
    notifications/ support/ certificates/ analytics/ media/
  lib/                        supabase client, env, dates (Africa/Accra default), media, offline store
worker/                       Cloudflare worker: /api/health, /api/media/sign, /api/media/submission-url
supabase/migrations/          11 ordered SQL migrations (the only way the schema changes)
tests/db  tests/e2e  src/test unit tests
```

## Workspaces and context switching

`my_context()` returns the caller's platform roles, school memberships, pending invitations and entitlements. The shell derives workspaces from it: **Learning** (everyone), **Teaching** (instructor role or school staff), **School: name** (one per school a user administers) and **Platform console** (admins/owner). Users switch without logging out. Every query still goes through RLS, so changing a value in the browser grants nothing.

## Realtime "classroom"

- `classroom_messages` (board, discussion, Q&A) streams changes over Postgres Changes, filtered by RLS.
- Presence ("in class now", raise hand, "studying this lesson") uses **private** Realtime channels `room:<course|class|session>:<id>`. Channel access is authorised by RLS on `realtime.messages` (migration 0007).

## Offline & low bandwidth

- The PWA precaches only the app shell (~760 KB). Page chunks are cached on first use. Public Cloudinary images get `f_auto,q_auto` plus size transformations and `srcset`.
- Learners can save lessons offline. Copies are stored per user in Cache Storage and deleted on sign-out, which protects shared devices.
- Lesson completions made offline are queued and replayed on reconnect. `complete_lesson` is idempotent, so retries never create duplicates.
- Assessments are online-only by design.
