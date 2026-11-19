import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, BookOpen, CheckCircle2, ChevronDown, Clock, Crown, Eye, Lock, PlayCircle, Target, Users } from 'lucide-react';
import { Alert, Avatar, Badge, Button, ButtonLink, Dialog, EmptyState, ErrorState, LoadingBlock, useToast } from '@/components/ui';
import { CourseCover } from '@/features/courses/CourseCover';
import { levelLabel, useInstructorCards } from '@/features/courses/catalog';
import { useCourse, useCourseOutline, useCourseStats, useEnrol, useMyEnrolment, type OutlineLesson } from '@/features/courses/queries';
import { useAuth } from '@/features/authentication/AuthProvider';
import { BlockRenderer } from '@/features/lessons/BlockRenderer';
import { supabase, unwrap } from '@/lib/supabase';
import { errorMessage, plural } from '@/lib/utils';

export function CourseDetail() {
  const { slug } = useParams();
  const { data: course, isLoading, error, refetch } = useCourse({ slug });
  const { data: outline } = useCourseOutline(course?.id);
  const { data: stats } = useCourseStats(course?.id);
  const { data: inst } = useInstructorCards(course ? [course.id] : []);
  const [preview, setPreview] = useState<OutlineLesson | null>(null);

  if (isLoading) return <div className="container-page py-10"><LoadingBlock rows={4} /></div>;
  if (error) return <div className="container-page py-10"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (!course) return <div className="container-page py-16"><EmptyState icon={<BookOpen className="h-7 w-7" />} title="Course not found" description="It may be unpublished or private." action={<ButtonLink to="/courses">Browse courses</ButtonLink>} /></div>;

  const published = (outline ?? []).filter((m) => m.status === 'published');
  return (
    <div>
      <section className="bg-ink-950 text-white">
        <div className="container-page grid gap-10 py-10 lg:grid-cols-[1.5fr_1fr] lg:py-14">
          <div>
            <nav aria-label="Breadcrumb" className="text-sm text-ink-300"><Link to="/courses" className="hover:text-white">Courses</Link>{course.category && <> / <Link to={`/courses?category=${course.category.slug}`} className="hover:text-white">{course.category.name}</Link></>}</nav>
            <div className="mt-4 flex flex-wrap gap-2">
              {course.is_premium && <Badge tone="amber" icon={<Crown className="h-3 w-3" />}>EduPro course</Badge>}
              {course.school && <Badge tone="navy" className="bg-white/10">{course.school.name}</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-lg text-ink-200">{course.short_description}</p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-300">
              <span className="inline-flex items-center gap-1.5"><BarChart2 className="h-4 w-4" />{levelLabel[course.level]}</span>
              {course.estimated_hours ? <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{course.estimated_hours} hours</span> : null}
              {stats && <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{plural(stats.lessons, 'lesson')}</span>}
              {stats && stats.learners > 0 && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{plural(stats.learners, 'learner')}</span>}
            </div>
            {inst && inst.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-4">
                {inst.map((i) => (
                  <div key={i.user_id} className="flex items-center gap-2.5">
                    <Avatar name={i.name} src={i.avatar_url} size={40} />
                    <div><p className="text-sm font-semibold text-white">{i.name}</p>{i.headline && <p className="text-xs text-ink-300">{i.headline}</p>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <EnrolCard courseId={course.id} isPremium={course.is_premium} method={course.enrolment_method} cover={<CourseCover course={course} />} />
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-10">
          {course.objectives?.length > 0 && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Target className="h-5 w-5 text-brand-600" />What you will learn</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.objectives.map((o) => <li key={o} className="flex gap-2.5 text-ink-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-growth-600" />{o}</li>)}
              </ul>
            </section>
          )}
          {course.description && (
            <section>
              <h2 className="text-xl font-bold">About this course</h2>
              <div className="prose-lesson mt-3 whitespace-pre-wrap">{course.description}</div>
            </section>
          )}
          <section>
            <h2 className="text-xl font-bold">Curriculum</h2>
            <p className="mt-1 text-sm text-ink-500">{plural(published.length, 'module')} · {plural(published.reduce((n, m) => n + m.lessons.filter((l) => l.status === 'published').length, 0), 'lesson')}</p>
            <div className="mt-4 space-y-3">
              {published.map((m, i) => <ModuleRow key={m.id} index={i} title={m.title} lessons={m.lessons.filter((l) => l.status === 'published')} onPreview={setPreview} />)}
              {!published.length && <p className="text-sm text-ink-500">The curriculum is being prepared.</p>}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          {(course.prerequisites_text || course.target_audience) && (
            <div className="card p-6">
              {course.target_audience && <><h2 className="font-bold">Who this course is for</h2><p className="mt-2 text-sm text-ink-600">{course.target_audience}</p></>}
              {course.prerequisites_text && <><h2 className="mt-5 font-bold">Prerequisites</h2><p className="mt-2 text-sm text-ink-600">{course.prerequisites_text}</p></>}
            </div>
          )}
          <div className="card p-6">
            <h2 className="font-bold">How you complete this course</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-growth-600" />Complete {course.completion_lesson_pct}% of lessons</li>
              {course.completion_requires_assessments && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-growth-600" />Pass the course assessments</li>}
              {course.certificate_enabled && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-growth-600" />Receive a verifiable certificate</li>}
            </ul>
          </div>
        </aside>
      </div>
      <PreviewDialog lesson={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function ModuleRow({ index, title, lessons, onPreview }: { index: number; title: string; lessons: OutlineLesson[]; onPreview: (l: OutlineLesson) => void }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span><span className="text-xs font-bold uppercase tracking-wider text-ink-400">Module {index + 1}</span><span className="block font-bold text-ink-900">{title}</span></span>
        <span className="flex items-center gap-3 text-sm text-ink-500">{plural(lessons.length, 'lesson')}<ChevronDown className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} /></span>
      </button>
      {open && (
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {lessons.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              {l.is_preview ? <PlayCircle className="h-4 w-4 shrink-0 text-brand-600" /> : <Lock className="h-4 w-4 shrink-0 text-ink-300" />}
              <span className="flex-1 text-ink-700">{l.title}</span>
              {l.estimated_minutes && <span className="text-xs text-ink-400">{l.estimated_minutes} min</span>}
              {l.is_preview && <button onClick={() => onPreview(l)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Eye className="h-3.5 w-3.5" />Preview</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewDialog({ lesson, onClose }: { lesson: OutlineLesson | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['preview-blocks', lesson?.id],
    enabled: Boolean(lesson),
    queryFn: async () => unwrap(await supabase.from('lesson_blocks').select('type, content').eq('lesson_id', lesson!.id).order('position')),
  });
  return (
    <Dialog open={Boolean(lesson)} onOpenChange={(o) => !o && onClose()} title={lesson?.title ?? ''} description="Free preview lesson" size="lg">
      {isLoading ? <LoadingBlock /> : <BlockRenderer blocks={(data ?? []) as never} />}
    </Dialog>
  );
}

function EnrolCard({ courseId, isPremium, method, cover }: { courseId: string; isPremium: boolean; method: string; cover: React.ReactNode }) {
  const { session, context } = useAuth();
  const { data: enr, isLoading } = useMyEnrolment(courseId);
  const enrol = useEnrol();
  const nav = useNavigate();
  const toast = useToast();
  const premiumLocked = isPremium && !context?.entitlements?.premium_courses?.enabled;
  const active = enr && enr.status !== 'dropped';
  return (
    <div className="overflow-hidden rounded-2xl bg-white text-ink-800 shadow-[var(--shadow-lift)] lg:self-start">
      <div className="aspect-video">{cover}</div>
      <div className="space-y-3 p-5">
        {!session ? (
          <>
            <ButtonLink to={`/register?next=${encodeURIComponent(location.pathname)}`} size="lg" className="w-full">Sign up free to enrol</ButtonLink>
            <ButtonLink to={`/login?next=${encodeURIComponent(location.pathname)}`} variant="outline" className="w-full">I already have an account</ButtonLink>
          </>
        ) : isLoading ? null : active ? (
          <ButtonLink to={`/learn/courses/${courseId}`} size="lg" variant="success" className="w-full">{enr.status === 'completed' ? 'Review course' : 'Continue learning'}</ButtonLink>
        ) : method !== 'open' ? (
          <Alert tone="info">Enrolment for this course is arranged by the instructor or school.</Alert>
        ) : premiumLocked ? (
          <Alert tone="warning" title="EduPro course">This course is part of ProfJero EduPro. <Link to="/pricing" className="font-semibold underline">Learn about EduPro</Link>.</Alert>
        ) : (
          <Button size="lg" className="w-full" loading={enrol.isPending} onClick={() => enrol.mutate(courseId, {
            onSuccess: () => { toast.success('You are enrolled!', 'Welcome to class.'); nav(`/learn/courses/${courseId}`); },
            onError: (e) => toast.error('Could not enrol', errorMessage(e)),
          })}>Enrol for free</Button>
        )}
        <p className="text-center text-xs text-ink-500">Learn at your own pace · Join live classes · Get feedback</p>
      </div>
    </div>
  );
}
