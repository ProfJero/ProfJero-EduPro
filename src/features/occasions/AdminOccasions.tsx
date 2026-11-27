import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Input, LoadingBlock, PageHeader, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';
import { currentOccasion, isActive, nextWindow, OCCASIONS, readConfig, type OccasionConfig } from './occasions';
import { previewOccasion, useOccasion } from './OccasionLayer';

const KEY = 'occasions.config';

/** Owner console: turn festive designs on/off, choose occasions and write the greetings. */
export function AdminOccasions() {
  const qc = useQueryClient();
  const toast = useToast();
  const setting = useQuery({ queryKey: ['admin-setting', KEY], queryFn: async () => unwrap(await supabase.from('platform_settings').select('value').eq('key', KEY).maybeSingle()) });
  const [cfg, setCfg] = useState<OccasionConfig | null>(null);
  const live = useOccasion();
  useEffect(() => { if (setting.data !== undefined) setCfg(readConfig(setting.data?.value)); }, [setting.data]);
  const save = useMutation({
    mutationFn: async (next: OccasionConfig) => unwrap(await supabase.from('platform_settings').upsert({ key: KEY, value: next as never, is_public: true, description: 'Festive designs' })),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-setting', KEY] }); void qc.invalidateQueries({ queryKey: ['public-settings'] }); toast.success('Saved', 'Everyone will see the change within a few minutes.'); },
    onError: (e) => toast.error('Not saved', errorMessage(e)),
  });
  const now = new Date();
  const rows = useMemo(() => OCCASIONS.map((o) => ({ o, next: nextWindow(o, now), active: isActive(o, now) }))
    .sort((a, b) => (a.next?.[0].getTime() ?? Infinity) - (b.next?.[0].getTime() ?? Infinity)), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cfg) return <LoadingBlock />;
  const showing = currentOccasion(cfg, now);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(readConfig(setting.data?.value));
  const update = (patch: Partial<OccasionConfig>) => setCfg({ ...cfg, ...patch });
  return (
    <div className="space-y-5">
      <PageHeader title="Festive designs" description="Light, joyful decorations for Christmas, Easter, Independence Day and other Ghanaian occasions — a garland, a greeting and an ornament on the logo. Learners can switch them off in Settings."
        actions={<Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(cfg)}>Save changes</Button>} />
      <Card><CardBody className="flex flex-wrap items-center gap-4">
        <span className="text-4xl" aria-hidden>{showing?.emoji ?? '🗓️'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-500">Showing now</p>
          <p className="text-lg font-extrabold">{showing ? showing.name : 'Nothing — no occasion today'}</p>
          {live.occasion && live.occasion.id !== showing?.id && <p className="text-sm text-sun-700">This device is previewing {live.occasion.name}.</p>}
        </div>
        {live.occasion && live.occasion.id !== showing?.id && <Button variant="secondary" leftIcon={<EyeOff className="h-4 w-4" />} onClick={() => previewOccasion(null)}>Stop preview</Button>}
      </CardBody></Card>

      <Card>
        <CardHeader title="How it works" />
        <CardBody className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Mode">
            {([['auto', 'Automatic', 'Follows the calendar below.'], ['manual', 'One occasion', 'Show one design until you change it.'], ['off', 'Off', 'No festive designs anywhere.']] as const).map(([v, t, d]) => (
              <button key={v} role="radio" aria-checked={cfg.mode === v} onClick={() => update({ mode: v })} className={cn('rounded-2xl border p-4 text-left', cfg.mode === v ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-ink-200 hover:border-ink-300')}>
                <p className="font-bold">{t}</p><p className="text-sm text-ink-500">{d}</p>
              </button>
            ))}
          </div>
          {cfg.mode === 'manual' && <Select value={cfg.manual ?? ''} onChange={(e) => update({ manual: e.target.value || null })} aria-label="Occasion to show" className="max-w-sm">
            <option value="">Choose an occasion…</option>{OCCASIONS.map((o) => <option key={o.id} value={o.id}>{o.emoji} {o.name}</option>)}</Select>}
          <Checkbox label="Falling decorations" description="Snow, confetti, petals or hearts fall gently for about 20 seconds when a page opens. Never shown in low-data or reduced-motion mode." checked={cfg.effects} onChange={(e) => update({ effects: e.target.checked })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Occasions" description="Turn individual occasions off, write your own greeting, or preview a design on this device." />
        <CardBody className="p-0">
          <ul className="divide-y divide-ink-100">{rows.map(({ o, next, active }) => {
            const off = cfg.disabled.includes(o.id);
            return (
              <li key={o.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5', off && 'opacity-60')}>
                <span className="text-2xl" aria-hidden>{o.emoji}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-bold">{o.name} {active && <Badge tone="green" icon={<Sparkles className="h-3 w-3" />}>Today</Badge>}</p>
                  <p className="text-xs text-ink-500">{o.manualOnly ? 'Turn on manually when you need it' : next ? `${fmtDate(next[0].toISOString(), 'EEE d MMM')}${next[1].getTime() !== next[0].getTime() ? ` – ${fmtDate(next[1].toISOString(), 'EEE d MMM yyyy')}` : ` ${next[0].getFullYear()}`}` : 'Date to be confirmed'}{o.note ? ` · ${o.note}` : ''}</p>
                </div>
                <Input value={cfg.messages[o.id] ?? ''} onChange={(e) => update({ messages: { ...cfg.messages, [o.id]: e.target.value.slice(0, 160) } })} placeholder={o.greeting} aria-label={`Greeting for ${o.name}`} className="h-9 w-full text-sm sm:w-80" />
                <Button size="sm" variant="ghost" leftIcon={<Eye className="h-4 w-4" />} onClick={() => { previewOccasion(o.id); toast.success(`Previewing ${o.name}`, 'Only on this device, for 10 minutes.'); }}>Preview</Button>
                {!o.manualOnly && <Checkbox label="On" checked={!off} onChange={(e) => update({ disabled: e.target.checked ? cfg.disabled.filter((x) => x !== o.id) : [...cfg.disabled, o.id] })} />}
              </li>
            );
          })}</ul>
        </CardBody>
      </Card>
      <Alert tone="info" title="Good practice">Designs follow the good-practice rule used by major sites: small touches that keep the ProfJero look, readable text, and an easy way for anyone to switch them off.</Alert>
    </div>
  );
}
