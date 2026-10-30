// Audio stays in memory until stop/cancel; each microphone attempt owns its resources.
const OUTPUT_RATE = 16000;
const MAX_SECONDS = 20;

function stopTracks(stream) {
  for (const track of stream?.getTracks() || []) {
    try { track.stop(); } catch (_) { /* Still release the remaining tracks/context. */ }
  }
}

async function releaseSession(session) {
  if (!session) return;
  session.capturing = false;
  stopTracks(session.stream); session.stream = null;
  if (session.node?.port) session.node.port.onmessage = null;
  if (session.node) session.node.onaudioprocess = null;
  for (const name of ['source', 'node', 'gain']) {
    try { session[name]?.disconnect(); } catch (_) { /* Some WebViews disconnect twice. */ }
    session[name] = null;
  }
  const context = session.context; session.context = null;
  if (context && context.state !== 'closed') {
    try { await context.close(); } catch (_) { /* Tracks have already been stopped. */ }
  }
}

function toPcm(chunks, samples, rate) {
  if (!samples || !Number.isFinite(rate) || rate <= 0) return new ArrayBuffer(0);
  const input = new Float32Array(samples); let offset = 0;
  for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.length; }
  const ratio = rate / OUTPUT_RATE;
  const pcm = new ArrayBuffer(Math.floor(samples / ratio) * 2), view = new DataView(pcm);
  for (let i = 0; i < pcm.byteLength / 2; i++) {
    const start = i * ratio, end = Math.min(input.length, (i + 1) * ratio);
    let sum = 0;
    // Fractional overlap also supports input rates below 16 kHz without inserting silence.
    for (let j = Math.floor(start); j < Math.ceil(end); j++) {
      if (Number.isFinite(input[j])) sum += input[j] * (Math.min(end, j + 1) - Math.max(start, j));
    }
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return pcm;
}

export class PcmRecorder {
  constructor() { this.generation = 0; this.session = null; }
  get samples() { return this.session?.samples || 0; }
  get chunks() { return this.session?.chunks || []; }
  get node() { return this.session?.node || null; }
  get capturing() { return this.session?.capturing === true; }
  get recordedSeconds() { return this.samples / (this.session?.rate || OUTPUT_RATE); }

  async start({ onLevel = () => {} } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前网页组件不支持录音，请更新系统网页组件');
    const generation = ++this.generation, previous = this.session;
    const session = { chunks: [], samples: 0, capturing: false, lastLevelSample: -Infinity };
    this.session = session;
    if (previous) { previous.chunks = []; previous.samples = 0; void releaseSession(previous); }
    const active = () => generation === this.generation && this.session === session;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      // Permission can arrive after cancel or after a second request has begun.
      if (!active()) { stopTracks(stream); return false; }
      session.stream = stream;
      const context = new AudioContext(); session.context = context;
      await context.resume();
      if (!active()) return false;
      session.rate = context.sampleRate;
      if (!Number.isFinite(session.rate) || session.rate <= 0) throw new Error('录音采样率不可用，请重试。');
      session.source = context.createMediaStreamSource(stream);
      session.gain = context.createGain(); session.gain.gain.value = 0;
      const receive = data => {
        if (!active() || !session.capturing || !data?.length || session.samples >= session.rate * MAX_SECONDS) return;
        const chunk = data.slice(0, session.rate * MAX_SECONDS - session.samples);
        session.chunks.push(chunk); session.samples += chunk.length;
        // A worklet may send 375 frames/second; keep UI updates to about 20/second.
        if (session.samples - session.lastLevelSample >= session.rate / 20) {
          session.lastLevelSample = session.samples;
          let energy = 0; for (const sample of chunk) if (Number.isFinite(sample)) energy += sample * sample;
          const level = Math.min(1, Math.sqrt(energy / chunk.length));
          try { onLevel(level); } catch (_) { /* A UI callback must never interrupt capture. */ }
        }
      };
      if (context.audioWorklet && window.AudioWorkletNode) {
        try {
          await context.audioWorklet.addModule('/static/pcm-worklet.js');
          if (!active()) return false;
          session.node = new AudioWorkletNode(context, 'starpet-pcm');
          session.node.port.onmessage = event => receive(event.data);
        } catch (error) { if (!active()) return false; }
      }
      // Older Huawei WebView versions may not expose AudioWorklet.
      if (!session.node) {
        session.node = context.createScriptProcessor(4096, 1, 1);
        session.node.onaudioprocess = event => receive(event.inputBuffer.getChannelData(0));
      }
      session.source.connect(session.node); session.node.connect(session.gain); session.gain.connect(context.destination);
      session.capturing = true;
      return true;
    } catch (error) {
      const wasActive = active();
      if (wasActive) this.session = null;
      await releaseSession(session);
      // A late failure belongs only to its own attempt, never the next recording.
      if (!wasActive) return false;
      throw error;
    }
  }

  async stop() {
    ++this.generation;
    const session = this.session; this.session = null;
    if (!session) return new ArrayBuffer(0);
    // Snapshot before awaiting close: a new recording may start during teardown.
    const { chunks, samples, rate } = session;
    session.chunks = []; session.samples = 0;
    await releaseSession(session);
    return toPcm(chunks, samples, rate);
  }

  async cancel() {
    ++this.generation;
    const session = this.session; this.session = null;
    if (session) { session.chunks = []; session.samples = 0; }
    await releaseSession(session);
  }
}
