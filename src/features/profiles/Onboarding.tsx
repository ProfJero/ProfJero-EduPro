import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, GraduationCap, Presentation, Sparkles } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/authentication/AuthProvider';
import { COUNTRIES, TIMEZONES } from './geo';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
  display_name: z.string().trim().max(60).optional(),
  country_code: z.string().length(2),
  timezone: z.string().min(3),
  learner_stage: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function Onboarding() {
  const { profile, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [err, setErr] = useState<string | null>(null);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    values: profile ? {
      full_name: profile.full_name, display_name: profile.display_name ?? '', country_code: profile.country_code,
      timezone: profile.timezone || (TIMEZONES.includes(browserTz) ? browserTz : 'Africa/Accra'), learner_stage: profile.learner_stage ?? '',
    } : undefined,
  });
  const save = async (v: Form) => {
    setErr(null);
    const { error } = await supabase.from('profiles').update({
      full_name: v.full_name, display_name: v.display_name || null, country_code: v.country_code, timezone: v.timezone,
      learner_stage: (v.learner_stage || null) as never,
    }).eq('id', profile!.id);
    if (error) return setErr(error.message);
    setStep(2);
  };
  const finish = async (dest: string) => {
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile!.id);
    await refresh();
    nav(dest, { replace: true });
  };
  const intent = profile?.intended_role ?? 'learner';
  return (
    <div className="min-h-screen bg-ink-50">
      <div className="container-page flex h-16 items-center"><Logo /></div>
      <main className="container-page max-w-2xl py-8">
        <p className="text-sm font-semibold text-brand-600">Step {step} of 2</p>
        {step === 1 ? (
          <div className="card mt-3 p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold">Let's set up your profile</h1>
            <p className="mt-1 text-ink-500">We only ask for what we need. You can change this later.</p>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit(save)} noValidate>
              {err && <Alert tone="error">{err}</Alert>}
              <Field label="Full name (official)" required hint="As in school records. Teachers see this and it goes on certificates." error={errors.full_name?.message}><Input {...register('full_name')} /></Field>
              <Field label="Display name" hint="Optional — what classmates see in discussions"><Input {...register('display_name')} /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Country"><Select {...register('country_code')}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>
                <Field label="Time zone" hint="Used to show class times"><Select {...register('timezone')}>{TIMEZONES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</Select></Field>
              </div>
              {intent === 'learner' && (
                <Field label="Learning stage"><Select {...register('learner_stage')}>
                  <option value="">Prefer not to say</option><option value="shs">Senior High School</option><option value="university">University / tertiary</option><option value="professional">Working professional</option><option value="other">Other</option>
                </Select></Field>
              )}
              <Button type="submit" size="lg" loading={isSubmitting}>Continue</Button>
            </form>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <h1 className="text-2xl font-extrabold">You're all set, {profile?.display_name || profile?.full_name?.split(' ')[0]}!</h1>
            <p className="text-ink-500">Where would you like to start?</p>
            <Choice icon={<GraduationCap className="h-6 w-6" />} title="Start learning" text="Browse courses and enrol for free." onClick={() => finish('/learn/explore')} primary={intent === 'learner'} />
            <Choice icon={<Presentation className="h-6 w-6" />} title="Teach on ProfJero Edu" text="Apply as an independent instructor. If your school invites you, you'll see your classes automatically." onClick={() => finish('/teach/apply')} primary={intent === 'educator'} />
            <Choice icon={<Building2 className="h-6 w-6" />} title="Register my school" text="Submit your institution for verification to get a private school workspace." onClick={() => finish('/schools/apply')} primary={intent === 'institution'} />
            <Choice icon={<Sparkles className="h-6 w-6" />} title="Go to my dashboard" text="Look around first." onClick={() => finish('/learn')} />
          </div>
        )}
      </main>
    </div>
  );
}

function Choice({ icon, title, text, onClick, primary }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className={`card flex w-full items-center gap-4 p-5 text-left transition hover:border-brand-300 hover:shadow-[var(--shadow-lift)] ${primary ? 'ring-2 ring-brand-200' : ''}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${primary ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}>{icon}</span>
      <span><span className="block font-bold text-ink-900">{title}</span><span className="block text-sm text-ink-500">{text}</span></span>
    </button>
  );
}
