import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Code2, ExternalLink, FlaskConical, Sigma, Swords, WifiOff } from 'lucide-react';
import { Badge, Card, CardBody, PageHeader } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { CURATED_PHET, LAB_TOOLS } from './catalog';

const LABS = [
  { kind: 'code', title: 'Code Lab', icon: Code2, to: '/lab/code', color: 'from-teal-600 to-ink-950', text: 'A VS Code-grade editor with Emmet, snippets and IntelliSense. Run Python, JavaScript, TypeScript, SQL and web projects instantly — C, C++, Java and more on the server.' },
  { kind: 'science', title: 'Science Lab', icon: FlaskConical, to: '/lab/science', color: 'from-growth-600 to-board-900', text: 'Virtual experiments: circuits, projectiles, pendulums, titration, the periodic table and buoyancy.' },
  { kind: 'math', title: 'Math Lab', icon: Sigma, to: '/lab/math', color: 'from-brand-600 to-ink-950', text: 'Graph functions, solve equations step by step, explore triangles, fractions, statistics and probability.' },
] as const;

export function LabHome() {
  const { user } = useAuth();
  const projects = useQuery({
    queryKey: ['lab-projects-home', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('lab_projects').select('id, title, language, updated_at').eq('owner_id', user!.id).order('updated_at', { ascending: false }).limit(6)),
  });
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="EduLab" title="Practical learning and experimentation" description="Coding playgrounds, simulations, virtual activities and practical challenges — learn by doing." />
      <div className="grid gap-5 lg:grid-cols-3">
        {LABS.map((l) => (
          <Link key={l.kind} to={l.to} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
            <div className={`flex h-28 items-end bg-gradient-to-br p-5 text-white ${l.color}`}><l.icon className="h-9 w-9 opacity-90" /></div>
            <div className="p-5">
              <h2 className="flex items-center justify-between text-lg font-extrabold">{l.title}<ArrowRight className="h-5 w-5 text-ink-400 transition group-hover:translate-x-1 group-hover:text-brand-600" /></h2>
              <p className="mt-1.5 text-sm text-ink-600">{l.text}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{LAB_TOOLS.filter((t) => t.lab === l.kind).slice(0, 6).map((t) => <Badge key={t.id}>{t.name}</Badge>)}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card><CardBody>
          <h2 className="font-bold">Your recent projects</h2>
          {projects.data?.length ? (
            <ul className="mt-3 divide-y divide-ink-100">{projects.data.map((p) => (
              <li key={p.id}><Link to={`/lab/code/${p.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-brand-700"><Code2 className="h-4 w-4 text-teal-600" /><span className="flex-1 truncate font-semibold">{p.title}</span><span className="text-xs text-ink-400">{p.language} · {fromNow(p.updated_at)}</span></Link></li>
            ))}</ul>
          ) : <p className="mt-2 text-sm text-ink-500">Projects you save in Code Lab appear here.</p>}
        </CardBody></Card>
        <Card><CardBody className="space-y-3">
          <h2 className="font-bold">Practical challenges</h2>
          <p className="text-sm text-ink-600">Put your skills to the test in the Challenge Arena — Code Quest, Math Sprint and more, in levels.</p>
          <Link to="/arena" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Swords className="h-4 w-4" />Open the Arena</Link>
          <p className="flex items-center gap-2 rounded-xl bg-ink-50 p-3 text-xs text-ink-600"><WifiOff className="h-4 w-4 shrink-0" />Labs keep working offline after their first load — great for low-data learners.</p>
        </CardBody></Card>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold">More simulations (PhET, University of Colorado)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{CURATED_PHET.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 hover:border-brand-300"><FlaskConical className="h-5 w-5 text-growth-600" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.title}</span><span className="text-xs text-ink-500">{s.subject}</span></span><ExternalLink className="h-4 w-4 text-ink-400" /></a>
        ))}</div>
      </section>
    </div>
  );
}
