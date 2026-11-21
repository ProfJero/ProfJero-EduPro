import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BellRing, Check, Crown, KeyRound, Monitor, Moon, ShieldCheck, Sun, WifiLow } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, PageHeader, Select, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { FileUploadButton } from '@/features/media/FileUploadButton';
import { COUNTRIES, TIMEZONES } from './geo';
import { ACCENTS, networkIsConstrained, usePrefs, type ThemeMode } from '@/features/preferences/PreferencesProvider';
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from '@/lib/push';
import { usePush } from '@/features/notifications/PushPrompt';
import { ProviderConnections } from '@/features/live/ProviderConnections';
import { cn } from '@/lib/utils';

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  display_name: z.string().trim().max(60).optional(),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(2000).optional(),
  country_code: z.string().length(2),
  timezone: z.string(),
  learner_stage: z.string().optional(),
  marketing_opt_in: z.boolean(),
});
type Form = z.infer<typeof schema>;

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const { workspaces } = useAuth();
  const teacher = workspaces.some((w) => w.kind === 'teacher');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile & settings" />
      <Tabs value={params.get('tab') ?? 'profile'} onValueChange={(v) => setParams({ tab: v }, { replace: true })} tabs={[
        { value: 'appearance', label: 'Appearance & data', content: <AppearanceSection /> },
        { value: 'notifications', label: 'Notifications', content: <NotificationsSection /> },
        ...(teacher ? [{ value: 'apps', label: 'Connected apps', content: <ProviderConnections /> }] : []),
        { value: 'profile', label: 'Profile', content: <ProfileForm /> },
        { value: 'account', label: 'Account & security', content: <AccountSection /> },
        { value: 'plan', label: 'Plan', content: <PlanSection /> },
        { value: 'roles', label: 'Roles', content: <RolesSection /> },
      ]} />
    </div>
  );
}

function ProfileForm() {
  const { profile, refresh } = useAuth();
  const toast = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<Form>({
    resolver: zodResolver(schema),
    values: profile ? { full_name: profile.full_name, display_name: profile.display_name ?? '', headline: profile.headline ?? '', bio: profile.bio ?? '', country_code: profile.country_code, timezone: profile.timezone, learner_stage: profile.learner_stage ?? '', marketing_opt_in: profile.marketing_opt_in } : undefined,
  });
  if (!profile) return null;
  const save = async (v: Form) => {
    const { error } = await supabase.from('profiles').update({ ...v, display_name: v.display_name || null, headline: v.headline || null, bio: v.bio || null, learner_stage: (v.learner_stage || null) as never }).eq('id', profile.id);
    if (error) toast.error('Could not save', error.message); else { toast.success('Profile saved'); await refresh(); }
  };
  return (
    <Card>
      <CardBody>
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={profile.full_name} src={profile.avatar_url} size={72} />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <FileUploadButton purpose="avatar" label="Change photo" onUploaded={async (r) => {
                const { error } = await supabase.from('profiles').update({ avatar_url: r.secure_url }).eq('id', profile.id);
                if (error) toast.error('Could not update photo', error.message); else { toast.success('Photo updated'); await refresh(); }
              }} />
            </div>
            {profile.avatar_url && <button className="text-xs font-semibold text-red-600" onClick={async () => { await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id); await refresh(); }}>Remove photo</button>}
          </div>
        </div>
        <form onSubmit={handleSubmit(save)} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" hint="Shown on certificates" error={errors.full_name?.message}><Input {...register('full_name')} /></Field>
            <Field label="Display name"><Input {...register('display_name')} /></Field>
          </div>
          <Field label="Headline" hint="e.g. “ICT teacher” or “SHS 3 science student”"><Input {...register('headline')} /></Field>
          <Field label="About you"><Textarea rows={4} {...register('bio')} /></Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Country"><Select {...register('country_code')}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>
            <Field label="Time zone"><Select {...register('timezone')}>{TIMEZONES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</Select></Field>
            <Field label="Learning stage"><Select {...register('learner_stage')}><option value="">—</option><option value="shs">SHS</option><option value="university">University</option><option value="professional">Professional</option><option value="other">Other</option></Select></Field>
          </div>
          <Checkbox label="Send me occasional product updates" description="We never share your details with advertisers." {...register('marketing_opt_in')} />
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
        </form>
      </CardBody>
    </Card>
  );
}

function AccountSection() {
  const { user, signOut, profile } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-5">
      {profile?.is_guest && <GuestUpgrade />}
      <Card>
        <CardHeader title="Email" />
        <CardBody><p className="text-sm text-ink-700">{user?.email}</p><p className="mt-1 text-xs text-ink-500">{user?.email_confirmed_at ? 'Verified' : 'Not verified'}</p></CardBody>
      </Card>
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><KeyRound className="h-5 w-5" />Change password</span>} />
        <CardBody>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={async (e) => {
            e.preventDefault();
            if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return toast.error('Weak password', 'Use at least 8 characters with a letter and a number.');
            setBusy(true);
            const { error } = await supabase.auth.updateUser({ password: pw });
            setBusy(false);
            if (error) toast.error('Could not change password', errorMessage(error)); else { setPw(''); toast.success('Password changed'); }
          }}>
            <label className="sr-only" htmlFor="newpw">New password</label>
            <Input id="newpw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
            <Button type="submit" loading={busy}>Update</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Sessions" />
        <CardBody className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={async () => { await signOut(); nav('/login', { replace: true }); }}>Sign out on this device</Button>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); await signOut(); nav('/login', { replace: true }); }}>Sign out everywhere</Button>
        </CardBody>
      </Card>
      <Alert tone="info" title="Your data">To request a copy of your data or account deletion, <Link to="/support" className="font-semibold underline">open a support ticket</Link>.</Alert>
    </div>
  );
}

function PlanSection() {
  const { context } = useAuth();
  const ent = context?.entitlements ?? {};
  return (
    <Card>
      <CardHeader title={context?.is_edupro ? <span className="inline-flex items-center gap-2"><Crown className="h-5 w-5 text-sun-500" />ProfJero EduPro</span> : 'ProfJero Edu (free)'} description="Your features come from your own plan and from any school you belong to." />
      <CardBody>
        <ul className="divide-y divide-ink-100">
          {Object.entries(ent).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium text-ink-700">{k.replace(/_/g, ' ')}</span>
              {v.enabled ? <Badge tone="green">{v.limit == null ? 'Included' : `Up to ${v.limit}`}</Badge> : <Badge>Not included</Badge>}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-500">EduPro is available through pilots. <Link to="/pricing" className="font-semibold text-brand-700">Compare plans</Link>.</p>
      </CardBody>
    </Card>
  );
}

function RolesSection() {
  const { context } = useAuth();
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Your roles</span>} description="Roles are granted by administrators. You can switch workspaces from the sidebar." />
        <CardBody className="flex flex-wrap gap-2">{context?.roles.map((r) => <Badge key={r} tone="brand">{r.replace('_', ' ')}</Badge>)}</CardBody>
      </Card>
      {!!context?.schools.length && (
        <Card><CardHeader title="Schools" /><CardBody><ul className="space-y-2 text-sm">{context.schools.map((s) => <li key={s.school_id} className="flex justify-between"><span className="font-semibold">{s.name}</span><span className="text-ink-500">{s.roles?.join(', ')}</span></li>)}</ul></CardBody></Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {!context?.roles.includes('teacher') && <Link to="/teach/apply" className="card p-4 hover:border-brand-300"><p className="font-bold">Become an instructor</p><p className="text-sm text-ink-500">Apply to create independent courses.</p></Link>}
        <Link to="/schools/apply" className="card p-4 hover:border-brand-300"><p className="font-bold">Register a school</p><p className="text-sm text-ink-500">Get a private school workspace.</p></Link>
      </div>
    </div>
  );
}

function GuestUpgrade() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Card className="ring-2 ring-sun-400/50">
      <CardHeader title="Save your progress" description="You joined as a guest. Add an email and password to keep your classes, work and progress — nothing is lost." />
      <CardBody>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return toast.error('Weak password', 'Use at least 8 characters with a letter and a number.');
          setBusy(true);
          const a = await supabase.auth.updateUser({ email });
          const b = a.error ? a : await supabase.auth.updateUser({ password: pw });
          setBusy(false);
          if (b.error) toast.error('Could not create your account', errorMessage(b.error));
          else { toast.success('Account created', 'You can now sign in with your email.'); await refresh(); }
        }}>
          <Input type="email" required placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required placeholder="Password" aria-label="Password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button type="submit" loading={busy}>Create account</Button>
        </form>
      </CardBody>
    </Card>
  );
}

function AppearanceSection() {
  const { prefs, setPref, lowData } = usePrefs();
  const modes: { v: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { v: 'light', label: 'Light', icon: <Sun className="h-5 w-5" /> }, { v: 'dark', label: 'Dark', icon: <Moon className="h-5 w-5" /> }, { v: 'system', label: 'System', icon: <Monitor className="h-5 w-5" /> },
  ];
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Theme" description="Choose how ProfJero Edu looks on this account." />
        <CardBody className="grid grid-cols-3 gap-3">
          {modes.map((m) => (
            <button key={m.v} onClick={() => setPref('theme', m.v)} aria-pressed={prefs.theme === m.v}
              className={cn('flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition', prefs.theme === m.v ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'border-ink-200 text-ink-600 hover:border-ink-300')}>
              {m.icon}{m.label}
            </button>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Accent colour" description="Your accent colours buttons, links and highlights everywhere." />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => setPref('accent', a.id)} aria-pressed={prefs.accent === a.id}
              className={cn('flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold', prefs.accent === a.id ? 'border-ink-900 ring-2 ring-ink-300' : 'border-ink-200 hover:border-ink-300')}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ background: a.swatch }}>{prefs.accent === a.id && <Check className="h-4 w-4" />}</span>
              <span className="text-ink-800">{a.name}</span>
            </button>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Reading & motion" />
        <CardBody className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-800">Text size</p>
            <div className="inline-flex rounded-xl bg-ink-100 p-1">
              {(['sm', 'md', 'lg'] as const).map((t) => <button key={t} onClick={() => setPref('textSize', t)} aria-pressed={prefs.textSize === t} className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold', prefs.textSize === t ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500')}>{t === 'sm' ? 'Small' : t === 'md' ? 'Default' : 'Large'}</button>)}
            </div>
          </div>
          <Checkbox label="Reduce motion" description="Minimise animations across the platform." checked={prefs.reduceMotion} onChange={(e) => setPref('reduceMotion', e.target.checked)} />
          <Checkbox label="Collapse the sidebar by default" description="Show only icons in the navigation (you can toggle it any time)." checked={prefs.sidebarCollapsed} onChange={(e) => setPref('sidebarCollapsed', e.target.checked)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><WifiLow className="h-5 w-5" />Low-data mode</span>} description="Use ProfJero Edu on limited or expensive data." />
        <CardBody className="space-y-3">
          <div className="inline-flex rounded-xl bg-ink-100 p-1">
            {(['auto', 'on', 'off'] as const).map((v) => <button key={v} onClick={() => setPref('lowData', v)} aria-pressed={prefs.lowData === v} className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold capitalize', prefs.lowData === v ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500')}>{v === 'auto' ? 'Automatic' : v}</button>)}
          </div>
          <p className="text-sm text-ink-600">Currently <strong>{lowData ? 'on' : 'off'}</strong>{prefs.lowData === 'auto' && ` — automatic mode turns it on when your device reports Data Saver or a 2G connection${networkIsConstrained() ? ' (detected now)' : ''}`}.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>Images and videos load only when you tap them; smaller image sizes are used.</li>
            <li>Web fonts, live presence and background refreshes are switched off.</li>
            <li>Saved lessons, labs and your work still function offline.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function NotificationsSection() {
  const toast = useToast();
  const push = usePush();
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const load = () => void pushState().then(setState);
  useEffect(load, []);
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><BellRing className="h-5 w-5" />Device notifications</span>} description="Receive live-class reminders, deadlines, grades and announcements on this device, even when the app is closed." />
      <CardBody className="space-y-3">
        {state === 'install' && <Alert tone="info" title="Add to Home Screen first">On iPhone and iPad, tap Share → Add to Home Screen, open ProfJero Edu from there, then turn notifications on.</Alert>}
        {state === 'unsupported' && <Alert tone="warning">This browser does not support push notifications. Try Chrome, Edge, Firefox or Samsung Internet.</Alert>}
        {state === 'unconfigured' && <Alert tone="info">Push notifications are not configured on this server yet.</Alert>}
        {state === 'blocked' && <Alert tone="warning" title="Notifications are blocked">Tap the lock icon beside the web address → Notifications → Allow, then reload this page.</Alert>}
        {(state === 'on' || state === 'off') && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 p-4">
            <p className="text-sm text-ink-700">Push notifications are <strong className={state === 'on' ? 'text-growth-700' : ''}>{state}</strong> on this device.</p>
            <div className="flex gap-2">
              {state === 'off'
                ? <Button loading={busy} leftIcon={<BellRing className="h-4 w-4" />} onClick={async () => { setBusy(true); const r = await enablePush().catch((e) => { toast.error('Failed', errorMessage(e)); return 'error'; }); setBusy(false); if (r === 'granted') toast.success('Notifications enabled'); load(); push.refresh(); }}>Allow notifications</Button>
                : <>
                  <Button variant="secondary" loading={busy} onClick={async () => { setBusy(true); try { await sendTestPush(); toast.success('Test sent', 'It should pop up in a few seconds — try closing the app first.'); } catch (e) { toast.error('Could not send', errorMessage(e)); } setBusy(false); }}>Send a test notification</Button>
                  <Button variant="outline" onClick={async () => { await disablePush(); toast.info('Notifications turned off for this device'); load(); push.refresh(); }}>Turn off</Button>
                </>}
            </div>
          </div>
        )}
        <p className="text-xs text-ink-500">In-app notifications are always available under <Link to="/notifications" className="font-semibold text-brand-700">Notifications</Link>.</p>
      </CardBody>
    </Card>
  );
}
