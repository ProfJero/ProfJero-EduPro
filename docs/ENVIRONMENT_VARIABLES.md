# Environment variables

Never put a secret in a `VITE_` variable: those are embedded in the public JavaScript bundle.

## Build time (GitHub Actions repository **variables** or a local `.env.local`)

| Name | Public? | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes (RLS protects data) | Supabase publishable/anon key |
| `VITE_CLOUDINARY_CLOUD_NAME` | yes | Enables upload UI (optional) |
| `VITE_API_BASE` | yes | Override API origin (default: same origin) |

## Runtime: Cloudflare Pages project → Settings → Variables

| Name | Type | Purpose |
|---|---|---|
| `SUPABASE_URL` | plain text | worker verifies sessions / checks permissions |
| `SUPABASE_ANON_KEY` | plain text | same |
| `CLOUDINARY_CLOUD_NAME` | plain text | signing |
| `CLOUDINARY_API_KEY` | **secret** | signing |
| `CLOUDINARY_API_SECRET` | **secret** | signing (never leaves the worker) |
| `GOOGLE_CLIENT_ID`, `ZOOM_CLIENT_ID` | plain text | reserved for future OAuth adapters |

## GitHub Actions secrets (for deployment)

| Name | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | `010429b77e626b5d6655bedd4f6472a5` |

Local development uses `.env.local` (frontend) and `.dev.vars` (worker under `wrangler pages dev`). Both are git-ignored. See `.env.example`.

The service-role key is **not used** by this project. Do not add it anywhere.
