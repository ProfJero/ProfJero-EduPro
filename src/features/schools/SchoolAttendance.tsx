import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { EmptyState, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { RollCall } from '@/features/classroom/TeacherClass';
import { useSchoolClasses } from './queries';
import { useSchoolReport } from './SchoolHome';

export function SchoolAttendance() {
  const { schoolId } = useParams();
  const classes = useSchoolClasses(schoolId);
  const report = useSchoolReport(schoolId);
  const [id, setId] = useState('');
  const active = id || classes.data?.find((c) => !c.is_archived)?.id || '';
  if (classes.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Daily class registers. Live-class attendance is recorded per session by the host." />
      {report.data && (
        <div className="card overflow-x-auto p-4"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-ink-500"><th className="py-2">Class</th><th>Students</th><th>Attendance rate</th></tr></thead>
          <tbody>{report.data.class_summary.map((c) => <tr key={c.class_id} className="border-t border-ink-100"><td className="py-2 font-medium">{c.name}{c.stream ? ` · ${c.stream}` : ''}</td><td>{c.students}</td><td>{c.attendance_rate == null ? 'No records' : `${c.attendance_rate}%`}</td></tr>)}</tbody></table></div>
      )}
      {classes.data?.length ? (
        <>
          <Select value={active} onChange={(e) => setId(e.target.value)} className="max-w-md" aria-label="Class">{classes.data.filter((c) => !c.is_archived).map((c) => <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>)}</Select>
          {active && <RollCall key={active} classId={active} />}
        </>
      ) : <EmptyState icon={<CalendarCheck className="h-7 w-7" />} title="Create classes first" />}
    </div>
  );
}
