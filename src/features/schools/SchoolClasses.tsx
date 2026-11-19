import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Presentation, Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, Dialog, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, Tabs, Textarea, useToast } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/authentication/AuthProvider';
import { classColor } from '@/features/classroom/LearnerClasses';
import { ClassroomPanel, useRoomMembers } from '@/features/classroom/ClassroomPanel';
import { RollCall } from '@/features/classroom/TeacherClass';
import { useClassInfo } from '@/features/classroom/ClassRoom';
import { useSchoolClasses, useSchoolPeople } from './queries';

export function useAcademicYears(schoolId?: string) {
  return useQuery({ queryKey: ['academic-years', schoolId], enabled: Boolean(schoolId), queryFn: async () => unwrap(await supabase.from('academic_years').select('id, name, starts_on, ends_on, is_current').eq('school_id', schoolId!).order('starts_on', { ascending: false })) });
}

export function SchoolClasses() {
  const { schoolId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const classes = useSchoolClasses(schoolId);
  const years = useAcademicYears(schoolId);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', stream: '', level: '', room_label: '', color: 'blue', academic_year_id: '', description: '' });
  return (
    <div>
      <PageHeader title="Classes & streams" description="Each class gets its own online classroom, roster, register and timetable." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New class</Button>} />
      {classes.isLoading ? <LoadingBlock /> : classes.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{classes.data.map((c) => (
          <Link key={c.id} to={`/school/${schoolId}/classes/${c.id}`} className={cn('card overflow-hidden hover:shadow-[var(--shadow-lift)]', c.is_archived && 'opacity-60')}>
            <div className="board-surface flex h-20 items-end gap-2 p-4 text-white"><span className={cn('h-3 w-3 rounded-full', classColor[c.color])} /><span className="text-lg font-extrabold">{c.name}{c.stream ? ` · ${c.stream}` : ''}</span></div>
            <div className="flex flex-wrap gap-2 p-4 text-sm text-ink-500">{c.level && <Badge>{c.level}</Badge>}{c.room_label && <span>{c.room_label}</span>}{c.is_archived && <Badge>Archived</Badge>}{years.data?.find((y) => y.id === c.academic_year_id)?.name}</div>
          </Link>
        ))}</div>
      ) : <EmptyState icon={<Presentation className="h-7 w-7" />} title="No classes yet" description="Create classes like “SHS 2 Science A”." action={<Button onClick={() => setOpen(true)}>Create class</Button>} />}
      <Dialog open={open} onOpenChange={setOpen} title="New class" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!f.name.trim()} onClick={async () => {
        const { error } = await supabase.from('school_classes').insert({ school_id: schoolId!, name: f.name.trim(), stream: f.stream || null, level: f.level || null, room_label: f.room_label || null, color: f.color, academic_year_id: f.academic_year_id || years.data?.find((y) => y.is_current)?.id || null, description: f.description || null });
        if (error) return toast.error('Could not create class', error.message);
        toast.success('Class created'); setOpen(false); setF({ ...f, name: '', stream: '' }); void qc.invalidateQueries({ queryKey: ['school-classes', schoolId] });
      }}>Create</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. SHS 2 Science" /></Field>
          <Field label="Stream / group"><Input value={f.stream} onChange={(e) => setF({ ...f, stream: e.target.value })} placeholder="e.g. A" /></Field>
          <Field label="Level"><Input value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} placeholder="e.g. SHS 2" /></Field>
          <Field label="Academic year"><Select value={f.academic_year_id} onChange={(e) => setF({ ...f, academic_year_id: e.target.value })}><option value="">Current year</option>{years.data?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
          <Field label="Colour"><Select value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}>{Object.keys(classColor).map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Room" className="sm:col-span-2"><Input value={f.room_label} onChange={(e) => setF({ ...f, room_label: e.target.value })} placeholder="e.g. Block B, Room 4" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
      </Dialog>
    </div>
  );
}

export function SchoolClassPage() {
  const { schoolId, classId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: cls, isLoading } = useClassInfo(classId);
  const members = useRoomMembers('class', classId);
  const teachers = useSchoolPeople(schoolId, 'teacher');
  const students = useSchoolPeople(schoolId, 'student');
  const ct = useQuery({ queryKey: ['class-teachers', classId], queryFn: async () => unwrap(await supabase.from('class_teachers').select('user_id, is_class_teacher, subject').eq('class_id', classId!)) });
  const courses = useQuery({ queryKey: ['class-courses', classId], queryFn: async () => unwrap(await supabase.from('class_courses').select('course:courses(id, title, status)').eq('class_id', classId!)) as unknown as { course: { id: string; title: string; status: string } | null }[] });
  const schoolCourses = useQuery({ queryKey: ['school-course-list', schoolId], queryFn: async () => unwrap(await supabase.from('courses').select('id, title, status').or(`school_id.eq.${schoolId},and(status.eq.published,visibility.eq.public)`).order('title').limit(300)) });
  const [addT, setAddT] = useState({ user: '', subject: '', isCT: false });
  const [addS, setAddS] = useState('');
  const [addC, setAddC] = useState('');
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['class-teachers', classId] }); void qc.invalidateQueries({ queryKey: ['room-members', 'class', classId] }); void qc.invalidateQueries({ queryKey: ['class-courses', classId] }); void qc.invalidateQueries({ queryKey: ['school-people', schoolId] }); };
  const act = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error } = await p; if (error) toast.error('Action failed', error.message); else { toast.success(ok); refresh(); } };
  if (isLoading) return <LoadingBlock />;
  if (!cls) return <EmptyState title="Class not found" />;
  const learnerIds = new Set((members.data ?? []).filter((m) => m.member_role === 'learner').map((m) => m.user_id));
  const teacherIds = new Set((ct.data ?? []).map((t) => t.user_id));
  const assigned = new Set((courses.data ?? []).map((c) => c.course?.id));
  return (
    <div className="space-y-6">
      <PageHeader back={{ to: `/school/${schoolId}/classes`, label: 'Classes' }} title={`${cls.name}${cls.stream ? ` · ${cls.stream}` : ''}`} description={cls.description ?? undefined}
        actions={<Button variant="outline" onClick={() => act(supabase.from('school_classes').update({ is_archived: true }).eq('id', cls.id), 'Class archived')}>Archive class</Button>} />
      <Tabs tabs={[
        { value: 'people', label: 'Teachers & students', content: (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader title="Teachers" /><CardBody className="space-y-3">
              <ul className="divide-y divide-ink-100">{(ct.data ?? []).map((t) => {
                const p = teachers.data?.find((x) => x.user_id === t.user_id);
                return <li key={t.user_id} className="flex items-center gap-3 py-2 text-sm"><Avatar name={p?.full_name} size={28} /><span className="flex-1">{p?.full_name ?? 'Teacher'}{t.subject && <span className="text-ink-500"> · {t.subject}</span>}</span>{t.is_class_teacher && <Badge tone="green">Class teacher</Badge>}<button aria-label="Remove teacher" className="text-ink-400 hover:text-red-600" onClick={() => act(supabase.from('class_teachers').delete().eq('class_id', cls.id).eq('user_id', t.user_id), 'Teacher removed')}><Trash2 className="h-4 w-4" /></button></li>;
              })}</ul>
              <div className="grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-2">
                <Select value={addT.user} onChange={(e) => setAddT({ ...addT, user: e.target.value })} aria-label="Teacher"><option value="">Add teacher…</option>{teachers.data?.filter((t) => !teacherIds.has(t.user_id) && t.status === 'active').map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name}</option>)}</Select>
                <Input value={addT.subject} onChange={(e) => setAddT({ ...addT, subject: e.target.value })} placeholder="Subject (optional)" aria-label="Subject" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addT.isCT} onChange={(e) => setAddT({ ...addT, isCT: e.target.checked })} className="accent-brand-600" />Class teacher</label>
                <Button size="sm" disabled={!addT.user} onClick={() => { void act(supabase.from('class_teachers').insert({ class_id: cls.id, user_id: addT.user, subject: addT.subject || null, is_class_teacher: addT.isCT }), 'Teacher assigned'); setAddT({ user: '', subject: '', isCT: false }); }}>Assign</Button>
              </div>
            </CardBody></Card>
            <Card><CardHeader title={`Students (${learnerIds.size})`} /><CardBody className="space-y-3">
              <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">{(members.data ?? []).filter((m) => m.member_role === 'learner').map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 py-2 text-sm"><Avatar name={m.name} src={m.avatar_url} size={28} /><span className="flex-1">{m.name}</span><button aria-label={`Remove ${m.name}`} className="text-ink-400 hover:text-red-600" onClick={() => act(supabase.from('class_enrolments').update({ status: 'removed' }).eq('class_id', cls.id).eq('user_id', m.user_id), 'Student removed from class')}><Trash2 className="h-4 w-4" /></button></li>
              ))}</ul>
              <div className="flex gap-2 rounded-xl bg-ink-50 p-3">
                <Select value={addS} onChange={(e) => setAddS(e.target.value)} aria-label="Student"><option value="">Add student…</option>{students.data?.filter((s) => !learnerIds.has(s.user_id) && s.status === 'active').map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name}{s.student_number ? ` (${s.student_number})` : ''}</option>)}</Select>
                <Button size="sm" disabled={!addS} onClick={() => { void act(supabase.from('class_enrolments').upsert({ class_id: cls.id, user_id: addS, status: 'active' }, { onConflict: 'class_id,user_id' }), 'Student added'); setAddS(''); }}>Add</Button>
              </div>
            </CardBody></Card>
          </div>
        ) },
        { value: 'courses', label: 'Courses', content: (
          <Card><CardHeader title="Assigned courses" description="Every student in the class is enrolled automatically — including students added later." /><CardBody className="space-y-3">
            <ul className="divide-y divide-ink-100">{(courses.data ?? []).map((c) => c.course && <li key={c.course.id} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1 font-medium">{c.course.title}</span><Badge>{c.course.status}</Badge><button aria-label="Unassign" className="text-ink-400 hover:text-red-600" onClick={() => act(supabase.from('class_courses').delete().eq('class_id', cls.id).eq('course_id', c.course!.id), 'Course unassigned (existing enrolments are kept)')}><Trash2 className="h-4 w-4" /></button></li>)}</ul>
            <div className="flex gap-2"><Select value={addC} onChange={(e) => setAddC(e.target.value)} aria-label="Course"><option value="">Assign course…</option>{schoolCourses.data?.filter((c) => !assigned.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}{c.status !== 'published' ? ` (${c.status})` : ''}</option>)}</Select>
              <Button disabled={!addC} onClick={() => { void act(supabase.from('class_courses').insert({ class_id: cls.id, course_id: addC, assigned_by: user!.id }), 'Course assigned & students enrolled'); setAddC(''); }}>Assign</Button></div>
          </CardBody></Card>
        ) },
        { value: 'register', label: 'Register', content: <RollCall classId={cls.id} /> },
        { value: 'room', label: 'Classroom', content: <ClassroomPanel type="class" roomId={cls.id} canModerate title={cls.name} /> },
      ]} />
    </div>
  );
}
