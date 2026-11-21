import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, CheckCircle2, Copy, Eye, History, Loader2, Pencil, Plus, Save, Trash2, X, AlertCircle,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, StatusBadge, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDateTime, fromNow } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { MediaPicker } from '@/features/media/MediaPicker';
import { LAB_TOOLS } from '@/features/lab/catalog';
import { BlockRenderer } from './BlockRenderer';
import { BLOCK_TYPES, blockMeta, EMBED_HOSTS, newBlock, validateBlocks, type BlockType, type LessonBlock } from './blocks';

type LessonRow = { id: string; course_id: string; module_id: string; title: string; summary: string | null; status: string; completion_rule: string; quiz_assessment_id: string | null; assignment_id: string | null; is_preview: boolean; estimated_minutes: number | null; updated_at: string };

export function LessonEditor() {
  const { courseId, lessonId } = useParams();
  const toast = useToast();
  const qc = useQueryClient();
  const lessonQ = useQuery({ queryKey: ['lesson-edit', lessonId], queryFn: async () => unwrap(await supabase.from('lessons').select('*').eq('id', lessonId!).maybeSingle()) as LessonRow | null });
  const blocksQ = useQuery({ queryKey: ['lesson-edit-blocks', lessonId], queryFn: async () => unwrap(await supabase.from('lesson_blocks').select('id, type, content').eq('lesson_id', lessonId!).order('position')) as LessonBlock[] });
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [invalid, setInvalid] = useState<{ index: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (lessonQ.data && blocksQ.data && !loaded) {
      setTitle(lessonQ.data.title);
      setSummary(lessonQ.data.summary ?? '');
      setBlocks(blocksQ.data.map((b) => ({ ...b, content: b.content as Record<string, unknown> })));
      setLoaded(true);
    }
  }, [lessonQ.data, blocksQ.data, loaded]);

  const save = useCallback(async (note?: string) => {
    const v = validateBlocks(blocks);
    if (!v.ok) {
      setInvalid({ index: v.index, message: v.message });
      setSaveState('error');
      return false;
    }
    setInvalid(null);
    setSaveState('saving');
    const { error } = await supabase.rpc('save_lesson_content', { p_lesson: lessonId!, p_title: title, p_summary: summary || null as never, p_blocks: blocks as never, p_revision_note: (note ?? null) as never });
    if (error) {
      setSaveState('error');
      toast.error('Autosave failed', errorMessage(error));
      return false;
    }
    setSaveState('saved');
    setDirty(false);
    setSavedAt(new Date().toISOString());
    if (note) void qc.invalidateQueries({ queryKey: ['lesson-revisions', lessonId] });
    void qc.invalidateQueries({ queryKey: ['course-outline', courseId] });
    return true;
  }, [blocks, title, summary, lessonId, courseId, qc, toast]);

  // Autosave 1.5s after the last edit.
  useEffect(() => {
    if (!loaded || !dirty) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1500);
    return () => clearTimeout(timer.current);
  }, [blocks, title, summary, loaded, dirty, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const mutate = (fn: (b: LessonBlock[]) => LessonBlock[]) => { setBlocks(fn); setDirty(true); };
  const update = (i: number, content: Record<string, unknown>) => mutate((b) => b.map((x, j) => (j === i ? { ...x, content } : x)));
  const insert = (i: number, type: BlockType) => mutate((b) => [...b.slice(0, i), newBlock(type), ...b.slice(i)]);
  const move = (i: number, d: -1 | 1) => mutate((b) => { const n = [...b]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  if (lessonQ.isLoading || blocksQ.isLoading) return <LoadingBlock rows={5} />;
  const lesson = lessonQ.data;
  if (!lesson) return <EmptyState title="Lesson not found" />;

  return (
    <div className="space-y-6">
      <PageHeader back={{ to: `/teach/courses/${courseId}?tab=curriculum`, label: 'Curriculum' }} eyebrow={<span className="inline-flex items-center gap-2">Lesson editor <StatusBadge status={lesson.status} /></span>} title={title || 'Untitled lesson'}
        actions={<>
          <SaveIndicator state={saveState} savedAt={savedAt} dirty={dirty} />
          <Button variant="outline" leftIcon={<History className="h-4 w-4" />} onClick={() => setShowHistory(true)}>History</Button>
          <Button variant="outline" leftIcon={preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</Button>
          <Button leftIcon={<Save className="h-4 w-4" />} onClick={async () => { if (await save('Manual save')) toast.success('Version saved'); }}>Save version</Button>
        </>} />
      {invalid && <Alert tone="error" title={`Block ${invalid.index + 1} needs attention`}>{invalid.message}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          {preview ? (
            <Card><CardBody className="mx-auto max-w-3xl py-8">
              <h1 className="text-3xl font-extrabold">{title}</h1>
              {summary && <p className="mt-2 text-lg text-ink-500">{summary}</p>}
              <div className="mt-8"><BlockRenderer blocks={blocks} /></div>
            </CardBody></Card>
          ) : (
            <>
              <Card><CardBody className="space-y-4">
                <Field label="Lesson title"><Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} maxLength={160} /></Field>
                <Field label="Summary" hint="One sentence shown under the title"><Input value={summary} onChange={(e) => { setSummary(e.target.value); setDirty(true); }} maxLength={300} /></Field>
              </CardBody></Card>
              <AddBlockBar onAdd={(t) => insert(0, t)} compact={blocks.length > 0} />
              {blocks.map((b, i) => (
                <div key={b.id}>
                  <Card className={cn(invalid?.index === i && 'ring-2 ring-red-300')}>
                    <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2">
                      <Badge tone="brand">{blockMeta[b.type].label}</Badge>
                      <span className="flex-1" />
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move block up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move block down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Duplicate block" onClick={() => mutate((bb) => [...bb.slice(0, i + 1), { ...b, id: crypto.randomUUID(), content: structuredClone(b.content) }, ...bb.slice(i + 1)])}><Copy className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" aria-label="Delete block" onClick={() => mutate((bb) => bb.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <CardBody><BlockEditor block={b} courseId={lesson.course_id} onChange={(c) => update(i, c)} /></CardBody>
                  </Card>
                  <AddBlockBar onAdd={(t) => insert(i + 1, t)} compact />
                </div>
              ))}
            </>
          )}
        </div>
        <LessonSettings lesson={lesson} onSaveFirst={(note) => save(note)} />
      </div>
      <RevisionsDialog open={showHistory} onOpenChange={setShowHistory} lessonId={lesson.id} onRestored={() => { setLoaded(false); void blocksQ.refetch(); void lessonQ.refetch(); }} />
    </div>
  );
}

function SaveIndicator({ state, savedAt, dirty }: { state: string; savedAt: string | null; dirty: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 self-center text-xs font-medium text-ink-500" aria-live="polite">
      {state === 'saving' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
        : state === 'error' ? <span className="text-red-600"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />Not saved</span>
        : dirty ? 'Unsaved changes'
        : savedAt ? <><CheckCircle2 className="h-3.5 w-3.5 text-growth-600" />Saved {fromNow(savedAt)}</> : 'All changes saved'}
    </span>
  );
}

function AddBlockBar({ onAdd, compact }: { onAdd: (t: BlockType) => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  if (!open) return (
    <div className="group flex justify-center py-1">
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 bg-surface px-3 py-1 text-xs font-semibold text-ink-500 opacity-70 hover:border-brand-400 hover:text-brand-700 group-hover:opacity-100"><Plus className="h-3.5 w-3.5" />Add block</button>
    </div>
  );
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-3">
      <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Add a block</p>{compact && <button onClick={() => setOpen(false)} aria-label="Close" className="text-ink-400"><X className="h-4 w-4" /></button>}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {BLOCK_TYPES.map((t) => (
          <button key={t} onClick={() => { onAdd(t); if (compact) setOpen(false); }} className="rounded-xl border border-ink-200 bg-surface px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50">
            <span className="block text-sm font-semibold text-ink-800">{blockMeta[t].label}</span>
            <span className="block text-[0.7rem] text-ink-500">{blockMeta[t].hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockEditor({ block, courseId, onChange }: { block: LessonBlock; courseId: string; onChange: (c: Record<string, unknown>) => void }) {
  const c = block.content;
  const set = (k: string, v: unknown) => onChange({ ...c, [k]: v });
  const s = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : '');

  switch (block.type) {
    case 'heading':
      return <div className="grid gap-3 sm:grid-cols-[1fr_8rem]"><Input aria-label="Heading text" value={s('text')} onChange={(e) => set('text', e.target.value)} placeholder="Section heading" /><Select aria-label="Heading level" value={String(c.level ?? 2)} onChange={(e) => set('level', Number(e.target.value))}><option value="2">Large</option><option value="3">Small</option></Select></div>;
    case 'paragraph':
      return <div><Textarea aria-label="Text" rows={6} value={s('text')} onChange={(e) => set('text', e.target.value)} placeholder="Write your explanation…" /><p className="mt-1 text-xs text-ink-400">Tip: leave a blank line for a new paragraph. Use **bold** and `code`.</p></div>;
    case 'image':
      return <div className="space-y-3"><MediaPicker kind="image" courseId={courseId} value={s('url')} onChange={(u) => set('url', u)} /><Field label="Alt text" hint="Describe the image for learners using screen readers"><Input value={s('alt')} onChange={(e) => set('alt', e.target.value)} /></Field><Input aria-label="Caption" value={s('caption')} onChange={(e) => set('caption', e.target.value)} placeholder="Caption (optional)" /></div>;
    case 'video':
    case 'audio':
      return <div className="space-y-3"><MediaPicker kind={block.type === 'video' ? 'video' : 'audio'} allowLink={block.type === 'video'} courseId={courseId} value={s('url')} onChange={(u) => set('url', u)} /><Input aria-label="Caption" value={s('caption')} onChange={(e) => set('caption', e.target.value)} placeholder="Caption (optional)" /><Field label="Transcript" hint="Recommended for accessibility and low-bandwidth learners"><Textarea rows={3} value={s('transcript')} onChange={(e) => set('transcript', e.target.value)} /></Field></div>;
    case 'code':
      return <div className="space-y-3"><Select aria-label="Language" value={s('language') || 'python'} onChange={(e) => set('language', e.target.value)} className="w-48">{['python', 'javascript', 'html', 'css', 'sql', 'java', 'c', 'cpp', 'bash', 'text'].map((l) => <option key={l}>{l}</option>)}</Select><Textarea aria-label="Code" rows={8} value={s('code')} onChange={(e) => set('code', e.target.value)} className="font-mono text-sm" spellCheck={false} /><Field label="Expected output (optional)"><Textarea rows={2} value={s('output')} onChange={(e) => set('output', e.target.value)} className="font-mono text-sm" /></Field></div>;
    case 'callout':
      return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-[10rem_1fr]"><Select aria-label="Tone" value={s('tone') || 'info'} onChange={(e) => set('tone', e.target.value)}><option value="info">Note</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="important">Key point</option></Select><Input aria-label="Title" value={s('title')} onChange={(e) => set('title', e.target.value)} placeholder="Title (optional)" /></div><Textarea aria-label="Callout text" rows={3} value={s('text')} onChange={(e) => set('text', e.target.value)} /></div>;
    case 'activity':
      return <div className="space-y-3"><Input aria-label="Activity title" value={s('title')} onChange={(e) => set('title', e.target.value)} /><Textarea aria-label="Instructions" rows={5} value={s('instructions')} onChange={(e) => set('instructions', e.target.value)} placeholder="What should learners do?" /><Field label="Expected result (hidden until learner opens it)"><Textarea rows={2} value={s('expected')} onChange={(e) => set('expected', e.target.value)} /></Field></div>;
    case 'quiz': {
      const opts = (c.options as string[]) ?? ['', ''];
      return (
        <div className="space-y-3">
          <Input aria-label="Question" value={s('question')} onChange={(e) => set('question', e.target.value)} placeholder="Practice question" />
          <fieldset className="space-y-2"><legend className="text-xs font-semibold text-ink-500">Options — select the correct one</legend>
            {opts.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name={`ans-${block.id}`} checked={Number(c.answer ?? 0) === i} onChange={() => set('answer', i)} aria-label={`Option ${i + 1} is correct`} className="h-4 w-4 accent-growth-600" />
                <Input aria-label={`Option ${i + 1}`} value={o} onChange={(e) => set('options', opts.map((x, j) => (j === i ? e.target.value : x)))} />
                <Button size="icon" variant="ghost" aria-label="Remove option" disabled={opts.length <= 2} onClick={() => onChange({ ...c, options: opts.filter((_, j) => j !== i), answer: 0 })}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            {opts.length < 8 && <Button size="sm" variant="ghost" onClick={() => set('options', [...opts, ''])}>Add option</Button>}
          </fieldset>
          <Input aria-label="Explanation" value={s('explanation')} onChange={(e) => set('explanation', e.target.value)} placeholder="Explanation shown after answering" />
          <p className="text-xs text-ink-400">Knowledge checks are ungraded practice. For graded quizzes, link an assessment in lesson settings.</p>
        </div>
      );
    }
    case 'resource':
    case 'link':
      return <div className="space-y-3"><Input aria-label="Title" value={s('title')} onChange={(e) => set('title', e.target.value)} placeholder="Title" />
        {block.type === 'resource'
          ? <MediaPicker kind="any" courseId={courseId} value={s('url')} onChange={(u) => set('url', u)} label="Choose a file (PDF, slides, worksheet…)" onUploaded={(_r, f) => { if (!s('title')) onChange({ ...c, url: _r.secure_url, title: f.name }); }} />
          : <Input aria-label="URL" value={s('url')} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />}
        <Input aria-label="Description" value={s('description')} onChange={(e) => set('description', e.target.value)} placeholder="Short description (optional)" /></div>;
    case 'lab':
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select aria-label="Lab" value={s('lab') || 'code'} onChange={(e) => onChange({ ...c, lab: e.target.value, tool: LAB_TOOLS.filter((t) => t.lab === e.target.value)[0]?.id })}>
              <option value="code">Code Lab</option><option value="science">Science Lab</option><option value="math">Math Lab</option>
            </Select>
            <Select aria-label="Tool" value={s('tool')} onChange={(e) => set('tool', e.target.value)}>
              {LAB_TOOLS.filter((t) => t.lab === (s('lab') || 'code')).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <Input aria-label="Title" value={s('title')} onChange={(e) => set('title', e.target.value)} />
          <Textarea aria-label="Instructions" rows={3} value={s('instructions')} onChange={(e) => set('instructions', e.target.value)} placeholder="What should learners do in the lab?" />
          {(s('lab') || 'code') === 'code' && <Field label="Starter code (optional)"><Textarea rows={6} value={s('starter')} onChange={(e) => set('starter', e.target.value)} className="font-mono text-sm" spellCheck={false} /></Field>}
        </div>
      );
    case 'table': {
      const headers = (c.headers as string[]) ?? [];
      const rows = (c.rows as string[][]) ?? [];
      return (
        <div className="space-y-3">
          <Input aria-label="Caption" value={s('caption')} onChange={(e) => set('caption', e.target.value)} placeholder="Caption (optional)" />
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{headers.map((h, i) => <th key={i} className="p-1"><Input aria-label={`Header ${i + 1}`} value={h} onChange={(e) => set('headers', headers.map((x, j) => (j === i ? e.target.value : x)))} className="h-9 font-semibold" /></th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{headers.map((_, ci) => <td key={ci} className="p-1"><Input aria-label={`Row ${ri + 1} column ${ci + 1}`} value={r[ci] ?? ''} onChange={(e) => set('rows', rows.map((rr, j) => (j === ri ? headers.map((__, k) => (k === ci ? e.target.value : rr[k] ?? '')) : rr)))} className="h-9" /></td>)}<td><Button size="icon" variant="ghost" aria-label="Remove row" onClick={() => set('rows', rows.filter((_, j) => j !== ri))}><X className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => set('rows', [...rows, headers.map(() => '')])}>Add row</Button>{headers.length < 10 && <Button size="sm" variant="ghost" onClick={() => onChange({ ...c, headers: [...headers, `Column ${headers.length + 1}`], rows: rows.map((r) => [...r, '']) })}>Add column</Button>}{headers.length > 1 && <Button size="sm" variant="ghost" onClick={() => onChange({ ...c, headers: headers.slice(0, -1), rows: rows.map((r) => r.slice(0, -1)) })}>Remove column</Button>}</div>
        </div>
      );
    }
    case 'steps': {
      const steps = (c.steps as string[]) ?? [''];
      return (
        <div className="space-y-2">
          <Input aria-label="Title" value={s('title')} onChange={(e) => set('title', e.target.value)} placeholder="Title (optional)" />
          {steps.map((st, i) => <div key={i} className="flex items-start gap-2"><span className="mt-2.5 w-6 text-center text-sm font-bold text-brand-600">{i + 1}</span><Textarea aria-label={`Step ${i + 1}`} rows={2} value={st} onChange={(e) => set('steps', steps.map((x, j) => (j === i ? e.target.value : x)))} /><Button size="icon" variant="ghost" aria-label="Remove step" disabled={steps.length === 1} onClick={() => set('steps', steps.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button></div>)}
          <Button size="sm" variant="ghost" onClick={() => set('steps', [...steps, ''])}>Add step</Button>
        </div>
      );
    }
    case 'embed':
      return <div className="space-y-3"><Input aria-label="Embed URL" value={s('url')} onChange={(e) => set('url', e.target.value)} placeholder="https://phet.colorado.edu/…" /><div className="grid gap-3 sm:grid-cols-[1fr_8rem]"><Input aria-label="Title" value={s('title')} onChange={(e) => set('title', e.target.value)} placeholder="Title" /><Input aria-label="Height in pixels" type="number" min={200} max={1200} value={Number(c.height ?? 480)} onChange={(e) => set('height', Number(e.target.value))} /></div><p className="text-xs text-ink-400">Allowed providers: {EMBED_HOSTS.join(', ')}</p></div>;
    case 'divider':
      return <hr className="border-ink-200" />;
    default:
      return null;
  }
}

function LessonSettings({ lesson, onSaveFirst }: { lesson: LessonRow; onSaveFirst: (note?: string) => Promise<boolean> }) {
  const qc = useQueryClient();
  const toast = useToast();
  const assessments = useQuery({ queryKey: ['course-assessments', lesson.course_id], queryFn: async () => unwrap(await supabase.from('assessments').select('id, title, status').eq('course_id', lesson.course_id)) });
  const assignments = useQuery({ queryKey: ['course-assignments', lesson.course_id], queryFn: async () => unwrap(await supabase.from('assignments').select('id, title, status').eq('course_id', lesson.course_id)) });
  const patch = async (p: Partial<LessonRow>, ok?: string) => {
    const { error } = await supabase.from('lessons').update(p as never).eq('id', lesson.id);
    if (error) toast.error('Could not update', error.message);
    else { if (ok) toast.success(ok); void qc.invalidateQueries({ queryKey: ['lesson-edit', lesson.id] }); void qc.invalidateQueries({ queryKey: ['course-outline', lesson.course_id] }); }
  };
  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader title="Publishing" />
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-600">Status: <StatusBadge status={lesson.status} /></p>
          {lesson.status !== 'published' ? (
            <Button className="w-full" variant="success" onClick={async () => { if (await onSaveFirst('Published')) await patch({ status: 'published' }, 'Lesson published'); }}>Publish lesson</Button>
          ) : <Button className="w-full" variant="outline" onClick={() => patch({ status: 'unpublished' }, 'Lesson unpublished')}>Unpublish</Button>}
          {lesson.status === 'draft' && <Button className="w-full" variant="ghost" onClick={() => patch({ status: 'in_review' }, 'Marked for review')}>Mark ready for review</Button>}
          <p className="text-xs text-ink-500">Learners see published lessons once the course itself is published.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Lesson settings" />
        <CardBody className="space-y-4">
          <Field label="Estimated minutes"><Input type="number" min={1} max={600} defaultValue={lesson.estimated_minutes ?? ''} onBlur={(e) => patch({ estimated_minutes: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Checkbox label="Free preview" description="Visitors can view this lesson without enrolling" checked={lesson.is_preview} onChange={(e) => patch({ is_preview: e.target.checked })} />
          <Field label="Completion rule">
            <Select value={lesson.completion_rule} onChange={(e) => patch({ completion_rule: e.target.value })}>
              <option value="mark_complete">Learner marks complete after studying</option>
              <option value="quiz_pass">Learner passes a quiz</option>
              <option value="assignment_submit">Learner submits an assignment</option>
            </Select>
          </Field>
          {lesson.completion_rule === 'quiz_pass' && (
            <Field label="Linked quiz" hint="Create quizzes under Assessments for this course">
              <Select value={lesson.quiz_assessment_id ?? ''} onChange={(e) => patch({ quiz_assessment_id: e.target.value || null })}><option value="">— choose —</option>{assessments.data?.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.status})</option>)}</Select>
            </Field>
          )}
          {lesson.completion_rule === 'assignment_submit' && (
            <Field label="Linked assignment">
              <Select value={lesson.assignment_id ?? ''} onChange={(e) => patch({ assignment_id: e.target.value || null })}><option value="">— choose —</option>{assignments.data?.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.status})</option>)}</Select>
            </Field>
          )}
        </CardBody>
      </Card>
    </aside>
  );
}

function RevisionsDialog({ open, onOpenChange, lessonId, onRestored }: { open: boolean; onOpenChange: (o: boolean) => void; lessonId: string; onRestored: () => void }) {
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['lesson-revisions', lessonId], enabled: open, queryFn: async () => unwrap(await supabase.from('lesson_revisions').select('id, title, note, created_at').eq('lesson_id', lessonId).order('created_at', { ascending: false })) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Revision history" description="Saved versions and publishes. Restoring creates a new version — nothing is lost.">
      {isLoading ? <LoadingBlock rows={2} /> : data?.length ? (
        <ul className="divide-y divide-ink-100">{data.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1"><p className="font-semibold">{r.note ?? 'Saved version'}</p><p className="text-xs text-ink-500">{fmtDateTime(r.created_at)} · {r.title}</p></div>
            <Button size="sm" variant="outline" onClick={async () => {
              const { error } = await supabase.rpc('restore_lesson_revision', { p_revision: r.id });
              if (error) toast.error('Restore failed', error.message); else { toast.success('Revision restored'); onOpenChange(false); onRestored(); }
            }}>Restore</Button>
          </li>
        ))}</ul>
      ) : <p className="text-sm text-ink-500">No saved versions yet. Use “Save version” or publish to create one.</p>}
    </Dialog>
  );
}
