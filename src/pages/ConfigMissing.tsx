export function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="card max-w-lg p-8">
        <h1 className="text-xl font-extrabold">ProfJero Edu is not configured</h1>
        <p className="mt-2 text-sm text-ink-600">
          The application needs <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> at build time. See <code>docs/ENVIRONMENT_VARIABLES.md</code>.
        </p>
      </div>
    </div>
  );
}
