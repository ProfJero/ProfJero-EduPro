// Round 3: class-private learning, test notifications, discussions, schedules,
// teacher challenges, owner console.
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
let owner, tutor, member, outsider, ids = {};

before(async () => {
  owner = await as('owner@profjero.test');
  tutor = await as('learner2@profjero.test'); // no instructor role: runs a class of their own
  member = await as('student@profjero.test');
  outsider = await as('otherstudent@profjero.test');
});

test('class-only course: only class members can open lessons', async () => {
  const me = await uid(tutor);
  const cls = await tutor.from('school_classes').insert({ name: 'Saturday Maths Clinic', owner_id: me }).select('id, join_code').single();
  assert.ifError(cls.error);
  ids.cls = cls.data.id; ids.code = cls.data.join_code;
  denied(await tutor.from('courses').insert({ owner_id: me, title: 'Public attempt', slug: `pub-${Date.now()}`, visibility: 'public', status: 'draft' }), 'no instructor role → cannot create public courses');
  const c = await tutor.from('courses').insert({ owner_id: me, title: 'Fractions (class)', slug: `cls-${Date.now()}`, visibility: 'class', status: 'draft', short_description: 'Class notes' }).select('id').single();
  assert.ifError(c.error);
  ids.course = c.data.id;
  const m = await tutor.from('course_modules').insert({ course_id: ids.course, title: 'Week 1' }).select('id').single();
  assert.ifError(m.error);
  const l = await tutor.from('lessons').insert({ course_id: ids.course, module_id: m.data.id, title: 'Adding fractions', status: 'published' }).select('id').single();
  assert.ifError(l.error);
  ids.lesson = l.data.id;
  assert.ifError((await tutor.from('lesson_blocks').insert({ lesson_id: ids.lesson, type: 'paragraph', position: 0, content: { text: 'Find a common denominator.' } })).error);
  assert.ifError((await tutor.from('courses').update({ status: 'published' }).eq('id', ids.course)).error, 'class owner publishes a class course without review');
  denied(await tutor.from('courses').update({ visibility: 'public' }).eq('id', ids.course).select().single(), 'cannot open it to the public without review');
  assert.ifError((await tutor.from('class_courses').insert({ class_id: ids.cls, course_id: ids.course, assigned_by: me })).error);

  const blocks = (c) => c.from('lesson_blocks').select('id').eq('lesson_id', ids.lesson);
  assert.equal((await blocks(outsider)).data.length, 0, 'outsider sees no lesson content');
  assert.equal((await outsider.from('courses').select('id').eq('id', ids.course)).data.length, 0, 'outsider cannot even see the course');
  denied(await outsider.rpc('enrol_in_course', { p_course: ids.course }), 'outsider cannot self-enrol');
  denied(await outsider.rpc('class_learning', { p_class: ids.cls }), 'outsider cannot list class learning');

  assert.ifError((await member.rpc('join_class_by_code', { p_code: ids.code })).error);
  assert.equal((await blocks(member)).data.length, 1, 'member reads the lesson');
  const cl = await member.rpc('class_learning', { p_class: ids.cls });
  assert.equal(cl.data[0].title, 'Fractions (class)');

  assert.ifError((await tutor.from('class_enrolments').update({ status: 'removed' }).eq('class_id', ids.cls).eq('user_id', await uid(member))).error);
  assert.equal((await blocks(member)).data.length, 0, 'removed member loses access');
});

test('anyone can send themselves a test notification (rate limited)', async () => {
  assert.ifError((await member.rpc('send_test_notification')).error);
  denied(await member.rpc('send_test_notification'), 'second test within 30 s is refused');
  const { data } = await member.from('notifications').select('type').eq('type', 'test');
  assert.ok(data.length >= 1);
});

test('class challenges: only class members can see and play them', async () => {
  const me = await uid(tutor);
  assert.ifError((await member.rpc('join_class_by_code', { p_code: ids.code })).error);
  const ch = await tutor.from('arena_challenges').insert({ slug: `cls-quiz-${Date.now()}`, game: 'quiz_rush', track: `t-${Date.now()}`, title: 'Class quiz', level: 1, created_by: me, class_id: ids.cls, status: 'draft', config: { count: 1 } }).select('id').single();
  assert.ifError(ch.error);
  assert.ifError((await tutor.from('arena_questions').insert({ challenge_id: ch.data.id, prompt: '2+2?', options: ['3', '4'], answer: '4', position: 0 })).error);
  assert.ifError((await tutor.from('arena_challenges').update({ status: 'published' }).eq('id', ch.data.id)).error);
  assert.equal((await outsider.from('arena_challenges').select('id').eq('id', ch.data.id)).data.length, 0, 'outsider cannot see it');
  denied(await outsider.rpc('arena_start', { p_challenge: ch.data.id }), 'outsider cannot start it');
  denied(await outsider.from('arena_questions').select('answer').eq('challenge_id', ch.data.id).then((r) => (r.data?.length ? r : { error: 'hidden' })), 'answers hidden');
  const st = await member.rpc('arena_start', { p_challenge: ch.data.id });
  assert.ifError(st.error);
  const sub = await member.rpc('arena_submit', { p_attempt: st.data.attempt_id, p_answers: { [st.data.payload.questions[0].id]: '4' } });
  assert.equal(sub.data.score, 1);
  const { data: n } = await member.from('notifications').select('type').eq('type', 'challenge');
  assert.ok(n.length >= 1, 'class was notified');
  denied(await outsider.from('arena_challenges').insert({ slug: `x-${Date.now()}`, game: 'quiz_rush', track: 'x', title: 'Hijack', level: 1, created_by: await uid(outsider), class_id: ids.cls }), 'outsider cannot add challenges to the class');
});

test('discussions: open spaces for everyone, class/group spaces stay private', async () => {
  const sid = (await uid(member));
  const pub = await member.from('discussion_spaces').insert({ title: 'Best way to revise for WASSCE?', created_by: sid, visibility: 'public', subject: 'General' }).select('id').single();
  assert.ifError(pub.error);
  assert.equal((await outsider.from('discussion_spaces').select('id').eq('id', pub.data.id)).data.length, 1, 'anyone signed in sees open discussions');
  assert.ifError((await outsider.from('classroom_messages').insert({ room_type: 'space', room_id: pub.data.id, user_id: await uid(outsider), kind: 'message', body: 'Past questions + timing yourself!' })).error, 'learners from other schools can reply');
  const { data: after } = await member.from('discussion_spaces').select('message_count').eq('id', pub.data.id).single();
  assert.equal(after.message_count, 1, 'reply counted');
  assert.ifError((await member.from('discussion_spaces').update({ message_count: 999 }).eq('id', pub.data.id)).error);
  assert.equal((await member.from('discussion_spaces').select('message_count').eq('id', pub.data.id).single()).data.message_count, 1, 'counts cannot be faked');
  assert.ifError((await member.from('discussion_spaces').update({ is_locked: true }).eq('id', pub.data.id)).error);
  denied(await outsider.from('classroom_messages').insert({ room_type: 'space', room_id: pub.data.id, user_id: await uid(outsider), kind: 'message', body: 'late' }), 'locked');

  const cs = await member.from('discussion_spaces').insert({ title: 'Homework 3 help', created_by: sid, visibility: 'class', class_id: ids.cls }).select('id').single();
  assert.ifError(cs.error, 'class members can start class discussions');
  assert.equal((await outsider.from('discussion_spaces').select('id').eq('id', cs.data.id)).data.length, 0, 'outsiders cannot see class discussions');
  denied(await outsider.from('classroom_messages').insert({ room_type: 'space', room_id: cs.data.id, user_id: await uid(outsider), kind: 'message', body: 'hi' }), 'or post in them');
  denied(await outsider.from('discussion_spaces').insert({ title: 'Sneaky class topic', created_by: await uid(outsider), visibility: 'class', class_id: ids.cls }), 'non-members cannot create class discussions');

  const g = await member.from('study_groups').insert({ name: 'Algebra squad', class_id: ids.cls, created_by: sid }).select('id').single();
  assert.ifError(g.error);
  assert.ifError((await member.from('discussion_spaces').insert({ title: 'Group plan for Friday', created_by: sid, visibility: 'group', group_id: g.data.id })).error, 'group leader creates group discussions');
  const plain = await as('schoolteacher@profjero.test');
  assert.ifError((await plain.rpc('join_class_by_code', { p_code: ids.code })).error);
  assert.ifError((await plain.rpc('join_study_group', { p_group: g.data.id })).error);
  denied(await plain.from('discussion_spaces').insert({ title: 'Not the leader', created_by: await uid(plain), visibility: 'group', group_id: g.data.id }), 'ordinary group members cannot');
});
