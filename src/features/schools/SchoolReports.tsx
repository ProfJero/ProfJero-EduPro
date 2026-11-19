import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, LoadingBlock, PageHeader, StatCard } from '@/components/ui';
import { downloadCsv } from '@/lib/utils';
import { useSchoolReport } from './SchoolHome';
import { useSchool } from './queries';

export function SchoolReports() {
  const { schoolId } = useParams();
  const { data: school } = useSchool(schoolId);
  const { data, isLoading } = useSchoolReport(schoolId);
  if (isLoading || !data) return <LoadingBlock />;
  const name = school?.name ?? 'school';
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Participation, enrolment, completion, assessment, submission and attendance — for your school only."
        actions={<Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadCsv(`${name}-class-report.csv`, data.class_summary.map((c) => ({ class: `${c.name}${c.stream ? ` ${c.stream}` : ''}`, students: c.students, courses: c.courses, avg_progress_pct: c.avg_progress ?? '', completions: c.completions, avg_assessment_pct: c.avg_score ?? '', attendance_rate_pct: c.attendance_rate ?? '', submission_rate_pct: c.submission_rate ?? '' })))}>Export class report</Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Students" value={data.students} /><StatCard label="Teachers" value={data.teachers} tone="green" />
        <StatCard label="Active learners (30d)" value={data.active_learners_30d} tone="violet" hint={data.students ? `${Math.round((100 * data.active_learners_30d) / data.students)}% participation` : undefined} />
        <StatCard label="Classes" value={data.classes} tone="amber" />
      </div>
      <Card>
        <CardHeader title="Class comparison" />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-ink-500"><th className="py-2">Class</th><th>Students</th><th>Courses</th><th>Avg progress</th><th>Completions</th><th>Avg score</th><th>Attendance</th><th>Submissions</th></tr></thead>
            <tbody>{data.class_summary.map((c) => (
              <tr key={c.class_id} className="border-t border-ink-100"><td className="py-2.5 font-semibold">{c.name}{c.stream ? ` · ${c.stream}` : ''}</td><td>{c.students}</td><td>{c.courses}</td><td><Bar v={c.avg_progress} /></td><td>{c.completions}</td><td><Bar v={c.avg_score} /></td><td><Bar v={c.attendance_rate} /></td><td><Bar v={c.submission_rate} /></td></tr>
            ))}</tbody></table>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Teacher activity (last 30 days)" action={<Button size="sm" variant="ghost" onClick={() => downloadCsv(`${name}-teacher-activity.csv`, data.teacher_activity.map((t) => ({ teacher: t.name, classes: t.classes, live_sessions_30d: t.sessions_30d, grades_given_30d: t.grades_30d })))}>Export</Button>} />
        <CardBody>
          <ul className="divide-y divide-ink-100">{data.teacher_activity.map((t) => <li key={t.user_id} className="flex flex-wrap gap-x-6 py-2.5 text-sm"><span className="min-w-[10rem] flex-1 font-semibold">{t.name}</span><span className="text-ink-500">{t.classes} classes</span><span className="text-ink-500">{t.sessions_30d} live sessions</span><span className="text-ink-500">{t.grades_30d} pieces of work marked</span></li>)}</ul>
          {!data.teacher_activity.length && <p className="text-sm text-ink-500">No teachers yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

function Bar({ v }: { v: number | null }) {
  if (v == null) return <span className="text-ink-400">—</span>;
  return <span className="inline-flex items-center gap-2"><span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100"><span className="block h-full bg-brand-600" style={{ width: `${Math.min(100, v)}%` }} /></span>{Math.round(v)}%</span>;
}
