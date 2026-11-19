# Development guide

1. `npm install`, then `npx supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime,storage-api` (needs Docker), then `npx supabase db reset`.
2. Create `.env.local` with the local URL `http://127.0.0.1:54321` and the `ANON_KEY` from `npx supabase status -o env`.
3. `npm run dev`. For the worker too: `npm run build && npx wrangler pages dev dist --port 8788` (put `SUPABASE_URL`/`SUPABASE_ANON_KEY` in `.dev.vars`).

## Conventions
- **Schema changes = new migration file** (`supabase/migrations/<timestamp>_name.sql`). Never edit production by hand. Then `npm run db:types` to regenerate `src/types/database.ts`.
- New table checklist: RLS enabled, policies for each role, indexes on FKs and policy columns, explicit grants, a security test in `tests/db`.
- Multi-step or privileged writes → a `SECURITY DEFINER` RPC with `search_path = ''` that checks `auth.uid()`. Helpers go in `private`.
- Frontend: feature folders under `src/features`. Data goes through TanStack Query + `unwrap()`, forms through React Hook Form + Zod, and UI through `src/components/ui`. Handle loading, empty, error and success states.
- Dates: store UTC; display with `src/lib/dates.ts` (user time zone, default Africa/Accra).
- Plan limits: never hard-code. Add a `features` row + `plan_features` values and enforce on the server.

## Troubleshooting
- **INSERT … RETURNING fails RLS**: the select policy must not rely on a helper that looks the row up by id (it isn't visible yet in the same statement). Add a direct column check (see `courses_read`).
- **Emails locally**: Mailpit at http://127.0.0.1:54324.
- **"ProfJero Edu is being set up" page**: the build is missing `VITE_SUPABASE_*`.
- **Uploads show "not configured"**: Cloudinary variables aren't set for the worker.
