/// <reference lib="webworker" />
/* JavaScript/TypeScript runner in an isolated worker (no DOM, no app access). */
type Msg = { type: 'run'; id: number; code: string; stdin: string } | { type: 'test'; id: number; code: string; fn: string; tests: { args: unknown[]; expected: unknown }[] };
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
const fmt = (v: unknown): string => {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x), 2) ?? String(v);
  } catch {
    return String(v);
  }
};

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  const t0 = performance.now();
  const lines = m.type === 'run' && m.stdin ? m.stdin.split('\n') : [];
  const con = {
    log: (...a: unknown[]) => post({ type: 'stdout', id: m.id, text: a.map(fmt).join(' ') + '\n' }),
    info: (...a: unknown[]) => post({ type: 'stdout', id: m.id, text: a.map(fmt).join(' ') + '\n' }),
    warn: (...a: unknown[]) => post({ type: 'stderr', id: m.id, text: '⚠ ' + a.map(fmt).join(' ') + '\n' }),
    error: (...a: unknown[]) => post({ type: 'stderr', id: m.id, text: a.map(fmt).join(' ') + '\n' }),
    table: (d: unknown) => post({ type: 'stdout', id: m.id, text: fmt(d) + '\n' }),
  };
  const prompt = (q = '') => {
    const v = lines.shift();
    post({ type: 'stdout', id: m.id, text: `${q}${v ?? ''}\n` });
    return v ?? null;
  };
  try {
    if (m.type === 'run') {
      const fn = new Function('console', 'prompt', `"use strict";\nreturn (async () => {\n${m.code}\n})();`);
      await fn(con, prompt);
      post({ type: 'done', id: m.id, ms: Math.round(performance.now() - t0) });
    } else {
      const results = [];
      for (const t of m.tests) {
        try {
          const fn = new Function('console', `"use strict";\n${m.code}\nreturn typeof ${m.fn} === 'function' ? ${m.fn} : undefined;`);
          const target = fn({ log() {}, info() {}, warn() {}, error() {}, table() {} });
          if (typeof target !== 'function') throw new Error(`Function ${m.fn} was not found`);
          const got = await target(...t.args);
          results.push({ pass: JSON.stringify(got) === JSON.stringify(t.expected), got });
        } catch (err) {
          results.push({ pass: false, error: String((err as Error).message ?? err) });
        }
      }
      post({ type: 'tests', id: m.id, results });
    }
  } catch (err) {
    const stack = String((err as Error)?.stack ?? '');
    const lm = /<anonymous>:(\d+):(\d+)/.exec(stack);
    post({ type: 'error', id: m.id, text: `${(err as Error)?.name ?? 'Error'}: ${(err as Error)?.message ?? err}`, line: lm ? Number(lm[1]) - 3 : undefined });
  }
};
