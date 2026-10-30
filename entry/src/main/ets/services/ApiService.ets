import { http } from '@kit.NetworkKit';

export interface SyncProgress {
  deviceId: string;
  xp: number;
  stars: number;
  streak: number;
  completedLessons: string[];
  learnedWords: string[];
  revision: number;
}

export interface PendingAnswer {
  deviceId: string;
  questionId: string;
  answerIndex: number;
  requestId: string;
}

export interface SpeakingResult {
  transcript: string;
  score: number;
  passed: boolean;
  feedback: string;
  xpAwarded: number;
  missingWords: string[];
}

export class ApiService {
  private static readonly BASE_URL: string = 'https://your-api.example.com';

  static async recordAnswer(answer: PendingAnswer): Promise<number> {
    const client = http.createHttp();
    try {
      const response = await client.request(`${ApiService.BASE_URL}/api/v1/practice/answer`, {
        method: http.RequestMethod.POST, header: { 'Content-Type': 'application/json' },
        extraData: JSON.stringify(answer),
        connectTimeout: 8000, readTimeout: 8000
      });
      return response.responseCode;
    } catch (_) { return 0; }
    finally { client.destroy(); }
  }

  static async evaluateSpeech(deviceId: string, sceneId: string, lineIndex: number, pcm: ArrayBuffer): Promise<SpeakingResult> {
    const client = http.createHttp();
    try {
      const response = await client.request(`${ApiService.BASE_URL}/api/v1/practice/speaking?deviceId=${encodeURIComponent(deviceId)}&sceneId=${encodeURIComponent(sceneId)}&lineIndex=${lineIndex}`, {
        method: http.RequestMethod.POST, header: { 'Content-Type': 'application/octet-stream' },
        extraData: pcm, connectTimeout: 8000, readTimeout: 45000
      });
      if (response.responseCode !== 200) { throw new Error('语音服务暂不可用，请稍后再试。'); }
      return JSON.parse(response.result as string) as SpeakingResult;
    } finally { client.destroy(); }
  }

  static async health(): Promise<boolean> {
    const client = http.createHttp();
    try {
      const response = await client.request(`${ApiService.BASE_URL}/api/health`, {
        method: http.RequestMethod.GET,
        connectTimeout: 5000,
        readTimeout: 5000
      });
      return response.responseCode === 200;
    } catch (_) {
      return false;
    } finally {
      client.destroy();
    }
  }

  static async syncProgress(progress: SyncProgress): Promise<number> {
    const client = http.createHttp();
    try {
      const response = await client.request(`${ApiService.BASE_URL}/api/v1/progress`, {
        method: http.RequestMethod.POST,
        header: { 'Content-Type': 'application/json' },
        extraData: JSON.stringify(progress),
        connectTimeout: 8000,
        readTimeout: 8000
      });
      return response.responseCode;
    } catch (_) {
      return 0;
    } finally {
      client.destroy();
    }
  }
}
