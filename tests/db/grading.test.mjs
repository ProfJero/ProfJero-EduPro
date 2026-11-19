// Unit tests for the server-side grading function (private.grade_response).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const db = new pg.Client({ connectionString: process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
await db.connect();
after(() => db.end());

async function grade(type, response, key, marks = 2) {
  const { rows } = await db.query('select * from private.grade_response($1::public.question_type, $2::jsonb, $3::jsonb, $4)', [type, JSON.stringify(response), JSON.stringify(key), marks]);
  return { awarded: rows[0].awarded == null ? null : Number(rows[0].awarded), correct: rows[0].correct, manual: rows[0].manual };
}

test('multiple choice / true-false', async () => {
  assert.deepEqual(await grade('multiple_choice', { option_id: 'a' }, { correct: ['a'] }), { awarded: 2, correct: true, manual: false });
  assert.deepEqual(await grade('true_false', { option_id: 'b' }, { correct: ['a'] }), { awarded: 0, correct: false, manual: false });
  assert.deepEqual(await grade('multiple_choice', {}, { correct: ['a'] }), { awarded: 0, correct: false, manual: false });
});

test('multiple select gives partial credit and penalises wrong picks', async () => {
  assert.equal((await grade('multiple_select', { option_ids: ['a', 'b'] }, { correct: ['a', 'b'] }, 4)).awarded, 4);
  assert.equal((await grade('multiple_select', { option_ids: ['a'] }, { correct: ['a', 'b'] }, 4)).awarded, 2);
  assert.equal((await grade('multiple_select', { option_ids: ['a', 'c'] }, { correct: ['a', 'b'] }, 4)).awarded, 0);
  assert.equal((await grade('multiple_select', { option_ids: ['c', 'd'] }, { correct: ['a', 'b'] }, 4)).awarded, 0, 'never negative');
});

test('fill in the blank normalises spacing and case', async () => {
  assert.equal((await grade('fill_blank', { text: '  Accra ' }, { accepted: ['accra'] })).correct, true);
  assert.equal((await grade('fill_blank', { text: 'Kumasi' }, { accepted: ['accra'] })).awarded, 0);
  assert.equal((await grade('fill_blank', { text: 'accra' }, { accepted: ['Accra'], case_sensitive: true })).correct, false);
});

test('short answer auto-marks matches and queues others for the teacher', async () => {
  assert.equal((await grade('short_answer', { text: 'photosynthesis' }, { accepted: ['Photosynthesis'] })).awarded, 2);
  assert.deepEqual(await grade('short_answer', { text: 'plants make food' }, { accepted: ['Photosynthesis'] }), { awarded: null, correct: null, manual: true });
  assert.equal((await grade('essay', { text: 'An essay' }, {})).manual, true);
});

test('matching and ordering award proportional credit', async () => {
  const key = { pairs: { l1: 'r1', l2: 'r2', l3: 'r3', l4: 'r4' } };
  assert.equal((await grade('matching', { pairs: { l1: 'r1', l2: 'r2', l3: 'r4', l4: 'r3' } }, key, 4)).awarded, 2);
  assert.equal((await grade('matching', { pairs: key.pairs }, key, 4)).correct, true);
  assert.equal((await grade('ordering', { order: ['a', 'b', 'c', 'd'] }, { order: ['a', 'b', 'c', 'd'] }, 4)).correct, true);
  assert.equal((await grade('ordering', { order: ['a', 'b', 'd', 'c'] }, { order: ['a', 'b', 'c', 'd'] }, 4)).awarded, 2);
});
