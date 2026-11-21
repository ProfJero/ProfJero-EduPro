# Integrations

## Supabase
Database, Auth, Realtime, pg_cron. Migrations in `supabase/migrations`. Production project: **not yet created**, because the Supabase account is at its free-project limit (see DEPLOYMENT.md).

Auth settings to configure in the dashboard (Authentication → URL configuration):
- Site URL: `https://profjero-edupro.pages.dev`
- Redirect URLs: `https://profjero-edupro.pages.dev/**`
- Email confirmations: **on**. Configure custom SMTP before launch (the built-in mailer is rate-limited).

## Cloudinary (🟡 awaiting credentials)
- Set Cloudflare secrets `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and the build variable `VITE_CLOUDINARY_CLOUD_NAME`.
- `POST /api/media/sign` checks the Supabase session, then the permission (`media_permissions` RPC for course media). It returns a signature for a fixed folder and `allowed_formats`:
  - avatars → `profjero-edu/avatars/<user>` (public delivery)
  - course media → `profjero-edu/courses/<course>` (public delivery, responsive `f_auto,q_auto`)
  - submissions → `profjero-edu/submissions/<user>`, **`type=authenticated`** (never publicly reachable)
- `POST /api/media/submission-url` reads `submission_files` **as the user** (RLS) and returns a 5-minute signed download URL.
- Free-tier awareness: images are transformed on delivery, videos are better embedded from YouTube/Vimeo, and upload sizes are capped (2 MB avatars, 10 MB submissions, 50 MB course media).

## Live-class providers
Adapter registry: `src/features/live/providers.ts`; server code `api/src/live.ts`.

| Provider | Status |
|---|---|
| Any https link, Teams | ✅ paste a link |
| Jitsi | ✅ generated room; **in-app classroom** via the official IFrame API when "Hold the class inside ProfJero Edu" is ticked. Without JaaS keys it uses the free `meet.jit.si` server (short test calls only). With `JAAS_APP_ID`, `JAAS_KID`, `JAAS_PRIVATE_KEY` it uses 8x8.vc with signed JWTs; the class host is moderator. JaaS has its own pricing — not provisioned. |
| Zoom | ✅ implemented, 🟡 awaiting a Zoom OAuth app. Create a *General app* (user-managed) at marketplace.zoom.us, scopes `meeting:write:meeting`, `user:read:user`; redirect URL `https://profjero-edupro.pages.dev/integrations/zoom/done`. Set `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET`. Teachers then connect in Settings → Connected apps and press **Create** when scheduling. |
| Google Meet | ✅ implemented, 🟡 awaiting a Google OAuth client. Google Cloud console → enable Google Calendar API → OAuth client (Web), redirect URI `https://profjero-edupro.pages.dev/integrations/google/done`, scopes `openid email …/auth/calendar.events`. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Meet links are created through Calendar events with `conferenceData`. |

OAuth tokens are stored only in `private.provider_tokens` through `provider_store_tokens`, which requires the worker secret and the user's own session; browsers never see them. Access tokens refresh automatically.

## AI (EduIntelligence)
`api/src/ai.ts` uses the official Anthropic SDK with `claude-opus-5-5`, streamed replies, server-side refusal fallback and prompt caching. Each request first calls `ai_consume` as the user (plan limit; blocked while a graded assessment is in progress). Answers are grounded in **approved** items from `curriculum_items` (`curriculum_search`) and, when opened from a lesson, the lesson's own content (`ai_lesson_context`). Admins import official NaCCA/GES strands and indicators in Platform console → Curriculum; nothing is invented. Needs `ANTHROPIC_API_KEY`.

## Web Push
`api/src/push.ts` implements VAPID (ES256) and aes128gcm encryption with Web Crypto (unit-tested round trip). A database trigger on `notifications` posts to `/api/push/dispatch` via `pg_net` with the worker secret; expired subscriptions are pruned. Needs `WORKER_SECRET`, the VAPID keys and `private.app_config`.

## Code execution
Python (Pyodide), JavaScript/TypeScript, SQL (sql.js) and web projects run in the learner's browser (engines from cdn.jsdelivr.net, cached offline). C, C++, Java, C#, Go, Rust, PHP, Ruby and Kotlin run through a Judge0-compatible service: set `JUDGE0_URL` (self-hosted Judge0 CE, or RapidAPI with `JUDGE0_KEY` + `JUDGE0_KEY_HEADER=X-RapidAPI-Key`). Not provisioned (paid plans exist).

## Cloudflare
Pages project `profjero-edupro` (Git-connected). `dist/_worker.js` serves the SPA, `/api/*` and `/lab-runner` (the Code Lab preview sandbox). Worker `profjero-edu-api` is the public API hostname and proxies to the app. `api/wrangler.toml` lets the API also be deployed as a standalone Worker if preferred.

## GitHub
`.github/workflows/ci-deploy.yml`: lint → typecheck → unit tests → build; local Supabase → DB security tests → E2E.
