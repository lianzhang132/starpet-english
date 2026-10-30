import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {refreshStudyDay, studyExtrasSnapshot, restoreStudyExtras} from '../app/static/study-session.mjs';
import {planDaily, normalizeLessonProgress} from '../app/static/study-plan.mjs';
import {normalizeMastery} from '../app/static/mastery.mjs';
import {normalizeCare} from '../app/static/pet-care.mjs';
import {LearningSync} from '../app/static/sync.mjs';

// Exercise production app handlers and the real outbox, without child data or a microphone.
const source = await readFile(new URL('../app/static/app.js', import.meta.url), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const line = start => source.split('\n').find(value => value.startsWith(start));
const handlers = [
  between('function save(){', "window.addEventListener('online'"),
  line('function studyDay('), line('function refreshDailyUi('), line('function todaysPlan('),
  between('async function practicePhonics(', 'function showPage('),
  line("document.addEventListener('visibilitychange', ()"),
  line("window.addEventListener('starpet-resume'"),
  line('setInterval(()=>{if(!document.hidden)refreshDailyUi()'),
].join('\n');

function harness({ready=true, serverProgress=null, queued=null}={}) {
  const state = {deviceId:'qa-study-handler', xp:1425, stars:5, streak:4, lastDay:'2026-10-22', dailyDay:'2026-10-22',
    completedLessons:['hello-1'], learnedWords:['hello'], learnedSentences:['breakfast:0'], mastery:{}, lessonProgress:{},
    petCare:{bond:8,accessory:'crown'}, videoProgress:{hello:{completed:true}}, speechReceipts:['old-receipt'],
    dailyWords:['hello'], dailySentences:['breakfast:0'], dailyQuizzes:['old-0'],
    dailyAttemptIds:Array.from({length:6},(_,i)=>`old-${i}`), phonicsPracticed:['letter-A'], cardCursor:7};
  const clock = {now:new Date(2026,9,22,12)};
  const values = new Map(), requests = [], errors = [], events = new Map();
  const storage = {getItem:key=>values.get(key)||null, setItem:(key,value)=>values.set(key,value)};
  const sync = new LearningSync({storage, deviceId:state.deviceId, post:async(path, body)=>{
    requests.push({path, body:structuredClone(body)}); return {ok:true};
  }});
  if(queued) sync.stageProgress(queued);
  const node = {textContent:'',classList:{remove(){}}};
  const context = vm.createContext({
    appState:state, bootstrapReady:ready, restoreRunning:false, parentReportText:null, lessons:[],
    learningSync:sync, localStorage:storage, normalizeCare, normalizeMastery, normalizeLessonProgress, planDaily,
    refreshStudyDay:(s,opts)=>refreshStudyDay(s,{...opts,now:clock.now}),
    studyExtrasSnapshot:s=>studyExtrasSnapshot(s,clock.now), restoreStudyExtras:(s,p)=>restoreStudyExtras(s,p,clock.now),
    questionPool:()=>Array.from({length:7},(_,i)=>({id:`new-${i}`})),
    renderBindings:()=>{}, renderWorlds:()=>{}, openPetMission:()=>{}, hasNativeBridge:()=>false,
    toast:message=>errors.push(message), speak:async()=>true, updatePhonicsProgress:()=>{},
    apiFetch:async()=>{requests.push({path:'recover'}); return {ok:true,json:async()=>serverProgress}},
    document:{hidden:false, querySelector:()=>node, addEventListener:(type,fn)=>events.set(type,fn)},
    window:{addEventListener:(type,fn)=>events.set(type,fn)},
    setInterval:(fn,ms)=>{events.set(`timer-${ms}`,fn)},
  });
  vm.runInContext(handlers,context);
  return {state,clock,context,sync,requests,errors,events,storage,run:expression=>vm.runInContext(expression,context)};
}

test('foreground, native resume and minute refresh persist tomorrow without increasing the streak', async()=>{
  for(const event of ['visibilitychange','starpet-resume','timer-60000']) {
    const h=harness(); assert.equal(h.run('todaysPlan().items.length'),0);
    h.clock.now=new Date(2026,9,23,12); h.events.get(event)(); await h.sync.flush();
    assert.equal(h.run('todaysPlan().items.length'),6,event);
    const saved=JSON.parse(h.storage.getItem('starpet-progress-v2'));
    assert.equal(saved.dailyDay,'2026-10-23'); assert.equal(saved.streak,4);
    assert.equal(saved.lastDay,'2026-10-22'); assert.deepEqual(saved.dailyAttemptIds,[]);
    assert.deepEqual(h.requests.at(-1).body.studySession.dailyAttemptIds,[]);
    assert.equal(h.requests.at(-1).body.studySession.lastStudyDay,'2026-10-22');
    assert.equal(h.requests.at(-1).body.xp,1425); assert.deepEqual(h.errors,[]);
  }
});

test('direct daily-plan click refreshes before applying the six-question cap',()=>{
  const h=harness(); h.clock.now=new Date(2026,9,23,12);
  assert.equal(h.run('todaysPlan().items.length'),6);
  assert.equal(h.state.streak,4);
});

test('completed phonics audio syncs its record and counts a real learning day once',async()=>{
  const h=harness(); h.clock.now=new Date(2026,9,23,12);
  h.context.target={dataset:{speech:'B',phonicsKey:'letter-B'},classList:{add(){}},closest:()=>null};
  await h.run('practicePhonics(target)'); await h.sync.flush();
  assert.equal(h.state.streak,5); assert.equal(h.state.lastDay,'2026-10-23');
  assert.deepEqual(h.state.phonicsPracticed,['letter-A','letter-B']);
  assert.deepEqual(h.requests.at(-1).body.phonicsPracticed,['letter-A','letter-B']);
  await h.run('practicePhonics(target)'); await h.sync.flush();
  assert.equal(h.state.streak,5); assert.equal(h.state.phonicsPracticed.length,2);
  assert.equal(h.state.xp,1425); assert.equal(h.state.stars,5);
});

test('cancelled or failed phonics audio is not marked heard or counted as studying',async()=>{
  const h=harness(); h.clock.now=new Date(2026,9,23,12); h.context.speak=async()=>false;
  h.context.target={dataset:{speech:'B',phonicsKey:'letter-B'}};
  await h.run('practicePhonics(target)');
  assert.equal(h.state.lastDay,'2026-10-22'); assert.equal(h.state.streak,4);
  assert.deepEqual(h.state.phonicsPracticed,['letter-A']); assert.equal(h.requests.length,0);
});

test('cloud bootstrap restores daily work before the first new snapshot is uploaded',async()=>{
  const prior=harness(), remote={...structuredClone(prior.state),...studyExtrasSnapshot(prior.state,prior.clock.now),revision:17,updatedAt:'saved'};
  const h=harness({ready:false,serverProgress:remote});
  Object.assign(h.state,{xp:0,stars:0,streak:0,lastDay:'',dailyDay:'',dailyQuizzes:[],dailyAttemptIds:[],phonicsPracticed:[],cardCursor:0});
  await h.run('recoverProgress()'); await h.sync.flush();
  assert.equal(h.context.bootstrapReady,true); assert.equal(h.state.xp,1425); assert.equal(h.state.stars,5);
  assert.equal(h.state.dailyAttemptIds.length,6); assert.equal(h.run('todaysPlan().items.length'),0);
  assert.deepEqual(h.state.phonicsPracticed,['letter-A']); assert.equal(h.state.cardCursor,7);
  const uploaded=h.requests.at(-1).body;
  assert.equal(uploaded.revision,18); assert.equal(uploaded.studySession.dailyAttemptIds.length,6);
  assert.equal(uploaded.streak,4); assert.deepEqual(uploaded.videoProgress,{hello:{completed:true}});
});

test('an offline queued daily snapshot takes precedence over server recovery',async()=>{
  const prior=harness(), queued={...structuredClone(prior.state),...studyExtrasSnapshot(prior.state,prior.clock.now)};
  const h=harness({ready:false,queued});
  Object.assign(h.state,{dailyAttemptIds:[],phonicsPracticed:[],lastDay:'',dailyDay:''});
  await h.run('recoverProgress()'); await h.sync.flush();
  assert.ok(h.requests.every(item=>item.path!=='recover'));
  assert.equal(h.state.dailyAttemptIds.length,6); assert.deepEqual(h.state.phonicsPracticed,['letter-A']);
});
