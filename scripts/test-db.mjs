// Runs the database security/integration suite against the local Supabase stack.
// Usage: npx supabase start && npx supabase db reset && npm run test:db
import { execSync, spawnSync } from 'node:child_process';

function localEnv() {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const env = {};
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = localEnv();
const res = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/db/*.test.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_URL: env.API_URL, SUPABASE_ANON_KEY: env.ANON_KEY, DB_URL: env.DB_URL },
});
process.exit(res.status ?? 1);
