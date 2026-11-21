import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  CheckCircle2, ChevronDown, Code2, Copy, Download, FilePlus2, FileText, FolderOpen, Keyboard, Loader2, Play, Save, Settings2, Share2, Square, Trash2, Wand2, XCircle,
} from 'lucide-react';
import { Alert, Badge, Button, Dialog, EmptyState, Input, LoadingBlock, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { env } from '@/lib/env';
import { cn, errorMessage } from '@/lib/utils';
import { fromNow } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { usePrefs } from '@/features/preferences/PreferencesProvider';
import { LANGS, monacoLanguageFor, type LabFile, type LangId } from './languages';
import { buildWebDocument, runProgram, runTests, stopAll, type RunEvent, type TestResult } from './runners';
import { setupMonaco } from './monacoSetup';

type OutLine = { kind: 'out' | 'err' | 'info'; text: string } | { kind: 'table'; columns: string[]; rows: unknown[][] };
type Settings = { fontSize: number; wordWrap: boolean; minimap: boolean; tabSize: number };
const SETTINGS_KEY = 'pje:codelab-settings';
const DRAFT_KEY = (id: string) => `pje:codelab-draft:${id}`;

function readSettings(): Settings {
  try {
    return { fontSize: 14, wordWrap: true, minimap: false, tabSize: 4, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { fontSize: 14, wordWrap: true, minimap: false, tabSize: 4 };
  }
}

export type CodeLabProps = {
  initialLang?: LangId; initialFiles?: LabFile[]; readOnlyTitle?: string; tests?: { args: unknown[]; expected: unknown }[]; testFn?: string;
  onTests?: (r: TestResult[]) => void; compact?: boolean; hideProjectBar?: boolean;
};

/** The reusable editor workspace (used by the Code Lab page, lessons and Arena). */
export function CodeWorkspace({ initialLang = 'python', initialFiles, tests, testFn, onTests, compact, hideProjectBar, projectId, title: titleProp, onSave, saving, readOnly }: CodeLabProps & {
  projectId?: string; title?: string; onSave?: (lang: LangId, files: LabFile[], title: string) => void; saving?: boolean; readOnly?: boolean;
}) {
  const { isDark } = usePrefs();
  const toast = useToast();
  const [lang, setLang] = useState<LangId>(initialLang);
  const [files, setFiles] = useState<LabFile[]>(initialFiles ?? LANGS[initialLang].files);
  const [active, setActive] = useState(files[0]?.name ?? LANGS[initialLang].main);
  const [title, setTitle] = useState(titleProp ?? 'Untitled project');
  const [stdin, setStdin] = useState('');
  const [out, setOut] = useState<OutLine[]>([]);
  const [panel, setPanel] = useState<'console' | 'input' | 'preview' | 'tests'>(initialLang === 'web' ? 'preview' : 'console');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [previewDoc, setPreviewDoc] = useState('');
  const [split, setSplit] = useState(58);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const runRef = useRef<() => void>(() => undefined);
  const saveRef = useRef<() => void>(() => undefined);
  const cfg = LANGS[lang];
  const main = files.some((f) => f.name === cfg.main) ? cfg.main : files[0]?.name;

  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } }, [settings]);
  // Autosave drafts locally (works offline).
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY(projectId ?? `new-${lang}`), JSON.stringify({ lang, files, title, at: Date.now() })); } catch { /* quota */ } }, 600);
    return () => clearTimeout(t);
  }, [files, lang, title, projectId]);
  useEffect(() => () => stopAll(), []);

  // Live web preview (debounced).
  useEffect(() => {
    if (lang !== 'web') return;
    const t = setTimeout(() => setPreviewDoc(buildWebDocument(files)), 500);
    return () => clearTimeout(t);
  }, [files, lang]);
  useEffect(() => {
    const onMsg = (e: MessageEvent<{ __pje?: number; type?: string; text?: string }>) => {
      if (!e.data?.__pje) return;
      setOut((o) => [...o.slice(-500), { kind: e.data.type === 'stderr' ? 'err' : 'out', text: (e.data.text ?? '') + '\n' }]);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const setMarker = useCallback((line?: number, message?: string) => {
    const m = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!m || !model) return;
    m.editor.setModelMarkers(model, 'run', line ? [{ startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: model.getLineMaxColumn(Math.min(line, model.getLineCount())), message: message ?? 'Error', severity: m.MarkerSeverity.Error }] : []);
  }, []);

  const run = useCallback(async () => {
    if (running) return;
    if (lang === 'web') { setPreviewDoc(buildWebDocument(files)); setPanel('preview'); return; }
    setOut([]); setRunning(true); setStatus(''); setMarker(); setPanel('console');
    const onEvent = (e: RunEvent) => {
      if (e.type === 'stdout') setOut((o) => [...o, { kind: 'out', text: e.text }]);
      else if (e.type === 'stderr') setOut((o) => [...o, { kind: 'err', text: e.text }]);
      else if (e.type === 'status') setStatus(e.text);
      else if (e.type === 'table') setOut((o) => [...o, { kind: 'table', columns: e.columns, rows: e.rows }]);
      else if (e.type === 'error') {
        setOut((o) => [...o, { kind: 'err', text: e.text + '\n' }]);
        if (e.line && (!e.file || e.file === active)) setMarker(e.line, e.text.split('\n').pop());
      } else if (e.type === 'done') setOut((o) => [...o, { kind: 'info', text: `\n✓ Finished in ${e.ms} ms\n` }]);
    };
    await runProgram(lang, files, main, stdin, onEvent);
    setRunning(false); setStatus('');
  }, [running, lang, files, main, stdin, active, setMarker]);

  const check = useCallback(async () => {
    if (!tests || !testFn) return;
    setRunning(true); setPanel('tests');
    try {
      const r = await runTests(lang, files, main, testFn, tests);
      setTestResults(r);
      onTests?.(r);
    } catch (e) {
      toast.error('Could not run the tests', errorMessage(e));
    } finally {
      setRunning(false);
    }
  }, [tests, testFn, lang, files, main, onTests, toast]);

  runRef.current = () => void run();
  saveRef.current = () => onSave?.(lang, files, title);

  const onMount: OnMount = async (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco as unknown as typeof Monaco;
    const emmet = await import('emmet-monaco-es');
    setupMonaco(monaco as unknown as typeof Monaco, emmet as never);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
    editor.focus();
  };

  const changeLang = (l: LangId) => {
    if (l === lang) return;
    setLang(l); const fs = LANGS[l].files; setFiles(fs); setActive(fs[0].name); setOut([]); setTestResults(null); setPanel(l === 'web' ? 'preview' : 'console');
  };
  const current = files.find((f) => f.name === active) ?? files[0];
  const updateFile = (content: string) => setFiles((fs) => fs.map((f) => (f.name === current.name ? { ...f, content } : f)));
  const addFile = () => {
    const name = prompt(`New file name (e.g. helpers.${cfg.ext})`)?.trim();
    if (!name) return;
    if (!/^[\w.-]{1,60}$/.test(name)) return toast.error('Invalid file name', 'Use letters, numbers, dots, dashes or underscores.');
    if (files.some((f) => f.name === name)) return toast.error('A file with that name already exists');
    setFiles((fs) => [...fs, { name, content: '' }]); setActive(name);
  };
  const renameFile = (name: string) => {
    const next = prompt('Rename file', name)?.trim();
    if (!next || next === name || !/^[\w.-]{1,60}$/.test(next) || files.some((f) => f.name === next)) return;
    setFiles((fs) => fs.map((f) => (f.name === name ? { ...f, name: next } : f))); if (active === name) setActive(next);
  };
  const deleteFile = (name: string) => {
    if (files.length <= 1 || name === cfg.main) return toast.info('The main file cannot be deleted');
    setFiles((fs) => fs.filter((f) => f.name !== name)); if (active === name) setActive(cfg.main);
  };
  const download = () => {
    const payload = lang === 'web' ? buildWebDocument(files) : current.content;
    const name = lang === 'web' ? `${title.replace(/\W+/g, '-') || 'project'}.html` : current.name;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([payload], { type: 'text/plain' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };
  const runnerUrl = env.apiBase ? `${env.apiBase}/lab-runner` : null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (runnerUrl && iframeRef.current?.contentWindow && previewDoc) iframeRef.current.contentWindow.postMessage({ __pjeRender: previewDoc }, '*');
  }, [previewDoc, runnerUrl]);

  const passed = testResults?.filter((t) => t.pass).length ?? 0;
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface', compact ? 'h-[34rem]' : 'h-[calc(100vh-9.5rem)] min-h-[34rem]')}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-ink-50 px-3 py-2">
        {!hideProjectBar && <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Project title" className="h-9 w-44 sm:w-56" readOnly={readOnly} />}
        <Select value={lang} onChange={(e) => changeLang(e.target.value as LangId)} aria-label="Language" className="h-9 w-40" disabled={Boolean(tests) || readOnly}>
          {Object.values(LANGS).map((l) => <option key={l.id} value={l.id}>{l.name}{l.runtime === 'server' ? ' (server)' : ''}</option>)}
        </Select>
        <div className="flex-1" />
        {status && <span className="hidden items-center gap-1 text-xs text-ink-500 sm:inline-flex"><Loader2 className="h-3.5 w-3.5 animate-spin" />{status}</span>}
        {running
          ? <Button size="sm" variant="danger" leftIcon={<Square className="h-4 w-4" />} onClick={() => { stopAll(); setRunning(false); setOut((o) => [...o, { kind: 'info', text: '\n■ Stopped\n' }]); }}>Stop</Button>
          : <Button size="sm" variant="success" leftIcon={<Play className="h-4 w-4" />} onClick={() => void run()} title="Run (Ctrl+Enter)">Run</Button>}
        {tests && <Button size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => void check()} disabled={running}>Check my work</Button>}
        <Button size="sm" variant="outline" leftIcon={<Wand2 className="h-4 w-4" />} onClick={() => editorRef.current?.getAction('editor.action.formatDocument')?.run()} title="Format (Shift+Alt+F)"><span className="hidden md:inline">Format</span></Button>
        {onSave && !readOnly && <Button size="sm" variant="outline" leftIcon={<Save className="h-4 w-4" />} loading={saving} onClick={() => onSave(lang, files, title)} title="Save (Ctrl+S)"><span className="hidden md:inline">Save</span></Button>}
        <Menu>
          <MenuTrigger className="inline-flex h-8 items-center gap-1 rounded-xl border border-ink-200 bg-surface px-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50" aria-label="More options"><Settings2 className="h-4 w-4" /><ChevronDown className="h-3.5 w-3.5" /></MenuTrigger>
          <MenuContent>
            <MenuLabel>Editor</MenuLabel>
            <MenuItem onSelect={() => setSettings((s) => ({ ...s, fontSize: Math.min(24, s.fontSize + 1) }))}>Increase font size ({settings.fontSize})</MenuItem>
            <MenuItem onSelect={() => setSettings((s) => ({ ...s, fontSize: Math.max(11, s.fontSize - 1) }))}>Decrease font size</MenuItem>
            <MenuItem onSelect={() => setSettings((s) => ({ ...s, wordWrap: !s.wordWrap }))}>{settings.wordWrap ? '✓ ' : ''}Word wrap</MenuItem>
            <MenuItem onSelect={() => setSettings((s) => ({ ...s, minimap: !s.minimap }))}>{settings.minimap ? '✓ ' : ''}Minimap</MenuItem>
            <MenuItem onSelect={() => setSettings((s) => ({ ...s, tabSize: s.tabSize === 4 ? 2 : 4 }))}>Tab size: {settings.tabSize}</MenuItem>
            <MenuItem icon={<Keyboard className="h-4 w-4" />} onSelect={() => { editorRef.current?.focus(); editorRef.current?.trigger('menu', 'editor.action.quickCommand', null); }}>Command palette (F1)</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Download className="h-4 w-4" />} onSelect={download}>Download</MenuItem>
            <MenuItem icon={<Copy className="h-4 w-4" />} onSelect={() => { void navigator.clipboard?.writeText(current.content); toast.success('Code copied'); }}>Copy code</MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* File explorer */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-200 bg-ink-50/60 p-1.5 md:w-44 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="hidden items-center justify-between px-1.5 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink-400 md:flex"><span className="inline-flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" />Files</span>
            {!readOnly && lang !== 'sql' && <button onClick={addFile} className="rounded p-0.5 hover:bg-ink-200" aria-label="New file"><FilePlus2 className="h-3.5 w-3.5" /></button>}</div>
          {files.map((f) => (
            <div key={f.name} className={cn('group flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium', f.name === current.name ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100')}>
              <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => setActive(f.name)} onDoubleClick={() => !readOnly && renameFile(f.name)} title="Double-click to rename">
                <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{f.name}</span>
              </button>
              {!readOnly && files.length > 1 && f.name !== cfg.main && <button className="hidden text-ink-400 hover:text-red-600 group-hover:block" onClick={() => deleteFile(f.name)} aria-label={`Delete ${f.name}`}><Trash2 className="h-3 w-3" /></button>}
            </div>
          ))}
          {!readOnly && lang !== 'sql' && <button onClick={addFile} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 md:hidden">+ File</button>}
        </div>

        {/* Editor + output split */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-[14rem] min-w-0 flex-1" style={{ flexBasis: `${split}%` }}>
            <Editor
              key={`${lang}:${current.name}`}
              height="100%"
              path={`${lang}/${current.name}`}
              language={monacoLanguageFor(current.name)}
              value={current.content}
              theme={isDark ? 'profjero-dark' : 'profjero-light'}
              onChange={(v) => !readOnly && updateFile(v ?? '')}
              onMount={onMount}
              loading={<div className="flex h-full items-center justify-center gap-2 text-sm text-ink-500"><Loader2 className="h-4 w-4 animate-spin" />Loading the code editor…</div>}
              options={{
                fontSize: settings.fontSize, wordWrap: settings.wordWrap ? 'on' : 'off', minimap: { enabled: settings.minimap }, tabSize: settings.tabSize, readOnly,
                automaticLayout: true, scrollBeyondLastLine: false, fontLigatures: true, bracketPairColorization: { enabled: true }, guides: { bracketPairs: true, indentation: true },
                quickSuggestions: { other: true, comments: false, strings: true }, suggestOnTriggerCharacters: true, tabCompletion: 'on', snippetSuggestions: 'top',
                formatOnPaste: true, smoothScrolling: true, cursorBlinking: 'smooth', renderLineHighlight: 'all', stickyScroll: { enabled: true }, padding: { top: 10 },
                fontFamily: "'Cascadia Code', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              }}
            />
          </div>
          <div role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize panels" className="hidden w-1.5 cursor-col-resize bg-ink-100 hover:bg-brand-200 lg:block"
            onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit((s) => Math.max(30, s - 4)); if (e.key === 'ArrowRight') setSplit((s) => Math.min(80, s + 4)); }}
            onPointerDown={(e) => {
              const parent = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              const move = (ev: PointerEvent) => setSplit(Math.min(80, Math.max(30, ((ev.clientX - parent.left) / parent.width) * 100)));
              const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
              window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
            }} />
          {/* Output */}
          <div className="flex min-h-[12rem] min-w-0 flex-col border-t border-ink-200 lg:border-l lg:border-t-0" style={{ flexBasis: `${100 - split}%` }}>
            <div className="flex items-center gap-1 border-b border-ink-200 bg-ink-50 px-2" role="tablist">
              {([...(lang === 'web' ? ['preview', 'console'] : ['console', 'input']), ...(tests ? ['tests'] : [])] as ('console' | 'input' | 'preview' | 'tests')[]).map((p) => (
                <button key={p} role="tab" aria-selected={panel === p} onClick={() => setPanel(p)} className={cn('px-3 py-2 text-xs font-bold uppercase tracking-wide', panel === p ? 'border-b-2 border-brand-600 text-brand-700' : 'text-ink-500')}>
                  {p === 'tests' && testResults ? `Tests ${passed}/${testResults.length}` : p}
                </button>
              ))}
              <div className="flex-1" />
              {panel === 'console' && <button className="px-2 text-xs font-semibold text-ink-500 hover:text-ink-800" onClick={() => setOut([])}>Clear</button>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {panel === 'console' && (
                <pre className="min-h-full whitespace-pre-wrap break-words bg-ink-950 p-3 font-mono text-[0.82rem] leading-relaxed text-ink-100 dark:bg-black/40" aria-live="polite">
                  {out.length === 0 && <span className="text-ink-400">{cfg.runtime === 'server' ? 'Output from the server runner appears here. ' : ''}Press Run (Ctrl+Enter) to execute your code.</span>}
                  {out.map((l, i) => l.kind === 'table'
                    ? <div key={i} className="my-2 overflow-x-auto rounded border border-white/10"><table className="text-xs"><thead><tr>{l.columns.map((c) => <th key={c} className="border-b border-white/10 px-2 py-1 text-left text-growth-500">{c}</th>)}</tr></thead><tbody>{l.rows.map((r, j) => <tr key={j}>{r.map((v, k) => <td key={k} className="px-2 py-0.5">{String(v ?? 'NULL')}</td>)}</tr>)}</tbody></table></div>
                    : <span key={i} className={l.kind === 'err' ? 'text-red-300' : l.kind === 'info' ? 'text-growth-500' : ''}>{l.text}</span>)}
                </pre>
              )}
              {panel === 'input' && (
                <div className="p-3">
                  <label htmlFor="stdin" className="text-xs font-semibold text-ink-600">Program input — one line per <code>input()</code> call</label>
                  <textarea id="stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} rows={8} className="mt-1 w-full rounded-lg border border-ink-200 bg-surface p-2 font-mono text-sm text-ink-900" placeholder={'Kwame\n17'} />
                </div>
              )}
              {panel === 'preview' && (
                runnerUrl
                  ? <iframe ref={iframeRef} title="Web preview" src={runnerUrl} className="h-full min-h-[14rem] w-full bg-white" sandbox="allow-scripts allow-modals allow-forms" onLoad={() => iframeRef.current?.contentWindow?.postMessage({ __pjeRender: previewDoc || buildWebDocument(files) }, '*')} />
                  : <iframe title="Web preview" srcDoc={previewDoc} className="h-full min-h-[14rem] w-full bg-white" sandbox="allow-scripts allow-modals allow-forms" />
              )}
              {panel === 'tests' && (
                <div className="space-y-2 p-3">
                  {!testResults ? <p className="text-sm text-ink-500">Press “Check my work” to run the tests.</p> : testResults.map((t, i) => (
                    <div key={i} className={cn('rounded-lg border p-2.5 text-sm', t.pass ? 'border-growth-500/40 bg-growth-50' : 'border-red-200 bg-red-50')}>
                      <p className="flex items-center gap-2 font-semibold">{t.pass ? <CheckCircle2 className="h-4 w-4 text-growth-600" /> : <XCircle className="h-4 w-4 text-red-600" />}Test {i + 1}: {testFn}({tests![i].args.map((a) => JSON.stringify(a)).join(', ')})</p>
                      <p className="ml-6 text-xs text-ink-600">Expected <code>{JSON.stringify(tests![i].expected)}</code>{!t.pass && <> · got <code>{t.error ?? JSON.stringify(t.got)}</code></>}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-ink-200 bg-ink-50 px-3 py-1 text-[0.7rem] text-ink-500">
        <span>{cfg.name}</span><span>·</span><span>{cfg.runtime === 'browser' ? 'Runs in your browser' : 'Runs on the server'}</span>
        <span className="hidden sm:inline">· Ctrl+Enter run · Ctrl+S save · Shift+Alt+F format · F1 commands · Tab expands Emmet & snippets</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
type ProjectRow = { id: string; title: string; language: LangId; files: LabFile[]; is_public: boolean; share_slug: string; updated_at: string; owner_id: string };

export function CodeLabPage() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const project = useQuery({
    queryKey: ['lab-project', projectId], enabled: Boolean(projectId),
    queryFn: async () => unwrap(await supabase.from('lab_projects').select('*').eq('id', projectId!).maybeSingle()) as unknown as ProjectRow | null,
  });
  const projects = useQuery({
    queryKey: ['lab-projects', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('lab_projects').select('id, title, language, updated_at').eq('owner_id', user!.id).order('updated_at', { ascending: false }).limit(50)) as unknown as Pick<ProjectRow, 'id' | 'title' | 'language' | 'updated_at'>[],
  });
  // Prefill from a lesson lab block or Arena (?lang=python&from=session)
  const prefill = useMemo(() => {
    const lang = (params.get('lang') ?? 'python') as LangId;
    try {
      const raw = sessionStorage.getItem('pje:lab-prefill');
      if (raw && params.get('from') === 'lesson') { const p = JSON.parse(raw) as { lang: LangId; code: string }; return { lang: p.lang, files: [{ name: LANGS[p.lang].main, content: p.code }] }; }
    } catch { /* ignore */ }
    return { lang: LANGS[lang] ? lang : 'python', files: undefined as LabFile[] | undefined };
  }, [params]);

  const save = async (lang: LangId, files: LabFile[], title: string) => {
    if (!user) return toast.info('Sign in to save projects');
    setSaving(true);
    const res = projectId && project.data?.owner_id === user.id
      ? await supabase.from('lab_projects').update({ title, language: lang, files: files as never }).eq('id', projectId).select('id').single()
      : await supabase.from('lab_projects').insert({ owner_id: user.id, title, language: lang, files: files as never }).select('id').single();
    setSaving(false);
    if (res.error) return toast.error('Not saved', res.error.message);
    toast.success('Project saved');
    void qc.invalidateQueries({ queryKey: ['lab-projects'] });
    if (!projectId) nav(`/lab/code/${res.data.id}`, { replace: true });
  };

  if (projectId && project.isLoading) return <LoadingBlock />;
  if (projectId && !project.data) return <EmptyState icon={<Code2 className="h-7 w-7" />} title="Project not found" />;
  const p = project.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">EduLab</p><h1 className="text-2xl font-extrabold">Code Lab</h1></div>
        <div className="flex flex-wrap gap-2">
          {p && <Button variant="outline" size="sm" leftIcon={<Share2 className="h-4 w-4" />} onClick={() => setShareOpen(true)}>Share</Button>}
          <Menu>
            <MenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-ink-200 bg-surface px-3 text-sm font-semibold text-ink-700"><FolderOpen className="h-4 w-4" />My projects</MenuTrigger>
            <MenuContent className="max-h-80 w-72 overflow-y-auto">
              <MenuItem onSelect={() => nav('/lab/code')} icon={<FilePlus2 className="h-4 w-4" />}>New project</MenuItem>
              <MenuSeparator />
              {(projects.data ?? []).map((x) => <MenuItem key={x.id} onSelect={() => nav(`/lab/code/${x.id}`)}><span className="flex-1 truncate">{x.title}</span><span className="text-xs text-ink-400">{LANGS[x.language]?.name} · {fromNow(x.updated_at)}</span></MenuItem>)}
              {!projects.data?.length && <p className="px-3 py-2 text-sm text-ink-500">No saved projects yet.</p>}
            </MenuContent>
          </Menu>
        </div>
      </div>
      <CodeWorkspace key={projectId ?? `new-${prefill.lang}`} projectId={projectId} initialLang={p?.language ?? prefill.lang} initialFiles={p?.files ?? prefill.files} title={p?.title} onSave={save} saving={saving} />
      {p && <ShareDialog open={shareOpen} onOpenChange={setShareOpen} project={p} onChange={() => void project.refetch()} />}
    </div>
  );
}

function ShareDialog({ open, onOpenChange, project, onChange }: { open: boolean; onOpenChange: (o: boolean) => void; project: ProjectRow; onChange: () => void }) {
  const toast = useToast();
  const url = `${location.origin}/lab/share/${project.share_slug}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share project" description="Anyone with the link can view and run a copy. They cannot change your project.">
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={project.is_public}
          onChange={async (e) => { const { error } = await supabase.from('lab_projects').update({ is_public: e.target.checked }).eq('id', project.id); if (error) toast.error('Failed', error.message); else onChange(); }} />Share with a link</label>
        {project.is_public && <div className="flex gap-2"><Input readOnly value={url} aria-label="Share link" /><Button onClick={() => { void navigator.clipboard?.writeText(url); toast.success('Link copied'); }}>Copy</Button></div>}
      </div>
    </Dialog>
  );
}

export function SharedProjectPage() {
  const { slug } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['shared-project', slug], queryFn: async () => unwrap(await supabase.from('lab_projects').select('*').eq('share_slug', slug!).eq('is_public', true).maybeSingle()) as unknown as ProjectRow | null });
  if (isLoading) return <div className="container-page py-10"><LoadingBlock /></div>;
  if (!data) return <div className="container-page py-16"><EmptyState title="This project is not shared" /></div>;
  return (
    <div className="container-page space-y-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><Badge tone="brand">Shared from Code Lab</Badge><h1 className="mt-2 text-2xl font-extrabold">{data.title}</h1></div><Link to="/lab/code" className="text-sm font-semibold text-brand-700">Open your own Code Lab →</Link></div>
      <Alert tone="info">You are viewing a shared copy. Run it freely — changes are not saved to the original.</Alert>
      <CodeWorkspace initialLang={data.language} initialFiles={data.files} title={data.title} hideProjectBar />
    </div>
  );
}
