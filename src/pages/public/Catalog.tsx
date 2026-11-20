import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, BookX } from 'lucide-react';
import { Button, EmptyState, ErrorState, Input, Select } from '@/components/ui';
import { CourseCard } from '@/features/courses/CourseCard';
import { levelLabel, useCatalog, useCategories, useInstructorCards } from '@/features/courses/catalog';
import { cn } from '@/lib/utils';

export function CatalogPage() {
  return (
    <div className="bg-ink-50/60">
      <div className="border-b border-ink-100 bg-surface">
        <div className="container-page py-10">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Explore courses</h1>
          <p className="mt-2 max-w-2xl text-ink-600">Practical, structured courses from ProfJero educators. Browse freely — create a free account to enrol and track your progress.</p>
        </div>
      </div>
      <div className="container-page py-8"><CourseBrowser linkPrefix="/courses/" /></div>
    </div>
  );
}

/** Shared by the public catalogue and the learner "Explore" page. */
export function CourseBrowser({ linkPrefix, linkBy = 'slug' }: { linkPrefix: string; linkBy?: 'slug' | 'id' }) {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const category = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const page = Number(params.get('page') ?? 0);
  const { data: cats } = useCategories();
  const { data, isLoading, error, refetch, isFetching } = useCatalog({ search: params.get('q') ?? '', category, level, page });
  const { data: inst } = useInstructorCards((data?.rows ?? []).map((c) => c.id));

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (term) next.set('q', term); else next.delete('q');
      next.delete('page');
      if ((params.get('q') ?? '') !== term) setParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [term, params, setParams]);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('page');
    setParams(next);
  };
  const pages = Math.ceil((data?.count ?? 0) / 12);

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search courses" aria-label="Search courses" className="pl-10" />
        </div>
        <Select value={level} onChange={(e) => set('level', e.target.value)} aria-label="Level" className="md:w-48">
          <option value="">All levels</option>
          {Object.entries(levelLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categories">
        <Chip active={!category} onClick={() => set('category', '')}>All</Chip>
        {cats?.map((c) => <Chip key={c.id} active={category === c.slug} onClick={() => set('category', c.slug)}>{c.name}</Chip>)}
      </div>
      <div className="mt-6" aria-live="polite" aria-busy={isFetching}>
        {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-ink-100" />)}</div>
        ) : data && data.rows.length ? (
          <>
            <p className="mb-4 text-sm text-ink-500">{data.count} course{data.count === 1 ? '' : 's'}</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.rows.map((c) => <CourseCard key={c.id} course={c} to={linkPrefix + (linkBy === 'slug' ? c.slug : c.id)} instructors={inst} />)}
            </div>
            {pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="outline" disabled={page === 0} onClick={() => set('page', String(page - 1))}>Previous</Button>
                <span className="text-sm text-ink-500">Page {page + 1} of {pages}</span>
                <Button variant="outline" disabled={page + 1 >= pages} onClick={() => { const n = new URLSearchParams(params); n.set('page', String(page + 1)); setParams(n); }}>Next</Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={<BookX className="h-7 w-7" />} title="No courses match yet" description="Try a different search or category. New courses are added regularly." />
        )}
      </div>
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300')}>
      {children}
    </button>
  );
}
