import { isChineseText, speechSegments } from './text-language.mjs?v=1.5.4';
// Real completion and cancellation control the next dialogue turn.
export class Speaker {
  constructor({native = false, callNative, synthesis, Utterance, getClip = () => null, createAudio,
    onActive = () => {}, onError = () => {}}) {
    Object.assign(this, {native, callNative, synthesis, Utterance, getClip, createAudio, onActive, onError});
    this.current = null;
    this.generation = 0;
  }
  stop() {
    this.generation++;
    this.current?.finish(false);
    try { this.synthesis?.cancel(); } catch (_) { /* Already cancelled locally. */ }
    try { if (this.native) this.callNative('stopSpeech').catch(() => {}); } catch (_) { }
  }
  async speak(text) {
    this.stop();
    const generation=this.generation,segments=speechSegments(text);
    if(!segments.length)return false;
    for(const segment of segments){
      if(generation!==this.generation||!await this.speakSingle(segment))return false;
    }
    return generation===this.generation;
  }
  speakSingle(text) {
    return new Promise(resolve => {
      const task = {finish: success => {
        if (this.current !== task) return;
        clearTimeout(task.timeout);
        this.current = null;
        task.stopClip?.();
        this.onActive(false);
        resolve(success);
      }};
      this.current = task;
      this.onActive(true);
      const failed = error => {
        if (this.current !== task) return;
        task.finish(false);
        this.onError(error?.message || '这次声音未能播放，请点喇叭再试。');
      };
      task.timeout = setTimeout(() => {failed(new Error('声音播放超时，请点喇叭再试。')); this.stop();}, 45000);
      const fallback = () => { if (this.current !== task) return;
      try { if (this.native) {
        this.callNative('speakAndWait', {text}).then(result => {
          if(result.error)failed(new Error(result.error));else task.finish(result.completed === true);
        }, failed);
      } else if (this.synthesis && this.Utterance) {
        const utterance = new this.Utterance(text);
        const language=isChineseText(text)?'zh-CN':'en-US';
        const voices = this.synthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith(language.slice(0,2)));
        const score = voice => (voice.lang === language ? 80 : 50) + (voice.localService ? 20 : 0)
          + (/natural|neural|premium|enhanced/i.test(voice.name) ? 100 : 0);
        utterance.voice = voices.sort((a,b) => score(b) - score(a))[0] || null;
        utterance.lang = language; utterance.rate = .94; utterance.pitch = 1;
        utterance.onend = () => task.finish(true);
        utterance.onerror = () => failed(new Error('朗读声音暂不可用，请检查语音设置。'));
        this.synthesis.speak(utterance);
      } else failed(new Error('当前设备没有可用的朗读功能。'));
      } catch (error) { failed(error); }
      };
      // APK playback is handled natively, including its offline clip lookup.
      let clip;try { clip=!this.native&&this.getClip(text); } catch (_) { }
      if(!clip||!this.createAudio||!/^\/static\/audio\/en-us\/[a-f0-9]{64}\.wav$/.test(clip.path)){fallback();return}
      let player,timer,usingClip=true;
      task.stopClip=()=>{
        usingClip=false;clearTimeout(timer);
        if(player){player.onended=null;player.onerror=null;try{player.pause();player.removeAttribute('src');player.load()}catch(_){}}
      };
      const retry=()=>{if(this.current!==task||!usingClip)return;task.stopClip();fallback()};
      try{
        player=this.createAudio(clip.path);
        player.onended=()=>{if(usingClip)task.finish(true)};
        player.onerror=retry;
        timer=setTimeout(retry,Math.min(35000,Math.max(6000,(clip.durationMs||0)+5000)));
        Promise.resolve(player.play()).catch(retry);
      }catch(_){retry()}
    });
  }
}
