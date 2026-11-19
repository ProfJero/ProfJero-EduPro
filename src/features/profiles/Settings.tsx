import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Crown, KeyRound, ShieldCheck } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, PageHeader, Select, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { FileUploadButton } from '@/features/media/FileUploadButton';
import { COUNTRIES, TIMEZONES } from './geo';

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
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile & settings" />
      <Tabs tabs={[
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
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-5">
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
          <Button variant="outline" onClick={() => void signOut()}>Sign out on this device</Button>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); await signOut(); }}>Sign out everywhere</Button>
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
