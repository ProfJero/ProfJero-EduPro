import { useQuery } from '@tanstack/react-query';
import { Check, Crown, Minus } from 'lucide-react';
import { Alert, Badge, ButtonLink, LoadingBlock } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Plan = { id: string; code: string; name: string; tier: string; scope: string; description: string | null; price_label: string | null; sort_order: number };
type PF = { plan_id: string; feature_key: string; enabled: boolean; limit_value: number | null };
type Feature = { key: string; name: string; description: string | null; kind: string; sort_order: number };

export function Pricing() {
  const { data, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const [plans, features, pf] = await Promise.all([
        supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('features').select('*').order('sort_order'),
        supabase.from('plan_features').select('*'),
      ]);
      return { plans: unwrap(plans) as Plan[], features: unwrap(features) as Feature[], pf: unwrap(pf) as PF[] };
    },
  });
  const scopes: { scope: string; title: string }[] = [{ scope: 'individual', title: 'For learners' }, { scope: 'teacher', title: 'For teachers' }, { scope: 'school', title: 'For schools' }];
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-600">One platform, two offerings</p>
        <h1 className="mt-2 text-4xl font-extrabold">ProfJero Edu & ProfJero EduPro</h1>
        <p className="mt-4 text-ink-600">ProfJero Edu is free and complete. ProfJero EduPro adds premium courses and advanced tools — in the same app, with the same account.</p>
      </div>
      <Alert tone="info" className="mx-auto mt-8 max-w-2xl">EduPro is currently offered through controlled pilots. Online payment is not yet available and pricing will be announced. Schools and educators interested in a pilot can <a className="font-semibold underline" href="/contact?topic=partnership">contact us</a>.</Alert>
      {isLoading || !data ? <div className="mt-10"><LoadingBlock rows={3} /></div> : (
        <div className="mt-12 space-y-14">
          {scopes.map(({ scope, title }) => {
            const plans = data.plans.filter((p) => p.scope === scope);
            const keys = new Set(data.pf.filter((x) => plans.some((p) => p.id === x.plan_id)).map((x) => x.feature_key));
            const feats = data.features.filter((f) => keys.has(f.key));
            return (
              <section key={scope}>
                <h2 className="text-2xl font-extrabold">{title}</h2>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {plans.map((p) => {
                    const pro = p.tier === 'edupro';
                    return (
                      <div key={p.id} className={cn('card flex flex-col p-6', pro && 'ring-2 ring-sun-400/60')}>
                        <div className="flex items-center justify-between"><h3 className="text-lg font-extrabold">{p.name}</h3>{pro ? <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>EduPro</Badge> : <Badge tone="brand">Edu</Badge>}</div>
                        <p className="mt-1 text-sm text-ink-500">{p.description}</p>
                        <p className="mt-4 text-2xl font-extrabold">{p.price_label ?? '—'}</p>
                        <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                          {feats.map((f) => {
                            const v = data.pf.find((x) => x.plan_id === p.id && x.feature_key === f.key);
                            const on = v?.enabled;
                            return (
                              <li key={f.key} className={cn('flex items-start gap-2.5', !on && 'text-ink-400')}>
                                {on ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-growth-600" /> : <Minus className="mt-0.5 h-4 w-4 shrink-0" />}
                                <span>{f.name}{on && f.kind === 'limit' && <strong className="ml-1 text-ink-800">{v?.limit_value == null ? '— unlimited' : `— up to ${v.limit_value}`}</strong>}</span>
                              </li>
                            );
                          })}
                        </ul>
                        <ButtonLink to={pro ? '/contact?topic=partnership' : '/register'} variant={pro ? 'secondary' : 'primary'} className="mt-6">{pro ? 'Ask about an EduPro pilot' : 'Get started free'}</ButtonLink>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
