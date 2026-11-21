/**
 * Shown when the build has no Supabase configuration (e.g. the very first
 * deployment before the production database is connected). Honest, branded,
 * and never pretends the platform is available.
 */
export function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6 text-white">
      <div className="max-w-lg text-center">
        <img src="/brand/mark.webp" alt="" width={72} height={72} className="mx-auto h-18 w-18" />
        <h1 className="mt-6 text-3xl font-extrabold text-white">ProfJero Edu is being set up</h1>
        <p className="mt-3 text-ink-300">
          Our digital learning platform is almost ready. The application is deployed, and its database connection is being finalised.
        </p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-growth-500">Unveiling the Extraordinary</p>
        <p className="mt-8 text-xs text-ink-500">
          Operators: the build needs <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. See <code>docs/DEPLOYMENT.md</code>.
        </p>
      </div>
    </div>
  );
}
