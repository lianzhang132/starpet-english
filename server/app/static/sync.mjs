// Only learning metadata is queued. Microphone audio is never persisted/replayed.
export class LearningSync {
  constructor({ storage, deviceId, post, onStatus = () => {} }) {
    this.storage = storage;
    this.deviceId = deviceId;
    this.key = `starpet-outbox-v1:${deviceId}`;
    this.post = post;
    this.onStatus = onStatus;
    this.running = null;
  }

  read() {
    const saved = this.storage.getItem(this.key);
    return saved ? JSON.parse(saved) : { revision: 0, progress: null, answers: [] };
  }

  write(state) {
    // Throw if storage is unavailable: never claim an unpersisted record is safe.
    this.storage.setItem(this.key, JSON.stringify(state));
  }

  adoptServerRevision(revision) {
    if (!Number.isSafeInteger(revision) || revision < 0) return false;
    const state = this.read();
    if (state.progress || state.answers.length) return false;
    if (revision > state.revision) {
      state.revision = revision;
      this.write(state);
    }
    return true;
  }

  stageProgress(progress) {
    const state = this.read();
    state.revision += 1;
    state.progress = { ...progress, deviceId: this.deviceId, revision: state.revision };
    this.write(state);
    this.onStatus('pending', this.pendingCount());
  }

  stageAnswer(questionId, answerIndex, requestId) {
    const state = this.read();
    if (!state.answers.some(answer => answer.requestId === requestId)) {
      state.answers.push({ deviceId: this.deviceId, questionId, answerIndex, requestId });
      this.write(state);
    }
    this.onStatus('pending', this.pendingCount());
  }

  pendingCount() {
    const state = this.read();
    return state.answers.length + (state.progress ? 1 : 0);
  }

  flush() {
    if (this.running) return this.running;
    this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  }

  async drain() {
    try {
      // Bound each pass; the foreground retry picks up any remaining backlog.
      for (let count = 0; count < 100; count += 1) {
        const state = this.read();
        if (!state.progress && !state.answers.length) {
          this.onStatus('synced', 0);
          return true;
        }
        const progress = state.progress;
        const body = progress || state.answers[0];
        const response = await this.post(progress ? '/api/v1/progress' : '/api/v1/practice/answer', body);
        if (!response.ok) {
          this.onStatus(response.status === 409 ? 'conflict' : 'offline', this.pendingCount());
          return false;
        }
        const latest = this.read();
        if (progress) {
          // A newer snapshot may have been queued while this request was running.
          if (latest.progress?.revision === progress.revision) latest.progress = null;
        } else {
          latest.answers = latest.answers.filter(answer => answer.requestId !== body.requestId);
        }
        this.write(latest);
      }
      this.onStatus('pending', this.pendingCount());
      return false;
    } catch (_) {
      this.onStatus('offline', this.pendingCount());
      return false;
    }
  }
}
