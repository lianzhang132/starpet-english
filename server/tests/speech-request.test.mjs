import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {readSpeechResponse} from '../app/static/speech-request.mjs';
import {speakingFeedback} from '../app/static/speaking-feedback.mjs';

const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});

test('speech failures distinguish busy, timeout and incomplete replies without exposing server details',async()=>{
  for(const [detail,text] of [['speech_busy','现在有点忙'],['speech_timeout','听得有点久'],['speech_invalid_response','没收到完整结果'],['speech_unavailable','暂时连不上']]){
    await assert.rejects(readSpeechResponse(response({detail},503)),error=>error.message.includes(text)&&error.message.includes('本页')&&!error.message.includes(detail));
  }
  await assert.rejects(readSpeechResponse(response({detail:'private backend traceback'},503)),/暂时连不上/);
  await assert.rejects(readSpeechResponse({ok:true,json:async()=>{throw new SyntaxError('invalid json')}}),/没收到完整结果/);
  await assert.rejects(readSpeechResponse(response({passed:'true'})),/没收到完整结果/);
  const abort=new DOMException('cancelled','AbortError');
  await assert.rejects(readSpeechResponse({ok:true,json:async()=>{throw abort}}),error=>error===abort);
});

// Run the production handler with a minimal DOM instead of duplicating receipt logic.
const appSource=await readFile(new URL('../app/static/app.js',import.meta.url),'utf8');
const submitSource=appSource.slice(appSource.indexOf('async function submitTake('),appSource.indexOf("document.querySelector('#audio-consent').addEventListener"));
function harness(results,{conversation=false}={}){
  const status={textContent:''},consent={checked:true},requests=[],said=[];
  const state={xp:0,mastery:{},speechReceipts:[],learnedSentences:[],dailySentences:[],selectedScene:{turns:[{id:'turn1'},{id:'turn2'}]}};
  const take={pcm:new ArrayBuffer(32000),sceneId:'breakfast',lineIndex:0,conversation,turn:{id:'turn1'},requestId:'same-recording-id',retry:false};
  let studyDays=0,attempts=0;
  const context=vm.createContext({
    recentTake:take,speechGeneration:1,speechPhase:'idle',appState:state,dialogueFinished:false,
    document:{querySelector:selector=>selector==='#audio-consent'?consent:status},
    apiFetch:async(url,options)=>{requests.push({url,options});return results.shift()},
    speechButton:()=>{},stopEnglish:()=>{},studyDay:()=>studyDays++,recordAttempt:()=>attempts++,save:()=>{},renderDialogue:()=>{},toast:()=>{},
    speak:async value=>{said.push(value);return true},
    addUnique:(list,value)=>{if(!list.includes(value))list.push(value)},
    readSpeechResponse,speakingFeedback,AbortController,setTimeout,clearTimeout,TypeError
  });
  vm.runInContext(submitSource,context);
  return {context,state,take,status,requests,said,run:()=>vm.runInContext('submitTake()',context),counts:()=>({studyDays,attempts})};
}

test('retry keeps the recording and request ID; metadata replay restores earned XP exactly once',async()=>{
  const replay={passed:true,xpAwarded:10,replayed:true,transcript:''};
  const h=harness([response({detail:'speech_busy'},503),response(replay),response(replay)]);
  await h.run();
  assert.match(h.status.textContent,/现在有点忙/);
  assert.equal(h.context.recentTake,h.take);assert.equal(h.take.retry,true);assert.equal(h.state.xp,0);
  await h.run();
  assert.equal(h.state.xp,10);assert.equal(h.take.retry,false);assert.match(h.status.textContent,/已恢复这次练习结果/);
  assert.doesNotMatch(h.status.textContent,/没有识别到完整句子/);
  await h.run();
  assert.equal(h.state.xp,10);assert.equal(h.state.speechReceipts.length,1);
  assert.deepEqual(h.counts(),{studyDays:1,attempts:1});
  assert.equal(new Set(h.requests.map(item=>item.url)).size,1);
  assert.ok(h.requests.every(item=>item.options.body===h.take.pcm));
});

test('an unsuccessful replay never grants XP; a zero-XP pass still retains learned progress',async()=>{
  const failed=harness([response({passed:false,xpAwarded:10,replayed:true})]);
  await failed.run();assert.equal(failed.state.xp,0);assert.equal(failed.state.learnedSentences.length,0);
  const passed=harness([response({passed:true,xpAwarded:0,replayed:true})]);
  await passed.run();assert.equal(passed.state.xp,0);assert.deepEqual(passed.state.learnedSentences,['breakfast:0']);
});

test('conversation metadata replay preserves understanding and continuation without speaking an absent reply',async()=>{
  const h=harness([response({understood:true,xpAwarded:12,replayed:true,nextTurnId:'turn2',complete:false})],{conversation:true});
  await h.run();
  assert.equal(h.state.xp,12);assert.equal(h.state.pendingNextTurnId,'turn2');
  assert.deepEqual(h.state.learnedSentences,['conversation:breakfast:turn1']);
  assert.deepEqual(h.said,[]);assert.match(h.status.textContent,/听懂你的意思/);
});

test('a cancelled submission cannot replace the cancellation state with a retry error',async()=>{
  const h=harness([]);
  h.context.apiFetch=async()=>{h.context.speechGeneration++;h.context.recentTake=null;h.status.textContent='已取消';return response({detail:'speech_timeout'},503)};
  await h.run();
  assert.equal(h.status.textContent,'已取消');assert.equal(h.take.retry,false);assert.equal(h.state.xp,0);
});
