import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the browser module without changing the repository's CommonJS tooling.
const code = await readFile(new URL('../app/static/recorder.js', import.meta.url), 'utf8');
const { PcmRecorder } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

function setup(t, { workletFails = false, resumePending = false, permissionPending = false } = {}) {
  let stopped = 0, closed = 0, resume, permission;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const node = { connect() {}, disconnect() {} };
  const context = {
    sampleRate: 48000, state: 'running', destination: {},
    resume: () => resumePending ? new Promise(resolve => { resume = resolve; }) : Promise.resolve(),
    close: async () => { closed++; context.state = 'closed'; },
    createMediaStreamSource: () => ({ ...node }),
    createGain: () => ({ ...node, gain: { value: 1 } }),
    createScriptProcessor: () => node,
    ...(workletFails ? { audioWorklet: { addModule: async () => { throw Error('unsupported'); } } } : {})
  };
  t.mock.method(globalThis, 'AudioContext', function() { return context; });
  t.mock.method(globalThis.navigator.mediaDevices, 'getUserMedia', () => permissionPending
    ? new Promise(resolve => { permission = () => resolve(stream); }) : Promise.resolve(stream));
  return { node, stream, stopped: () => stopped, closed: () => closed,
    resume: () => resume(), permission: () => permission() };
}

// Test-only browser surface; no real microphone or network is accessed.
globalThis.window = { AudioWorkletNode: function() {} };
globalThis.AudioContext = function() {};
Object.defineProperty(globalThis.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia() {} } });

test('old WebView fallback copies samples and emits 16kHz little-endian PCM', async t => {
  const mock = setup(t), recorder = new PcmRecorder();
  assert.equal(await recorder.start(), true);
  const samples = Float32Array.from([1, 1, 1, -1, -1, -1]);
  mock.node.onaudioprocess({ inputBuffer: { getChannelData: () => samples } });
  samples.fill(0); // Audio callbacks reuse their buffers; retained audio must be a copy.
  const pcm = new DataView(await recorder.stop());
  assert.equal(pcm.byteLength, 4);
  assert.equal(pcm.getInt16(0, true), 32767);
  assert.equal(pcm.getInt16(2, true), -32768);
  assert.equal(mock.stopped(), 1); assert.equal(mock.closed(), 1);
  assert.equal(recorder.samples, 0); assert.equal(mock.node.onaudioprocess, null);
});
test('failed worklet loading falls back and caps retained audio at 20 seconds', async t => {
  const mock = setup(t, { workletFails: true }), recorder = new PcmRecorder();
  assert.equal(await recorder.start(), true);
  mock.node.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(48000 * 25) } });
  assert.equal(recorder.samples, 48000 * 20);
  await recorder.cancel(); assert.deepEqual(recorder.chunks, []);
});
test('cancel while waiting for microphone permission immediately stops a late stream', async t => {
  const mock = setup(t, { permissionPending: true }), recorder = new PcmRecorder();
  const started = recorder.start(); await recorder.cancel(); mock.permission();
  assert.equal(await started, false); assert.equal(mock.stopped(), 1);
});
test('cancel during AudioContext resume does not restart capture', async t => {
  const mock = setup(t, { resumePending: true }), recorder = new PcmRecorder();
  const started = recorder.start(); await Promise.resolve();
  await recorder.cancel(); mock.resume();
  assert.equal(await started, false); assert.equal(mock.stopped(), 1);
  assert.equal(mock.closed(), 1); assert.equal(recorder.node, null);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function multipleSessions(t, configs = []) {
  const sessions = [];
  t.mock.method(globalThis.navigator.mediaDevices, 'getUserMedia', () => {
    const index = sessions.length, config = configs[index] || {};
    const state = { stopped: 0, closed: 0 }, node = { connect() {}, disconnect() {} };
    const stream = { getTracks: () => [{ stop: () => state.stopped++ }] };
    const context = {
      sampleRate: config.rate || 48000, state: 'running', destination: {},
      resume: () => config.resume ? config.resume.promise : Promise.resolve(),
      close: () => { state.closed++; context.state = 'closed'; return config.close ? config.close.promise : Promise.resolve(); },
      createMediaStreamSource: () => ({ connect() {}, disconnect() { if (config.disconnectThrows) throw Error('disconnected'); } }),
      createGain: () => ({ connect() {}, disconnect() {}, gain: { value: 1 } }),
      createScriptProcessor: () => node,
      ...(config.worklet ? { audioWorklet: { addModule: () => config.worklet.promise } } : {})
    };
    sessions.push({ state, stream, context, node, feed: samples => node.onaudioprocess({ inputBuffer: { getChannelData: () => Float32Array.from(samples) } }) });
    return config.permission ? config.permission.promise.then(() => stream) : Promise.resolve(stream);
  });
  let nextContext = 0;
  t.mock.method(globalThis, 'AudioContext', function() { return sessions[nextContext++].context; });
  return sessions;
}

test('late resume failure from a cancelled attempt cannot cancel the new microphone', async t => {
  const resume = deferred(), sessions = multipleSessions(t, [{ resume }, {}]), recorder = new PcmRecorder();
  const old = recorder.start(); await Promise.resolve(); await recorder.cancel();
  assert.equal(await recorder.start(), true);
  resume.reject(new Error('closed while resuming'));
  assert.equal(await old, false); assert.equal(recorder.capturing, true);
  assert.equal(sessions[0].state.stopped, 1); assert.equal(sessions[1].state.stopped, 0);
  sessions[1].feed([1, 1, 1]); assert.equal(new DataView(await recorder.stop()).getInt16(0, true), 32767);
});

test('a slow close cannot replace stopped audio with samples from the next recording', async t => {
  const close = deferred(), sessions = multipleSessions(t, [{ close }, {}]), recorder = new PcmRecorder();
  await recorder.start(); sessions[0].feed([1, 1, 1]);
  const old = recorder.stop(); assert.equal(recorder.capturing, false);
  await recorder.start(); sessions[1].feed([-1, -1, -1]);
  close.resolve();
  assert.equal(new DataView(await old).getInt16(0, true), 32767);
  assert.equal(recorder.samples, 3); assert.equal(recorder.capturing, true);
  assert.equal(new DataView(await recorder.stop()).getInt16(0, true), -32768);
});

test('pending cancel teardown never clears new audio', async t => {
  const close = deferred(), sessions = multipleSessions(t, [{ close }, {}]), recorder = new PcmRecorder();
  await recorder.start(); const cancelled = recorder.cancel();
  await recorder.start(); sessions[1].feed([.5, .5, .5]); close.resolve(); await cancelled;
  assert.equal(recorder.samples, 3); assert.equal(recorder.capturing, true);
  assert.equal(new DataView(await recorder.stop()).getInt16(0, true), 16384);
});

test('late worklet rejection cannot install a fallback processor into the next session', async t => {
  const worklet = deferred(), sessions = multipleSessions(t, [{ worklet }, {}]), recorder = new PcmRecorder();
  const old = recorder.start(); await Promise.resolve(); await Promise.resolve();
  await recorder.cancel(); await recorder.start(); worklet.reject(Error('load aborted'));
  assert.equal(await old, false); assert.equal(recorder.node, sessions[1].node);
  assert.equal(sessions[0].node.onaudioprocess, undefined); await recorder.cancel();
});

test('teardown continues after vendor disconnect and context-close errors', async t => {
  const close = deferred(), sessions = multipleSessions(t, [{ disconnectThrows: true, close }]), recorder = new PcmRecorder();
  await recorder.start(); const cancelled = recorder.cancel(); close.reject(Error('already closed'));
  await cancelled; assert.equal(sessions[0].state.stopped, 1); assert.equal(sessions[0].state.closed, 1);
  assert.equal(recorder.capturing, false); assert.equal(recorder.node, null);
  assert.equal(sessions[0].node.onaudioprocess, null);
});

test('level meter reports actual samples, is bounded, and cannot break recording', async t => {
  const sessions = multipleSessions(t), recorder = new PcmRecorder(), levels = [];
  await recorder.start({ onLevel(level) { levels.push(level); throw Error('UI disconnected'); } });
  assert.equal(recorder.capturing, true); assert.equal(recorder.recordedSeconds, 0);
  sessions[0].feed(new Float32Array(4800).fill(.5));
  assert.deepEqual(levels, [.5]); assert.equal(recorder.recordedSeconds, .1);
  sessions[0].feed([1, 1, 1]); assert.equal(levels.length, 1);
  await recorder.cancel(); assert.equal(recorder.recordedSeconds, 0); assert.equal(recorder.capturing, false);
});

test('input rates below 16kHz do not insert zero samples into spoken audio', async t => {
  const sessions = multipleSessions(t, [{ rate: 8000 }]), recorder = new PcmRecorder();
  await recorder.start(); sessions[0].feed([1, -1]);
  assert.deepEqual(Array.from(new Int16Array(await recorder.stop())), [32767, 32767, -32768, -32768]);
});

test('stop before capture yields empty audio and repeated stop cannot reuse a previous take', async t => {
  const sessions = multipleSessions(t), recorder = new PcmRecorder();
  assert.equal((await recorder.stop()).byteLength, 0);
  await recorder.start(); sessions[0].feed([1, 1, 1]);
  assert.equal((await recorder.stop()).byteLength, 2);
  assert.equal((await recorder.stop()).byteLength, 0);
});
