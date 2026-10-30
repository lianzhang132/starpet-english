import test from 'node:test';
import assert from 'node:assert/strict';
import { ALPHABET, PHONICS_SOUNDS, CVC_BLENDS, PHONICS_QUIZZES } from '../app/static/phonics.mjs';

test('alphabet covers A through Z exactly once', () => {
  assert.equal(ALPHABET.length, 26);
  assert.equal(ALPHABET.map(item => item.letter).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assert.equal(new Set(ALPHABET.map(item => item.word)).size, 26);
  for (const item of ALPHABET) {
    assert.match(item.sound, /^\/.+\/$/);
    assert.ok(item.word && item.meaning && item.emoji);
  }
});

test('sound groups have two listenable example words', () => {
  assert.ok(PHONICS_SOUNDS.length >= 10);
  for (const item of PHONICS_SOUNDS) {
    assert.equal(item.words.length, 2);
    assert.ok(item.letters && item.sound && item.hint);
  }
});

test('CVC lessons blend three lower-case sounds into the displayed word', () => {
  assert.ok(CVC_BLENDS.length >= 12);
  for (const item of CVC_BLENDS) {
    assert.equal(item.parts.length, 3);
    assert.equal(item.sounds.length, 3);
    assert.ok(item.sounds.every(sound => /^\/.+\/$/.test(sound)));
    assert.equal(item.parts.join(''), item.word);
    assert.match(item.word, /^[a-z]{3}$/);
  }
});

test('phonics listening quiz covers every blend with four unique choices', () => {
  assert.equal(PHONICS_QUIZZES.length, CVC_BLENDS.length);
  for (const quiz of PHONICS_QUIZZES) {
    assert.equal(quiz.answers.length, 4);
    assert.equal(new Set(quiz.answers).size, 4);
    assert.equal(quiz.answers[quiz.correctIndex], quiz.speech);
  }
});
