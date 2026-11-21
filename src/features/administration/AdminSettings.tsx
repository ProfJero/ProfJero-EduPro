import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, LoadingBlock, PageHeader, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';

export function AdminSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: async () => unwrap(await supabase.from('platform_settings').select('*').order('key')) });
  const [newKey, setNewKey] = useState('');
  if (isLoading) return <LoadingBlock />;
  const save = async (key: string, raw: string, is_public: boolean, description?: string | null) => {
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return toast.error('Invalid JSON', 'Strings need quotes, e.g. "ProfJero Edu"'); }
    const { error } = await supabase.from('platform_settings').upsert({ key, value: value as never, is_public, description: description ?? null });
    if (error) toast.error('Not saved', error.message); else { toast.success(`Saved ${key}`); void qc.invalidateQueries({ queryKey: ['admin-settings'] }); void qc.invalidateQueries({ queryKey: ['public-settings'] }); }
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Platform settings" description="Configuration values stored in the database. Values are JSON." />
      <Alert tone="info" title="Testimonials">To show genuine testimonials on the homepage, add a public key <code>home.testimonials</code> with a value like <code>[{'{'}"quote":"…","name":"…","role":"SHS 3 student"{'}'}]</code>. Only publish testimonials you have permission to use.</Alert>
      <div className="space-y-3">{data?.map((s) => <SettingRow key={s.key} k={s.key} value={JSON.stringify(s.value)} isPublic={s.is_public} description={s.description} onSave={save} />)}</div>
      <Card><CardHeader title="Add a setting" /><CardBody className="flex gap-2"><Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. home.testimonials" aria-label="New key" /><Button disabled={!/^[a-z0-9_.]+$/.test(newKey)} onClick={() => { void save(newKey, '[]', true); setNewKey(''); }}>Add</Button></CardBody></Card>
    </div>
  );
}

function SettingRow({ k, value, isPublic, description, onSave }: { k: string; value: string; isPublic: boolean; description: string | null; onSave: (k: string, v: string, p: boolean, d?: string | null) => void }) {
  const [v, setV] = useState(value);
  const [p, setP] = useState(isPublic);
  return (
    <Card><CardBody className="grid gap-3 md:grid-cols-[16rem_1fr_auto] md:items-start">
      <div><p className="font-mono text-sm font-semibold">{k}</p>{description && <p className="text-xs text-ink-500">{description}</p>}<Checkbox className="mt-2" label="Public" checked={p} onChange={(e) => setP(e.target.checked)} /></div>
      <Field label="Value (JSON)">{v.length > 60 ? <Textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} className="font-mono text-sm" /> : <Input value={v} onChange={(e) => setV(e.target.value)} className="font-mono text-sm" />}</Field>
      <Button className="md:mt-7" variant="outline" disabled={v === value && p === isPublic} onClick={() => onSave(k, v, p, description)}>Save</Button>
    </CardBody></Card>
  );
}
