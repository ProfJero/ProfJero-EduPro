# Environment variables

Never put a secret in a `VITE_` variable: those are embedded in the public JavaScript bundle. All variables below are set on the **Cloudflare Pages project `profjero-edupro`** (Settings → Variables and secrets), for production and preview. Local development uses `.env.local` (frontend) and `.dev.vars` (worker); both are git-ignored — see `.env.example`.

## Build time (public)

| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key (RLS protects data) |
| `VITE_API_BASE` | API origin (`https://profjero-edu-api.profjerodigitalstudio.workers.dev`) |
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key |
| `VITE_CLOUDINARY_CLOUD_NAME` | Enables device uploads |
| `NODE_VERSION` | `22` |

## Runtime (server only)

| Name | Type | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | plain | verify sessions; every database call runs as the signed-in user (RLS) |
| `APP_URL` | plain | OAuth redirect base, CORS |
| `API_URL` | plain | allowed in the site's CSP (frames/connect) |
| `ALLOWED_ORIGINS` | plain, optional | extra CORS origins (comma separated) |
| `WORKER_SECRET` | **secret** | shared with `private.app_config` — push dispatch, OAuth state signing, provider token vault |
| `ANTHROPIC_API_KEY` | **secret** | AI Companion and Resource Studio (model `claude-opus-5-5`) |
| `VAPID_PUBLIC_KEY` | plain | Web Push |
| `VAPID_PRIVATE_KEY` | **secret** | Web Push signing (raw base64url or JWK) |
| `VAPID_SUBJECT` | plain, optional | contact URL/mailto for push services |
| `CLOUDINARY_CLOUD_NAME` | plain | upload signing |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | **secret** | upload signing |
| `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | plain / **secret** | Zoom OAuth app |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | plain / **secret** | Google OAuth client (Calendar events → Meet links) |
| `JAAS_APP_ID`, `JAAS_KID` | plain | Jitsi as a Service |
| `JAAS_PRIVATE_KEY` | **secret** | JaaS RS256 key (PKCS#8 PEM) |
| `JUDGE0_URL` | plain | Judge0-compatible code runner |
| `JUDGE0_KEY`, `JUDGE0_KEY_HEADER` | **secret** / plain | runner auth (`X-Auth-Token`, or `X-RapidAPI-Key` for RapidAPI) |

The Supabase service-role key is **not used** anywhere. Privileged server actions use worker-secret-gated database functions instead.
