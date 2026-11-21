/// <reference lib="webworker" />
/* Python runner (Pyodide/WebAssembly). Runs off the main thread; the page
   terminates this worker on timeout or Stop, so infinite loops can't freeze the UI. */
type Msg =
  | { type: 'run'; id: number; files: { name: string; content: string }[]; main: string; stdin: string }
  | { type: 'test'; id: number; files: { name: string; content: string }[]; main: string; fn: string; tests: { args: unknown[]; expected: unknown }[] };

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
type Py = { runPythonAsync: (c: string) => Promise<unknown>; FS: { writeFile: (p: string, d: string) => void; mkdirTree: (p: string) => void }; setStdout: (o: { batched: (s: string) => void }) => void; setStderr: (o: { batched: (s: string) => void }) => void; globals: { set: (k: string, v: unknown) => void } };
let pyodide: Py | null = null;
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

async function ensure() {
  if (pyodide) return pyodide;
  post({ type: 'status', text: 'Loading Python (first time only)…' });
  const mod = (await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`)) as { loadPyodide: (o: { indexURL: string }) => Promise<Py> };
  pyodide = await mod.loadPyodide({ indexURL: PYODIDE });
  post({ type: 'status', text: 'Python ready' });
  return pyodide;
}

function writeFiles(py: Py, files: { name: string; content: string }[]) {
  py.FS.mkdirTree('/home/pyodide/project');
  for (const f of files) py.FS.writeFile(`/home/pyodide/project/${f.name}`, f.content);
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  const t0 = performance.now();
  try {
    const py = await ensure();
    py.setStdout({ batched: (s) => post({ type: 'stdout', id: m.id, text: s }) });
    py.setStderr({ batched: (s) => post({ type: 'stderr', id: m.id, text: s }) });
    writeFiles(py, m.files);
    if (m.type === 'run') {
      py.globals.set('__pje_stdin', m.stdin);
      await py.runPythonAsync(`
import sys, os, builtins, runpy
os.chdir('/home/pyodide/project')
if '/home/pyodide/project' not in sys.path: sys.path.insert(0, '/home/pyodide/project')
for _m in [k for k in list(sys.modules) if getattr(sys.modules[k], '__file__', '') and str(getattr(sys.modules[k], '__file__', '')).startswith('/home/pyodide/project')]:
    del sys.modules[_m]
_lines = __pje_stdin.split('\\n') if __pje_stdin else []
def _input(prompt=''):
    print(prompt, end='')
    if not _lines:
        raise EOFError('No more input. Add input lines in the Input tab before running.')
    v = _lines.pop(0)
    print(v)
    return v
builtins.input = _input
runpy.run_path('${m.main}', run_name='__main__')
`);
      post({ type: 'done', id: m.id, ms: Math.round(performance.now() - t0) });
    } else {
      const results: { pass: boolean; got?: unknown; error?: string }[] = [];
      for (const t of m.tests) {
        py.globals.set('__pje_args', JSON.stringify(t.args));
        try {
          const out = (await py.runPythonAsync(`
import json, runpy, os, sys
os.chdir('/home/pyodide/project')
_ns = runpy.run_path('${m.main}', run_name='__test__')
json.dumps(_ns['${m.fn}'](*json.loads(__pje_args)))
`)) as string;
          const got = JSON.parse(out);
          results.push({ pass: JSON.stringify(got) === JSON.stringify(t.expected), got });
        } catch (err) {
          results.push({ pass: false, error: String((err as Error).message ?? err).split('\n').slice(-3).join('\n') });
        }
      }
      post({ type: 'tests', id: m.id, results });
    }
  } catch (err) {
    const text = String((err as Error)?.message ?? err);
    const line = /File "(?:\/home\/pyodide\/project\/)?([^"]+)", line (\d+)/g;
    let last: RegExpExecArray | null = null; let mm: RegExpExecArray | null;
    while ((mm = line.exec(text))) if (!mm[1].startsWith('<') && !mm[1].includes('/lib/')) last = mm;
    post({ type: 'error', id: m.id, text: cleanTraceback(text), file: last?.[1], line: last ? Number(last[2]) : undefined });
  }
};

function cleanTraceback(t: string) {
  return t.split('\n').filter((l) => !l.includes('/lib/python') && !l.includes('pyodide') && !l.includes('runpy.py') && !l.includes('<exec>')).join('\n').trim();
}
