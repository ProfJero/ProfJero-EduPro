import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Clock3 } from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, Card, CardBody, Field, Input, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { fmtDate } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';
import { COUNTRIES, TIMEZONES } from '@/features/profiles/geo';

const schema = z.object({
  name: z.string().trim().min(3, 'Enter the school name').max(160),
  institution_type: z.enum(['basic', 'jhs', 'shs', 'tertiary', 'vocational', 'training_centre', 'other']),
  country_code: z.string().length(2),
  region: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(240).optional(),
  contact_email: z.string().trim().email('Enter the school’s official email'),
  contact_phone: z.string().trim().max(30).optional(),
  website: z.union([z.string().trim().url('Enter a full URL'), z.literal('')]).optional(),
  timezone: z.string(),
  estimated_learners: z.coerce.number().int().min(0).max(1_000_000).optional(),
  applicant_role: z.string().trim().min(2, 'Tell us your role at the school').max(80),
  application_notes: z.string().trim().max(2000).optional(),
});
type Form = z.input<typeof schema>;

export function SchoolApply() {
  const { user, context, refresh } = useAuth();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { institution_type: 'shs', country_code: 'GH', timezone: 'Africa/Accra' } });
  const apps = context?.school_applications ?? [];
  const submit = async (raw: Form) => {
    const v = schema.parse(raw);
    const slug = `${slugify(v.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from('schools').insert({ ...v, website: v.website || null, slug, applied_by: user!.id, status: 'pending' });
    if (error) return toast.error('Could not submit', error.message);
    setDone(true);
    await refresh();
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Register a school" description="Submit your institution for verification. Once approved you'll get a private school workspace and become its administrator." />
      {apps.map((a) => (
        <Alert key={a.school_id} className="mb-4" tone={a.status === 'pending' ? 'info' : 'warning'} title={a.name} action={<Badge tone={a.status === 'pending' ? 'amber' : 'red'}>{a.status}</Badge>}>
          <Clock3 className="mr-1 inline h-4 w-4" />Submitted {fmtDate(a.created_at)}. {a.status === 'pending' ? 'The ProfJero team will review it and notify you.' : 'This application was not approved — see your notifications for the reason.'}
        </Alert>
      ))}
      {done ? (
        <Card><CardBody className="text-center"><Building2 className="mx-auto h-10 w-10 text-brand-600" /><h2 className="mt-3 text-xl font-extrabold">Application received</h2><p className="mt-1 text-ink-600">We will verify your school and notify you. You can keep learning in the meantime.</p><ButtonLink to="/learn" className="mt-5">Back to dashboard</ButtonLink></CardBody></Card>
      ) : (
        <Card><CardBody>
          <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <Field label="School / institution name" required error={errors.name?.message}><Input {...register('name')} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Type"><Select {...register('institution_type')}><option value="basic">Basic school</option><option value="jhs">Junior High School</option><option value="shs">Senior High School</option><option value="tertiary">University / tertiary</option><option value="vocational">Technical / vocational</option><option value="training_centre">Training centre</option><option value="other">Other</option></Select></Field>
              <Field label="Approximate number of learners"><Input type="number" min={0} {...register('estimated_learners')} /></Field>
              <Field label="Country"><Select {...register('country_code')}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>
              <Field label="Time zone"><Select {...register('timezone')}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Region / state"><Input {...register('region')} /></Field>
              <Field label="City / town"><Input {...register('city')} /></Field>
            </div>
            <Field label="Address"><Input {...register('address')} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Official school email" required error={errors.contact_email?.message}><Input type="email" {...register('contact_email')} /></Field>
              <Field label="Phone"><Input type="tel" {...register('contact_phone')} /></Field>
            </div>
            <Field label="Website" error={errors.website?.message}><Input type="url" placeholder="https://" {...register('website')} /></Field>
            <Field label="Your role at the school" required hint="e.g. Headmaster, ICT coordinator, Registrar" error={errors.applicant_role?.message}><Input {...register('applicant_role')} /></Field>
            <Field label="Anything else we should know?"><Textarea rows={3} {...register('application_notes')} /></Field>
            <Alert tone="info">Verified institutional privileges are only granted after review. We may contact the school to confirm.</Alert>
            <Button type="submit" size="lg" loading={isSubmitting}>Submit for verification</Button>
          </form>
        </CardBody></Card>
      )}
    </div>
  );
}
