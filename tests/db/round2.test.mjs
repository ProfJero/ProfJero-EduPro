// Round 2 features: teacher classes, join codes, guests, leadership, groups,
// polls, pulse, arena anti-cheat, AI allowance, gradebook, push vault.
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
const denied = (r, m) => assert.ok(r.error, m ?? 'expected error');
let teacher, learner, learner2, other, guest, cls, code;

before(async () => {
  teacher = await as('teacher@profjero.test');
  learner = await as('learner@profjero.test');
  learner2 = await as('learner2@profjero.test');
  other = await as('otherstudent@profjero.test');
  guest = mk();
  const g = await guest.auth.signInAnonymously({ options: { data: { full_name: 'Guest Abena' } } });
  if (g.error) throw g.error;
});

test('any teacher can create an independent class with a join code', async () => {
  const { data, error } = await teacher.from('school_classes').insert({ name: 'Evening Python Club', owner_id: (await teacher.auth.getUser()).data.user.id, subject: 'Computing' }).select('id, join_code').single();
  assert.ifError(error);
  cls = data.id; code = data.join_code;
  assert.match(code, /^[A-Z2-9]{7}$/);
  const { data: ct } = await teacher.from('class_teachers').select('is_class_teacher').eq('class_id', cls);
  assert.equal(ct.length, 1, 'owner becomes class teacher');
  denied(await guest.from('school_classes').insert({ name: 'Guest class', owner_id: (await guest.auth.getUser()).data.user.id }), 'guests cannot create classes');
});

test('join by code; guests blocked unless the teacher allows them', async () => {
  const pv = await mk().rpc('class_preview', { p_code: code });
  assert.equal(pv.data.name, 'Evening Python Club');
  assert.ifError((await learner.rpc('join_class_by_code', { p_code: code })).error);
  denied(await guest.rpc('join_class_by_code', { p_code: code }), 'guest blocked');
  assert.ifError((await teacher.from('school_classes').update({ allow_guests: true, join_requires_approval: true }).eq('id', cls)).error);
  const g = await guest.rpc('join_class_by_code', { p_code: code });
  assert.ifError(g.error);
  assert.equal(g.data.status, 'pending');
  const reqs = await teacher.rpc('class_join_requests', { p_class: cls });
  assert.equal(reqs.data[0].is_guest, true);
  assert.ifError((await teacher.rpc('review_join_request', { p_class: cls, p_user: reqs.data[0].user_id, p_approve: true })).error);
  const { data: rows } = await guest.from('school_classes').select('id').eq('id', cls);
  assert.equal(rows.length, 1, 'admitted guest sees the class');
  denied(await guest.rpc('enrol_in_course', { p_course: '00000000-0000-4000-d000-000000000001' }), 'guests cannot self-enrol');
  denied(await other.from('school_classes').update({ name: 'hacked' }).eq('id', cls).select().single(), 'outsider cannot edit');
  const { data: invisible } = await other.from('class_enrolments').select('user_id').eq('class_id', cls);
  assert.equal(invisible.length, 0, 'outsider cannot see roster');
});

test('leadership permissions are enforced per permission', async () => {
  const lid = (await learner.auth.getUser()).data.user.id;
  assert.ifError((await teacher.from('class_leaders').insert({ class_id: cls, user_id: lid, title: 'Class Prefect', permissions: ['post_board', 'take_attendance'] })).error);
  denied(await learner.from('class_leaders').update({ permissions: ['post_board', 'create_polls'] }).eq('class_id', cls).eq('user_id', lid).select().single(), 'leaders cannot grant themselves powers');
  assert.ifError((await learner.from('classroom_messages').insert({ room_type: 'class', room_id: cls, user_id: lid, kind: 'board', body: 'Quiz on Friday!' })).error);
  const today = new Date().toISOString().slice(0, 10);
  assert.ifError((await learner.from('class_attendance').insert({ class_id: cls, user_id: lid, attendance_date: today, status: 'present', marked_by: lid })).error);
  denied(await learner.rpc('create_poll', { p_room_type: 'class', p_room: cls, p_question: 'Pick a date', p_options: ['Mon', 'Tue'] }), 'no create_polls permission');
  const gid = (await guest.auth.getUser()).data.user.id;
  denied(await guest.from('classroom_messages').insert({ room_type: 'class', room_id: cls, user_id: gid, kind: 'board', body: 'x' }), 'non-leader cannot post board');
});

test('polls: one vote per person, results hidden until voting', async () => {
  const p = await teacher.rpc('create_poll', { p_room_type: 'class', p_room: cls, p_question: 'Which topic next?', p_options: ['Loops', 'Functions', 'Lists'] });
  assert.ifError(p.error);
  const r0 = await guest.rpc('poll_results', { p_poll: p.data });
  assert.equal(r0.data.visible, false);
  const opts = r0.data.options;
  assert.ifError((await guest.rpc('cast_vote', { p_poll: p.data, p_option_ids: [opts[0].id] })).error);
  denied(await guest.rpc('cast_vote', { p_poll: p.data, p_option_ids: [opts[0].id, opts[1].id] }), 'single choice');
  assert.ifError((await learner.rpc('cast_vote', { p_poll: p.data, p_option_ids: [opts[0].id] })).error);
  assert.ifError((await learner.rpc('cast_vote', { p_poll: p.data, p_option_ids: [opts[1].id] })).error); // change vote
  const r = await teacher.rpc('poll_results', { p_poll: p.data });
  assert.equal(r.data.total_voters, 2);
  assert.deepEqual(r.data.options.map((o) => o.votes), [1, 1, 0]);
  denied(await other.rpc('cast_vote', { p_poll: p.data, p_option_ids: [opts[0].id] }), 'outsider cannot vote');
  denied(await learner.from('poll_votes').insert({ poll_id: p.data, option_id: opts[2].id, user_id: (await learner.auth.getUser()).data.user.id }), 'no direct vote writes');
});

test('study groups and peer help', async () => {
  const lid = (await learner.auth.getUser()).data.user.id;
  const g = await learner.from('study_groups').insert({ class_id: cls, name: 'Loop Lovers', created_by: lid }).select('id').single();
  assert.ifError(g.error);
  assert.ifError((await guest.rpc('join_study_group', { p_group: g.data.id })).error);
  denied(await other.rpc('join_study_group', { p_group: g.data.id }), 'outsider cannot join');
  const q = await guest.from('classroom_messages').insert({ room_type: 'group', room_id: g.data.id, user_id: (await guest.auth.getUser()).data.user.id, kind: 'question', body: 'How do I stop a while loop?' }).select('id').single();
  assert.ifError(q.error);
  const a = await learner.from('classroom_messages').insert({ room_type: 'group', room_id: g.data.id, user_id: lid, body: 'Use break, or make the condition false.', parent_id: q.data.id }).select('id').single();
  assert.ifError(a.error);
  assert.ifError((await guest.from('message_reactions').insert({ message_id: a.data.id, user_id: (await guest.auth.getUser()).data.user.id, kind: 'helpful' })).error);
  denied(await learner.from('message_reactions').insert({ message_id: a.data.id, user_id: lid, kind: 'helpful' }), 'cannot upvote own answer');
  denied(await other.rpc('accept_answer', { p_message: a.data.id }), 'outsiders cannot accept');
  assert.ifError((await guest.rpc('accept_answer', { p_message: a.data.id })).error);
  const helpers = await learner.rpc('peer_helpers', { p_type: 'group', p_room: g.data.id });
  assert.equal(Number(helpers.data[0].accepted), 1);
});

test('class pulse is anonymous to teachers', async () => {
  const c = await teacher.from('pulse_checks').insert({ class_id: cls, question: 'How well did you understand loops?', created_by: (await teacher.auth.getUser()).data.user.id }).select('id').single();
  assert.ifError(c.error);
  assert.ifError((await learner.from('pulse_responses').insert({ check_id: c.data.id, user_id: (await learner.auth.getUser()).data.user.id, value: 4, comment: 'Need more examples' })).error);
  const s = await teacher.rpc('pulse_summary', { p_check: c.data.id });
  assert.equal(s.data.responses, 1);
  assert.deepEqual(s.data.comments, ['Need more examples']);
  const { data: raw } = await teacher.from('pulse_responses').select('*').eq('check_id', c.data.id);
  assert.equal(raw.length, 0, 'teacher cannot see who answered what');
  denied(await learner.rpc('pulse_summary', { p_check: c.data.id }));
});

test('arena: answers stay secret, scoring is server-side', async () => {
  const { data: ch } = await learner2.from('arena_challenges').select('id, level').eq('slug', 'math-sprint-1').single();
  const s = await learner2.rpc('arena_start', { p_challenge: ch.id });
  assert.ifError(s.error);
  denied(await learner2.from('arena_attempts').select('secret').eq('id', s.data.attempt_id), 'secret column not readable');
  const { data: qs } = await learner2.from('arena_questions').select('*');
  assert.equal(qs.length, 0, 'quiz answers not readable');
  const answers = s.data.payload.problems.map((p) => String(eval(p.text.replace('×', '*').replace('÷', '/')))); // learner solves correctly
  const sub = await learner2.rpc('arena_submit', { p_attempt: s.data.attempt_id, p_answers: answers });
  assert.ifError(sub.error);
  assert.equal(Number(sub.data.score), answers.length);
  assert.ok(sub.data.xp > 0);
  denied(await learner2.rpc('arena_submit', { p_attempt: s.data.attempt_id, p_answers: answers }), 'no double submit');
  const { data: lv5 } = await other.from('arena_challenges').select('id').eq('slug', 'math-sprint-5').single();
  denied(await other.rpc('arena_start', { p_challenge: lv5.id }), 'locked level');
  const lb = await learner2.rpc('arena_leaderboard', { p_challenge: ch.id });
  assert.ok(lb.data.some((r) => r.is_me));
  assert.ok(lb.data.every((r) => r.is_me || r.user_id === null), 'other users ids hidden');
  const me = await learner2.rpc('my_arena_summary');
  assert.ok(me.data.badges.some((b) => b.code === 'first_challenge'));
});

test('AI allowance and assessment lock', async () => {
  const r = await learner2.rpc('ai_consume', { p_tokens: 10 });
  assert.equal(r.data.allowed, true);
  assert.equal(r.data.remaining, 14);
  denied(await learner2.from('ai_usage').insert({ user_id: (await learner2.auth.getUser()).data.user.id, requests: 0 }), 'no direct usage writes');
  const s = await learner2.rpc('start_attempt', { p_assessment: '00000000-0000-4000-e300-000000000001' });
  if (!s.error) {
    const r2 = await learner2.rpc('ai_consume', { p_tokens: 0 });
    assert.equal(r2.data.allowed, false, 'paused during assessment');
  }
});

test('gradebook and provider token vault', async () => {
  const gb = await teacher.rpc('gradebook', { p_course: '00000000-0000-4000-d000-000000000001' });
  assert.ifError(gb.error);
  assert.ok(gb.data.columns.length >= 1);
  denied(await learner.rpc('gradebook', { p_course: '00000000-0000-4000-d000-000000000001' }));
  denied(await teacher.rpc('provider_get_tokens', { p_secret: 'wrong-secret-wrong-secret-xx', p_provider: 'zoom' }), 'vault needs worker secret');
  denied(await teacher.rpc('push_prune', { p_secret: 'nope', p_endpoints: [] }));
});
