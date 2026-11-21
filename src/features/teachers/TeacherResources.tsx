import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { safeExternalUrl } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { MediaPicker } from '@/features/media/MediaPicker';
import { useManagedCourses } from './queries';

export function CourseResourcesManager({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('link');
  const { data, isLoading } = useQuery({ queryKey: ['course-resources', courseId], queryFn: async () => unwrap(await supabase.from('course_resources').select('id, title, url, kind, description').eq('course_id', courseId).order('created_at')) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['course-resources', courseId] });
  const add = async () => {
    if (!safeExternalUrl(url) || !url.startsWith('https://')) return toast.error('Invalid link', 'Use a secure https:// link');
    const { error } = await supabase.from('course_resources').insert({ course_id: courseId, title: title.trim(), url, kind, created_by: user!.id });
    if (error) toast.error('Could not add', error.message); else { setTitle(''); setUrl(''); toast.success('Resource added'); refresh(); }
  };
  return (
    <Card>
      <CardHeader title="Course resources" description="Notes, worksheets, slides and links learners can download or open." />
      <CardBody className="space-y-4">
        {isLoading ? <LoadingBlock rows={1} /> : data?.length ? (
          <ul className="divide-y divide-ink-100">{data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm"><Download className="h-4 w-4 text-ink-400" /><a href={safeExternalUrl(r.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-semibold text-brand-700">{r.title}</a><span className="text-xs capitalize text-ink-400">{r.kind}</span>
              <button aria-label={`Remove ${r.title}`} className="text-ink-400 hover:text-red-600" onClick={async () => { await supabase.from('course_resources').delete().eq('id', r.id); refresh(); }}><Trash2 className="h-4 w-4" /></button></li>
          ))}</ul>
        ) : <p className="text-sm text-ink-500">No resources yet.</p>}
        <div className="space-y-3 rounded-xl bg-ink-50 p-4">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 worksheet" /></Field>
          <MediaPicker kind="any" courseId={courseId} value={url} onChange={setUrl} label="Choose a file from your device"
            onUploaded={(r, f) => { if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); setKind(r.resource_type === 'image' ? 'image' : r.resource_type === 'video' ? 'video' : 'document'); }} />
          <details className="text-sm"><summary className="cursor-pointer font-semibold text-ink-600">Or add a web link</summary>
            <div className="mt-2 flex gap-2"><Input value={url} onChange={(e) => { setUrl(e.target.value); setKind('link'); }} placeholder="https://" aria-label="Link" /></div>
          </details>
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} disabled={!title.trim() || !url} onClick={add}>Add resource</Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function TeacherResources() {
  const { data, isLoading } = useManagedCourses();
  const [courseId, setCourseId] = useState('');
  const active = courseId || data?.[0]?.id || '';
  return (
    <div>
      <PageHeader title="Resources" description="Manage downloadable materials for each of your courses." />
      {isLoading ? <LoadingBlock /> : data?.length ? (
        <div className="space-y-4">
          <Select value={active} onChange={(e) => setCourseId(e.target.value)} aria-label="Course" className="max-w-md">{data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
          {active && <CourseResourcesManager courseId={active} />}
        </div>
      ) : <EmptyState title="No courses yet" description="Create a course to attach resources." />}
    </div>
  );
}
