import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardBody, Checkbox, Field, Input, PageHeader, Select, Textarea, useToast } from '@/components/ui';
import { supabase, type Tables } from '@/lib/supabase';
import { slugify, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { MediaPicker } from '@/features/media/MediaPicker';
import { useCategories, levelLabel } from './catalog';

const schema = z.object({
  title: z.string().trim().min(3, 'At least 3 characters').max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only').max(120),
  short_description: z.string().trim().max(280),
  description: z.string().max(20000),
  category_id: z.string().optional(),
  subject: z.string().trim().max(80).optional(),
  target_audience: z.string().trim().max(300).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all_levels']),
  objectives: z.array(z.object({ value: z.string().trim().max(200) })),
  prerequisites_text: z.string().trim().max(2000).optional(),
  estimated_hours: z.union([z.coerce.number().min(0).max(1000), z.literal('')]).optional(),
  visibility: z.enum(['public', 'unlisted', 'school', 'private']),
  enrolment_method: z.enum(['open', 'invite', 'closed']),
  school_id: z.string().optional(),
  cover_url: z.union([z.string().trim().url().startsWith('https://'), z.literal('')]).optional(),
  completion_lesson_pct: z.coerce.number().int().min(1).max(100),
  completion_requires_assessments: z.boolean(),
  certificate_enabled: z.boolean(),
});
export type CourseFormValues = z.input<typeof schema>;

export function toFormValues(c?: Tables<'courses'>): CourseFormValues {
  return {
    title: c?.title ?? '', slug: c?.slug ?? '', short_description: c?.short_description ?? '', description: c?.description ?? '',
    category_id: c?.category_id ?? '', subject: c?.subject ?? '', target_audience: c?.target_audience ?? '', level: c?.level ?? 'beginner',
    objectives: (c?.objectives?.length ? c.objectives : ['', '', '']).map((value) => ({ value })), prerequisites_text: c?.prerequisites_text ?? '',
    estimated_hours: c?.estimated_hours ?? '', visibility: c?.visibility ?? 'public', enrolment_method: c?.enrolment_method ?? 'open', school_id: c?.school_id ?? '',
    cover_url: c?.cover_url ?? '', completion_lesson_pct: c?.completion_lesson_pct ?? 100, completion_requires_assessments: c?.completion_requires_assessments ?? true, certificate_enabled: c?.certificate_enabled ?? true,
  };
}

function toRow(raw: CourseFormValues) {
  const v = schema.parse(raw);
  return {
    title: v.title, slug: v.slug, short_description: v.short_description, description: v.description, category_id: v.category_id || null,
    subject: v.subject || null, target_audience: v.target_audience || null, level: v.level, objectives: v.objectives.map((o) => o.value).filter(Boolean),
    prerequisites_text: v.prerequisites_text || null, estimated_hours: v.estimated_hours === '' || v.estimated_hours == null ? null : Number(v.estimated_hours),
    visibility: v.visibility, enrolment_method: v.enrolment_method, cover_url: v.cover_url || null,
    completion_lesson_pct: v.completion_lesson_pct, completion_requires_assessments: v.completion_requires_assessments, certificate_enabled: v.certificate_enabled,
  };
}

export function CourseFormFields({ initial, courseId, onSubmit, submitLabel, allowSchoolChoice }: { initial: CourseFormValues; courseId?: string; onSubmit: (row: ReturnType<typeof toRow> & { school_id: string | null }) => Promise<void>; submitLabel: string; allowSchoolChoice: boolean }) {
  const { context } = useAuth();
  const { data: cats } = useCategories();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting, dirtyFields } } = useForm<CourseFormValues>({ resolver: zodResolver(schema), defaultValues: initial });
  const objectives = useFieldArray({ control, name: 'objectives' });
  const staffSchools = (context?.schools ?? []).filter((s) => s.roles?.some((r) => r === 'teacher' || r === 'school_admin'));
  const schoolId = watch('school_id');
  const cover = watch('cover_url');
  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit(async (v) => {
      setErr(null);
      try {
        await onSubmit({ ...toRow(v), school_id: v.school_id || null });
      } catch (e) {
        setErr(errorMessage(e));
      }
    })}>
      {err && <Alert tone="error">{err}</Alert>}
      <Card><CardBody className="space-y-5">
        <h2 className="font-bold">Basics</h2>
        <Field label="Course title" required error={errors.title?.message}><Input {...register('title', { onChange: (e) => { if (!courseId && !dirtyFields.slug) setValue('slug', slugify(e.target.value)); } })} /></Field>
        <Field label="URL slug" hint={`profjero-edupro.pages.dev/courses/${watch('slug') || 'your-course'}`} error={errors.slug?.message}><Input {...register('slug')} /></Field>
        <Field label="Short description" hint="Shown on course cards (max 280 characters)" error={errors.short_description?.message}><Textarea rows={2} {...register('short_description')} /></Field>
        <Field label="Full description"><Textarea rows={6} {...register('description')} /></Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Category"><Select {...register('category_id')}><option value="">—</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Subject"><Input {...register('subject')} placeholder="e.g. Core Mathematics" /></Field>
          <Field label="Level"><Select {...register('level')}>{Object.entries(levelLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Target audience"><Input {...register('target_audience')} placeholder="e.g. SHS 2 students" /></Field>
          <Field label="Estimated duration (hours)" error={errors.estimated_hours?.message as string | undefined}><Input type="number" step="0.5" min={0} {...register('estimated_hours')} /></Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-800">Cover image</p>
          <MediaPicker kind="image" courseId={courseId} value={cover} onChange={(url) => setValue('cover_url', url, { shouldDirty: true })} label="Choose a cover image from your device" />
        </div>
      </CardBody></Card>

      <Card><CardBody className="space-y-5">
        <h2 className="font-bold">Learning design</h2>
        <div>
          <p className="text-sm font-semibold text-ink-800">Learning objectives</p>
          <div className="mt-2 space-y-2">
            {objectives.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2"><Input {...register(`objectives.${i}.value`)} placeholder={`Objective ${i + 1}`} aria-label={`Objective ${i + 1}`} /><Button variant="ghost" size="icon" aria-label="Remove objective" onClick={() => objectives.remove(i)}><Trash2 className="h-4 w-4" /></Button></div>
            ))}
            <Button variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => objectives.append({ value: '' })}>Add objective</Button>
          </div>
        </div>
        <Field label="Prerequisites"><Textarea rows={2} {...register('prerequisites_text')} /></Field>
      </CardBody></Card>

      <Card><CardBody className="space-y-5">
        <h2 className="font-bold">Access & completion</h2>
        {allowSchoolChoice && (
          <Field label="Course belongs to" hint="School courses are managed by that school and can be assigned to its classes.">
            <Select {...register('school_id')}>
              {context?.roles.includes('teacher') || context?.roles.includes('platform_admin') ? <option value="">Independent (my own course)</option> : null}
              {staffSchools.map((s) => <option key={s.school_id} value={s.school_id}>{s.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Visibility"><Select {...register('visibility')}>
            <option value="public">Public — listed in the catalogue</option><option value="unlisted">Unlisted — anyone with the link</option>
            {schoolId && <option value="school">School only</option>}<option value="private">Private — invited learners only</option>
          </Select></Field>
          <Field label="Enrolment"><Select {...register('enrolment_method')}><option value="open">Open — learners self-enrol</option><option value="invite">By teacher / school only</option><option value="closed">Closed</option></Select></Field>
        </div>
        <Field label="Lessons required to complete (%)"><Input type="number" min={1} max={100} {...register('completion_lesson_pct')} /></Field>
        <Checkbox label="Learners must pass all course assessments to complete" {...register('completion_requires_assessments')} />
        <Checkbox label="Issue a certificate on completion" {...register('certificate_enabled')} />
      </CardBody></Card>
      <Button type="submit" size="lg" loading={isSubmitting}>{submitLabel}</Button>
    </form>
  );
}

export function CourseNewPage() {
  const { user, context } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const staffSchools = (context?.schools ?? []).filter((s) => s.roles?.some((r) => r === 'teacher' || r === 'school_admin'));
  const canIndependent = context?.roles.includes('teacher') || context?.roles.includes('platform_admin');
  const initial = toFormValues();
  if (!canIndependent && staffSchools[0]) initial.school_id = staffSchools[0].school_id;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ to: '/teach/courses', label: 'My courses' }} title="Create a course" description="Start with the basics — you'll add modules and lessons next." />
      {!canIndependent && !staffSchools.length ? <Alert tone="warning">You need instructor access or a school teaching role to create courses.</Alert> : (
        <CourseFormFields initial={initial} allowSchoolChoice={Boolean(staffSchools.length)} submitLabel="Create course & add lessons" onSubmit={async (row) => {
          const { data, error } = await supabase.from('courses').insert({ ...row, owner_id: user!.id, status: 'draft', visibility: row.visibility === 'school' && !row.school_id ? 'private' : row.visibility }).select('id').single();
          if (error) throw new Error(error.message);
          await supabase.from('course_instructors').insert({ course_id: data.id, user_id: user!.id, role: 'lead' });
          await supabase.from('course_modules').insert({ course_id: data.id, title: 'Module 1', position: 0 });
          void qc.invalidateQueries({ queryKey: ['managed-courses'] });
          toast.success('Course created', 'Now add your lessons.');
          nav(`/teach/courses/${data.id}?tab=curriculum`);
        }} />
      )}
    </div>
  );
}
