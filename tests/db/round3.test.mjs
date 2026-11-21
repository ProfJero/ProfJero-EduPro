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
