import { transform } from 'sucrase';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { SAMPLE_SQL_DB, type LabFile, type LangId } from './languages';

export type RunEvent =
  | { type: 'stdout' | 'stderr' | 'status'; text: string }
  | { type: 'error'; text: string; line?: number; file?: string }
  | { type: 'done'; ms: number }
  | { type: 'table'; columns: string[]; rows: unknown[][] };
export type TestResult = { pass: boolean; got?: unknown; error?: string };

const TIMEOUT_MS = 15_000;

/** A restartable worker wrapper: terminates on timeout/stop so runaway code can't hang the tab. */
class WorkerRunner {
  private worker: Worker | null = null;
  private seq = 0;
  constructor(private make: () => Worker) {}
  stop() {
    this.worker?.terminate();
    this.worker = null;
  }
  run(msg: Record<string, unknown>, onEvent: (e: RunEvent) => void, timeout = TIMEOUT_MS): Promise<TestResult[] | void> {
    if (!this.worker) this.worker = this.make();
    const id = ++this.seq;
    const w = this.worker;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        onEvent({ type: 'error', text: `Stopped: your program ran for more than ${timeout / 1000} seconds (possible infinite loop).` });
        this.stop();
        resolve();
      }, timeout);
      w.onmessage = (ev: MessageEvent<{ type: string; id?: number; text?: string; ms?: number; line?: number; file?: string; results?: TestResult[] }>) => {
        const d = ev.data;
        if (d.type === 'status') return onEvent({ type: 'status', text: d.text ?? '' });
        if (d.id !== id) return;
        if (d.type === 'stdout' || d.type === 'stderr') onEvent({ type: d.type, text: d.text ?? '' });
        else if (d.type === 'error') { clearTimeout(timer); onEvent({ type: 'error', text: d.text ?? 'Error', line: d.line, file: d.file }); resolve(); }
        else if (d.type === 'done') { clearTimeout(timer); onEvent({ type: 'done', ms: d.ms ?? 0 }); resolve(); }
        else if (d.type === 'tests') { clearTimeout(timer); resolve(d.results); }
      };
      w.onerror = (err) => { clearTimeout(timer); onEvent({ type: 'error', text: err.message || 'Worker error' }); this.stop(); resolve(); };
      w.postMessage({ ...msg, id });
    });
  }
}

const python = new WorkerRunner(() => new Worker(new URL('./py.worker.ts', import.meta.url), { type: 'module' }));
const js = new WorkerRunner(() => new Worker(new URL('./js.worker.ts', import.meta.url), { type: 'module' }));

export function stopAll() {
  python.stop();
  js.stop();
}

export function toJs(code: string, ts: boolean) {
  return ts ? transform(code, { transforms: ['typescript'], disableESTransforms: true }).code : code;
}

/** Concatenate JS/TS files: main last, others first (simple module-less bundle). */
function bundle(files: LabFile[], main: string) {
  const ordered = [...files.filter((f) => f.name !== main && /\.(m?js|ts)$/.test(f.name)), ...files.filter((f) => f.name === main)];
  return ordered.map((f) => toJs(f.content, f.name.endsWith('.ts'))).join('\n;\n');
}

export async function runProgram(lang: LangId, files: LabFile[], main: string, stdin: string, onEvent: (e: RunEvent) => void) {
  if (lang === 'python') return python.run({ type: 'run', files, main, stdin }, onEvent, 30_000);
  if (lang === 'javascript' || lang === 'typescript') {
    let code: string;
    try {
      code = bundle(files, main);
    } catch (e) {
      return onEvent({ type: 'error', text: `Compile error: ${(e as Error).message}` });
    }
    return js.run({ type: 'run', code, stdin }, onEvent);
  }
  if (lang === 'sql') return runSql(files.find((f) => f.name === main)?.content ?? '', onEvent);
  return runRemote(lang, files, main, stdin, onEvent);
}

export async function runTests(lang: LangId, files: LabFile[], main: string, fn: string, tests: { args: unknown[]; expected: unknown }[]): Promise<TestResult[]> {
  if (lang === 'python') return ((await python.run({ type: 'test', files, main, fn, tests }, () => undefined, 30_000)) ?? []) as TestResult[];
  if (lang === 'javascript' || lang === 'typescript') return ((await js.run({ type: 'test', code: bundle(files, main), fn, tests }, () => undefined)) ?? []) as TestResult[];
  throw new Error('Automatic tests are available for Python and JavaScript.');
}

// ---------------------------------------------------------------------------
// SQL (sql.js / SQLite compiled to WebAssembly)
// ---------------------------------------------------------------------------
type SqlDb = { exec: (sql: string) => { columns: string[]; values: unknown[][] }[]; close: () => void };
type SqlJs = { Database: new () => SqlDb };
let sqlJs: Promise<SqlJs> | null = null;
const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/';
function loadSqlJs(): Promise<SqlJs> {
  sqlJs ??= new Promise((resolve, reject) => {
    const w = window as unknown as { initSqlJs?: (o: { locateFile: (f: string) => string }) => Promise<SqlJs> };
    const go = () => w.initSqlJs!({ locateFile: (f) => SQLJS + f }).then(resolve, reject);
    if (w.initSqlJs) return void go();
    const s = document.createElement('script');
    s.src = `${SQLJS}sql-wasm.js`;
    s.crossOrigin = 'anonymous';
    s.onload = go;
    s.onerror = () => reject(new Error('Could not load the SQL engine. Check your connection (it is cached after the first load).'));
    document.head.appendChild(s);
  });
  return sqlJs;
}

async function runSql(sql: string, onEvent: (e: RunEvent) => void) {
  const t0 = performance.now();
  try {
    onEvent({ type: 'status', text: 'Loading SQL engine…' });
    const SQL = await loadSqlJs();
    const db = new SQL.Database();
    db.exec(SAMPLE_SQL_DB);
    const results = db.exec(sql);
    if (!results.length) onEvent({ type: 'stdout', text: 'Query OK (no rows returned).\n' });
    for (const r of results) onEvent({ type: 'table', columns: r.columns, rows: r.values });
    db.close();
    onEvent({ type: 'done', ms: Math.round(performance.now() - t0) });
  } catch (e) {
    onEvent({ type: 'error', text: (e as Error).message });
  }
}

// ---------------------------------------------------------------------------
// Compiled languages: executed by the API worker (Judge0-compatible service)
// ---------------------------------------------------------------------------
async function runRemote(lang: LangId, files: LabFile[], main: string, stdin: string, onEvent: (e: RunEvent) => void) {
  if (!env.apiBase) return onEvent({ type: 'error', text: 'Running this language needs the ProfJero Edu code-execution service, which is not configured here. You can still write and save code.' });
  onEvent({ type: 'status', text: 'Compiling and running on the server…' });
  const { data } = await supabase.auth.getSession();
  try {
    const res = await fetch(`${env.apiBase}/api/code/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ language: lang, files, main, stdin }),
    });
    const j = (await res.json()) as { stdout?: string; stderr?: string; compile_output?: string; status?: string; time?: string; error?: string };
    if (!res.ok) return onEvent({ type: 'error', text: j.error ?? `Execution failed (${res.status})` });
    if (j.compile_output) onEvent({ type: 'stderr', text: j.compile_output });
    if (j.stdout) onEvent({ type: 'stdout', text: j.stdout });
    if (j.stderr) onEvent({ type: 'stderr', text: j.stderr });
    onEvent({ type: 'done', ms: Math.round(Number(j.time ?? 0) * 1000) });
  } catch {
    onEvent({ type: 'error', text: 'Could not reach the code-execution service. Check your connection.' });
  }
}

// ---------------------------------------------------------------------------
// Web preview document (HTML + CSS + JS) with a console bridge
// ---------------------------------------------------------------------------
export function buildWebDocument(files: LabFile[]) {
  const html = files.find((f) => f.name.endsWith('.html'))?.content ?? '';
  const css = files.filter((f) => f.name.endsWith('.css')).map((f) => f.content).join('\n');
  const jsCode = files.filter((f) => f.name.endsWith('.js')).map((f) => f.content).join('\n;\n');
  const bridge = `<script>(function(){var send=function(t,a){try{parent.postMessage({__pje:1,type:t,text:Array.prototype.map.call(a,function(x){try{return typeof x==='string'?x:JSON.stringify(x)}catch(e){return String(x)}}).join(' ')},'*')}catch(e){}};
['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){send(k==='error'||k==='warn'?'stderr':'stdout',arguments);o.apply(console,arguments)}});
window.addEventListener('error',function(e){send('stderr',[e.message+(e.lineno?' (line '+e.lineno+')':'')])});})();</script>`;
  const body = /<body[\s>]/i.test(html) ? html : `<body>${html}</body>`;
  const doc = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${bridge}<style>${css}</style></head>${body}</html>`;
  const withAssets = doc.includes(bridge) ? doc : doc.replace(/<head[^>]*>/i, (m) => `${m}${bridge}<style>${css}</style>`);
  return withAssets.replace(/<\/body>/i, `<script>${jsCode.replace(/<\/script>/gi, '<\\/script>')}</script></body>`);
}
