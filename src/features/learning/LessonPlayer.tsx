import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, CheckCircle2, ChevronLeft, ChevronRight, Circle, CloudDownload, CloudOff, ListTree, Sparkles, Users, X, ClipboardCheck, ClipboardList } from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, EmptyState, LoadingBlock, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn, errorMessage } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { hasFeature } from '@/features/authentication/types';
import { useCourse, useCourseOutline, useMyEnrolment } from '@/features/courses/queries';
import { BlockRenderer } from '@/features/lessons/BlockRenderer';
import { useClassPresence } from '@/features/classroom/usePresence';
import { useOnline } from '@/components/app/ConnectionBanner';
import { getOfflineLesson, queueCompletion, readQueue, removeOfflineLesson, saveLessonOffline } from '@/lib/offline/store';
import { useLessonProgress } from './queries';

export function LessonPlayer() {
  const { courseId, lessonId } = useParams();
  const { user, context } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const online = useOnline();
  const [outlineOpen, setOutlineOpen] = useState(false);
  const { data: course } = useCourse({ id: courseId });
  const { data: outline } = useCourseOutline(courseId);
  const { data: enr } = useMyEnrolment(courseId);
  const { data: progress } = useLessonProgress(courseId);
  const enrolled = Boolean(enr && enr.status !== 'dropped');

  const blocksQ = useQuery({
    queryKey: ['lesson-blocks', lessonId],
    queryFn: async () => {
      try {
        const rows = unwrap(await supabase.from('lesson_blocks').select('type, content').eq('lesson_id', lessonId!).order('position'));
        return { blocks: rows as { type: string; content: Record<string, unknown> }[], offline: false };
      } catch (e) {
        const cached = user ? await getOfflineLesson(user.id, lessonId!) : null;
        if (cached) return { blocks: cached.blocks as { type: string; content: Record<string, unknown> }[], offline: true };
        throw e;
      }
    },
  });
  const savedQ = useQuery({ queryKey: ['offline-saved', lessonId, user?.id], enabled: Boolean(user), queryFn: async () => Boolean(await getOfflineLesson(user!.id, lessonId!)) });
  const bookmarkQ = useQuery({
    queryKey: ['bookmark', lessonId, user?.id], enabled: Boolean(user && enrolled),
    queryFn: async () => Boolean(unwrap(await supabase.from('bookmarks').select('lesson_id').eq('lesson_id', lessonId!).eq('user_id', user!.id).maybeSingle())),
  });

  useEffect(() => {
    if (enrolled && lessonId && online) void supabase.rpc('touch_lesson', { p_lesson: lessonId });
    window.scrollTo({ top: 0 });
  }, [enrolled, lessonId, online]);

  const presence = useClassPresence('course', courseId, { role: 'learner', where: lessonId, enabled: enrolled && online });
  const studyingHere = presence.members.filter((m) => m.where === lessonId && m.user_id !== user?.id);

  const flat = useMemo(() => (outline ?? []).filter((m) => m.status === 'published').flatMap((m) => m.lessons.filter((l) => l.status === 'published').map((l) => ({ ...l, moduleTitle: m.title }))), [outline]);
  const idx = flat.findIndex((l) => l.id === lessonId);
  const lesson = flat[idx];
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  const done = new Set((progress ?? []).filter((p) => p.status === 'completed').map((p) => p.lesson_id));
  const queued = user ? readQueue(user.id).includes(lessonId ?? '') : false;
  const isDone = done.has(lessonId ?? '') || queued;

  const complete = useMutation({
    mutationFn: async () => {
      if (!navigator.onLine) {
        queueCompletion(user!.id, lessonId!);
        return { queued: true };
      }
      return unwrap(await supabase.rpc('complete_lesson', { p_lesson: lessonId! })) as { progress_pct: number; course_status: string };
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['progress', courseId] });
      void qc.invalidateQueries({ queryKey: ['enrolment', courseId] });
      void qc.invalidateQueries({ queryKey: ['my-courses'] });
      if ('queued' in r) toast.info('Saved offline', 'We will sync this lesson when you are back online.');
      else if (r.course_status === 'completed') toast.success('Course complete! 🎉', 'Your certificate is ready in Certificates.');
      else toast.success('Lesson complete', `Course progress: ${Math.round(Number(r.progress_pct))}%`);
    },
    onError: (e) => toast.error('Not completed yet', errorMessage(e)),
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (bookmarkQ.data) unwrap(await supabase.from('bookmarks').delete().eq('lesson_id', lessonId!).eq('user_id', user!.id));
      else unwrap(await supabase.from('bookmarks').insert({ lesson_id: lessonId!, user_id: user!.id }));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bookmark', lessonId] }),
    onError: (e) => toast.error('Bookmark failed', errorMessage(e)),
  });

  const toggleOffline = async () => {
    if (!user || !lesson || !course) return;
    try {
      if (savedQ.data) {
        await removeOfflineLesson(user.id, lesson.id);
        toast.info('Removed from offline lessons');
      } else {
        await saveLessonOffline(user.id, { lessonId: lesson.id, courseId: course.id, courseTitle: course.title, title: lesson.title, savedAt: new Date().toISOString(), blocks: blocksQ.data?.blocks ?? [] });
        toast.success('Saved for offline study', 'Find it under Resources → Offline lessons.');
      }
      void qc.invalidateQueries({ queryKey: ['offline-saved', lessonId] });
    } catch (e) {
      toast.error('Offline save failed', errorMessage(e));
    }
  };

  if (!outline || blocksQ.isLoading) return <LoadingBlock rows={5} />;
  if (!lesson && !blocksQ.data?.offline) return <EmptyState title="Lesson not available" description="It may be unpublished, or you need to enrol first." action={<ButtonLink to={`/learn/courses/${courseId}`}>Back to course</ButtonLink>} />;

  const Outline = (
    <nav aria-label="Course outline" className="space-y-4">
      {(outline ?? []).filter((m) => m.status === 'published').map((m) => (
        <div key={m.id}>
          <p className="px-2 text-xs font-bold uppercase tracking-wider text-ink-400">{m.title}</p>
          <ul className="mt-1 space-y-0.5">
            {m.lessons.filter((l) => l.status === 'published').map((l) => (
              <li key={l.id}>
                <Link to={`/learn/courses/${courseId}/lessons/${l.id}`} onClick={() => setOutlineOpen(false)} aria-current={l.id === lessonId ? 'page' : undefined}
                  className={cn('flex items-start gap-2 rounded-lg px-2 py-2 text-sm', l.id === lessonId ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-600 hover:bg-ink-50')}>
                  {done.has(l.id) ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-growth-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />}
                  <span>{l.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr] xl:grid-cols-[17rem_1fr_15rem]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
          <Link to={`/learn/courses/${courseId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-brand-700"><ChevronLeft className="h-4 w-4" />{course?.title ?? 'Course'}</Link>
          {Outline}
        </div>
      </aside>

      <article className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-2 lg:hidden">
          <Link to={`/learn/courses/${courseId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500"><ChevronLeft className="h-4 w-4" />Course</Link>
          <Button variant="outline" size="sm" leftIcon={<ListTree className="h-4 w-4" />} onClick={() => setOutlineOpen(true)}>Lessons</Button>
        </div>
        {outlineOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-surface p-5 lg:hidden" role="dialog" aria-modal="true" aria-label="Course outline">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{course?.title}</h2><button onClick={() => setOutlineOpen(false)} aria-label="Close" className="rounded-lg p-2 hover:bg-ink-100"><X className="h-5 w-5" /></button></div>
            {Outline}
          </div>
        )}

        {blocksQ.data?.offline && <Alert tone="info" className="mb-4" title="Offline copy">You're viewing a saved copy of this lesson.</Alert>}
        {!enrolled && <Alert tone="warning" className="mb-4">You are previewing this lesson. Enrol in the course to track progress.</Alert>}

        <header className="mb-6">
          <p className="text-sm font-semibold text-brand-600">{lesson?.moduleTitle} · Lesson {idx + 1} of {flat.length}</p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">{lesson?.title}</h1>
          {lesson?.summary && <p className="mt-2 text-lg text-ink-500">{lesson.summary}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {enrolled && <ButtonLink size="sm" variant="ghost" to={`/ai?lesson=${lessonId}`} leftIcon={<Sparkles className="h-4 w-4 text-violet-600" />}>Ask AI about this lesson</ButtonLink>}
            {enrolled && <Button size="sm" variant="ghost" onClick={() => toggleBookmark.mutate()} leftIcon={bookmarkQ.data ? <BookmarkCheck className="h-4 w-4 text-brand-600" /> : <Bookmark className="h-4 w-4" />}>{bookmarkQ.data ? 'Bookmarked' : 'Bookmark'}</Button>}
            {enrolled && hasFeature(context, 'offline_downloads') && <Button size="sm" variant="ghost" onClick={toggleOffline} leftIcon={savedQ.data ? <CloudOff className="h-4 w-4" /> : <CloudDownload className="h-4 w-4" />}>{savedQ.data ? 'Remove offline copy' : 'Save for offline'}</Button>}
            {studyingHere.length > 0 && <Badge tone="green" icon={<Users className="h-3 w-3" />}>{studyingHere.length} classmate{studyingHere.length > 1 ? 's' : ''} studying this now</Badge>}
          </div>
        </header>

        {blocksQ.data?.blocks.length ? <BlockRenderer blocks={blocksQ.data.blocks as never} /> : <p className="text-ink-500">This lesson has no content yet.</p>}

        {enrolled && lesson && (
          <section className="mt-10 rounded-2xl border border-ink-200 bg-surface p-5" aria-label="Lesson completion">
            {isDone ? (
              <p className="flex items-center gap-2 font-semibold text-growth-700"><CheckCircle2 className="h-5 w-5" />{queued ? 'Completed offline — will sync when online' : 'You completed this lesson'}</p>
            ) : lesson.completion_rule === 'quiz_pass' ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-600"><ClipboardCheck className="mr-1 inline h-4 w-4 text-brand-600" />Pass the lesson quiz to complete this lesson.</p>
                <div className="flex gap-2">
                  {lesson.quiz_assessment_id && <ButtonLink size="sm" to={`/learn/assessments/${lesson.quiz_assessment_id}`} variant="secondary">Take quiz</ButtonLink>}
                  <Button size="sm" loading={complete.isPending} onClick={() => complete.mutate()}>I've passed — check</Button>
                </div>
              </div>
            ) : lesson.completion_rule === 'assignment_submit' ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-600"><ClipboardList className="mr-1 inline h-4 w-4 text-sun-500" />Submit the lesson assignment to complete this lesson.</p>
                <div className="flex gap-2">
                  {lesson.assignment_id && <ButtonLink size="sm" to={`/learn/assignments/${lesson.assignment_id}`} variant="secondary">Open assignment</ButtonLink>}
                  <Button size="sm" loading={complete.isPending} onClick={() => complete.mutate()}>I've submitted — check</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-600">Finished working through this lesson and its activities?</p>
                <Button variant="success" loading={complete.isPending} onClick={() => complete.mutate()} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Mark lesson complete</Button>
              </div>
            )}
          </section>
        )}

        <nav className="mt-8 flex items-center justify-between gap-3 border-t border-ink-200 pt-6" aria-label="Lesson navigation">
          {prev ? <ButtonLink variant="outline" to={`/learn/courses/${courseId}/lessons/${prev.id}`} leftIcon={<ChevronLeft className="h-4 w-4" />}><span className="hidden sm:inline">{prev.title}</span><span className="sm:hidden">Previous</span></ButtonLink> : <span />}
          {next ? <ButtonLink to={`/learn/courses/${courseId}/lessons/${next.id}`}><span className="hidden sm:inline">{next.title}</span><span className="sm:hidden">Next</span><ChevronRight className="h-4 w-4" /></ButtonLink>
            : <ButtonLink to={`/learn/courses/${courseId}`} variant="secondary">Back to course</ButtonLink>}
        </nav>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-20 space-y-4">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Studying now</p>
            {presence.members.length ? (
              <ul className="mt-3 space-y-2">
                {presence.members.slice(0, 8).map((m) => (
                  <li key={m.user_id} className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-growth-500" /><span className="truncate">{m.user_id === user?.id ? 'You' : m.name}</span>{m.where === lessonId && m.user_id !== user?.id && <span className="text-xs text-ink-400">· this lesson</span>}</li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-500">Classmates who are studying will appear here.</p>}
            <Link to={`/learn/courses/${courseId}`} className="mt-3 inline-block text-sm font-semibold text-brand-700">Ask the class a question →</Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
