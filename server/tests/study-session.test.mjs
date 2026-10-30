import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshStudyDay, studyExtrasSnapshot, restoreStudyExtras} from '../app/static/study-session.mjs';
import {planDaily} from '../app/static/study-plan.mjs';

const local = (year, month, day) => new Date(year, month - 1, day, 12);
const yesterday = () => ({lastDay:'2026-10-22', streak:4, dailyWords:['apple'], dailySentences:['breakfast:0'],
  dailyQuizzes:['old-0'], dailyAttemptIds:Array.from({length:6}, (_, i) => `old-${i}`),
  phonicsPracticed:['letter-A', 'word-apple'], cardCursor:9, xp:1425, stars:5});

test('an app kept open overnight gets a new daily plan without gaining a streak', () => {
  const state = yesterday();
  const questions = Array.from({length:7}, (_, i) => ({id:`new-${i}`}));
  const plan = () => planDaily({questions, mastery:{}, dailyAttemptIds:state.dailyAttemptIds,
    limit:Math.max(0, 6 - state.dailyAttemptIds.length)});
  assert.equal(plan().items.length, 0);
  assert.equal(refreshStudyDay(state, {now:local(2026,10,23)}), true);
  assert.equal(plan().items.length, 6);
  assert.equal(state.dailyDay, '2026-10-23');
  assert.equal(state.lastDay, '2026-10-22');
  assert.equal(state.streak, 4);
  assert.deepEqual(state.dailySentences, []);
  assert.equal(state.xp, 1425); assert.equal(state.stars, 5);
});

test('legacy same-day records survive migration and repeated non-learning refresh', () => {
  const state = yesterday();
  refreshStudyDay(state, {now:local(2026,10,22)});
  const snapshot = structuredClone(state);
  assert.equal(refreshStudyDay(state, {now:local(2026,10,22)}), false);
  assert.deepEqual(state, snapshot);
  assert.equal(state.dailyAttemptIds.length, 6);
});

test('opening tomorrow then actually learning increments once, never on reopen', () => {
  const state = yesterday(), now = local(2026,10,23);
  refreshStudyDay(state, {now});
  refreshStudyDay(state, {now, studying:true});
  state.dailyWords.push('banana');
  refreshStudyDay(state, {now});
  refreshStudyDay(state, {now, studying:true});
  assert.equal(state.streak, 5);
  assert.equal(state.lastDay, '2026-10-23');
  assert.deepEqual(state.dailyWords, ['banana']);
});

test('opening on an idle day does not bridge a missed learning day', () => {
  const state = yesterday();
  refreshStudyDay(state, {now:local(2026,10,23)});
  refreshStudyDay(state, {now:local(2026,10,24), studying:true});
  assert.equal(state.streak, 1);
});

test('calendar transitions handle year end, leap day and local DST boundaries', () => {
  for (const [lastDay, now] of [
    ['2026-12-31',local(2027,1,1)], ['2028-2-28',local(2028,2,29)],
    ['2028-2-29',local(2028,3,1)], ['2026-3-8',local(2026,3,9)],
  ]) {
    const state = {...yesterday(), lastDay};
    refreshStudyDay(state, {now, studying:true});
    assert.equal(state.streak, 5, lastDay);
    assert.deepEqual(state.dailyAttemptIds, []);
  }
});

test('same-day cloud restore keeps completed daily work, phonics, cursor and reward totals', () => {
  const source = yesterday(), now = local(2026,10,22);
  const snapshot = studyExtrasSnapshot(source, now);
  const restored = {streak:4, xp:1425, stars:5};
  restoreStudyExtras(restored, snapshot, now);
  assert.deepEqual(restored.dailyAttemptIds, source.dailyAttemptIds);
  assert.deepEqual(restored.dailyWords, ['apple']);
  assert.deepEqual(restored.phonicsPracticed, source.phonicsPracticed);
  assert.equal(restored.cardCursor, 9);
  assert.equal(restored.streak, 4); assert.equal(restored.xp, 1425); assert.equal(restored.stars, 5);
});

test('old cloud daily counters expire on restore but lifetime phonics and last study survive', () => {
  const source = yesterday(), remote = studyExtrasSnapshot(source, local(2026,10,22));
  const restored = {streak:4};
  restoreStudyExtras(restored, remote, local(2026,10,23));
  assert.deepEqual(restored.dailyAttemptIds, []);
  assert.deepEqual(restored.phonicsPracticed, source.phonicsPracticed);
  assert.equal(restored.lastDay, '2026-10-22');
  refreshStudyDay(restored, {now:local(2026,10,23), studying:true});
  assert.equal(restored.streak, 5);
});

test('a day refreshed without learning remains distinct after cloud recovery', () => {
  const source = yesterday(), now = local(2026,10,23);
  const remote = studyExtrasSnapshot(source, now);
  assert.equal(remote.studySession.day, '2026-10-23');
  assert.equal(remote.studySession.lastStudyDay, '2026-10-22');
  const restored = {streak:4};
  restoreStudyExtras(restored, remote, now);
  assert.equal(restored.streak, 4);
  refreshStudyDay(restored, {now, studying:true});
  assert.equal(restored.streak, 5);
});

test('omitted older-server fields preserve existing local records', () => {
  const state = yesterday();
  restoreStudyExtras(state, {}, local(2026,10,22));
  assert.equal(state.dailyAttemptIds.length, 6);
  assert.deepEqual(state.phonicsPracticed, ['letter-A', 'word-apple']);
  assert.equal(state.cardCursor, 9);
});

test('snapshot lists do not change when live state changes while syncing', () => {
  const state = yesterday(), snapshot = studyExtrasSnapshot(state, local(2026,10,22));
  state.dailyWords.push('banana'); state.phonicsPracticed.push('letter-B');
  assert.deepEqual(snapshot.studySession.dailyWords, ['apple']);
  assert.deepEqual(snapshot.phonicsPracticed, ['letter-A', 'word-apple']);
});

test('corrupt daily fields are sanitized and invalid clock input cannot wipe progress', () => {
  const state = {...yesterday(), lastDay:'2026-02-30', dailyAttemptIds:null};
  const saved = structuredClone(state);
  assert.equal(refreshStudyDay(state, {now:new Date(NaN)}), false);
  assert.deepEqual(state, saved);
  refreshStudyDay(state, {now:local(2026,3,2)});
  assert.equal(state.lastDay, '');
  assert.deepEqual(state.dailyAttemptIds, []);
  const valid = {...yesterday(), dailyWords:['apple','apple',null,7,'']};
  refreshStudyDay(valid, {now:local(2026,10,22)});
  assert.deepEqual(valid.dailyWords, ['apple']);
});

test('padded cloud dates are compatible with legacy unpadded local dates', () => {
  const state = {...yesterday(), lastDay:'2026-03-02'};
  refreshStudyDay(state, {now:local(2026,3,2)});
  assert.equal(state.lastDay, '2026-3-2');
  assert.deepEqual(state.dailyWords, ['apple']);
});
