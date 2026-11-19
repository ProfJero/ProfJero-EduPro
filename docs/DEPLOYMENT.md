# Deployment

## Current status (19 November 2026)

| Item | Status |
|---|---|
| GitHub | Source pushed to `ProfJero/ProfJero-EduPro`, branch `ccr-b163a389-1cynkq` |
| Cloudflare Pages project | **Created**: `profjero-edupro` → https://profjero-edupro.pages.dev (production branch `main`) |
| First deployment | **Blocked.** Cloudflare's GitHub integration for this account reports "internal issue with your Cloudflare Pages Git installation", and direct uploads need an API token the connector cannot use. Use the GitHub Actions route below. |
| Supabase production project | **Blocked.** The account that owns "ProfJero's Org" already has 2 active free projects (Supabase's per-person limit). Pause or delete one, or upgrade. |

## Steps to go live

1. **Supabase project**: in https://supabase.com/dashboard, pause or delete one existing free project for that account, then create a project named `profjero-edupro` (region `eu-west-2`, London, is closest to Accra among the available regions). Or ask Claude in a new message and it will create it and apply the migrations.
2. **Apply the schema**: `npx supabase link --project-ref <ref> && npx supabase db push`. This applies migrations only, never `seed.sql`.
3. **Auth URLs**: Authentication → URL configuration. Site URL `https://profjero-edupro.pages.dev`, redirect `https://profjero-edupro.pages.dev/**`. Configure SMTP (Authentication → Emails) before inviting real users.
4. **Cloudflare variables**: Pages → `profjero-edupro` → Settings → Variables. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (and the Cloudinary secrets when available).
5. **GitHub**: repository → Settings → Secrets and variables → Actions.
   - Secrets: `CLOUDFLARE_API_TOKEN` (Cloudflare → My Profile → API Tokens → Create token → "Edit Cloudflare Workers" template, or a custom token with *Account › Cloudflare Pages › Edit*), `CLOUDFLARE_ACCOUNT_ID`.
   - Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_CLOUDINARY_CLOUD_NAME`.
6. **Deploy**: merge to `main` (deploys to https://profjero-edupro.pages.dev), or run the workflow manually. Other branches deploy as previews (`<branch>.profjero-edupro.pages.dev`).
7. **Owner account**: sign up at the site with **profjero947@gmail.com**. The owner and platform-admin roles are granted automatically.
8. **Verify**: `curl https://profjero-edupro.pages.dev/api/health` should report `"supabase": true`. Then register a test learner and run through the journeys in TESTING.md.

### Alternative: Git integration
If you reconnect GitHub in Cloudflare (Workers & Pages → Create → Connect to Git, reinstalling the Cloudflare Pages GitHub app), you can create a Git-connected project with build command `npm run build`, output `dist`, and `NODE_VERSION=22`. A Git project needs a fresh project name, or delete the empty `profjero-edupro` direct-upload project first.

## Build facts
- Build command `npm run build`, output directory `dist` (verified). Output includes `dist/_worker.js` (advanced mode) and `dist/sw.js`.
- No custom domain is configured or purchased.
