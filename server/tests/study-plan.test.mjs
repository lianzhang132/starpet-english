import test from 'node:test';
import assert from 'node:assert/strict';
import { planDaily, normalizeLessonProgress } from '../app/static/study-plan.mjs';
import { recordAttempt } from '../app/static/mastery.mjs';

const questions = [
  { id: 'q-apple', conceptKey: 'word:apple' },
  { id: 'lesson-apple', conceptKey: 'word:apple', lessonId: 'food-1' },
  { id: 'q-hello' }, { id: 'q-cat' }, { id: 'q-dog' }
];

test('daily plan does not repeat a resting question or its same-word variant', () => {
  const mastery = {};
  recordAttempt(mastery, 'q-apple', true, 100);
  const secondDay = planDaily({ questions, mastery, now: 100 + 86_400_000 });
  assert.deepEqual(secondDay.items.map(item => item.question.id), ['q-apple', 'q-hello', 'q-cat', 'q-dog']);
  assert.equal(secondDay.items[0].kind, 'due');
  recordAttempt(mastery, 'q-apple', true, 100 + 86_400_000);
  const thirdDay = planDaily({ questions, mastery, now: 100 + 2 * 86_400_000 });
  assert.deepEqual(thirdDay.items.map(item => item.question.id), ['q-hello', 'q-cat', 'q-dog']);
});

test('wrong answer is due after ten minutes, but not instantly', () => {
  const mastery = {};
  recordAttempt(mastery, 'q-apple', false, 100);
  assert.equal(planDaily({ questions, mastery, now: 599_999 }).items.some(x => x.question.id === 'q-apple'), false);
  const due = planDaily({ questions, mastery, now: 600_100 }).items[0];
  assert.equal(due.question.id, 'q-apple');
  assert.match(due.reason, /没答对/);
});

test('today answered concepts and previously completed lessons are excluded from new items', () => {
  const plan = planDaily({ questions, mastery: {}, dailyQuizzes: ['q-apple'], completedLessons: ['food-1'], now: 100 });
  assert.deepEqual(plan.items.map(x => x.question.id), ['q-hello', 'q-cat', 'q-dog']);
  assert.equal(plan.items.some(x => x.question.id === 'lesson-apple'), false);
});

test('an attempted question is not automatically repeated later the same day', () => {
  const mastery = {};
  recordAttempt(mastery, 'q-apple', false, 100);
  const plan = planDaily({ questions, mastery, dailyAttemptIds: ['q-apple'], now: 700_000 });
  assert.equal(plan.items.some(x => x.question.id === 'q-apple' || x.question.id === 'lesson-apple'), false);
});

test('due items come first, then new items; one concept appears only once', () => {
  const mastery = {};
  recordAttempt(mastery, 'q-dog', false, 1);
  recordAttempt(mastery, 'q-apple', false, 2);
  const plan = planDaily({ questions, mastery, now: 700_000, limit: 3 });
  assert.deepEqual(plan.items.map(x => x.question.id), ['q-dog', 'q-apple', 'q-hello']);
  assert.equal(plan.dueCount, 2);
  assert.equal(new Set(plan.items.map(x => x.question.conceptKey || x.question.id)).size, plan.items.length);
});

test('unfinished lesson progress is sanitized without discarding valid answers', () => {
  const lessons = [{ id: 'food-1', words: [{}, {}, {}], questions: [{ id: 'a' }, { id: 'b' }] }];
  assert.deepEqual(normalizeLessonProgress({ 'food-1': {
    phase: 'quiz', cardIndex: 99, correctIds: ['a', 'a', 'unknown'], nextQuestionId: 'b'
  } }, lessons), { 'food-1': { phase: 'quiz', cardIndex: 3, correctIds: ['a'], nextQuestionId: 'b' } });
});
