// Round 4: sections & official names, one group per class, group live classes,
// private score sheets, feedback forms, mentions & notifications, admin details.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const PASSWORD = 'DevPassw0rd!';
const mk = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
async function as(email) {
  const c = mk();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}
const uid = async (c) => (await c.auth.getUser()).data.user.id;
const denied = (r, m) => assert.ok(r.error, m ?? 'expected error');
const notes = async (c, type) => (await c.from('notifications').select('title, body, link, data, type').eq('type', type).order('created_at', { ascending: false })).data ?? [];
let owner, tutor, kofi, kwame, outsider, abena;
const ids = {};

before(async () => {
  owner = await as('owner@profjero.test');
  tutor = await as('learner2@profjero.test'); // runs a class of their own
  kofi = await as('student@profjero.test');
  kwame = await as('schoolteacher@profjero.test'); // Akosua: plain member of this class
  abena = await as('otheradmin@profjero.test');
  outsider = await as('otherstudent@profjero.test');
  ids.tutor = await uid(tutor); ids.kofi = await uid(kofi); ids.kwame = await uid(kwame); ids.outsider = await uid(outsider);
  const cls = await tutor.from('school_classes').insert({ name: 'Ctrl + Alt + Learn', owner_id: ids.tutor }).select('id, join_code').single();
  assert.ifError(cls.error);
  ids.cls = cls.data.id;
  assert.ifError((await kofi.rpc('join_class_by_code', { p_code: cls.data.join_code })).error);
  assert.ifError((await kwame.rpc('join_class_by_code', { p_code: cls.data.join_code })).error);
});

test('sections, roster and official names', async () => {
  assert.ifError((await kofi.from('profiles').update({ display_name: 'K-Boy' }).eq('id', ids.kofi)).error);
  const secs = await tutor.from('class_sections').insert([{ class_id: ids.cls, name: 'General Arts A2', position: 0 }, { class_id: ids.cls, name: 'Science B2', position: 1 }]).select('id, name');
  assert.ifError(secs.error);
  ids.ga = secs.data.find((s) => s.name === 'General Arts A2').id;
  denied(await kofi.from('class_sections').insert({ class_id: ids.cls, name: 'My own' }).select().single(), 'learners cannot add sections');
  assert.ifError((await kofi.rpc('set_class_section', { p_class: ids.cls, p_section: ids.ga })).error);
  denied(await kofi.rpc('set_class_section', { p_class: ids.cls, p_section: ids.ga, p_user: ids.kwame }), 'cannot set someone else’s section');
  assert.equal((await kofi.rpc('my_class_section', { p_class: ids.cls })).data, ids.ga);

  const roster = await tutor.rpc('class_roster', { p_class: ids.cls });
  assert.ifError(roster.error);
  const me = roster.data.find((r) => r.user_id === ids.kofi);
  assert.equal(me.full_name, 'Kofi Appiah', 'teacher sees the official name');
  assert.equal(me.display_name, 'K-Boy');
  assert.equal(me.section_name, 'General Arts A2');
  denied(await kofi.rpc('class_roster', { p_class: ids.cls }), 'ordinary learners cannot read the register');
  denied(await outsider.rpc('class_roster', { p_class: ids.cls }));

  const asTeacher = (await tutor.rpc('room_members', { p_type: 'class', p_room: ids.cls })).data.find((m) => m.user_id === ids.kofi);
  const asPeer = (await kwame.rpc('room_members', { p_type: 'class', p_room: ids.cls })).data.find((m) => m.user_id === ids.kofi);
  assert.equal(asTeacher.name, 'Kofi Appiah');
  assert.equal(asPeer.name, 'K-Boy', 'classmates see the display name');
});

test('one group per class; teachers move learners; auto-split', async () => {
  const g = await tutor.from('study_groups').insert([{ class_id: ids.cls, name: 'Team Volta', created_by: ids.tutor }, { class_id: ids.cls, name: 'Team Pra', created_by: ids.tutor }]).select('id, name');
  assert.ifError(g.error);
  ids.volta = g.data.find((x) => x.name === 'Team Volta').id; ids.pra = g.data.find((x) => x.name === 'Team Pra').id;
  assert.equal((await tutor.from('study_group_members').select('user_id').eq('group_id', ids.volta)).data.length, 0, 'teacher does not become a member');

  assert.ifError((await kofi.rpc('join_study_group', { p_group: ids.volta })).error);
  const second = await kofi.rpc('join_study_group', { p_group: ids.pra });
  denied(second, 'second group in the same class is refused');
  assert.match(second.error.message, /Leave that group first/);
  assert.ifError((await kofi.from('study_group_members').delete().eq('group_id', ids.volta).eq('user_id', ids.kofi)).error);
  assert.ifError((await kofi.rpc('join_study_group', { p_group: ids.pra })).error, 'after leaving, can join another');

  assert.ifError((await tutor.rpc('assign_group_member', { p_group: ids.volta, p_user: ids.kofi, p_role: 'leader' })).error, 'teacher moves Kofi and makes him leader');
  const mine = (await kofi.from('study_group_members').select('group_id, role').eq('user_id', ids.kofi).in('group_id', [ids.volta, ids.pra])).data;
  assert.deepEqual(mine, [{ group_id: ids.volta, role: 'leader' }]);
  assert.ok((await notes(kofi, 'group')).length >= 1, 'Kofi was told about the move');

  assert.ifError((await kofi.rpc('assign_group_member', { p_group: ids.volta, p_user: ids.kwame })).error, 'group leader adds an ungrouped classmate');
  denied(await kofi.rpc('assign_group_member', { p_group: ids.volta, p_user: ids.outsider }), 'cannot add someone outside the class');
  denied(await kofi.rpc('auto_group_class', { p_class: ids.cls, p_groups: 2 }), 'only teachers auto-split');
  const n = await tutor.rpc('auto_group_class', { p_class: ids.cls, p_groups: 2, p_prefix: 'Squad' });
  assert.ifError(n.error);
  assert.equal(n.data, 0, 'everyone is already in a group');
});

test('group live classes are only for the group', async () => {
  const s = await kofi.from('live_sessions').insert({ title: 'Volta revision call', join_url: 'https://meet.jit.si/pje-volta-test', group_id: ids.volta,
    host_id: ids.kofi, starts_at: new Date(Date.now() + 86_400_000).toISOString(), duration_minutes: 45 }).select('id').single();
  assert.ifError(s.error);
  ids.session = s.data.id;
  assert.equal((await kwame.from('live_sessions').select('id').eq('id', ids.session)).data.length, 1, 'group member sees it');
  assert.equal((await outsider.from('live_sessions').select('id').eq('id', ids.session)).data.length, 0, 'outsider does not');
  assert.ok((await notes(kwame, 'live_class')).some((x) => x.title.includes('Volta revision call')), 'members are notified');
  denied(await outsider.from('live_sessions').insert({ title: 'Hijack', join_url: 'https://meet.jit.si/x', group_id: ids.volta, host_id: ids.outsider, starts_at: new Date().toISOString() }).select().single());
  denied(await kofi.from('live_sessions').insert({ title: 'Mixed', join_url: 'https://meet.jit.si/y', group_id: ids.volta, class_id: ids.cls, host_id: ids.kofi, starts_at: new Date().toISOString() }).select().single(), 'group sessions cannot leak to the class');
});

test('score sheets: private, released with notification', async () => {
  const sh = await tutor.from('score_sheets').insert({ class_id: ids.cls, title: 'Mid-Sem Exams', max_score: 50, created_by: ids.tutor }).select('id').single();
  assert.ifError(sh.error);
  ids.sheet = sh.data.id;
  assert.ifError((await tutor.from('score_entries').upsert([{ sheet_id: ids.sheet, user_id: ids.kofi, score: 42 }, { sheet_id: ids.sheet, user_id: ids.kwame, score: 37, remark: 'Good effort' }])).error);
  denied(await tutor.from('score_entries').upsert({ sheet_id: ids.sheet, user_id: ids.kofi, score: 51 }).select().single(), 'above the maximum');
  denied(await tutor.from('score_entries').insert({ sheet_id: ids.sheet, user_id: ids.outsider, score: 10 }).select().single(), 'not in the class');
  denied(await kofi.from('score_entries').upsert({ sheet_id: ids.sheet, user_id: ids.kofi, score: 50 }).select().single(), 'learners cannot change scores');
  assert.equal((await kofi.from('score_entries').select('score').eq('sheet_id', ids.sheet)).data.length, 0, 'hidden before release');
  assert.ifError((await tutor.from('score_sheets').update({ status: 'released' }).eq('id', ids.sheet)).error);
  const seen = (await kofi.from('score_entries').select('user_id, score').eq('sheet_id', ids.sheet)).data;
  assert.deepEqual(seen.map((r) => [r.user_id, Number(r.score)]), [[ids.kofi, 42]], 'Kofi sees only his own score');
  const mine = await kofi.rpc('my_scores');
  assert.equal(mine.data[0].title, 'Mid-Sem Exams');
  assert.equal(mine.data[0].class_average, null, 'class stats hidden unless enabled');
  const n = await notes(kofi, 'score');
  assert.ok(n.length >= 1 && !n[0].body.includes('42'), 'notified without revealing the score');
  assert.equal((await outsider.from('score_sheets').select('id').eq('id', ids.sheet)).data.length, 0);
});

test('feedback forms: answer once, admins read results, anonymity respected', async () => {
  const questions = [
    { id: 'q1', type: 'rating', label: 'How easy is ProfJero Edu to use?', required: true },
    { id: 'q2', type: 'choice', label: 'Which feature do you use most?', options: ['Classes', 'EduLab', 'AI Companion'], required: false },
    { id: 'q3', type: 'text', label: 'What should we improve?' },
  ];
  const f = await owner.from('feedback_forms').insert({ title: 'Term 1 experience', questions, audience: 'learners', anonymous: true }).select('id').single();
  assert.ifError(f.error);
  ids.form = f.data.id;
  assert.equal((await kofi.rpc('my_open_feedback')).data.filter((x) => x.id === ids.form).length, 0, 'drafts are hidden');
  assert.ifError((await owner.from('feedback_forms').update({ status: 'open' }).eq('id', ids.form)).error);
  assert.ok((await notes(kofi, 'feedback')).some((x) => x.data.form_id === ids.form), 'learners notified');
  assert.equal((await tutor.rpc('my_open_feedback')).data.filter((x) => x.id === ids.form).length, 0, 'people who run a class count as teachers');
  assert.equal((await kofi.rpc('my_open_feedback')).data.filter((x) => x.id === ids.form).length, 1);
  denied(await kofi.from('feedback_responses').insert({ form_id: ids.form, answers: { q2: 'Classes' } }).select().single(), 'required question missing');
  denied(await kofi.from('feedback_responses').insert({ form_id: ids.form, answers: { q1: 9 } }).select().single(), 'rating out of range');
  assert.ifError((await kofi.from('feedback_responses').insert({ form_id: ids.form, answers: { q1: 5, q2: 'EduLab', q3: 'More practicals', junk: 1 } })).error);
  denied(await kofi.from('feedback_responses').insert({ form_id: ids.form, answers: { q1: 4 } }).select().single(), 'only one answer each');
  assert.equal((await kofi.rpc('my_open_feedback')).data.filter((x) => x.id === ids.form).length, 0, 'no longer waiting');
  assert.equal((await kwame.from('feedback_responses').select('id').eq('form_id', ids.form)).data.length, 0, 'cannot read others’ answers');
  denied(await kofi.rpc('feedback_results', { p_form: ids.form }));
  const res = await owner.rpc('feedback_results', { p_form: ids.form });
  assert.ifError(res.error);
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].respondent, null, 'anonymous form hides the name');
  assert.equal(res.data[0].answers.junk, undefined, 'unknown answers are dropped');
  denied(await owner.from('feedback_forms').update({ questions: [questions[0]] }).eq('id', ids.form).select().single(), 'questions locked after answers');
});

test('mentions, replies, questions and staff alerts notify the right people', async () => {
  const q = await kwame.from('classroom_messages').insert({ room_type: 'class', room_id: ids.cls, user_id: ids.kwame, kind: 'question',
    body: `How do we balance this equation @[K-Boy](${ids.kofi})? Also @[Kojo](${ids.outsider})` }).select('id').single();
  assert.ifError(q.error);
  const m = await notes(kofi, 'mention');
  assert.ok(m.length >= 1 && m[0].body.includes('@K-Boy') && !m[0].body.includes(ids.kofi), 'Kofi was mentioned, with readable text');
  assert.equal((await notes(outsider, 'mention')).length, 0, 'people outside the class are never notified');
  assert.ok((await notes(tutor, 'question')).length >= 1, 'teacher hears about questions');
  assert.ifError((await kofi.from('classroom_messages').insert({ room_type: 'class', room_id: ids.cls, user_id: ids.kofi, kind: 'answer', parent_id: q.data.id, body: 'Count atoms on each side.' })).error);
  assert.ok((await notes(kwame, 'reply')).some((x) => x.title.includes('answered your question')), 'asker hears about the answer');

  assert.ifError((await kofi.from('classroom_messages').insert({ room_type: 'group', room_id: ids.volta, user_id: ids.kofi, body: 'Meet at 4?' })).error);
  assert.ifError((await kofi.from('classroom_messages').insert({ room_type: 'group', room_id: ids.volta, user_id: ids.kofi, body: 'Bring calculators' })).error);
  assert.equal((await notes(kwame, 'chat')).length, 1, 'group chat alerts are throttled to one unread per room');

  const t = await abena.from('support_tickets').insert({ user_id: await uid(abena), subject: 'Cannot open my lesson', category: 'technical', description: 'It shows a blank page' }).select('id').single();
  assert.ifError(t.error);
  assert.ok((await notes(owner, 'support_new')).some((x) => x.title.includes('Cannot open my lesson')), 'owner hears about help requests');
});

test('teacher applications show applicant details to admins only', async () => {
  const a = await abena.from('instructor_applications').insert({ user_id: await uid(abena), expertise: 'Integrated Science', motivation: 'I teach SHS science and want to share my notes widely.', institution: 'Accra Academy', years_experience: 4 }).select('id').single();
  assert.ifError(a.error);
  const list = await owner.rpc('admin_instructor_applications');
  assert.ifError(list.error);
  const row = list.data.find((r) => r.id === a.data.id);
  assert.equal(row.full_name, 'Abena Ofori');
  assert.equal(row.email, 'otheradmin@profjero.test');
  assert.equal(row.institution, 'Accra Academy');
  denied(await abena.rpc('admin_instructor_applications'));
  assert.ok((await notes(owner, 'teacher_application')).length >= 1, 'owner notified of the application');
});
