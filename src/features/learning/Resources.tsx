import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, CloudOff, Download, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, EmptyState, LoadingBlock, PageHeader, Tabs } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fromNow } from '@/lib/dates';
import { safeExternalUrl } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { listOfflineLessons, removeOfflineLesson } from '@/lib/offline/store';

export function ResourcesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const bookmarks = useQuery({
    queryKey: ['bookmarks', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('bookmarks').select('lesson_id, created_at, lesson:lessons(id, title, course_id, course:courses(title))').eq('user_id', user!.id).order('created_at', { ascending: false })) as unknown as { lesson_id: string; created_at: string; lesson: { id: string; title: string; course_id: string; course: { title: string } | null } | null }[],
  });
  const resources = useQuery({
    queryKey: ['all-resources', user?.id], enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('course_resources').select('id, title, description, url, kind, course:courses(id, title)').order('created_at', { ascending: false }).limit(200)) as unknown as { id: string; title: string; description: string | null; url: string; kind: string; course: { id: string; title: string } | null }[],
  });
  const offline = useQuery({ queryKey: ['offline-list', user?.id], enabled: Boolean(user), queryFn: () => listOfflineLessons(user!.id) });

  return (
    <div>
      <PageHeader title="Resources" description="Your bookmarks, downloadable materials and lessons saved for offline study." />
      <Tabs tabs={[
        { value: 'bookmarks', label: 'Bookmarks', count: bookmarks.data?.length, content: bookmarks.isLoading ? <LoadingBlock /> : bookmarks.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">{bookmarks.data.map((b) => b.lesson && (
            <li key={b.lesson_id}><Link to={`/learn/courses/${b.lesson.course_id}/lessons/${b.lesson.id}`} className="card flex items-center gap-3 p-4 hover:border-brand-300">
              <Bookmark className="h-5 w-5 text-brand-600" /><span className="min-w-0"><span className="block truncate font-semibold">{b.lesson.title}</span><span className="block truncate text-xs text-ink-500">{b.lesson.course?.title} · saved {fromNow(b.created_at)}</span></span>
            </Link></li>
          ))}</ul>
        ) : <EmptyState icon={<Bookmark className="h-6 w-6" />} title="No bookmarks yet" description="Tap “Bookmark” on any lesson to keep it here." /> },
        { value: 'materials', label: 'Course materials', count: resources.data?.length, content: resources.isLoading ? <LoadingBlock /> : resources.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">{resources.data.map((r) => (
            <li key={r.id}><a href={safeExternalUrl(r.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 hover:border-brand-300">
              <Download className="h-5 w-5 text-growth-600" /><span className="min-w-0"><span className="block truncate font-semibold">{r.title}</span><span className="block truncate text-xs text-ink-500">{r.course?.title}</span></span>
            </a></li>
          ))}</ul>
        ) : <EmptyState icon={<Download className="h-6 w-6" />} title="No materials yet" /> },
        { value: 'offline', label: 'Offline lessons', count: offline.data?.length, content: (
          <Card>
            <CardHeader title="Saved on this device" description="Available without internet. Removed automatically when you sign out." />
            <CardBody>
              {offline.data?.length ? (
                <ul className="divide-y divide-ink-100">{offline.data.map((o) => (
                  <li key={o.lessonId} className="flex items-center gap-3 py-3">
                    <Link to={`/learn/courses/${o.courseId}/lessons/${o.lessonId}`} className="min-w-0 flex-1"><span className="block truncate font-semibold">{o.title}</span><span className="text-xs text-ink-500">{o.courseTitle} · saved {fromNow(o.savedAt)}</span></Link>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${o.title}`} onClick={async () => { await removeOfflineLesson(user!.id, o.lessonId); void qc.invalidateQueries({ queryKey: ['offline-list'] }); }}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}</ul>
              ) : <EmptyState icon={<CloudOff className="h-6 w-6" />} title="No offline lessons" description="Open a lesson and choose “Save for offline”." className="border-0" />}
            </CardBody>
          </Card>
        ) },
      ]} />
    </div>
  );
}
