import test from 'node:test';
import assert from 'node:assert/strict';
import {STORY_LESSONS} from '../app/static/videos/stories.mjs';

const wordCount = (text) => text.match(/[a-z]+(?:'[a-z]+)?/gi)?.length ?? 0;

test('original story collection has stable unique ids and complete learning metadata', () => {
  assert.equal(STORY_LESSONS.length, 3);
  assert.equal(new Set(STORY_LESSONS.map((lesson) => lesson.id)).size, STORY_LESSONS.length);
  for (const lesson of STORY_LESSONS) {
    assert.match(lesson.id, /^story-/);
    assert.equal(lesson.kind, 'story');
    assert.equal(lesson.level, '故事启蒙');
    assert.ok(lesson.duration >= 60 && lesson.duration <= 80);
    for (const field of ['title', 'titleEn', 'description']) assert.ok(lesson[field]?.trim());
    assert.ok(lesson.story.setting && lesson.story.takeaway);
  }
});

test('dialogue stays short and bilingual without racing the child', () => {
  for (const lesson of STORY_LESSONS) {
    assert.ok(lesson.transcript.length >= 8 && lesson.transcript.length <= 10);
    const total = lesson.transcript.reduce((sum, line) => sum + wordCount(line.en), 0);
    assert.ok(total >= 30 && total <= 55, `${lesson.id}: ${total} English words`);
    let previousEnd = 0;
    for (const line of lesson.transcript) {
      assert.ok(wordCount(line.en) >= 2 && wordCount(line.en) <= 6, line.en);
      assert.match(line.zh, /[\u3400-\u9fff]/);
      assert.ok(line.visual && line.speaker);
      assert.ok(line.start >= previousEnd);
      assert.ok(line.end - line.start >= 3 && line.end <= lesson.duration);
      previousEnd = line.end;
    }
  }
});

test('animation beats cover a complete episode and match each spoken action', () => {
  for (const lesson of STORY_LESSONS) {
    const beats = lesson.story.beats;
    assert.equal(beats[0].start, 0);
    assert.equal(beats.at(-1).end, lesson.duration);
    assert.equal(beats.length, lesson.transcript.length);
    for (let index = 0; index < beats.length; index += 1) {
      const beat = beats[index];
      assert.ok(beat.scene && beat.action);
      assert.equal(beat.start, lesson.transcript[index].start);
      assert.equal(beat.action, lesson.transcript[index].visual);
      assert.ok(beat.end >= lesson.transcript[index].end);
      if (index > 0) assert.equal(beats[index - 1].end, beat.start);
    }
  }
});

test('two optional speaking invitations have real silent response time and playable practice', () => {
  const ids = new Set();
  for (const lesson of STORY_LESSONS) {
    assert.equal(lesson.interactions.length, 2);
    assert.equal(lesson.practice.length, 2);
    for (const invitation of lesson.interactions) {
      assert.ok(!ids.has(invitation.id));
      ids.add(invitation.id);
      assert.ok(invitation.at > lesson.duration / 2);
      assert.ok(invitation.resumeAfter >= 4);
      assert.ok(invitation.at + invitation.resumeAfter <= lesson.duration);
      assert.ok(invitation.promptZh);
      const example = lesson.transcript.find((line) => line.en === invitation.promptEn);
      assert.ok(example, 'invitation must use a phrase heard in the story');
      assert.equal(invitation.at, example.end);
      assert.ok(!lesson.transcript.some((line) =>
        line.start < invitation.at + invitation.resumeAfter && line.end > invitation.at));
      assert.ok(lesson.practice.some((item) => item.en === example.en
        && item.start === example.start && item.end === example.end));
    }
  }
});

test('story checks require understanding events and motives instead of isolated word naming', () => {
  const ids = new Set();
  for (const lesson of STORY_LESSONS) {
    assert.equal(lesson.questions.length, 2);
    for (const question of lesson.questions) {
      assert.ok(!ids.has(question.id));
      ids.add(question.id);
      assert.match(question.prompt, /为什么|变化/);
      assert.ok(question.options.length >= 2);
      assert.ok(Number.isInteger(question.correctIndex));
      assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
      assert.ok(question.explanation.length >= 20);
      for (const option of question.options) assert.ok(option.en && option.zh);
    }
  }
});

test('each story carries its intended useful words in contextual dialogue', () => {
  const expected = {
    'story-balloon': ['red', 'up', 'down', 'help', 'thank you'],
    'story-picnic': ['apple', 'banana', 'hungry', 'share'],
    'story-rain': ['rain', 'wet', 'come in', 'together'],
  };
  for (const lesson of STORY_LESSONS) {
    const text = lesson.transcript.map((line) => line.en.toLowerCase()).join(' ');
    for (const phrase of expected[lesson.id]) assert.ok(text.includes(phrase), phrase);
  }
});
