import test from 'node:test';
import assert from 'node:assert/strict';
import { Speaker } from '../app/static/speaker.mjs';

function fixture() {
  const utterances=[],errors=[];
  class Utterance { constructor(text){this.text=text} }
  const speaker = new Speaker({synthesis:{cancel(){},getVoices(){return []},speak(utter){utterances.push(utter)}},
    Utterance,onError:message=>errors.push(message)});
  return {speaker,utterances,errors};
}

test('a reply only completes after the voice reports completion', async () => {
  const {speaker,utterances}=fixture();
  let done=false;const pending=speaker.speak('Hello').then(result=>{done=true;return result});
  await Promise.resolve();assert.equal(done,false);
  utterances[0].onend();assert.equal(await pending,true);
});

test('leaving a scene cancels follow-up and ignores late completion or errors', async () => {
  const {speaker,utterances,errors}=fixture();
  const old=speaker.speak('First question');speaker.stop();
  assert.equal(await old,false);
  const next=speaker.speak('New scene');
  utterances[0].onend();utterances[0].onerror();
  assert.equal(errors.length,0);assert.notEqual(speaker.current,null);
  utterances[1].onend();assert.equal(await next,true);
});

test('native cancellation is not treated as successful playback', async () => {
  const speaker=new Speaker({native:true,callNative:async action=>action==='speakAndWait'?{completed:false}:{}});
  assert.equal(await speaker.speak('Cancelled sentence'),false);
});

test('unavailable speech gives a retry message and does not unlock an automatic next turn', async () => {
  const {speaker,utterances,errors}=fixture();
  const pending=speaker.speak('Hello');utterances[0].onerror();
  assert.equal(await pending,false);assert.equal(errors.length,1);
});

test('vendor voice-list and cancellation exceptions do not leave playback pending', async () => {
  const {speaker,errors}=fixture();
  speaker.synthesis.cancel=()=>{throw new Error('vendor disconnected')};
  speaker.synthesis.getVoices=()=>{throw new Error('voice list unavailable')};
  assert.equal(await speaker.speak('Hello'),false);
  assert.equal(speaker.current,null);assert.equal(errors.length,1);
  assert.doesNotThrow(()=>speaker.stop());
});

function clipFixture(){
  const fixtureValues=fixture(),players=[];
  fixtureValues.speaker.getClip=()=>({path:'/static/audio/en-us/'+'a'.repeat(64)+'.wav',durationMs:1000});
  fixtureValues.speaker.createAudio=path=>{
    const player={path,paused:false,play(){return Promise.resolve()},pause(){this.paused=true},removeAttribute(){},load(){}};
    players.push(player);return player;
  };
  return {...fixtureValues,players};
}

test('offline clip is preferred and only finishes at its actual end',async()=>{
  const {speaker,players,utterances}=clipFixture();
  let finished=false;const result=speaker.speak('Hello').then(value=>{finished=true;return value});
  await Promise.resolve();assert.equal(finished,false);assert.equal(utterances.length,0);
  players[0].onended();assert.equal(await result,true);assert.equal(players[0].paused,true);
});

test('failed clips fall back to TTS once without ending the conversation early',async()=>{
  const {speaker,players,utterances,errors}=clipFixture();const result=speaker.speak('Hello');
  const error=players[0].onerror;error();error();assert.equal(utterances.length,1);
  utterances[0].onend();assert.equal(await result,true);assert.equal(errors.length,0);
});

test('cancelled clip cannot speak again or complete a newer request',async()=>{
  const {speaker,players,utterances}=clipFixture();const result=speaker.speak('Hello');
  const end=players[0].onended,error=players[0].onerror;speaker.stop();
  assert.equal(await result,false);end();error();assert.equal(utterances.length,0);
});

test('autoplay rejection uses the existing speech fallback',async()=>{
  const {speaker,utterances}=clipFixture();
  speaker.createAudio=()=>({play:()=>Promise.reject(new Error('NotAllowedError')),pause(){},removeAttribute(){},load(){}});
  const pending=speaker.speak('Hello');await Promise.resolve();await Promise.resolve();
  assert.equal(utterances.length,1);utterances[0].onend();assert.equal(await pending,true);
});

test('Chinese answer meanings use Chinese TTS rather than an English voice',async()=>{
  const {speaker,utterances}=fixture();const result=speaker.speak('我喜欢猫。');
  assert.equal(utterances[0].lang,'zh-CN');utterances[0].onend();assert.equal(await result,true);
  const english=speaker.speak('I like cats.');assert.equal(utterances[1].lang,'en-US');utterances[1].onend();await english;
});

test('mixed Chinese prompts read English words in an English voice, in order',async()=>{
  const {speaker,utterances}=fixture();
  const result=speaker.speak('听到 dog 后，选出正确答案。');
  assert.equal(utterances[0].text,'听到');assert.equal(utterances[0].lang,'zh-CN');
  assert.equal(utterances.length,1);utterances[0].onend();await Promise.resolve();
  assert.equal(utterances[1].text,'dog');assert.equal(utterances[1].lang,'en-US');
  utterances[1].onend();await Promise.resolve();
  assert.equal(utterances[2].text,'后，选出正确答案。');assert.equal(utterances[2].lang,'zh-CN');
  utterances[2].onend();assert.equal(await result,true);
});

test('cancel between segments cannot play the remaining word or instruction',async()=>{
  const {speaker,utterances}=fixture();
  const old=speaker.speak('听一听。dog');utterances[0].onend();speaker.stop();
  assert.equal(await old,false);assert.equal(utterances.length,1);
});

test('a replay cancels the old prompt and stale callbacks cannot resume it',async()=>{
  const {speaker,utterances}=fixture();const old=speaker.speak('听一听。dog');
  const replay=speaker.speak('新题目。cat');utterances[0].onend();
  assert.equal(await old,false);assert.equal(utterances.length,2);
  utterances[1].onend();await Promise.resolve();assert.equal(utterances[2].text,'cat');
  utterances[2].onend();assert.equal(await replay,true);
});

test('English vocabulary in mixed prompts still prefers its offline clip',async()=>{
  const {speaker,players,utterances}=clipFixture();
  speaker.getClip=text=>text==='dog'?{path:'/static/audio/en-us/'+'a'.repeat(64)+'.wav',durationMs:1000}:null;
  const result=speaker.speak('请听 dog');utterances[0].onend();await Promise.resolve();
  assert.equal(utterances.length,1);assert.equal(players.length,1);
  players[0].onended();assert.equal(await result,true);
});

test('native language errors are visible and do not start the remaining word',async()=>{
  const errors=[],spoken=[];
  const speaker=new Speaker({native:true,onError:message=>errors.push(message),callNative:async(action,data)=>{
    if(action==='speakAndWait'){spoken.push(data.text);return {completed:false,error:'中文语音包不可用'}}return {};
  }});
  assert.equal(await speaker.speak('请听。dog'),false);
  assert.deepEqual(spoken,['请听。']);assert.deepEqual(errors,['中文语音包不可用']);
});
