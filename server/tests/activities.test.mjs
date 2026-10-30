import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {careAction,normalizeCare} from '../app/static/pet-care.mjs';
import {WatchTracker,normalizeVideo,videoReady} from '../app/static/video-learning.mjs';
import {VIDEO_LESSONS} from '../app/static/videos/catalog.mjs';
import {pcmWav,pcmHasVoice} from '../app/static/speech-audio.mjs';
import {AUDIO_CLIPS} from '../app/static/audio-manifest.mjs';
import {VideoRoom} from '../app/static/video-room.mjs';
const day='2026-10-13';
test('free snack, star cost and daily feeding cap cannot overdraw or farm',()=>{
  let a=careAction({},1,'feed','apple',day);assert.equal(a.ok,true);assert.equal(a.stars,1);assert.equal(a.state.bond,1);
  assert.equal(careAction(a.state,a.stars,'feed','apple',day).ok,false);
  assert.equal(careAction(a.state,a.stars,'feed','banana',day).ok,false);
  a=careAction(a.state,a.stars,'feed','milk',day);assert.equal(a.stars,0);
  assert.equal(careAction(a.state,0,'feed','milk',day).ok,false);
  a=careAction(a.state,5,'feed','banana',day);assert.equal(a.state.feeds,3);assert.equal(a.stars,3);
  assert.equal(careAction(a.state,5,'feed','milk',day).ok,false);
});
test('repeat companionship stays free; next-day reset never removes bond or unlocked clothing',()=>{
  let state={};for(const action of ['touch','groom','play'])state=careAction(state,0,action,null,day).state;
  assert.equal(state.bond,3);assert.equal(careAction(state,0,'play',null,day).state.bond,3);
  assert.equal(careAction(state,0,'dress','crown',day).ok,false);
  state=careAction(state,0,'dress','scarf',day).state;
  const next=normalizeCare(state,'2026-10-14');assert.equal(next.bond,3);assert.equal(next.accessory,'scarf');assert.deepEqual(next.actions,[]);
  assert.equal(normalizeCare({bond:-20,accessory:'<x>',feeds:Infinity}).bond,0);
});
test('watch coverage requires real playback; seeking, paused/hidden time and stalls do not earn coverage',()=>{
  const lesson=VIDEO_LESSONS[0],p=normalizeVideo({},lesson),tracker=new WatchTracker();
  for(let i=0;i<=100;i++)tracker.sample(p,lesson,i/4,{now:i*250});
  assert.equal(p.seconds.length,25);assert.equal(videoReady(p,lesson),false);
  p.correct.push(lesson.questions[0].id);assert.equal(videoReady(p,lesson),true);
  const saved=p.seconds.length;tracker.sample(p,lesson,27,{now:25001});assert.equal(p.seconds.length,saved);
  tracker.sample(p,lesson,28,{now:26000,visible:false});assert.equal(p.seconds.length,saved);
  const fresh=normalizeVideo({},lesson);tracker.reset();tracker.sample(fresh,lesson,0,{now:0});tracker.sample(fresh,lesson,27,{now:100,seeking:true});tracker.sample(fresh,lesson,28,{now:1100});assert.equal(fresh.seconds.length,0);
});
test('replaying cannot duplicate watched seconds; storage is sanitized',()=>{
  const lesson=VIDEO_LESSONS[0],p=normalizeVideo({seconds:[-1,0,0,400,'a'],correct:['bad'],position:Infinity},lesson);
  assert.deepEqual(p.seconds,[0]);assert.deepEqual(p.correct,[]);assert.equal(p.position,0);
  const tracker=new WatchTracker();for(let replay=0;replay<4;replay++){tracker.reset();for(let n=0;n<=10;n++)tracker.sample(p,lesson,n,{now:n*1000})}
  assert.equal(p.seconds.length,10);
});
test('all original and licensed videos have bundled media, complete captions, valid practice links and offline speech',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../app/static/catalog.json',import.meta.url)));
  assert.equal(new Set(VIDEO_LESSONS.map(v=>v.id)).size,14);
  for(const lesson of VIDEO_LESSONS){
    for(const path of [lesson.src,lesson.poster,lesson.captions])assert.ok((await stat(new URL('../app/'+path.replace('/static/','static/'),import.meta.url))).size>50);
    const vtt=await readFile(new URL('../app/'+lesson.captions.replace('/static/','static/'),import.meta.url),'utf8');assert.ok(vtt.startsWith('WEBVTT'));
    for(const cue of lesson.transcript){assert.ok(cue.end<=lesson.duration);assert.ok(AUDIO_CLIPS[cue.en]);assert.ok(vtt.includes(cue.en))}
    for(const p of lesson.practice)if(p.sceneId)assert.equal(catalog.dialogues.find(s=>s.id===p.sceneId).lines[p.lineIndex],p.en);
    for(const q of lesson.questions){assert.ok(q.correctIndex<q.options.length);for(const o of q.options)assert.ok(AUDIO_CLIPS[o.en])}
  }
});
test('WAV replay is valid mono16k PCM and near-silence is not uploaded',()=>{
  const pcm=new Int16Array(16000).fill(1000).buffer,wav=pcmWav(pcm),view=new DataView(wav);
  assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint32(40,true),32000);assert.equal(wav.byteLength,32044);
  assert.equal(pcmHasVoice(pcm),true);assert.equal(pcmHasVoice(new ArrayBuffer(32000)),false);assert.throws(()=>pcmWav(new ArrayBuffer(3)));
});
test('a completed video grants one reward and one study-day callback across repeated saves',()=>{
  const lesson=VIDEO_LESSONS[0],app={xp:4,stars:1,videoProgress:{}},progress=normalizeVideo({seconds:Array.from({length:28},(_,i)=>i),correct:[lesson.questions[0].id]},lesson);
  let studyDays=0,saves=0;
  const room={lesson,progress,getState:()=>app,onComplete:()=>studyDays++,save:()=>saves++,toast:()=>{},renderLibrary:()=>{}};
  VideoRoom.prototype.persist.call(room);VideoRoom.prototype.persist.call(room);
  assert.equal(app.xp,19);assert.equal(app.stars,2);assert.equal(studyDays,1);assert.equal(saves,2);assert.equal(app.videoProgress.hello.completed,true);
});
