import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { FileUp, MailPlus, MoreVertical, UserPlus, Users, Download } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CardBody, DataTable, Dialog, EmptyState, Field, Input, LoadingBlock, Menu, MenuContent, MenuItem, MenuTrigger, PageHeader, Select, StatusBadge, Tabs, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/dates';
import { downloadCsv, errorMessage } from '@/lib/utils';
import { useInvitations, useSchoolClasses, useSchoolPeople, type Person } from './queries';

export function SchoolStudents() {
  return <PeoplePage role="student" title="Students" description="Add students individually, import a class list from CSV, and manage class membership." />;
}
export function SchoolTeachers() {
  return <PeoplePage role="teacher" title="Teachers" description="Invite teachers by email and assign them to classes. Teachers only see the classes they're assigned to." />;
}

function PeoplePage({ role, title, description }: { role: 'student' | 'teacher'; title: string; description: string }) {
  const { schoolId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const people = useSchoolPeople(schoolId, role);
  const admins = useSchoolPeople(schoolId, 'school_admin');
  const invites = useInvitations(schoolId);
  const classes = useSchoolClasses(schoolId);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [placing, setPlacing] = useState<Person | null>(null);
  const [q, setQ] = useState('');
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['school-people', schoolId] }); void qc.invalidateQueries({ queryKey: ['school-invitations', schoolId] }); void qc.invalidateQueries({ queryKey: ['school-report', schoolId] }); };
  const setStatus = async (p: Person, status: 'active' | 'suspended' | 'removed') => {
    const { error } = await supabase.from('school_memberships').update({ status }).eq('id', p.membership_id);
    if (error) toast.error('Could not update', error.message); else { toast.success(`Membership ${status}`); refresh(); }
  };
  const rows = (people.data ?? []).filter((p) => `${p.full_name} ${p.email ?? ''} ${p.student_number ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const roleInvites = (invites.data ?? []).filter((i) => i.role === role);
  return (
    <div>
      <PageHeader title={title} description={description} actions={<>
        {role === 'student' && <Button variant="outline" leftIcon={<FileUp className="h-4 w-4" />} onClick={() => setImporting(true)}>Import CSV</Button>}
        <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>{role === 'student' ? 'Add student' : 'Invite teacher'}</Button>
      </>} />
      <Tabs tabs={[
        { value: 'members', label: title, count: people.data?.length, content: (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or number" aria-label="Search" className="max-w-sm" /><span className="flex-1" />
              <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />} disabled={!rows.length} onClick={() => downloadCsv(`${role}s.csv`, rows.map((p) => ({ name: p.full_name, email: p.email ?? '', student_number: p.student_number ?? '', classes: p.classes.join('; '), status: p.status, joined: p.joined_at })))}>Export</Button></div>
            {people.isLoading ? <LoadingBlock /> : (
              <DataTable rows={rows} rowKey={(r) => r.membership_id} empty={<EmptyState icon={<Users className="h-7 w-7" />} title={`No ${role}s yet`} action={<Button onClick={() => setAdding(true)}>{role === 'student' ? 'Add a student' : 'Invite a teacher'}</Button>} />} columns={[
                { key: 'n', header: 'Name', primary: true, cell: (r) => <span className="inline-flex items-center gap-2"><Avatar name={r.full_name} src={r.avatar_url} size={28} />{r.full_name || '—'}</span> },
                { key: 'e', header: 'Email', cell: (r) => <span className="text-ink-600">{r.email}</span> },
                ...(role === 'student' ? [{ key: 'sn', header: 'Student no.', cell: (r: Person) => r.student_number ?? '—' }] : []),
                { key: 'c', header: 'Classes', cell: (r) => r.classes.length ? r.classes.join(', ') : <span className="text-ink-400">None</span> },
                { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
                { key: 'x', header: '', cell: (r) => (
                  <Menu>
                    <MenuTrigger className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${r.full_name}`}><MoreVertical className="h-4 w-4" /></MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setPlacing(r)}>Assign to class</MenuItem>
                      {r.status === 'active' ? <MenuItem onSelect={() => setStatus(r, 'suspended')}>Suspend membership</MenuItem> : <MenuItem onSelect={() => setStatus(r, 'active')}>Reactivate</MenuItem>}
                      <MenuItem danger onSelect={() => setStatus(r, 'removed')}>Remove from school</MenuItem>
                    </MenuContent>
                  </Menu>
                ) },
              ]} />
            )}
          </div>
        ) },
        { value: 'invites', label: 'Pending invitations', count: roleInvites.length, content: (
          <DataTable rows={roleInvites} rowKey={(r) => r.id} empty={<EmptyState icon={<MailPlus className="h-6 w-6" />} title="No pending invitations" description="People without an account get an invitation they accept after signing up with the same email." />} columns={[
            { key: 'e', header: 'Email', primary: true, cell: (r) => r.email },
            { key: 'n', header: 'Name', cell: (r) => r.full_name ?? '—' },
            { key: 'd', header: 'Expires', cell: (r) => fmtDate(r.expires_at) },
            { key: 'x', header: '', cell: (r) => <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('school_invitations').update({ status: 'revoked' }).eq('id', r.id); refresh(); }}>Revoke</Button> },
          ]} />
        ) },
        ...(role === 'teacher' ? [{ value: 'admins', label: 'Administrators', count: admins.data?.length, content: (
          <Card><CardBody><ul className="divide-y divide-ink-100">{(admins.data ?? []).map((a) => <li key={a.membership_id} className="flex items-center gap-3 py-2.5 text-sm"><Avatar name={a.full_name} size={28} /><span className="flex-1 font-medium">{a.full_name}</span><span className="text-ink-500">{a.email}</span></li>)}</ul>
            <p className="mt-3 text-xs text-ink-500">To add another administrator, use “Invite teacher” and choose the administrator role.</p></CardBody></Card>
        ) }] : []),
      ]} />
      <AddPersonDialog open={adding} onOpenChange={setAdding} schoolId={schoolId!} role={role} classes={classes.data ?? []} onDone={refresh} />
      {role === 'student' && <ImportDialog open={importing} onOpenChange={setImporting} schoolId={schoolId!} classes={classes.data ?? []} onDone={refresh} />}
      <PlaceDialog person={placing} role={role} classes={classes.data ?? []} onClose={() => { setPlacing(null); refresh(); }} />
    </div>
  );
}

function AddPersonDialog({ open, onOpenChange, schoolId, role, classes, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; schoolId: string; role: 'student' | 'teacher'; classes: { id: string; name: string; stream: string | null }[]; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ email: '', name: '', number: '', classId: '', asRole: role as string });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={role === 'student' ? 'Add a student' : 'Invite a teacher'}
      description="If they already have a ProfJero Edu account with this email they're added straight away; otherwise they receive an invitation to accept after signing up."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={busy} disabled={!f.email.includes('@')} onClick={async () => {
        setBusy(true);
        const { data, error } = await supabase.rpc('add_school_member', { p_school: schoolId, p_email: f.email, p_full_name: f.name || null as never, p_role: f.asRole as 'student', p_class: (f.classId || null) as never, p_student_number: (f.number || null) as never });
        setBusy(false);
        if (error) return toast.error('Could not add', errorMessage(error));
        toast.success(data === 'added' ? 'Added to the school' : 'Invitation created', data === 'invited' ? 'They will see it after signing up with this email.' : undefined);
        setF({ email: '', name: '', number: '', classId: '', asRole: role });
        onDone();
        onOpenChange(false);
      }}>{role === 'student' ? 'Add student' : 'Send invitation'}</Button></>}>
      <div className="space-y-4">
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Full name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {role === 'student' && <Field label="Student number (optional)"><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>}
        {role === 'teacher' && <Field label="Role"><Select value={f.asRole} onChange={(e) => setF({ ...f, asRole: e.target.value })}><option value="teacher">Teacher</option><option value="school_admin">School administrator</option></Select></Field>}
        <Field label={role === 'student' ? 'Class' : 'Assign to class (optional)'}><Select value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}><option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>)}</Select></Field>
      </div>
    </Dialog>
  );
}

type Report = { row: number; email: string; status: 'added' | 'invited' | 'error'; message?: string };

function ImportDialog({ open, onOpenChange, schoolId, classes, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; schoolId: string; classes: { id: string; name: string; stream: string | null }[]; onDone: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<{ email: string; full_name: string; student_number: string }[]>([]);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [classId, setClassId] = useState('');
  const [report, setReport] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState(false);
  const reset = () => { setRows([]); setReport(null); setParseErr(null); };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }} title="Import students from CSV" size="lg">
      {report ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2"><Badge tone="green">{report.filter((r) => r.status === 'added').length} added</Badge><Badge tone="brand">{report.filter((r) => r.status === 'invited').length} invited</Badge><Badge tone="red">{report.filter((r) => r.status === 'error').length} errors</Badge></div>
          {report.some((r) => r.status === 'error') && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-red-200"><table className="w-full text-sm"><thead className="bg-red-50 text-left"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Problem</th></tr></thead>
              <tbody>{report.filter((r) => r.status === 'error').map((r) => <tr key={r.row} className="border-t border-red-100"><td className="px-3 py-1.5">{r.row + 1}</td><td className="px-3 py-1.5">{r.email || '—'}</td><td className="px-3 py-1.5 text-red-700">{r.message}</td></tr>)}</tbody></table></div>
          )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => downloadCsv('import-report.csv', report.map((r) => ({ row: r.row + 1, email: r.email, status: r.status, message: r.message ?? '' })))}>Download report</Button><Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert tone="info">Use a CSV with a header row: <code>email,full_name,student_number</code>. Up to 1,000 rows per import. Existing accounts are added directly — no duplicates are created; others receive invitations.</Alert>
          <Button variant="ghost" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadCsv('students-template.csv', [{ email: 'student@example.com', full_name: 'Ama Owusu', student_number: 'SHS2-001' }])}>Download template</Button>
          <input type="file" accept=".csv,text/csv" aria-label="CSV file" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setParseErr(null);
              Papa.parse<Record<string, string>>(file, {
                header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
                complete: (res) => {
                  if (!res.meta.fields?.includes('email')) return setParseErr('The file needs an "email" column.');
                  if (res.data.length > 1000) return setParseErr('Please split the file — up to 1,000 rows per import.');
                  setRows(res.data.map((r) => ({ email: (r.email ?? '').trim(), full_name: (r.full_name ?? r.name ?? '').trim(), student_number: (r.student_number ?? '').trim() })));
                },
                error: (err) => setParseErr(err.message),
              });
            }} />
          {parseErr && <Alert tone="error">{parseErr}</Alert>}
          {rows.length > 0 && <p className="text-sm text-ink-600">{rows.length} row(s) ready. Preview: {rows.slice(0, 3).map((r) => r.email).join(', ')}{rows.length > 3 && '…'}</p>}
          <Field label="Place everyone in class (optional)"><Select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>)}</Select></Field>
          <div className="flex justify-end"><Button loading={busy} disabled={!rows.length} onClick={async () => {
            setBusy(true);
            const { data, error } = await supabase.rpc('import_students', { p_school: schoolId, p_class: (classId || null) as never, p_rows: rows as never });
            setBusy(false);
            if (error) return toast.error('Import failed', errorMessage(error));
            setReport(data as unknown as Report[]);
            onDone();
          }}>Import {rows.length || ''} students</Button></div>
        </div>
      )}
    </Dialog>
  );
}

function PlaceDialog({ person, role, classes, onClose }: { person: Person | null; role: 'student' | 'teacher'; classes: { id: string; name: string; stream: string | null }[]; onClose: () => void }) {
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [isCT, setIsCT] = useState(false);
  return (
    <Dialog open={Boolean(person)} onOpenChange={(o) => !o && onClose()} title={`Assign ${person?.full_name ?? ''} to a class`} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!classId} onClick={async () => {
        const res = role === 'student'
          ? await supabase.from('class_enrolments').upsert({ class_id: classId, user_id: person!.user_id, status: 'active' }, { onConflict: 'class_id,user_id' })
          : await supabase.from('class_teachers').upsert({ class_id: classId, user_id: person!.user_id, is_class_teacher: isCT }, { onConflict: 'class_id,user_id' });
        if (res.error) toast.error('Could not assign', res.error.message); else { toast.success('Assigned'); onClose(); }
      }}>Assign</Button></>}>
      <div className="space-y-4">
        <Field label="Class"><Select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Choose…</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''}</option>)}</Select></Field>
        {role === 'teacher' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isCT} onChange={(e) => setIsCT(e.target.checked)} className="accent-brand-600" />Class teacher (form master/mistress)</label>}
        {person && person.classes.length > 0 && <p className="text-xs text-ink-500">Currently in: {person.classes.join(', ')}</p>}
      </div>
    </Dialog>
  );
}
