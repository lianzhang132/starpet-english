import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {BOOKDASH_LESSONS} from '../app/static/videos/bookdash.mjs';
import {VIDEO_LESSONS} from '../app/static/videos/catalog.mjs';
import {AUDIO_CLIPS} from '../app/static/audio-manifest.mjs';
import {normalizeVideo,videoNextStep,videoReady} from '../app/static/video-learning.mjs';

test('six licensed readings expand the library without changing the seven existing ids',()=>{
  assert.equal(BOOKDASH_LESSONS.length,6);assert.equal(VIDEO_LESSONS.length,14);
  assert.equal(new Set(VIDEO_LESSONS.map(v=>v.id)).size,14);
  assert.deepEqual(VIDEO_LESSONS.slice(0,7).map(v=>v.id),['hello','colors','breakfast','pets','story-balloon','story-picnic','story-rain']);
});
test('every adaptation credits its publisher, all listed creators, permission and changes',async()=>{
  const provenance=JSON.parse(await readFile(new URL('../app/static/videos/bookdash-sources.json',import.meta.url)));
  for(const book of BOOKDASH_LESSONS){
    const source=provenance.books.find(p=>p.id===book.id);
    assert.equal(book.source.type,'cc-by');assert.equal(source.license,'CC BY 4.0');
    assert.equal(source.url,book.source.url);assert.deepEqual(source.creators,book.source.creators);
    assert.match(source.adaptation,/synthetic/i);assert.match(book.source.credit,/不是星伴原创/);
    assert.ok(source.images.length>=10);assert.ok(book.source.creators.length>=3);
    for(const image of source.images){assert.match(image.sha256,/^[0-9a-f]{64}$/);assert.ok(image.url.startsWith('https://bookdash.org/wp-content/uploads/'))}
  }
  assert.ok((await stat(new URL('../app/static/videos/bookdash-logo.png',import.meta.url))).size>1000);
});
test('every illustrated scene has bounded bilingual narration that fits the recorded voice',()=>{
  for(const book of BOOKDASH_LESSONS){
    assert.equal(book.kind,'storybook');assert.ok(book.duration>=90&&book.duration<=130);
    assert.ok(book.transcript.length>=12);
    for(const [i,cue] of book.transcript.entries()){
      assert.ok(Number.isInteger(cue.page));assert.ok(cue.en&&cue.zh);
      assert.ok(cue.end<=book.duration);assert.ok(AUDIO_CLIPS[cue.en].durationMs<(cue.end-cue.start-.15)*1000);
      if(i)assert.ok(cue.start>=book.transcript[i-1].end);
    }
    assert.equal(book.questions.length,2);assert.equal(book.practice.length,2);
    for(const q of book.questions){assert.ok(q.options.length>=2);assert.ok(q.correctIndex>=0&&q.correctIndex<q.options.length);assert.ok(q.explanation.length>=20)}
  }
});
test('two voluntary invitations reuse audible lines with at least four quiet seconds',()=>{
  for(const book of BOOKDASH_LESSONS)for(const turn of book.interactions){
    assert.ok(book.practice.some(p=>p.en===turn.promptEn));assert.ok(book.transcript.some(p=>p.en===turn.promptEn&&p.end===turn.at));
    assert.ok(!book.transcript.some(p=>p.start<turn.at+4&&p.end>turn.at));
  }
});
test('library differentiates watched, questions remaining, and completed without rewarding a tap',()=>{
  const book=BOOKDASH_LESSONS[0],raw={position:book.duration,seconds:Array.from({length:Math.ceil(book.duration*.8)},(_,i)=>i)};
  const before=structuredClone(raw),p=normalizeVideo(raw,book);
  assert.equal(videoNextStep({},book).label,'开始观看');
  assert.match(videoNextStep({seconds:[0]},book).label,/继续看/);
  assert.equal(videoNextStep(raw,book).intent,'questions');assert.match(videoNextStep(raw,book).label,/不用从头重看/);
  assert.equal(videoReady(p,book),false);assert.deepEqual(raw,before);
  p.correct=book.questions.map(q=>q.id);assert.equal(videoReady(p,book),true);
  p.completed=true;assert.equal(videoNextStep(p,book).intent,'watch');assert.match(videoNextStep(p,book).label,/已完成/);
});
