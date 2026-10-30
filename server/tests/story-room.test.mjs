import test from 'node:test';
import assert from 'node:assert/strict';
import {VideoRoom} from '../app/static/video-room.mjs';
import {VIDEO_LESSONS} from '../app/static/videos/catalog.mjs';

class Element {
  constructor() { this.hidden = false; this.textContent = ''; this.html = ''; this.listeners = new Map(); this.attributes = {}; this.classList = {toggle() {}}; }
  set innerHTML(value) { this.html = value; }
  get innerHTML() { return this.html; }
  addEventListener(name, callback) { const callbacks = this.listeners.get(name) || []; callbacks.push(callback); this.listeners.set(name, callbacks); }
  dispatch(name, event = {}) { for (const callback of this.listeners.get(name) || []) callback(event); }
  setAttribute(name, value) { this.attributes[name] = value; }
  insertAdjacentHTML(_where, html) { this.html += html; }
  scrollIntoView() {}
}

class Video extends Element {
  constructor() { super(); this.currentTime = 0; this.paused = true; this.seeking = false; this.playbackRate = 1; }
  load() { this.loads=(this.loads||0)+1; this.error=null; this.currentTime=0; this.paused=true; }
  pause() { const wasPlaying = !this.paused; this.paused = true; if (wasPlaying) this.dispatch('pause'); }
  play() { const wasPaused = this.paused; this.paused = false; if (wasPaused) this.dispatch('play'); return Promise.resolve(); }
}

class PlayerRoom extends Element {
  set innerHTML(value) {
    super.innerHTML = value;
    const panel = new Element(); panel.hidden = true;
    panel.nodes = new Map(['h3', '.story-turn-zh'].map(selector => [selector, new Element()]));
    panel.querySelector = selector => panel.nodes.get(selector);
    const caption = new Element();
    caption.nodes = new Map(['b', 'span'].map(selector => [selector, new Element()]));
    caption.querySelector = selector => caption.nodes.get(selector);
    this.nodes = new Map([
      ['video', new Video()], ['.video-caption', caption], ['.story-turn', panel],
      ['.video-screen', new Element()], ['.video-tools', new Element()], ['#video-status', new Element()], ['.video-questions', new Element()],
    ]);
    for (let i = 0; i < 3; i++) this.nodes.set('#video-feedback-' + i, new Element());
  }
  get innerHTML() { return super.innerHTML; }
  querySelector(selector) { return this.nodes?.get(selector) || null; }
}

function setup({savedPosition = 0, prepareVideo = null} = {}) {
  const story = VIDEO_LESSONS.find(lesson => lesson.kind === 'story');
  assert.ok(story, 'original story content is available');
  const library = new Element(), playerRoom = new PlayerRoom(), root = new Element();
  root.querySelector = selector => selector === '#video-library' ? library : playerRoom;
  const legacy = {position:9, seconds:[0,1,2], correct:['hello-name'], completed:true};
  const app = {xp:1425, stars:5, videoProgress:{hello:structuredClone(legacy), [story.id]:{position:savedPosition}}};
  const calls = {saves:0, completions:0, beforeMedia:0, speak:[], speakWhilePaused:[], practice:[], toast:[], errors:[]};
  const room = new VideoRoom({
    root, getState:() => app, save:() => calls.saves++, canAct:() => true,
    onComplete:() => calls.completions++, beforeMedia:() => calls.beforeMedia++,
    speak:text => { calls.speak.push(text); room.pause(); },
    speakWhilePaused:text => calls.speakWhilePaused.push(text),
    practice:(...args) => calls.practice.push(args), toast:text => calls.toast.push(text),
    reportError:details => calls.errors.push(details),
    prepareVideo,
  });
  room.open(story.id);
  const click = vact => {
    const button = {dataset:{vact}, textContent:'', setAttribute() {}};
    root.dispatch('click', {target:{closest:() => button}, stopPropagation() {}});
    return button;
  };
  const panel = () => playerRoom.querySelector('.story-turn');
  return {room, story, app, calls, click, panel, legacy};
}

function assertNoSpeakingReward(ctx) {
  assert.equal(ctx.app.xp, 1425);
  assert.equal(ctx.app.stars, 5);
  assert.equal(ctx.calls.completions, 0);
  assert.deepEqual(ctx.calls.practice, []);
  assert.deepEqual(ctx.app.videoProgress.hello, ctx.legacy);
}

test('offering a story invitation pauses the actual player and renders optional text only', () => {
  const ctx = setup(), turn = ctx.story.interactions[0];
  ctx.room.player.play(); ctx.room.segmentEnd = 50;
  ctx.room.offerStoryTurn(turn);
  assert.equal(ctx.room.player.paused, true);
  assert.equal(ctx.room.pendingTurn, turn);
  assert.equal(ctx.room.segmentEnd, null);
  assert.equal(ctx.panel().hidden, false);
  assert.equal(ctx.panel().querySelector('h3').textContent, turn.promptEn);
  assert.equal(ctx.panel().querySelector('.story-turn-zh').textContent, turn.promptZh);
  assert.deepEqual(ctx.calls.speak, []);
  assert.deepEqual(ctx.calls.speakWhilePaused, []);
  assertNoSpeakingReward(ctx);
});

test('continue or skip is the same reward-neutral action and clears the invitation', () => {
  for (const action of ['story-continue', 'play']) {
    const ctx = setup(); ctx.room.offerStoryTurn(ctx.story.interactions[0]);
    ctx.click(action);
    assert.equal(ctx.room.pendingTurn, null);
    assert.equal(ctx.panel().hidden, true);
    assert.equal(ctx.room.player.paused, false);
    assertNoSpeakingReward(ctx);
  }
});

test('listen once uses the non-clearing speech path and leaves the invitation visible', () => {
  const ctx = setup(), turn = ctx.story.interactions[0];
  ctx.room.offerStoryTurn(turn);
  ctx.click('story-sound');
  assert.deepEqual(ctx.calls.speakWhilePaused, [turn.promptEn]);
  assert.deepEqual(ctx.calls.speak, []);
  assert.equal(ctx.room.pendingTurn, turn);
  assert.equal(ctx.panel().hidden, false);
  assert.equal(ctx.room.player.paused, true);
  assertNoSpeakingReward(ctx);
});

test('listen once after a cleared invitation does nothing', () => {
  const ctx = setup(); ctx.room.offerStoryTurn(ctx.story.interactions[0]);
  ctx.room.continueStory(); ctx.click('story-sound');
  assert.deepEqual(ctx.calls.speak, []);
  assert.deepEqual(ctx.calls.speakWhilePaused, []);
  assertNoSpeakingReward(ctx);
});

test('turning invitations off continues playback without reward or a later stale panel', () => {
  const ctx = setup(); ctx.room.offerStoryTurn(ctx.story.interactions[0]);
  ctx.click('interactive');
  assert.equal(ctx.room.interactive, false);
  assert.equal(ctx.room.pendingTurn, null);
  assert.equal(ctx.panel().hidden, true);
  assert.equal(ctx.room.player.paused, false);
  ctx.click('interactive');
  assert.equal(ctx.room.interactive, true);
  assert.equal(ctx.room.pendingTurn, null);
  assert.equal(ctx.panel().hidden, true);
  assertNoSpeakingReward(ctx);
});

test('pause used by background or navigation clears pending turn and saves without a reward', () => {
  const ctx = setup(); ctx.room.offerStoryTurn(ctx.story.interactions[0]);
  const before = ctx.calls.saves;
  ctx.room.pause();
  assert.equal(ctx.room.player.paused, true);
  assert.equal(ctx.room.pendingTurn, null);
  assert.equal(ctx.panel().hidden, true);
  assert.ok(ctx.calls.saves > before);
  assertNoSpeakingReward(ctx);
});

test('restarting returns to zero and makes invitations eligible in a new viewing', () => {
  const ctx = setup(), turn = ctx.story.interactions[0];
  ctx.room.storyPauses.sample(turn.at - .25);
  assert.equal(ctx.room.storyPauses.sample(turn.at), turn);
  ctx.room.offerStoryTurn(turn); ctx.room.player.currentTime = turn.at;
  ctx.click('restart');
  assert.equal(ctx.room.player.currentTime, 0);
  assert.equal(ctx.room.progress.position, 0);
  assert.equal(ctx.room.player.paused, true);
  assert.equal(ctx.room.pendingTurn, null);
  assert.equal(ctx.panel().hidden, true);
  assert.equal(ctx.room.storyPauses.sample(turn.at - .25), null);
  assert.equal(ctx.room.storyPauses.sample(turn.at), turn);
  assertNoSpeakingReward(ctx);
});

test('switching to a legacy clip clears story-only state and preserves saved legacy records', () => {
  const ctx = setup(); ctx.room.offerStoryTurn(ctx.story.interactions[0]);
  ctx.room.open('hello');
  assert.equal(ctx.room.lesson.id, 'hello');
  assert.equal(ctx.room.pendingTurn, null);
  assert.equal(ctx.room.storyPauses.interactions.length, 0);
  assert.equal(ctx.room.progress.completed, true);
  ctx.room.persist();
  assertNoSpeakingReward(ctx);
});

test('native video play clears a pending invitation just like the continue button', () => {
  const ctx = setup(); ctx.room.offerStoryTurn(ctx.story.interactions[0]);
  ctx.room.player.play();
  assert.equal(ctx.room.pendingTurn, null);
  assert.equal(ctx.panel().hidden, true);
  assertNoSpeakingReward(ctx);
});

test('seeking away from a pending invitation clears its now unrelated sentence', () => {
  const ctx = setup(); ctx.room.offerStoryTurn(ctx.story.interactions[0]);
  ctx.room.player.currentTime = 20; ctx.room.player.seeking = true;
  ctx.room.player.dispatch('seeking');
  assert.equal(ctx.room.pendingTurn, null);
  assert.equal(ctx.panel().hidden, true);
  assertNoSpeakingReward(ctx);
});

test('timeupdate routes a normal crossing to the invitation but never records or awards', () => {
  const oldDocument = globalThis.document; globalThis.document = {hidden:false};
  try {
    const ctx = setup(), turn = ctx.story.interactions[0];
    ctx.room.player.play();
    ctx.room.player.currentTime = turn.at - .25; ctx.room.player.dispatch('timeupdate');
    ctx.room.player.currentTime = turn.at; ctx.room.player.dispatch('timeupdate');
    assert.equal(ctx.room.pendingTurn, turn);
    assert.equal(ctx.panel().hidden, false);
    assert.equal(ctx.room.player.paused, true);
    assertNoSpeakingReward(ctx);
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; }
});

test('restoring a position just after an invitation never surfaces the old invitation', () => {
  const oldDocument = globalThis.document; globalThis.document = {hidden:false};
  try {
    const ctx = setup({savedPosition:46.1});
    ctx.room.player.dispatch('loadedmetadata');
    ctx.room.player.play();
    ctx.room.player.currentTime = 46.35; ctx.room.player.dispatch('timeupdate');
    ctx.room.player.currentTime = 46.6; ctx.room.player.dispatch('timeupdate');
    assert.equal(ctx.room.pendingTurn, null);
    assert.equal(ctx.panel().hidden, true);
    assert.equal(ctx.room.player.paused, false);
    assertNoSpeakingReward(ctx);
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; }
});

test('a story still requires all comprehension questions and watched coverage for its one reward', () => {
  const ctx = setup();
  ctx.room.progress.seconds = Array.from({length:Math.ceil(ctx.story.duration * .8)}, (_, index) => index);
  ctx.room.progress.correct = [ctx.story.questions[0].id]; ctx.room.persist();
  assertNoSpeakingReward(ctx);
  ctx.room.progress.correct.push(...ctx.story.questions.slice(1).map(question => question.id));
  ctx.room.persist(); ctx.room.persist();
  assert.equal(ctx.app.xp, 1440);
  assert.equal(ctx.app.stars, 6);
  assert.equal(ctx.calls.completions, 1);
  assert.deepEqual(ctx.app.videoProgress.hello, ctx.legacy);
});

test('a media failure saves the last position and retry restores it without inventing watched seconds',()=>{
  const previousDocument=globalThis.document;globalThis.document={hidden:false};
  try{
    const ctx=setup(),video=ctx.room.player;
    ctx.room.progress.seconds=[0,1,2];video.currentTime=59.22;video.error={code:2};video.readyState=2;video.networkState=1;
    video.dispatch('error');
    assert.equal(ctx.app.videoProgress[ctx.story.id].position,59.22);
    assert.equal(ctx.calls.errors[0].code,2);
    ctx.click('play');
    assert.equal(video.loads,1);assert.equal(ctx.room.resumePosition,59.22);
    video.dispatch('timeupdate');
    assert.equal(ctx.room.progress.position,59.22);
    video.dispatch('loadedmetadata');
    assert.equal(video.currentTime,59.22);assert.equal(ctx.room.resumePosition,null);
    video.dispatch('timeupdate');
    assert.deepEqual(ctx.room.progress.seconds,[0,1,2]);
    assert.equal(ctx.room.pendingTurn,null);assertNoSpeakingReward(ctx);
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument}
});

test('retry near the end resumes the remaining fragment instead of jumping to the start',()=>{
  const ctx=setup(),video=ctx.room.player;
  video.currentTime=73.5;video.error={code:2};video.dispatch('error');
  ctx.click('play');video.dispatch('loadedmetadata');
  assert.equal(video.currentTime,73.5);assertNoSpeakingReward(ctx);
});

test('restarting during recovery discards the pending old position',()=>{
  const ctx=setup(),video=ctx.room.player;
  video.currentTime=59.2;video.error={code:2};video.dispatch('error');
  ctx.click('play');ctx.click('restart');video.dispatch('loadedmetadata');
  assert.equal(video.currentTime,0);assert.equal(video.paused,true);assert.equal(ctx.room.progress.position,0);
  assertNoSpeakingReward(ctx);
});

test('repeating a sentence can recover a failed player and stop at that sentence end',()=>{
  const ctx=setup(),video=ctx.room.player,cue=ctx.story.transcript[2];
  video.error={code:2};ctx.room.repeat(cue);video.dispatch('loadedmetadata');
  assert.equal(video.loads,1);assert.equal(video.currentTime,cue.start);
  assert.equal(ctx.room.segmentEnd,cue.end);assertNoSpeakingReward(ctx);
});

test('leaving during a pending play cannot surface a stale playback error',async()=>{
  const ctx=setup();let rejectPlay;
  ctx.room.player.play=()=>new Promise((_resolve,reject)=>{rejectPlay=reject});
  ctx.click('play');ctx.room.pause();rejectPlay(new Error('late decode failure'));
  await Promise.resolve();
  assert.deepEqual(ctx.calls.toast,[]);assertNoSpeakingReward(ctx);
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('watched story opens directly at understanding questions without replay or premature reward',async()=>{
  const ctx=setup({prepareVideo:async()=>({url:'blob:ready',release(){}})});
  ctx.app.videoProgress['story-rain']={position:74,seconds:Array.from({length:60},(_,i)=>i)};
  ctx.room.open('story-rain','questions');await settle();
  assert.equal(ctx.room.questionFocus,true);assert.equal(ctx.room.player.paused,true);
  assert.match(ctx.room.playerRoom.querySelector('#video-status').textContent,/无需再看一遍/);
  assert.match(ctx.room.library.innerHTML,/完成理解题/);assertNoSpeakingReward(ctx);ctx.room.releaseSource();
});
test('new book has the same optional speaking controls and full attribution without launching a microphone',()=>{
  const ctx=setup();ctx.room.open('book-fifi-and-teddy');
  assert.match(ctx.room.playerRoom.innerHTML,/Book Dash/);assert.match(ctx.room.playerRoom.innerHTML,/CC BY 4.0/);
  assert.match(ctx.room.playerRoom.innerHTML,/Tshepo Letsapa/);assert.match(ctx.room.playerRoom.querySelector('.video-tools').innerHTML,/interactive/);
  ctx.room.offerStoryTurn(ctx.room.lesson.interactions[0]);ctx.click('story-sound');
  assert.deepEqual(ctx.calls.speakWhilePaused,['Where is Teddy?']);assert.equal(ctx.room.player.paused,true);assertNoSpeakingReward(ctx);
});
test('licensed 3D film has its own source credits, voluntary turns and returns to the picture on continue',()=>{
  const ctx=setup();ctx.room.open('film-llamigos');let scrolls=0;ctx.room.player.scrollIntoView=()=>scrolls++;
  assert.match(ctx.room.playerRoom.innerHTML,/Blender Studio/);assert.doesNotMatch(ctx.room.playerRoom.innerHTML,/bookdash-logo/);
  ctx.room.offerStoryTurn(ctx.room.lesson.interactions[0]);ctx.click('story-sound');
  assert.deepEqual(ctx.calls.speakWhilePaused,['Can we share?']);assert.equal(ctx.room.player.paused,true);
  ctx.click('story-continue');assert.equal(ctx.room.player.paused,false);assert.equal(scrolls,1);assertNoSpeakingReward(ctx);
});
test('bundled preparation completes before controls enable and never starts playback on its own',async()=>{
  let resolveSource;const ctx=setup({prepareVideo:()=>new Promise(resolve=>{resolveSource=resolve})});
  await settle();
  assert.equal(ctx.room.mediaReady,false);assert.equal(ctx.room.player.controls,false);
  assert.doesNotMatch(ctx.room.playerRoom.innerHTML,/<source src=/);
  ctx.click('play');assert.equal(ctx.room.player.paused,true);
  resolveSource({url:'blob:complete-video',release(){}});await settle();
  assert.equal(ctx.room.player.src,'blob:complete-video');assert.equal(ctx.room.player.controls,true);
  assert.equal(ctx.room.player.paused,true);assert.equal(ctx.room.mediaReady,true);
  ctx.click('play');assert.equal(ctx.room.player.paused,false);assertNoSpeakingReward(ctx);
  ctx.room.releaseSource();
});

test('switching lessons cancels preparation and releases a late obsolete Blob',async()=>{
  const requests=[];let released=0;
  const ctx=setup({prepareVideo:(path,signal)=>new Promise(resolve=>requests.push({path,signal,resolve}))});
  await settle();const first=ctx.room.player;
  ctx.room.open('story-rain');await settle();
  assert.equal(requests[0].signal.aborted,true);assert.match(requests[1].path,/story-rain/);
  requests[0].resolve({url:'blob:old',release(){released++}});await settle();
  assert.equal(released,1);assert.notEqual(ctx.room.player.src,'blob:old');assert.equal(first.paused,true);
  requests[1].resolve({url:'blob:rain',release(){released++}});await settle();
  assert.equal(ctx.room.player.src,'blob:rain');ctx.room.releaseSource();assert.equal(released,2);
  assertNoSpeakingReward(ctx);
});

test('a preparation failure stays paused and allows an explicit fresh retry',async()=>{
  let calls=0;
  const ctx=setup({prepareVideo:async()=>{if(++calls===1)throw new Error('incomplete local read');return {url:'blob:retry',release(){}}}});
  await settle();assert.equal(ctx.room.mediaReady,false);assert.equal(ctx.room.player.paused,true);
  assert.match(ctx.room.playerRoom.querySelector('#video-status').textContent,/再试一次/);
  ctx.click('play');await settle();assert.equal(calls,2);assert.equal(ctx.room.mediaReady,true);
  assert.equal(ctx.room.player.paused,true);ctx.click('play');assert.equal(ctx.room.player.paused,false);
  ctx.room.releaseSource();assertNoSpeakingReward(ctx);
});
