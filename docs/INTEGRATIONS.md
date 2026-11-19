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
Adapter registry: `src/features/live/providers.ts`. Status endpoint: `GET /api/health` → `live_providers`.

| Provider | Status |
|---|---|
| Manual link (any https) | ✅ |
| Google Meet link | ✅ validated link |
| Zoom link | ✅ validated link |
| Jitsi | ✅ generated room links. `meet.jit.si` is suitable **for testing only**; use a dedicated JaaS or self-hosted deployment for production (not provisioned). |
| Microsoft Teams link | ✅ |
| Google Meet REST API (OAuth) | 🟡 not implemented. Needs a Google Cloud OAuth client (`GOOGLE_CLIENT_ID`/`SECRET`) and a Meet API scope review. Tokens would go in `private.provider_tokens`, which clients can never read. |
| Zoom Meetings API (OAuth, not Video SDK) | 🟡 not implemented. Needs a Zoom OAuth app (`ZOOM_CLIENT_ID`/`SECRET`). |

## Cloudflare
Pages project `profjero-edupro` (created). Worker in advanced mode (`dist/_worker.js`) serves the SPA and `/api/*`. Server variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (plain text) plus the Cloudinary secrets.

## GitHub
`.github/workflows/ci-deploy.yml`: lint → typecheck → unit tests → build; local Supabase → DB security tests → E2E; then `wrangler pages deploy` when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets exist.
