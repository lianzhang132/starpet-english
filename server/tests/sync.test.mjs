import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningSync } from '../app/static/sync.mjs';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const snapshot = stars => ({ xp: 60, stars, streak: 1, completedLessons: ['hello-1'], learnedWords: ['hello'] });
const ok = { ok: true, status: 200 };
function setup(options = {}) {
  return new LearningSync({storage: memoryStorage(), deviceId: 'test-browser', post: async () => ok, ...options});
}

test('offline records survive restart and newer snapshots coalesce', async () => {
  const storage = memoryStorage();
  const first = setup({storage, post: async () => { throw new Error('offline'); }});
  first.stageProgress(snapshot(4));
  first.stageAnswer('q-apple', 1, 'event-001');
  first.stageProgress(snapshot(3));
  assert.equal(await first.flush(), false);
  const sent = [];
  const restarted = setup({storage, post: async (path, body) => { sent.push({path, body}); return ok; }});
  assert.equal(restarted.pendingCount(), 2);
  assert.equal(await restarted.flush(), true);
  assert.equal(sent[0].body.stars, 3);
  assert.equal(sent[0].body.revision, 2);
  assert.equal(sent[1].body.requestId, 'event-001');
  assert.equal(restarted.pendingCount(), 0);
});

test('lost acknowledgement replays the same event identifier', async () => {
  const sent = [];
  const sync = setup({post: async (_, body) => {
    sent.push(body.requestId);
    if (sent.length === 1) throw new Error('response lost after commit');
    return ok;
  }});
  sync.stageAnswer('q-apple', 1, 'event-lost-ack');
  assert.equal(await sync.flush(), false);
  assert.equal(sync.pendingCount(), 1);
  assert.equal(await sync.flush(), true);
  assert.deepEqual(sent, ['event-lost-ack', 'event-lost-ack']);
});

test('slow old acknowledgement cannot clear a newer pending snapshot', async () => {
  let resolveFirst;
  const sent = [];
  const sync = setup({post: async (_, body) => {
    sent.push(body);
    if (sent.length === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return ok;
  }});
  sync.stageProgress(snapshot(4));
  const running = sync.flush();
  sync.stageProgress(snapshot(3));
  assert.equal(sync.flush(), running);
  resolveFirst(ok);
  assert.equal(await running, true);
  assert.deepEqual(sent.map(body => body.stars), [4, 3]);
  assert.deepEqual(sent.map(body => body.revision), [1, 2]);
});

test('409 keeps local progress and shows conflict instead of claiming success', async () => {
  const statuses = [];
  const sync = setup({post: async () => ({ok: false, status: 409}), onStatus: status => statuses.push(status)});
  sync.stageProgress(snapshot(4));
  assert.equal(await sync.flush(), false);
  assert.equal(sync.pendingCount(), 1);
  assert.equal(statuses.at(-1), 'conflict');
});

test('HTTP errors keep pending answers for a later successful retry', async () => {
  const sync = setup({post: async () => ({ok: false, status: 503})});
  sync.stageAnswer('q-apple', 1, 'event-http-error');
  assert.equal(await sync.flush(), false);
  assert.equal(sync.pendingCount(), 1);
  sync.post = async () => ok;
  assert.equal(await sync.flush(), true);
  assert.equal(sync.pendingCount(), 0);
});

test('an answer added during a request is not discarded with the acknowledgement', async () => {
  let resolveFirst;
  const sent = [];
  const sync = setup({post: async (_, body) => {
    sent.push(body.requestId);
    return sent.length === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : ok;
  }});
  sync.stageAnswer('q-apple', 1, 'event-one');
  const running = sync.flush();
  sync.stageAnswer('q-cats', 0, 'event-two');
  resolveFirst(ok);
  await running;
  assert.deepEqual(sent, ['event-one', 'event-two']);
  assert.equal(sync.pendingCount(), 0);
});

test('progress revision continues after a fully acknowledged restart', async () => {
  const storage = memoryStorage();
  const first = setup({storage});
  first.stageProgress(snapshot(4));
  await first.flush();
  const restarted = setup({storage});
  restarted.stageProgress(snapshot(3));
  assert.equal(restarted.read().progress.revision, 2);
});

test('restored server revision becomes the baseline without replacing pending local work', () => {
  const sync = setup();
  assert.equal(sync.adoptServerRevision(8), true);
  sync.stageProgress(snapshot(4));
  assert.equal(sync.read().progress.revision, 9);
  assert.equal(sync.adoptServerRevision(20), false);
  assert.equal(sync.read().progress.revision, 9);
});

test('storage failure is surfaced without starting an unpersisted request', () => {
  const sync = setup({storage: {getItem: () => null, setItem: () => {throw new Error('quota');}}});
  assert.throws(() => sync.stageAnswer('q-apple', 1, 'event-quota'), /quota/);
});
