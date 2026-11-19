# ProfJero Edu / ProfJero EduPro

**A digital learning ecosystem by ProfJero Digital Studio.** It connects learners, educators and institutions through structured courses, live classes, class discussion, practical lessons, assessments, assignments, feedback and verifiable certificates. It is built to feel like a real classroom, wherever you learn.

ProfJero Edu is the free offering. **ProfJero EduPro** is the premium tier inside the **same app, database and account system**. Plans and limits are data, not code.

| | |
|---|---|
| Frontend | React 18 · TypeScript (strict) · Vite 8 · Tailwind CSS 4 · React Router · TanStack Query · React Hook Form · Zod · Radix primitives · Lucide |
| Backend | Supabase (Postgres 17, Auth, Row Level Security, Realtime, pg_cron) |
| Server API | Cloudflare Pages advanced-mode worker (`worker/`) |
| Media | Cloudinary (signed uploads, authenticated delivery for submissions) |
| Hosting | Cloudflare Pages project `profjero-edupro` → https://profjero-edupro.pages.dev |

## Quick start (local)

```bash
npm install
npx supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime,storage-api   # needs Docker
npx supabase db reset          # applies supabase/migrations + local-only seed
cp .env.example .env.local     # set VITE_SUPABASE_URL=http://127.0.0.1:54321 and the local ANON_KEY
npm run dev                    # http://localhost:5173
```

Local seed accounts (local stack only, password `DevPassw0rd!`): `owner@profjero.test`, `teacher@profjero.test`, `learner@profjero.test`, `schooladmin@profjero.test`, `schoolteacher@profjero.test`, `student@profjero.test`, `otheradmin@profjero.test`, `otherstudent@profjero.test`, `learner2@profjero.test`. Emails sent locally arrive in Mailpit at http://127.0.0.1:54324.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, production build, bundle `dist/_worker.js` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Database security and integration tests against the local stack |
| `npm run test:e2e` | Playwright user journeys (local stack + `wrangler pages dev`) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [Security](docs/SECURITY.md)
- [User roles & permissions](docs/USER_ROLES_AND_PERMISSIONS.md) · [Features & status](docs/FEATURES.md)
- [Integrations](docs/INTEGRATIONS.md) · [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Deployment](docs/DEPLOYMENT.md) · [Testing](docs/TESTING.md) · [Admin guide](docs/ADMIN_GUIDE.md) · [Development guide](docs/DEVELOPMENT_GUIDE.md)
- [Product research: what we adopted from the best platforms](docs/PLATFORM_RESEARCH.md) · [Implementation plan & status](docs/IMPLEMENTATION_PLAN.md)

The account owner is **profjero947@gmail.com**. That email receives the owner and platform-admin roles automatically when it signs up (see `private.owner_emails`).
