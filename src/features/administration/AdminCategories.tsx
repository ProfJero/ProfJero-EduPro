import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button, Card, CardBody, Checkbox, Field, Input, LoadingBlock, PageHeader, Select, useToast } from '@/components/ui';
import { supabase, unwrap, type Updates } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { CategoryIcon, categoryIconNames } from '@/features/courses/CategoryIcon';

export function AdminCategories() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['admin-categories'], queryFn: async () => unwrap(await supabase.from('categories').select('*').order('sort_order')) });
  const [f, setF] = useState({ name: '', description: '', icon: 'book-open' });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['admin-categories'] }); void qc.invalidateQueries({ queryKey: ['categories'] }); };
  const upd = async (id: string, patch: Updates<'categories'>) => { const { error } = await supabase.from('categories').update(patch).eq('id', id); if (error) toast.error('Failed', error.message); else refresh(); };
  if (isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Learning areas shown in the catalogue." />
      <Card><CardBody className="grid gap-3 sm:grid-cols-[1fr_2fr_10rem_auto]">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Icon"><Select value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}>{categoryIconNames.map((i) => <option key={i}>{i}</option>)}</Select></Field>
        <Button className="self-end" leftIcon={<Plus className="h-4 w-4" />} disabled={f.name.trim().length < 2} onClick={async () => {
          const { error } = await supabase.from('categories').insert({ name: f.name.trim(), slug: slugify(f.name), description: f.description || null, icon: f.icon, sort_order: (data?.length ?? 0) + 1 });
          if (error) toast.error('Failed', error.message); else { setF({ name: '', description: '', icon: 'book-open' }); refresh(); }
        }}>Add</Button>
      </CardBody></Card>
      <div className="grid gap-3 md:grid-cols-2">{data?.map((c) => (
        <Card key={c.id}><CardBody className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><CategoryIcon name={c.icon} className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><Input defaultValue={c.name} aria-label="Category name" onBlur={(e) => e.target.value !== c.name && upd(c.id, { name: e.target.value })} className="h-9" /></div>
          <Input type="number" defaultValue={c.sort_order} aria-label="Sort order" className="h-9 w-16" onBlur={(e) => upd(c.id, { sort_order: Number(e.target.value) })} />
          <Checkbox label="Active" checked={c.is_active} onChange={(e) => upd(c.id, { is_active: e.target.checked })} />
        </CardBody></Card>
      ))}</div>
    </div>
  );
}
