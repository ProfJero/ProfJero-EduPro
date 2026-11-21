import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Avatar, Badge, DataTable, EmptyState, Input, LoadingBlock, PageHeader, ProgressBar } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { pct } from '@/lib/utils';

type S = { user_id: string; name: string; avatar_url: string | null; contexts: string[]; avg_progress: number | null; last_activity_at: string | null };

export function TeacherStudents() {
  const { data, isLoading } = useQuery({ queryKey: ['my-students'], queryFn: async () => unwrap(await supabase.rpc('my_students')) as S[] });
  const [q, setQ] = useState('');
  const rows = (data ?? []).filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Students" description="Learners in the courses you manage and the classes you teach." />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" aria-label="Search students" className="mb-4 max-w-sm" />
      {isLoading ? <LoadingBlock /> : (
        <DataTable rows={rows} rowKey={(r) => r.user_id} empty={<EmptyState icon={<Users className="h-7 w-7" />} title="No students yet" />} columns={[
          { key: 'n', header: 'Student', primary: true, cell: (r) => <span className="inline-flex items-center gap-2"><Avatar name={r.name} src={r.avatar_url} size={28} />{r.name}</span> },
          { key: 'c', header: 'Courses & classes', cell: (r) => <div className="flex flex-wrap justify-end gap-1 md:justify-start">{r.contexts.slice(0, 3).map((c) => <Badge key={c}>{c}</Badge>)}{r.contexts.length > 3 && <Badge>+{r.contexts.length - 3}</Badge>}</div> },
          { key: 'p', header: 'Avg progress', cell: (r) => (r.avg_progress == null ? '—' : <div className="flex min-w-[7rem] items-center gap-2"><ProgressBar value={r.avg_progress} className="flex-1" /><span className="text-xs">{pct(r.avg_progress)}%</span></div>) },
          { key: 'a', header: 'Last active', cell: (r) => (r.last_activity_at ? fromNow(r.last_activity_at) : '—') },
        ]} />
      )}
    </div>
  );
}
