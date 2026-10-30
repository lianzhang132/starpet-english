import test from 'node:test';
import assert from 'node:assert/strict';
import { accuracy, dueIds, normalizeMastery, recordAttempt, deferUncertainSpeech } from '../app/static/mastery.mjs';
import { reviewQueue, isListeningQuestion } from '../app/static/review.mjs';

test('correct answers grow intervals and incorrect answers return soon', () => {
  const mastery = {};
  const first = recordAttempt(mastery, 'q-one', true, 1_000);
  assert.equal(first.level, 1);
  assert.equal(first.dueAt, 1_000 + 86_400_000);
  const wrong = recordAttempt(mastery, 'q-one', false, 2_000);
  assert.equal(wrong.level, 0);
  assert.equal(wrong.dueAt, 602_000);
  assert.equal(accuracy(wrong), 50);
});

test('due list is ordered and ignores malformed storage values', () => {
  const mastery = normalizeMastery({later:{level:2,attempts:2,correct:2,dueAt:200},now:{level:0,attempts:1,correct:0,dueAt:100},partial:{level:9,attempts:1},bad:'x'});
  assert.deepEqual(dueIds(mastery, 200), ['partial', 'now', 'later']);
  assert.deepEqual(mastery.partial, {level:5,attempts:1,correct:0,lastSeen:0,dueAt:0});
});

test('immediate repeats cannot inflate long-term mastery or postpone review', () => {
  const mastery = {};
  const first = recordAttempt(mastery, 'cat', true, 100);
  for(let count=1;count<=10;count++) recordAttempt(mastery, 'cat', true, 100+count);
  assert.equal(mastery.cat.level, 1);
  assert.equal(mastery.cat.dueAt, first.dueAt);
  recordAttempt(mastery, 'cat', true, first.dueAt);
  assert.equal(mastery.cat.level, 2);
  assert.equal(mastery.cat.dueAt, first.dueAt+3*86_400_000);
});

test('uncertain speech preserves mastery and defers automatic review without blocking a voluntary retry', () => {
  const mastery = {};
  const first = recordAttempt(mastery, 'speaking:hello:1', true, 100);
  const due = first.dueAt;
  const postponed = deferUncertainSpeech(mastery, 'speaking:hello:1', due);
  assert.equal(postponed.level, 1);
  assert.equal(postponed.attempts, 1);
  assert.equal(postponed.dueAt, due);
  assert.deepEqual(dueIds(normalizeMastery(mastery), due + 100), []);
  assert.deepEqual(dueIds(normalizeMastery(mastery), due + 86_400_000), ['speaking:hello:1']);
  const retry = recordAttempt(mastery, 'speaking:hello:1', true, due + 200);
  assert.equal(retry.level, 2);
  assert.equal(retry.dueAt, due + 200 + 3 * 86_400_000);
  assert.equal(retry.deferredUntil, undefined);
});

test('first unmatched speech is deferred without inventing a failed attempt', () => {
  const mastery = {};
  deferUncertainSpeech(mastery, 'conversation:chat:one', 100);
  assert.equal(mastery['conversation:chat:one'].attempts, 0);
  assert.deepEqual(dueIds(mastery, 101), []);
  assert.deepEqual(dueIds(mastery, 86_400_100), ['conversation:chat:one']);
});

test('due speaking and phonics are actionable and keep their audio type', () => {
  const mastery = {};
  for(const id of ['speaking:hello:1','conversation:chat-food:drink','phonics-cat']) recordAttempt(mastery,id,false,10);
  const question={id:'phonics-cat',speech:'cat'};
  const items=reviewQueue(mastery,[question],[
    {id:'hello',kind:'repeat',lines:['Hello','Good morning']},
    {id:'chat-food',kind:'conversation',turns:[{id:'food',question:'Food?'},{id:'drink',question:'Drink?'}]}
  ],700_000);
  assert.equal(items.length,3);
  assert.equal(items[0].index,1);
  assert.equal(items[1].index,1);
  assert.equal(isListeningQuestion('review',items[2].question),true);
  assert.equal(isListeningQuestion('review',{id:'q-meaning'}),false);
});
