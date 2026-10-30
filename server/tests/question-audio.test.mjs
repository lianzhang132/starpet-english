import test from 'node:test';
import assert from 'node:assert/strict';
import { speechSegments } from '../app/static/text-language.mjs';
import { questionSpeech, LISTENING_PROMPT } from '../app/static/question-audio.mjs';
import { CVC_BLENDS } from '../app/static/phonics.mjs';

test('Chinese, English and quoted mixed prompts preserve language segments',()=>{
  assert.deepEqual(speechSegments('“苹果”用英语怎么说？'),['“苹果”用英语怎么说？']);
  assert.deepEqual(speechSegments('What would you like?'),['What would you like?']);
  assert.deepEqual(speechSegments('“dog” 的中文是什么？'),['dog','的中文是什么？']);
  assert.deepEqual(speechSegments('我喜欢 cats。你呢？'),['我喜欢','cats','你呢？']);
  assert.deepEqual(speechSegments('I am 7. Let\'s go!'),['I am 7. Let\'s go!']);
  assert.deepEqual(speechSegments('🔊…'),[]);
});

test('ordinary question narration never exposes choices, hints or the answer',()=>{
  const question={id:'quiz-sentence',prompt:'选择正确的句子。',hint:'秘密提示',answers:['Correct answer','Wrong answer'],correctIndex:0};
  for(const mode of ['daily','lesson-quiz','review'])assert.equal(questionSpeech(mode,question),question.prompt);
  assert.equal(questionSpeech('daily',null),'');
});

test('listening narration reads the displayed instruction before its target',()=>{
  const question={id:'phonics-dog',prompt:'unused',speech:'dog',answers:['cat','dog'],correctIndex:1};
  assert.equal(questionSpeech('phonics-listen',question),`${LISTENING_PROMPT}。\ndog`);
  assert.equal(questionSpeech('review',question),`${LISTENING_PROMPT}。\ndog`);
  assert.deepEqual(speechSegments(questionSpeech('review',question)),[`${LISTENING_PROMPT}。`,'dog']);
  assert.equal(questionSpeech('listen',{id:'word',answers:['cat','dog'],correctIndex:1}),`${LISTENING_PROMPT}。\ndog`);
});

test('dog blend matches the current American demonstration and explains British variation',()=>{
  const dog=CVC_BLENDS.find(item=>item.word==='dog');
  assert.deepEqual(dog.sounds,['/d/','/ɑ/','/g/']);
  assert.match(dog.note,/英式 \/dɒɡ\//);
});
