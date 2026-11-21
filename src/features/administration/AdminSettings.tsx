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
      <PageHeader title="System controls" description="Switch platform features on or off, post a banner for everyone and keep release notes. Changes apply within a few minutes for everyone." />
      <Switches values={Object.fromEntries((data ?? []).map((s) => [s.key, s.value]))} onSave={(k, v) => save(k, JSON.stringify(v), true, data?.find((x) => x.key === k)?.description)} />
      <h2 className="pt-4 text-lg font-bold">Advanced settings (JSON)</h2>
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

function Switches({ values, onSave }: { values: Record<string, unknown>; onSave: (k: string, v: unknown) => void }) {
  const [banner, setBanner] = useState(typeof values['maintenance.banner'] === 'string' ? (values['maintenance.banner'] as string) : '');
  const toggles: [string, string, string][] = [
    ['signups.enabled', 'New sign-ups', 'Let new people create accounts.'],
    ['ai.enabled', 'AI Companion & Resource Studio', 'Turn AI features off to stop API costs instantly.'],
    ['discussions.public_enabled', 'Open discussions', 'Allow discussions across classes and schools.'],
    ['arena.enabled', 'Challenge Arena', 'Show games, XP and leaderboards.'],
    ['maintenance.read_only', 'Maintenance mode notice', 'Tell users maintenance is in progress.'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card><CardHeader title="Feature switches" /><CardBody className="divide-y divide-ink-100">
        {toggles.map(([k, label, hint]) => {
          const on = values[k] === true;
          return (
            <div key={k} className="flex items-center gap-3 py-3">
              <div className="flex-1"><p className="font-semibold">{label}</p><p className="text-xs text-ink-500">{hint}</p></div>
              <button role="switch" aria-checked={on} aria-label={label} onClick={() => onSave(k, !on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-growth-500' : 'bg-ink-300'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          );
        })}
      </CardBody></Card>
      <Card><CardHeader title="Banner for everyone" description="Shown at the top of every page in the app. Leave empty to hide." /><CardBody className="space-y-3">
        <Textarea rows={3} value={banner} onChange={(e) => setBanner(e.target.value)} maxLength={300} placeholder="Mid-term break: live classes resume on Monday 3 March." />
        <div className="flex gap-2"><Button onClick={() => onSave('maintenance.banner', banner.trim())}>Publish banner</Button><Button variant="ghost" onClick={() => { setBanner(''); onSave('maintenance.banner', ''); }}>Remove</Button></div>
      </CardBody></Card>
    </div>
  );
}
