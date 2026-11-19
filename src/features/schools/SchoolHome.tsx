import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, GraduationCap, MailPlus, Presentation, Upload, Users } from 'lucide-react';
import { Alert, ButtonLink, Card, CardBody, CardHeader, LoadingBlock, PageHeader, StatCard } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { useSchool } from './queries';

export type SchoolReport = {
  students: number; teachers: number; pending_invitations: number; classes: number; active_learners_30d: number;
  class_summary: { class_id: string; name: string; stream: string | null; students: number; courses: number; avg_progress: number | null; completions: number; avg_score: number | null; attendance_rate: number | null; submission_rate: number | null }[];
  teacher_activity: { user_id: string; name: string; classes: number; sessions_30d: number; grades_30d: number }[];
};
export function useSchoolReport(schoolId?: string) {
  return useQuery({ queryKey: ['school-report', schoolId], enabled: Boolean(schoolId), queryFn: async () => unwrap(await supabase.rpc('school_report', { p_school: schoolId! })) as unknown as SchoolReport });
}

export function SchoolHome() {
  const { schoolId } = useParams();
  const school = useSchool(schoolId);
  const r = useSchoolReport(schoolId);
  const base = `/school/${schoolId}`;
  if (school.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="School workspace" title={school.data?.name ?? 'School'} description="A private space for your institution. Only your school's members can see its records." />
      {school.data?.status !== 'approved' && <Alert tone="warning" title={`School status: ${school.data?.status}`}>Some features are unavailable until the school is approved.</Alert>}
      {r.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Students" value={r.data.students} icon={<GraduationCap className="h-5 w-5" />} to={`${base}/students`} />
          <StatCard label="Teachers" value={r.data.teachers} icon={<Users className="h-5 w-5" />} tone="green" to={`${base}/teachers`} />
          <StatCard label="Classes" value={r.data.classes} icon={<Presentation className="h-5 w-5" />} tone="amber" to={`${base}/classes`} />
          <StatCard label="Active learners (30d)" value={r.data.active_learners_30d} icon={<Activity className="h-5 w-5" />} tone="violet" />
          <StatCard label="Pending invites" value={r.data.pending_invitations} icon={<MailPlus className="h-5 w-5" />} tone="navy" to={`${base}/students`} />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { to: `${base}/academic`, title: '1. Academic structure', text: 'Create the academic year and terms.' },
          { to: `${base}/classes`, title: '2. Classes & streams', text: 'Set up classes and assign class teachers.' },
          { to: `${base}/teachers`, title: '3. Invite teachers', text: 'Teachers join by email invitation.' },
          { to: `${base}/students`, title: '4. Add students', text: 'Add one by one or import a CSV.' },
          { to: `${base}/courses`, title: '5. Assign courses', text: 'Assign courses to classes — students are enrolled automatically.' },
          { to: `${base}/reports`, title: '6. Track progress', text: 'Attendance, performance and completion reports.' },
        ].map((s) => <Link key={s.to} to={s.to} className="card p-5 hover:border-brand-300"><p className="font-bold text-ink-900">{s.title}</p><p className="mt-1 text-sm text-ink-500">{s.text}</p></Link>)}
      </div>
      {r.isLoading ? <LoadingBlock /> : r.data && (
        <Card>
          <CardHeader title="Classes at a glance" action={<ButtonLink to={`${base}/reports`} variant="outline" size="sm" leftIcon={<BarChart3 className="h-4 w-4" />}>Full reports</ButtonLink>} />
          <CardBody>
            {r.data.class_summary.length ? (
              <ul className="divide-y divide-ink-100">{r.data.class_summary.map((c) => (
                <li key={c.class_id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3 text-sm">
                  <Link to={`${base}/classes/${c.class_id}`} className="min-w-[10rem] flex-1 font-semibold hover:text-brand-700">{c.name}{c.stream ? ` · ${c.stream}` : ''}</Link>
                  <span className="text-ink-500">{c.students} students</span><span className="text-ink-500">{c.courses} courses</span>
                  <span className="text-ink-500">progress {c.avg_progress ?? '—'}%</span><span className="text-ink-500">attendance {c.attendance_rate ?? '—'}%</span>
                </li>
              ))}</ul>
            ) : <p className="text-sm text-ink-500">No classes yet. <Link to={`${base}/classes`} className="font-semibold text-brand-700">Create your first class</Link>. <Upload className="hidden" /></p>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
