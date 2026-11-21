import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookMarked, ChevronRight, ExternalLink, FileText, GraduationCap, Library, Search } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState, Input, LoadingBlock, PageHeader, Select, Tabs } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';

const GRADES: Record<string, string[]> = { SHS: ['SHS 1', 'SHS 2', 'SHS 3'], JHS: ['JHS 1', 'JHS 2', 'JHS 3'], Basic: ['KG 1', 'KG 2', 'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6'] };

/** Official MoE / NaCCA teaching and learning materials + the SHS curriculum structure. */
export function CurriculumLibrary() {
  const { workspaces } = useAuth();
  const isTeacher = workspaces.some((w) => w.kind !== 'learner');
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Official resources" title="Curriculum Library" description="Ministry of Education learner materials, teacher manuals and the SHS curriculum — all in one place. Documents open from the official curriculum microsite." />
      <Tabs tabs={[
        { value: 'docs', label: <span className="inline-flex items-center gap-1.5"><Library className="h-4 w-4" />Learning materials</span>, content: <Documents isTeacher={isTeacher} /> },
        { value: 'curriculum', label: <span className="inline-flex items-center gap-1.5"><BookMarked className="h-4 w-4" />SHS curriculum</span>, content: <CurriculumTree /> },
      ]} />
      <p className="text-xs text-ink-500">Source: Ministry of Education curriculum resources microsite (curriculumresources.edu.gh). ProfJero Edu links to the documents; it does not change them.</p>
    </div>
  );
}

function Documents({ isTeacher }: { isTeacher: boolean }) {
  const [level, setLevel] = useState('SHS');
  const [grade, setGrade] = useState('SHS 1');
  const [subject, setSubject] = useState('');
  const [audience, setAudience] = useState(isTeacher ? '' : 'learner');
  const [q, setQ] = useState('');
  const docs = useQuery({
    queryKey: ['curriculum-docs', level, grade, audience],
    queryFn: async () => {
      let s = supabase.from('curriculum_resources').select('id, level, grade, subject, audience, title, url').eq('level', level).order('subject').order('title').limit(1000);
      if (grade) s = s.eq('grade', grade);
      if (audience) s = s.in('audience', [audience, 'all']);
      return unwrap(await s);
    },
  });
  const subjects = useMemo(() => [...new Set((docs.data ?? []).map((d) => d.subject).filter(Boolean) as string[])].sort(), [docs.data]);
  const list = (docs.data ?? []).filter((d) => (!subject || d.subject === subject) && (!q || `${d.title} ${d.subject}`.toLowerCase().includes(q.toLowerCase())));
  const bySubject = new Map<string, typeof list>();
  list.forEach((d) => bySubject.set(d.subject ?? 'General', [...(bySubject.get(d.subject ?? 'General') ?? []), d]));
  return (
    <div className="space-y-4">
      <Card><CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={level} onChange={(e) => { setLevel(e.target.value); setGrade(GRADES[e.target.value]?.[0] ?? ''); setSubject(''); }} aria-label="Level"><option value="SHS">Senior High (SHS)</option><option value="JHS">Junior High (JHS)</option><option value="Basic">Basic (KG–P6)</option><option value="General">General library</option></Select>
        <Select value={grade} onChange={(e) => { setGrade(e.target.value); setSubject(''); }} aria-label="Class" disabled={!GRADES[level]}><option value="">All classes</option>{(GRADES[level] ?? []).map((g) => <option key={g}>{g}</option>)}</Select>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject"><option value="">All subjects</option>{subjects.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Material type"><option value="">Learner & teacher</option><option value="learner">Learner materials</option><option value="teacher">Teacher manuals</option></Select>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" aria-label="Search materials" /></div>
      </CardBody></Card>
      {docs.isLoading ? <LoadingBlock /> : !list.length ? <EmptyState icon={<Library className="h-7 w-7" />} title="No materials match" description="Try another class or subject." /> : (
        <div className="space-y-5">{[...bySubject.entries()].map(([s, items]) => (
          <section key={s}>
            <h2 className="mb-2 flex items-center gap-2 font-bold"><GraduationCap className="h-4 w-4 text-brand-600" />{s}<span className="text-xs font-normal text-ink-400">{items.length}</span></h2>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map((d) => (
              <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer" className="card group flex items-center gap-3 p-3 transition hover:border-brand-300">
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', d.audience === 'teacher' ? 'bg-violet-50 text-violet-700' : 'bg-brand-50 text-brand-700')}><FileText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-semibold group-hover:text-brand-700">{d.title}</span><span className="text-xs text-ink-500">{d.grade ?? d.level} · {d.audience === 'teacher' ? 'Teacher' : 'Learner'}</span></span>
                <ExternalLink className="h-4 w-4 shrink-0 text-ink-300" />
              </a></li>
            ))}</ul>
          </section>
        ))}</div>
      )}
    </div>
  );
}

type Item = { id: string; parent_id: string | null; kind: string; code: string | null; title: string; grade_level: string | null; position: number };
function CurriculumTree() {
  const subjects = useQuery({ queryKey: ['shs-subjects'], staleTime: 3_600_000, queryFn: async () => unwrap(await supabase.from('curriculum_items').select('id, title, description').eq('kind', 'subject').like('code', 'SHS-%').order('title')) });
  const [sid, setSid] = useState('');
  const [year, setYear] = useState('SHS 1');
  const items = useQuery({
    queryKey: ['shs-items', sid], enabled: Boolean(sid), staleTime: 3_600_000,
    queryFn: async () => {
      // Breadth-first: load the subtree under the subject (max depth 3).
      const all: Item[] = [];
      let parents = [sid];
      for (let d = 0; d < 3 && parents.length; d++) {
        const r = unwrap(await supabase.from('curriculum_items').select('id, parent_id, kind, code, title, grade_level, position').in('parent_id', parents).order('position').limit(1000)) as Item[];
        all.push(...r); parents = r.map((x) => x.id);
      }
      return all;
    },
  });
  const tree = useMemo(() => {
    const kids = new Map<string, Item[]>();
    (items.data ?? []).filter((i) => !i.grade_level || i.grade_level === year).forEach((i) => kids.set(i.parent_id!, [...(kids.get(i.parent_id!) ?? []), i]));
    return kids;
  }, [items.data, year]);
  const subj = subjects.data?.find((s) => s.id === sid);
  const render = (pid: string, depth: number): React.ReactNode => (tree.get(pid) ?? []).map((n) => (
    n.kind === 'strand' || n.kind === 'sub_strand' ? (
      <details key={n.id} open={depth === 0} className={cn(depth === 0 ? 'rounded-2xl border border-ink-200 bg-surface p-3' : 'ml-1 mt-2 border-l-2 border-ink-100 pl-3')}>
        <summary className="flex cursor-pointer items-center gap-2 font-bold"><ChevronRight className="h-4 w-4 text-ink-400" />{n.title}</summary>
        <div className="mt-2 space-y-2">{render(n.id, depth + 1)}</div>
      </details>
    ) : (
      <div key={n.id} className="ml-2 flex gap-2 text-sm">
        <Badge tone={n.kind === 'content_standard' ? 'brand' : 'green'} className="h-fit shrink-0 font-mono text-[0.65rem]">{n.code?.split(' ').pop()}</Badge>
        <p><span className="font-semibold text-ink-500">{n.kind === 'content_standard' ? 'Content standard: ' : 'Learning outcome: '}</span>{n.title}</p>
      </div>
    )
  ));
  return (
    <div className="space-y-4">
      <Card><CardBody className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <Select value={sid} onChange={(e) => setSid(e.target.value)} aria-label="Subject"><option value="">Choose an SHS subject…</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">{['SHS 1', 'SHS 2', 'SHS 3'].map((y) => <option key={y}>{y}</option>)}</Select>
      </CardBody></Card>
      {!sid ? <EmptyState icon={<BookMarked className="h-7 w-7" />} title="Pick a subject" description="See its strands, sub-strands, content standards and learning outcomes. The AI Companion and Resource Studio use these too." />
        : items.isLoading ? <LoadingBlock /> : <div className="space-y-3">{render(sid, 0)}{subj?.description && <p className="text-xs text-ink-500">{subj.description.replace('Official SHS curriculum document: ', 'Source document: ')}</p>}</div>}
    </div>
  );
}
