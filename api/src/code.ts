/** Server-side code execution for compiled languages via a Judge0-compatible API. */
import type { Env } from './env';
import { body, json, type User } from './util';

// Judge0 CE language ids
const LANG: Record<string, number> = { c: 50, cpp: 54, java: 62, csharp: 51, go: 60, rust: 73, php: 68, ruby: 72, kotlin: 78 };
export const codeReady = (env: Env) => Boolean(env.JUDGE0_URL);

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s?: string | null) => (s ? new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0))) : '');

export async function runCode(req: Request, env: Env, _user: User) {
  if (!codeReady(env)) return json({ error: 'Running this language needs the code-execution service, which the administrator has not configured yet. Python, JavaScript, TypeScript, SQL and web projects run in your browser.' }, 503);
  const b = await body<{ language?: string; files?: { name: string; content: string }[]; main?: string; stdin?: string }>(req, 150_000);
  const id = LANG[b.language ?? ''];
  if (!id) return json({ error: 'Unsupported language' }, 400);
  const files = (b.files ?? []).filter((f) => typeof f.content === 'string');
  const main = files.find((f) => f.name === b.main) ?? files[0];
  if (!main || main.content.length > 64_000) return json({ error: 'Source missing or too large' }, 400);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (env.JUDGE0_KEY) headers[env.JUDGE0_KEY_HEADER || 'X-Auth-Token'] = env.JUDGE0_KEY;
  const r = await fetch(`${env.JUDGE0_URL!.replace(/\/$/, '')}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST', headers,
    body: JSON.stringify({ language_id: id, source_code: b64(main.content), stdin: b64((b.stdin ?? '').slice(0, 10_000)), cpu_time_limit: 5, wall_time_limit: 10, memory_limit: 256000 }),
  });
  if (!r.ok) return json({ error: `The code-execution service returned ${r.status}.` }, 502);
  const j = (await r.json()) as { stdout?: string; stderr?: string; compile_output?: string; message?: string; status?: { description?: string }; time?: string };
  return json({ stdout: unb64(j.stdout).slice(0, 100_000), stderr: (unb64(j.stderr) + (j.message ? `\n${unb64(j.message)}` : '')).slice(0, 50_000), compile_output: unb64(j.compile_output).slice(0, 50_000), status: j.status?.description, time: j.time });
}
