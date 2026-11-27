import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Presentation } from 'lucide-react';
import { Alert, Button, ButtonLink, Card, CardBody, Field, Input, LoadingBlock, PageHeader, StatusBadge, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { useAuth } from '@/features/authentication/AuthProvider';

const schema = z.object({
  expertise: z.string().trim().min(3, 'What do you teach?').max(300),
  motivation: z.string().trim().min(20, 'Tell us a bit more (at least 20 characters)').max(3000),
  portfolio_url: z.union([z.string().trim().url('Enter a full URL'), z.literal('')]).optional(),
  phone: z.string().trim().max(30).optional(),
  institution: z.string().trim().max(160).optional(),
  subjects: z.string().trim().max(300).optional(),
  teaching_level: z.string().trim().max(80).optional(),
  years_experience: z.string().trim().regex(/^(\d{1,2})?$/, 'Enter a number of years').optional(),
  location: z.string().trim().max(120).optional(),
});

export function InstructorApply() {
  const { user, context } = useAuth();
  const toast = useToast();
  const apps = useQuery({ queryKey: ['instructor-apps', user?.id], enabled: Boolean(user), queryFn: async () => unwrap(await supabase.from('instructor_applications').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })) });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (context?.roles.includes('teacher')) {
    return <div className="mx-auto max-w-2xl"><PageHeader title="You're an instructor" /><Alert tone="success" title="Instructor access active" action={<ButtonLink to="/teach" size="sm">Open teaching workspace</ButtonLink>}>You can create courses and submit them for review.</Alert></div>;
  }
  if (apps.isLoading) return <LoadingBlock />;
  const pending = apps.data?.find((a) => a.status === 'pending');
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Become a ProfJero Edu instructor" description="Independent instructors create and run their own courses. Teaching at a school? Your school administrator invites you instead." />
      {apps.data?.map((a) => (
        <Alert key={a.id} className="mb-4" tone={a.status === 'rejected' ? 'warning' : 'info'} title={`Application from ${fmtDate(a.created_at)}`} action={<StatusBadge status={a.status} />}>{a.review_notes ?? (a.status === 'pending' ? 'Under review.' : '')}</Alert>
      ))}
      {!pending && (
        <Card><CardBody>
          <form className="space-y-5" onSubmit={handleSubmit(async (v) => {
            const { error } = await supabase.from('instructor_applications').insert({ user_id: user!.id, expertise: v.expertise, motivation: v.motivation, portfolio_url: v.portfolio_url || null,
              phone: v.phone || null, institution: v.institution || null, subjects: v.subjects || null, teaching_level: v.teaching_level || null,
              years_experience: v.years_experience ? Math.min(60, Number(v.years_experience)) : null, location: v.location || null });
            if (error) toast.error('Could not submit', error.message); else { toast.success('Application sent'); void apps.refetch(); }
          })} noValidate>
            <Presentation className="h-8 w-8 text-growth-600" />
            <Field label="Subjects or skills you teach" required error={errors.expertise?.message}><Input {...register('expertise')} placeholder="e.g. Python programming, SHS Core Mathematics" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="School or institution"><Input {...register('institution')} placeholder="e.g. Accra Academy" /></Field>
              <Field label="Level you teach"><Input {...register('teaching_level')} list="levels" placeholder="e.g. SHS" /></Field>
              <Field label="Years of teaching" error={errors.years_experience?.message}><Input inputMode="numeric" {...register('years_experience')} /></Field>
              <Field label="Town / region"><Input {...register('location')} placeholder="e.g. Kumasi, Ashanti" /></Field>
              <Field label="Phone (optional)" hint="Only the ProfJero team sees this."><Input type="tel" autoComplete="tel" {...register('phone')} /></Field>
              <Field label="Other subjects"><Input {...register('subjects')} placeholder="e.g. ICT, Physics" /></Field>
            </div>
            <datalist id="levels"><option>Basic (Primary)</option><option>JHS</option><option>SHS</option><option>Tertiary</option><option>Professional</option></datalist>
            <Field label="Your teaching experience and what you'd like to teach" required error={errors.motivation?.message}><Textarea rows={6} {...register('motivation')} /></Field>
            <Field label="Portfolio, LinkedIn or website" error={errors.portfolio_url?.message}><Input type="url" placeholder="https://" {...register('portfolio_url')} /></Field>
            <Button type="submit" loading={isSubmitting}>Submit application</Button>
          </form>
        </CardBody></Card>
      )}
    </div>
  );
}
