# Deployment

## Current status (20 November 2026)

| Item | Status |
|---|---|
| GitHub | `ProfJero/ProfJero-EduPro`, branch `ccr-b163a389-1cynkq` |
| Cloudflare Pages | `profjero-edupro`, **Git-connected**: the production branch is `main` (other branches build previews); each push builds (`npm run build`, output `dist`) and deploys to https://profjero-edupro.pages.dev. Compatibility flag `nodejs_compat` is set. |
| API hostname | Worker `profjero-edu-api` → https://profjero-edu-api.profjerodigitalstudio.workers.dev. A small proxy that forwards to the app; the API code itself runs in the Pages worker (`dist/_worker.js`), so it is rebuilt from GitHub on every push. |
| Supabase | Project **ProfJero EduPro** (`nhfrjayhywzsfhacftdj`, eu-west-1, org "ProfJero Hub"). All migrations up to `20261120000500` are applied. `seed.sql` (test accounts) is **never** applied to production. |
| Pages variables (plain) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_API_BASE`, `API_URL`, `APP_URL`, `NODE_VERSION=22` — set for production and preview. |

## Steps only the owner can do (dashboards)

1. **Supabase → Authentication → Sign In / Providers → Email**: turn **off** "Confirm email" (sign-up then signs people straight in; the app also handles it being on). Turn **on** "Allow anonymous sign-ins" (needed for guests joining a class).
2. **Supabase → Authentication → URL configuration**: Site URL `https://profjero-edupro.pages.dev`; redirect URL `https://profjero-edupro.pages.dev/**`.
3. **Shared worker secret** (enables push dispatch and the Zoom/Google token vault):
   - Generate a random value locally, e.g. `openssl rand -hex 32`.
   - Cloudflare → Workers & Pages → `profjero-edupro` → Settings → Variables and secrets → add **secret** `WORKER_SECRET` (production and preview).
   - Supabase → SQL editor:
     `insert into private.app_config (key, value) values ('api_url', 'https://profjero-edupro.pages.dev'), ('worker_secret', '<the same value>') on conflict (key) do update set value = excluded.value;`
4. **Push notifications**: run `npx web-push generate-vapid-keys`. Add Pages variables `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY` (both the public key, plain text), secret `VAPID_PRIVATE_KEY` (the private key), optional `VAPID_SUBJECT` (e.g. `https://profjero-edupro.pages.dev`). Retry the latest deployment so the public key is built into the app.
5. **AI Companion / Resource Studio**: secret `ANTHROPIC_API_KEY` (from console.anthropic.com). Usage is billed by Anthropic; daily per-user limits come from the plan feature `ai_requests_per_day`.
6. Optional integrations: see INTEGRATIONS.md (Cloudinary, Zoom, Google Meet, JaaS, Judge0).
7. **Owner account**: sign up with **profjero947@gmail.com** — owner and platform-admin roles are granted automatically.

After changing variables, use Pages → Deployments → *Retry deployment* (build-time `VITE_` values only change on a new build).

## Capacity
See CAPACITY.md for the free-tier analysis.

## Verify
- `curl https://profjero-edu-api.profjerodigitalstudio.workers.dev/api/health` → `features` shows which integrations are configured.
- Platform console → Integrations shows the same, with what each one needs.

## Google Search Console

1. In Search Console add a **URL-prefix** property for `https://profjero-edupro.pages.dev/`.
2. Choose **HTML tag** verification and copy only the `content` value.
3. In Cloudflare → Pages → profjero-edupro → Settings → Variables, add `GOOGLE_SITE_VERIFICATION` (plain text) with that value for Production, then redeploy (push to `main`). The worker adds the tag to every page.
4. Click **Verify**, then submit `sitemap.xml` under **Sitemaps**. The sitemap updates automatically as courses are published.
