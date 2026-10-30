import test from 'node:test';
import assert from 'node:assert/strict';
import {StoryPauses} from '../app/static/story-playback.mjs';

const invitations = [
  {id:'story-help', at:46, promptEn:'Can you help me?', promptZh:'一起请小鸟帮忙吧！', resumeAfter:4},
  {id:'story-thanks', at:61, promptEn:'Thank you!', promptZh:'想说的话，和波波一起谢谢小鸟吧。', resumeAfter:4},
];

test('first timeupdate only establishes a baseline, including a restored position', () => {
  const pauses = new StoryPauses(invitations);
  assert.equal(pauses.sample(46.1), null);
  assert.equal(pauses.sample(46.35), null);
  assert.equal(pauses.sample(46.6), null);
});

test('ordinary quarter-second timeupdates trigger the original invitation once', () => {
  const pauses = new StoryPauses(invitations);
  for (let time = 44; time < 46; time += .25) assert.equal(pauses.sample(time), null);
  assert.equal(pauses.sample(46), invitations[0]);
  assert.equal(pauses.sample(46.25), null);
  assert.equal(pauses.sample(46.5), null);
});

test('pausing and manually continuing never repeat the invitation', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45.8);
  assert.equal(pauses.sample(46.05), invitations[0]);
  assert.equal(pauses.sample(46.05, {playing:false}), null);
  assert.equal(pauses.sample(46.05, {playing:true}), null);
  assert.equal(pauses.sample(46.3), null);
  assert.equal(pauses.sample(45), null);
  assert.equal(pauses.sample(46), null);
});

test('both story points trigger independently, without repeat or a pending queue', () => {
  const pauses = new StoryPauses(invitations);
  const results = [];
  for (let time = 0; time <= 65; time += .25) {
    const result = pauses.sample(time);
    if (result) results.push(result);
  }
  assert.deepEqual(results, invitations);
});

test('large forward jumps skip old points instead of interrupting after seek', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(1);
  assert.equal(pauses.sample(48), null);
  assert.equal(pauses.sample(48.25), null);
  pauses.sample(60.75);
  assert.equal(pauses.sample(61), invitations[1]);
});

test('explicit seeking suppresses even a small crossing and updates the baseline', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45.75);
  assert.equal(pauses.sample(46.1, {seeking:true}), null);
  assert.equal(pauses.sample(46.35), null);
});

test('a skipped point may be invited after actually replaying that part', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45.75);
  assert.equal(pauses.sample(46.1, {seeking:true}), null);
  assert.equal(pauses.sample(45), null);
  assert.equal(pauses.sample(46), invitations[0]);
});

test('turning invitations back on does not surface a disabled crossing', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45.75);
  assert.equal(pauses.sample(46, {enabled:false}), null);
  assert.equal(pauses.sample(46.25, {enabled:true}), null);
  pauses.sample(60.75);
  assert.equal(pauses.sample(61), invitations[1]);
});

test('hidden-page playback cannot interrupt immediately when visible again', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45.75);
  assert.equal(pauses.sample(46, {visible:false}), null);
  assert.equal(pauses.sample(46.25, {visible:true}), null);
});

test('paused time changes cannot trigger or queue an invitation', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45.75);
  assert.equal(pauses.sample(46, {playing:false}), null);
  assert.equal(pauses.sample(46.25, {playing:true}), null);
});

test('restarting resets points but the first sample never catches an old point', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45);
  assert.equal(pauses.sample(46), invitations[0]);
  pauses.reset(0);
  assert.equal(pauses.sample(45.75), null);
  assert.equal(pauses.sample(46), invitations[0]);
  pauses.reset(46);
  assert.equal(pauses.sample(46.1), null);
  assert.equal(pauses.sample(46.35), null);
});

test('invalid timestamps are ignored and invalidate the playback baseline', () => {
  const pauses = new StoryPauses(invitations);
  pauses.sample(45.75);
  for (const value of [NaN, Infinity, -1, '46', null, undefined]) assert.equal(pauses.sample(value), null);
  assert.equal(pauses.sample(46.1), null);
  assert.equal(pauses.sample(46.35), null);
});

test('empty or malformed interactions do not break playback', () => {
  for (const input of [undefined, null, {}, [], [null, {}, {at:NaN}, {at:Infinity}, {at:-1}, {at:'46'}]]) {
    const pauses = new StoryPauses(input);
    assert.equal(pauses.sample(45), null);
    assert.equal(pauses.sample(46), null);
  }
});

test('duplicate ids remain distinct and unsorted interactions follow playback order', () => {
  const late = {id:'same', at:61}, early = {id:'same', at:46};
  const pauses = new StoryPauses([late, early]);
  pauses.sample(45);
  assert.equal(pauses.sample(46), early);
  pauses.sample(60);
  assert.equal(pauses.sample(61), late);
});

test('the seek threshold accepts 2.5 seconds but skips larger jumps', () => {
  const accepted = new StoryPauses(invitations), skipped = new StoryPauses(invitations);
  accepted.sample(43.5);
  skipped.sample(43.49);
  assert.equal(accepted.sample(46), invitations[0]);
  assert.equal(skipped.sample(46), null);
});

test('close crossings never leave a delayed invitation queued after manual resume', () => {
  const pauses = new StoryPauses([{at:1}, {at:1.1}]);
  pauses.sample(.75);
  assert.equal(pauses.sample(1.25).at, 1);
  assert.equal(pauses.sample(1.5), null);
});

test('invitations preserve content and carry no microphone, assessment or reward side effects', () => {
  const content = structuredClone(invitations), pauses = new StoryPauses(content);
  pauses.sample(45);
  assert.equal(pauses.sample(46), content[0]);
  pauses.sample(60);
  assert.equal(pauses.sample(61), content[1]);
  assert.deepEqual(content, invitations);
  assert.deepEqual(Object.keys(pauses).sort(), ['hasBaseline','interactions','lastTime','triggered']);
});
