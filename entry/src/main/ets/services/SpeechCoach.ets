import { textToSpeech } from '@kit.CoreSpeechKit';
import { audio } from '@kit.AudioKit';
import { abilityAccessCtrl, common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';

export class SpeechCoach {
  private engine: textToSpeech.TextToSpeechEngine | undefined = undefined;
  private creating: Promise<textToSpeech.TextToSpeechEngine> | undefined = undefined;
  private request: number = 0;
  private generation: number = 0;

  async speak(text: string, onError: (message: string) => void): Promise<void> {
    const generation = ++this.generation;
    try {
      if (this.creating === undefined && this.engine === undefined) {
        this.creating = new Promise<textToSpeech.TextToSpeechEngine>((resolve, reject) => {
          const params: textToSpeech.CreateEngineParams = { language: 'en-US', person: 8, online: 1,
            extraParams: { 'style': 'interaction-broadcast', 'locate': 'CN', 'name': 'StarPetEnglish' } };
          textToSpeech.createEngine(params, (err: BusinessError, engine: textToSpeech.TextToSpeechEngine) => {
            if (err) { reject(new Error('英文语音包暂不可用，请在系统中下载英语语音后重试。')); return; }
            resolve(engine);
          });
        });
      }
      if (this.engine === undefined && this.creating !== undefined) {
        const engine = await this.creating;
        if (generation !== this.generation) { return; }
        this.engine = engine;
      }
      const listener: textToSpeech.SpeakListener = {
        onStart: (id: string, response: textToSpeech.StartResponse) => {},
        onComplete: (id: string, response: textToSpeech.CompleteResponse) => {},
        onStop: (id: string, response: textToSpeech.StopResponse) => {},
        onData: (id: string, data: ArrayBuffer, response: textToSpeech.SynthesisResponse) => {},
        onError: (id: string, code: number, message: string) => { onError('朗读暂不可用，请检查系统英语语音包。'); }
      };
      this.engine?.setListener(listener);
      this.engine?.stop();
      const params: textToSpeech.SpeakParams = { requestId: `starpet-${Date.now()}-${this.request++}`,
        extraParams: { 'queueMode': 0, 'speed': 0.85, 'volume': 1, 'pitch': 1,
          'languageContext': 'en-US', 'audioType': 'pcm', 'soundChannel': 3, 'playType': 1 } };
      this.engine?.speak(text, params);
    } catch (_) {
      if (generation === this.generation) {
        this.creating = undefined;
        onError('英文朗读暂不可用，请检查系统英语语音包。');
      }
    }
  }

  stop(): void { ++this.generation; this.engine?.stop(); }
  release(): void {
    ++this.generation;
    if (this.engine === undefined && this.creating !== undefined) {
      this.creating.then((engine: textToSpeech.TextToSpeechEngine) => { engine.shutdown(); }).catch(() => {});
    }
    this.engine?.stop();
    this.engine?.shutdown();
    this.engine = undefined;
    this.creating = undefined;
  }
}

export class PcmRecorder {
  private capturer: audio.AudioCapturer | undefined = undefined;
  private chunks: Uint8Array[] = [];
  private size: number = 0;
  private generation: number = 0;
  private running: boolean = false;

  async start(context: common.UIAbilityContext): Promise<void> {
    const generation = ++this.generation;
    const permission = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(context, ['ohos.permission.MICROPHONE']);
    if (permission.authResults.length === 0 || permission.authResults[0] !== 0) {
      throw new Error('需要麦克风权限才能跟读。也可以继续听音学习。');
    }
    if (generation !== this.generation) { return; }
    const options: audio.AudioCapturerOptions = {
      streamInfo: { samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_16000, channels: audio.AudioChannel.CHANNEL_1,
        sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE, encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW },
      capturerInfo: { source: audio.SourceType.SOURCE_TYPE_MIC, capturerFlags: 0 }
    };
    const capturer = await audio.createAudioCapturer(options);
    if (generation !== this.generation) { await capturer.release(); return; }
    this.capturer = capturer;
    this.chunks = [];
    this.size = 0;
    capturer.on('readData', (buffer: ArrayBuffer) => {
      if (!this.running || this.size >= 640000) { return; }
      const chunk = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 640000 - this.size)));
      this.chunks.push(chunk);
      this.size += chunk.byteLength;
    });
    this.running = true;
    try { await capturer.start(); } catch (error) { await this.cancel(); throw error; }
  }

  async stop(): Promise<ArrayBuffer> {
    this.running = false;
    const capturer = this.capturer;
    this.capturer = undefined;
    if (capturer !== undefined) {
      try { await capturer.stop(); } finally { await capturer.release(); }
    }
    const result = new Uint8Array(this.size);
    let offset: number = 0;
    this.chunks.forEach((chunk: Uint8Array) => { result.set(chunk, offset); offset += chunk.byteLength; });
    this.chunks = [];
    this.size = 0;
    return result.buffer;
  }

  async cancel(): Promise<void> {
    ++this.generation;
    await this.stop();
  }
}
