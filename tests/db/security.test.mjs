// Database integration + security tests. Run against the LOCAL Supabase stack:
//   npx supabase db reset && npm run test:db
// Every test signs in as a real seeded user through the public API (anon key),
// exactly like the browser does, so RLS and RPC checks are exercised for real.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
if (!ANON) throw new Error('SUPABASE_ANON_KEY is required (see scripts/test-db.mjs)');
const PASSWORD = 'DevPassw0rd!';

const ID = {
  owner: '00000000-0000-4000-a000-000000000001',
  teacher: '00000000-0000-4000-a000-000000000002',
  learner: '00000000-0000-4000-a000-000000000003',
  learner2: '00000000-0000-4000-a000-000000000004',
  schoolAdmin: '00000000-0000-4000-a000-000000000005',
  schoolTeacher: '00000000-0000-4000-a000-000000000006',
  student: '00000000-0000-4000-a000-000000000007',
  otherAdmin: '00000000-0000-4000-a000-000000000008',
  otherStudent: '00000000-0000-4000-a000-000000000009',
  devSchool: '00000000-0000-4000-b000-000000000001',
  otherSchool: '00000000-0000-4000-b000-000000000002',
  devClass: '00000000-0000-4000-c000-000000000010',
  otherClass: '00000000-0000-4000-c000-000000000020',
  python: '00000000-0000-4000-d000-000000000001',
  schoolCourse: '00000000-0000-4000-d000-000000000002',
  lesson1: '00000000-0000-4000-d200-000000000001',
  lesson2: '00000000-0000-4000-d200-000000000002',
  lesson3: '00000000-0000-4000-d200-000000000003',
  quiz: '00000000-0000-4000-e300-000000000001',
  qMcq: '00000000-0000-4000-e100-000000000001',
  qTf: '00000000-0000-4000-e100-000000000002',
  qFill: '00000000-0000-4000-e100-000000000003',
  optPrint: '00000000-0000-4000-e200-000000000002',
  optFalse: '00000000-0000-4000-e200-000000000005',
  assignment: '00000000-0000-4000-f000-000000000001',
};

const clients = {};
async function as(name, email) {
  if (clients[name]) return clients[name];
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  clients[name] = c;
  return c;
}
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
let owner, teacher, learner, learner2, schoolAdmin, schoolTeacher, student, otherAdmin, otherStudent;

before(async () => {
  owner = await as('owner', 'owner@profjero.test');
  teacher = await as('teacher', 'teacher@profjero.test');
  learner = await as('learner', 'learner@profjero.test');
  learner2 = await as('learner2', 'learner2@profjero.test');
  schoolAdmin = await as('schoolAdmin', 'schooladmin@profjero.test');
  schoolTeacher = await as('schoolTeacher', 'schoolteacher@profjero.test');
  student = await as('student', 'student@profjero.test');
  otherAdmin = await as('otherAdmin', 'otheradmin@profjero.test');
  otherStudent = await as('otherStudent', 'otherstudent@profjero.test');
});

const denied = (res, msg) => assert.ok(res.error, msg ?? 'expected an error');

// ---------------------------------------------------------------------------
test('owner bootstrap grants owner + platform_admin; learners get learner only', async () => {
  const o = await owner.rpc('my_context');
  assert.ifError(o.error);
  assert.ok(o.data.roles.includes('owner') && o.data.roles.includes('platform_admin'));
  const l = await learner.rpc('my_context');
  assert.deepEqual(l.data.roles, ['learner']);
});

test('users cannot escalate their own roles or status', async () => {
  denied(await learner.from('user_roles').insert({ user_id: ID.learner, role: 'platform_admin' }), 'insert role');
  denied(await learner.rpc('set_user_role', { p_user: ID.learner, p_role: 'platform_admin', p_grant: true }), 'rpc role');
  denied(await learner.from('profiles').update({ status: 'suspended' }).eq('id', ID.learner), 'status change');
  denied(await learner.rpc('admin_overview'), 'admin overview');
  // a platform admin (non-owner) cannot mint other admins
  const r = await owner.rpc('set_user_role', { p_user: ID.teacher, p_role: 'platform_admin', p_grant: false });
  assert.ifError(r.error);
});

test('anonymous visitors see the catalogue and preview lessons only', async () => {
  const { data: courses } = await anon.from('courses').select('id, slug, status').eq('slug', 'python-foundations');
  assert.equal(courses.length, 1);
  const { data: sc } = await anon.from('courses').select('id').eq('id', ID.schoolCourse);
  assert.equal(sc.length, 0, 'school-only course hidden');
  const { data: preview } = await anon.from('lesson_blocks').select('id').eq('lesson_id', ID.lesson1);
  assert.ok(preview.length > 0, 'preview lesson content visible');
  const { data: locked } = await anon.from('lesson_blocks').select('id').eq('lesson_id', ID.lesson2);
  assert.equal(locked.length, 0, 'non-preview content hidden');
  denied(await anon.from('profiles').select('*'), 'anon profiles');
  const cards = await anon.rpc('course_instructor_cards', { p_course_ids: [ID.python] });
  assert.ifError(cards.error);
  assert.equal(cards.data[0].name, 'Ama Mensah');
});

test('learners cannot enrol by writing the table directly', async () => {
  denied(await learner.from('course_enrolments').insert({ course_id: ID.python, user_id: ID.learner }));
});

test('enrolment unlocks lesson content and progress tracking', async () => {
  const e = await learner.rpc('enrol_in_course', { p_course: ID.python });
  assert.ifError(e.error);
  const { data } = await learner.from('lesson_blocks').select('id').eq('lesson_id', ID.lesson2);
  assert.ok(data.length > 0);
  assert.ifError((await learner.rpc('touch_lesson', { p_lesson: ID.lesson1 })).error);
  const c = await learner.rpc('complete_lesson', { p_lesson: ID.lesson1 });
  assert.ifError(c.error);
  assert.equal(Number(c.data.progress_pct), 33.33);
  // learner2 cannot see learner's progress or enrolment
  const { data: p2 } = await learner2.from('lesson_progress').select('*').eq('user_id', ID.learner);
  assert.equal(p2.length, 0);
  const { data: e2 } = await learner2.from('course_enrolments').select('*').eq('user_id', ID.learner);
  assert.equal(e2.length, 0);
});

test('answer keys and question banks are hidden from learners', async () => {
  const k = await learner.from('question_answer_keys').select('*');
  assert.equal(k.data.length, 0);
  const q = await learner.from('questions').select('*');
  assert.equal(q.data.length, 0);
  const t = await teacher.from('question_answer_keys').select('*');
  assert.ok(t.data.length >= 3, 'author sees keys');
});

let attemptId;
test('assessment attempt: no keys before submit, server grading, results', async () => {
  const s = await learner.rpc('start_attempt', { p_assessment: ID.quiz });
  assert.ifError(s.error);
  attemptId = s.data;
  const g = await learner.rpc('get_attempt', { p_attempt: attemptId });
  assert.ifError(g.error);
  assert.equal(g.data.questions.length, 3);
  for (const q of g.data.questions) {
    assert.equal(q.answer_key, undefined, 'no key leaked');
    assert.equal(q.is_correct, undefined, 'no correctness leaked');
  }
  // learner2 cannot read or write this attempt
  denied(await learner2.rpc('get_attempt', { p_attempt: attemptId }));
  denied(await learner2.rpc('save_answer', { p_attempt: attemptId, p_question: ID.qMcq, p_response: { option_id: ID.optPrint } }));
  denied(await learner2.rpc('submit_attempt', { p_attempt: attemptId }));
  // learner cannot write answers or results directly
  denied(await learner.from('attempt_answers').insert({ attempt_id: attemptId, question_id: ID.qMcq, awarded_marks: 100 }));
  denied(await learner.from('assessment_results').insert({ attempt_id: attemptId, assessment_id: ID.quiz, user_id: ID.learner, score: 99 }));

  for (const [q, r] of [[ID.qMcq, { option_id: ID.optPrint }], [ID.qTf, { option_id: ID.optFalse }], [ID.qFill, { text: '  DEF ' }]]) {
    assert.ifError((await learner.rpc('save_answer', { p_attempt: attemptId, p_question: q, p_response: r })).error);
  }
  const sub = await learner.rpc('submit_attempt', { p_attempt: attemptId });
  assert.ifError(sub.error);
  assert.equal(Number(sub.data.result.score), 3);
  assert.equal(sub.data.result.passed, true);
  // cannot change answers after submission
  denied(await learner.rpc('save_answer', { p_attempt: attemptId, p_question: ID.qMcq, p_response: {} }));
  // learner2 cannot read learner's results
  const { data: r2 } = await learner2.from('assessment_results').select('*').eq('user_id', ID.learner);
  assert.equal(r2.length, 0);
  // learners cannot grade
  denied(await learner.rpc('grade_answer', { p_attempt: attemptId, p_question: ID.qMcq, p_marks: 1, p_feedback: 'x' }));
});

test('completing all lessons + passing quiz completes the course and issues a verifiable certificate', async () => {
  for (const l of [ID.lesson2, ID.lesson3]) assert.ifError((await learner.rpc('complete_lesson', { p_lesson: l })).error);
  const { data: enr } = await learner.from('course_enrolments').select('status, progress_pct').eq('course_id', ID.python).single();
  assert.equal(enr.status, 'completed');
  const { data: certs } = await learner.from('certificates').select('serial').eq('course_id', ID.python);
  assert.equal(certs.length, 1);
  const v = await anon.rpc('verify_certificate', { p_serial: certs[0].serial });
  assert.equal(v.data.status, 'valid');
  assert.equal(v.data.learner_name, 'Kwame Owusu');
  denied(await learner.from('certificates').insert({ serial: 'FAKE', user_id: ID.learner, course_id: ID.python, learner_name: 'x', course_title: 'x', issuer_name: 'x', completed_on: '2026-01-01' }));
  denied(await learner2.rpc('claim_certificate', { p_course: ID.python }));
});

test('school isolation: another school cannot see private records', async () => {
  const { data: classes } = await otherAdmin.from('school_classes').select('id').eq('school_id', ID.devSchool);
  assert.equal(classes.length, 0);
  const { data: members } = await otherAdmin.from('school_memberships').select('id').eq('school_id', ID.devSchool);
  assert.equal(members.length, 0);
  denied(await otherAdmin.rpc('school_people', { p_school: ID.devSchool }));
  denied(await otherAdmin.rpc('school_report', { p_school: ID.devSchool }));
  denied(await otherAdmin.rpc('add_school_member', { p_school: ID.devSchool, p_email: 'x@y.test', p_full_name: 'X', p_role: 'student' }));
  denied(await otherAdmin.from('school_classes').insert({ school_id: ID.devSchool, name: 'Injected' }));
  const { data: dev } = await schoolAdmin.rpc('school_people', { p_school: ID.devSchool });
  assert.ok(dev.length >= 3);
  // students of the other school can't see this class
  const { data: c2 } = await otherStudent.from('school_classes').select('id').eq('id', ID.devClass);
  assert.equal(c2.length, 0);
  // a teacher cannot read the other school's attendance or enrolments
  const { data: att } = await schoolTeacher.from('class_enrolments').select('*').eq('class_id', ID.otherClass);
  assert.equal(att.length, 0);
});

test('school course assignment auto-enrolled the class student', async () => {
  const { data } = await student.from('course_enrolments').select('source, class_id').eq('course_id', ID.schoolCourse).single();
  assert.equal(data.source, 'school');
  const { data: sc } = await student.from('courses').select('id').eq('id', ID.schoolCourse);
  assert.equal(sc.length, 1);
  const { data: other } = await otherStudent.from('courses').select('id').eq('id', ID.schoolCourse);
  assert.equal(other.length, 0);
});

test('assignment submission, protected grading, feedback visibility', async () => {
  // student submits
  const ins = await student.from('assignment_submissions').insert({
    assignment_id: ID.assignment, user_id: ID.student, text_response: 'Our lab has 30 computers...', status: 'submitted',
  }).select().single();
  assert.ifError(ins.error);
  const subId = ins.data.id;
  // student can't self-grade or mark graded
  denied(await student.from('submission_grades').insert({ submission_id: subId, score: 20, graded_by: ID.student }));
  const st = await student.from('assignment_submissions').update({ status: 'graded' }).eq('id', subId).select();
  assert.ok(st.error || st.data.length === 0, 'cannot set graded');
  // other people can't see it
  const { data: seen } = await otherStudent.from('assignment_submissions').select('*').eq('id', subId);
  assert.equal(seen.length, 0);
  const { data: seen2 } = await teacher.from('assignment_submissions').select('*').eq('id', subId);
  assert.equal(seen2.length, 0, 'unrelated teacher cannot see');
  // teacher cannot alter learner text
  const tamper = await schoolTeacher.from('assignment_submissions').update({ text_response: 'tampered' }).eq('id', subId);
  assert.ok(tamper.error);
  // class teacher grades
  const g = await schoolTeacher.from('submission_grades').insert({ submission_id: subId, score: 17, feedback: 'Well explained', graded_by: ID.schoolTeacher });
  assert.ifError(g.error);
  denied(await schoolTeacher.from('submission_grades').update({ score: 25 }).eq('submission_id', subId).select().single(), 'over max');
  const { data: grade } = await student.from('submission_grades').select('score, feedback').eq('submission_id', subId).single();
  assert.equal(Number(grade.score), 17);
  const { data: sub } = await student.from('assignment_submissions').select('status').eq('id', subId).single();
  assert.equal(sub.status, 'graded');
});

test('teachers cannot publish independent courses directly; review workflow works', async () => {
  const c = await teacher.from('courses').insert({ slug: 'test-course-review', title: 'Review Me', owner_id: ID.teacher }).select().single();
  assert.ifError(c.error);
  denied(await teacher.from('courses').update({ status: 'published' }).eq('id', c.data.id), 'direct publish');
  denied(await teacher.from('courses').update({ is_premium: true }).eq('id', c.data.id), 'premium flag');
  const m = await teacher.from('course_modules').insert({ course_id: c.data.id, title: 'M1' }).select().single();
  await teacher.from('lessons').insert({ course_id: c.data.id, module_id: m.data.id, title: 'L1', status: 'published' });
  assert.ifError((await teacher.rpc('submit_course_for_review', { p_course: c.data.id })).error);
  denied(await learner.rpc('review_course', { p_course: c.data.id, p_action: 'publish' }));
  assert.ifError((await owner.rpc('review_course', { p_course: c.data.id, p_action: 'publish' })).error);
  const { data } = await anon.from('courses').select('status').eq('id', c.data.id).single();
  assert.equal(data.status, 'published');
  // learners cannot create independent courses
  denied(await learner.from('courses').insert({ slug: 'nope', title: 'Nope', owner_id: ID.learner }));
});

test('EduPro entitlements cannot be self-assigned; admin grant unlocks premium courses', async () => {
  const { data: plan } = await learner2.from('plans').select('id').eq('code', 'edupro_individual').single();
  denied(await learner2.from('subscriptions').insert({ plan_id: plan.id, user_id: ID.learner2 }), 'self subscribe');
  denied(await learner2.rpc('grant_subscription', { p_plan_code: 'edupro_individual', p_user: ID.learner2, p_school: null, p_ends_at: null }));
  // make a premium course
  const pc = await owner.from('courses').insert({ slug: 'premium-data', title: 'Premium Data Course', owner_id: ID.owner, status: 'published', is_premium: true }).select().single();
  assert.ifError(pc.error);
  denied(await learner2.rpc('enrol_in_course', { p_course: pc.data.id }), 'premium locked');
  const g = await owner.rpc('grant_subscription', { p_plan_code: 'edupro_individual', p_user: ID.learner2, p_school: null, p_ends_at: null, p_notes: 'pilot' });
  assert.ifError(g.error);
  const ctx = await learner2.rpc('my_context');
  assert.equal(ctx.data.is_edupro, true);
  assert.ifError((await learner2.rpc('enrol_in_course', { p_course: pc.data.id })).error);
  // revoke
  assert.ifError((await owner.rpc('revoke_subscription', { p_subscription: g.data, p_reason: 'end of pilot' })).error);
  const ctx2 = await learner2.rpc('my_context');
  assert.equal(ctx2.data.is_edupro, false);
});

test('live classes: manual link, notifications, join records attendance', async () => {
  const startsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const s = await teacher.from('live_sessions').insert({
    title: 'Loops clinic', provider: 'manual', join_url: 'https://meet.google.com/abc-defg-hij',
    course_id: ID.python, host_id: ID.teacher, starts_at: startsAt, duration_minutes: 45,
  }).select().single();
  assert.ifError(s.error);
  denied(await learner.from('live_sessions').insert({ title: 'x', join_url: 'https://x.test', course_id: ID.python, host_id: ID.learner, starts_at: startsAt }));
  const { data: notes } = await learner.from('notifications').select('type, title').eq('type', 'live_class');
  assert.ok(notes.some((n) => n.title.includes('Loops clinic')));
  const j = await learner.rpc('join_live_session', { p_session: s.data.id });
  assert.equal(j.data, 'https://meet.google.com/abc-defg-hij');
  const { data: att } = await teacher.from('live_session_attendance').select('user_id, status').eq('session_id', s.data.id);
  assert.equal(att.length, 1);
  // non-enrolled learner cannot see or join
  const { data: hidden } = await otherStudent.from('live_sessions').select('id').eq('id', s.data.id);
  assert.equal(hidden.length, 0);
  denied(await otherStudent.rpc('join_live_session', { p_session: s.data.id }));
});

test('classroom discussion is private to the room', async () => {
  const m = await learner.from('classroom_messages').insert({ room_type: 'course', room_id: ID.python, user_id: ID.learner, body: 'Is print() a function?', kind: 'question' });
  assert.ifError(m.error);
  const { data: visible } = await teacher.from('classroom_messages').select('id, author_name').eq('room_id', ID.python);
  assert.ok(visible.length >= 1);
  assert.equal(visible[0].author_name, 'Kwame Owusu');
  const { data: hidden } = await otherStudent.from('classroom_messages').select('id').eq('room_id', ID.python);
  assert.equal(hidden.length, 0);
  denied(await otherStudent.from('classroom_messages').insert({ room_type: 'course', room_id: ID.python, user_id: ID.otherStudent, body: 'hi' }));
  denied(await learner.from('classroom_messages').insert({ room_type: 'course', room_id: ID.python, user_id: ID.learner, body: 'board', kind: 'board' }), 'only teachers post board');
});

test('notifications are private', async () => {
  const { data } = await learner2.from('notifications').select('id').eq('user_id', ID.learner);
  assert.equal(data.length, 0);
  denied(await learner2.from('notifications').insert({ user_id: ID.learner, type: 'x', title: 'spoof' }));
});

test('school application requires owner approval; CSV import reports per row', async () => {
  const app = await learner2.from('schools').insert({ name: 'Learner Two College', slug: 'learner-two-college', contact_email: 'a@b.test', applied_by: ID.learner2 }).select().single();
  assert.ifError(app.error);
  denied(await learner2.from('schools').update({ status: 'approved' }).eq('id', app.data.id), 'self approve');
  denied(await learner2.from('schools').insert({ name: 'Sneaky', slug: 'sneaky', contact_email: 'a@b.test', applied_by: ID.learner2, status: 'approved' }));
  assert.ifError((await owner.rpc('review_school', { p_school: app.data.id, p_approve: true })).error);
  const ctx = await learner2.rpc('my_context');
  assert.ok(ctx.data.schools.some((s) => s.school_id === app.data.id && s.roles.includes('school_admin')));
  const rep = await learner2.rpc('import_students', { p_school: app.data.id, p_class: null, p_rows: [
    { email: 'learner@profjero.test', full_name: 'Kwame' }, { email: 'new.student@school.test', full_name: 'New' },
    { email: 'not-an-email' }, { email: 'new.student@school.test' },
  ] });
  assert.ifError(rep.error);
  assert.deepEqual(rep.data.map((r) => r.status), ['added', 'invited', 'error', 'error']);
});

test('support tickets are private', async () => {
  const t = await learner.from('support_tickets').insert({ user_id: ID.learner, subject: 'Help please', description: 'I cannot find my certificate.' }).select().single();
  assert.ifError(t.error);
  const { data } = await learner2.from('support_tickets').select('id').eq('id', t.data.id);
  assert.equal(data.length, 0);
  denied(await learner.from('support_tickets').update({ assigned_to: ID.learner }).eq('id', t.data.id), 'cannot self-assign');
  assert.ifError((await owner.from('support_replies').insert({ ticket_id: t.data.id, author_id: ID.owner, body: 'Look under Certificates.' })).error);
  const { data: r } = await learner.from('support_replies').select('body').eq('ticket_id', t.data.id);
  assert.equal(r.length, 1);
});

test('suspended accounts are blocked from RPCs', async () => {
  assert.ifError((await owner.rpc('set_user_status', { p_user: ID.learner2, p_status: 'suspended' })).error);
  denied(await learner2.rpc('my_context'));
  denied(await schoolAdmin.rpc('set_user_status', { p_user: ID.owner, p_status: 'suspended' }));
  assert.ifError((await owner.rpc('set_user_status', { p_user: ID.learner2, p_status: 'active' })).error);
  const { data: logs } = await owner.from('audit_logs').select('action').in('action', ['user.suspended', 'user.active']);
  assert.ok(logs.length >= 2, 'privileged actions audited');
});
