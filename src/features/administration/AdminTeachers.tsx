import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Calendar, ExternalLink, GraduationCap, Mail, MapPin, Phone, Presentation, School } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardBody, Dialog, EmptyState, Field, LoadingBlock, PageHeader, StatusBadge, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { fmtDate, fromNow } from '@/lib/dates';

type App = { id: string; user_id: string; full_name: string; display_name: string | null; email: string; avatar_url: string | null; headline: string | null; bio: string | null;
  country_code: string; joined_at: string; expertise: string; motivation: string; portfolio_url: string | null; phone: string | null; institution: string | null; subjects: string | null;
  teaching_level: string | null; years_experience: number | null; location: string | null; status: string; review_notes: string | null; reviewed_at: string | null; reviewer: string | null;
  created_at: string; courses_owned: number; classes_owned: number };
import { AdminUsersTable } from './AdminTeachersTable';

export function AdminTeachers() {
  const qc = useQueryClient();
  const toast = useToast();
  const apps = useQuery({ queryKey: ['instructor-apps-admin'], queryFn: async () => (unwrap(await supabase.rpc('admin_instructor_applications')) ?? []) as App[] });
  const [review, setReview] = useState<{ id: string; approve: boolean } | null>(null);
  const [notes, setNotes] = useState('');
  const pending = (apps.data ?? []).filter((a) => a.status === 'pending');
  return (
    <div>
      <PageHeader title="Teachers" description="Review independent instructor applications. School teachers are managed by their schools." />
      <Tabs tabs={[
        { value: 'apps', label: 'Applications', count: pending.length, content: apps.isLoading ? <LoadingBlock /> : (apps.data?.length ? (
          <div className="space-y-3">{apps.data.map((a) => (
            <Card key={a.id}><CardBody className="space-y-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={a.full_name} src={a.avatar_url} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold">{a.full_name}{a.display_name && a.display_name !== a.full_name && <span className="text-sm font-medium text-ink-500"> · “{a.display_name}”</span>}</p>
                  {a.headline && <p className="text-sm text-ink-600">{a.headline}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
                    <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"><Mail className="h-3.5 w-3.5" />{a.email}</a>
                    {a.phone && <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="h-3.5 w-3.5" />{a.phone}</a>}
                    {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.location}</span>}
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Member since {fmtDate(a.joined_at)}</span>
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <dl className="grid gap-3 rounded-2xl bg-ink-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="flex items-center gap-1 text-xs font-semibold uppercase text-ink-500"><GraduationCap className="h-3.5 w-3.5" />Teaches</dt><dd className="font-semibold text-ink-900">{a.expertise}</dd></div>
                {a.subjects && <div><dt className="text-xs font-semibold uppercase text-ink-500">Other subjects</dt><dd>{a.subjects}</dd></div>}
                {a.institution && <div><dt className="flex items-center gap-1 text-xs font-semibold uppercase text-ink-500"><School className="h-3.5 w-3.5" />School / institution</dt><dd>{a.institution}</dd></div>}
                {a.teaching_level && <div><dt className="text-xs font-semibold uppercase text-ink-500">Level</dt><dd>{a.teaching_level}</dd></div>}
                {a.years_experience != null && <div><dt className="flex items-center gap-1 text-xs font-semibold uppercase text-ink-500"><Briefcase className="h-3.5 w-3.5" />Experience</dt><dd>{a.years_experience} year{a.years_experience === 1 ? '' : 's'}</dd></div>}
                <div><dt className="text-xs font-semibold uppercase text-ink-500">On ProfJero Edu</dt><dd>{a.classes_owned} class{a.classes_owned === 1 ? '' : 'es'} · {a.courses_owned} course{a.courses_owned === 1 ? '' : 's'}</dd></div>
              </dl>
              <div><p className="text-xs font-semibold uppercase text-ink-500">Why they want to teach</p><p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{a.motivation}</p></div>
              {a.bio && <div><p className="text-xs font-semibold uppercase text-ink-500">Profile bio</p><p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{a.bio}</p></div>}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {a.portfolio_url && <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 underline"><ExternalLink className="h-4 w-4" />Portfolio / website</a>}
                <Badge>Applied {fmtDate(a.created_at)} ({fromNow(a.created_at)})</Badge>
                {a.reviewed_at && <span className="text-ink-500">Reviewed {fmtDate(a.reviewed_at)}{a.reviewer ? ` by ${a.reviewer}` : ''}{a.review_notes ? ` — “${a.review_notes}”` : ''}</span>}
              </div>
              {a.status === 'pending' && <div className="flex gap-2 border-t border-ink-100 pt-3"><Button size="sm" variant="success" onClick={() => { setNotes(''); setReview({ id: a.id, approve: true }); }}>Approve {a.full_name.split(' ')[0]}</Button><Button size="sm" variant="outline" onClick={() => { setNotes(''); setReview({ id: a.id, approve: false }); }}>Decline</Button></div>}
            </CardBody></Card>
          ))}</div>
        ) : <EmptyState icon={<Presentation className="h-7 w-7" />} title="No applications" />) },
        { value: 'list', label: 'Instructors', content: <AdminUsersTable role="teacher" /> },
      ]} />
      <Dialog open={Boolean(review)} onOpenChange={(o) => !o && setReview(null)} title={review?.approve ? 'Approve instructor' : 'Decline application'} size="sm"
        footer={<><Button variant="outline" onClick={() => setReview(null)}>Cancel</Button><Button variant={review?.approve ? 'success' : 'danger'} onClick={async () => {
          const { error } = await supabase.rpc('review_instructor_application', { p_application: review!.id, p_approve: review!.approve, p_notes: (notes || null) as never });
          if (error) return toast.error('Failed', error.message);
          toast.success('Done — applicant notified'); setReview(null); void qc.invalidateQueries({ queryKey: ['instructor-apps-admin'] });
        }}>Confirm</Button></>}>
        <Field label="Note to the applicant (optional)"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Dialog>
    </div>
  );
}
