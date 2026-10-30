import test from 'node:test';
import assert from 'node:assert/strict';
import {speakingFeedback} from '../app/static/speaking-feedback.mjs';

test('uncertain ASR is not presented as a pronunciation score or a child mistake',()=>{
  const text=speakingFeedback({passed:false,score:0,transcript:'too many the money',feedback:'未说清：good morning'});
  assert.match(text,/这次波波没听准，先听听回放，再试一次。/);
  assert.match(text,/系统识别（可能听错）：too many the money/);
  assert.doesNotMatch(text,/%|匹配度|未说清|你说错|发音差/);
});

test('only a true pass gets success encouragement; absent or empty results stay gentle',()=>{
  assert.match(speakingFeedback({passed:true,transcript:'Good morning'}),/波波听懂这句啦！勇敢开口真棒。/);
  for(const result of [null,{}, {passed:false,transcript:'  '}, {passed:'true'}]){
    const text=speakingFeedback(result);
    assert.match(text,/这次波波没听准/);
    assert.match(text,/这次没有识别到完整句子/);
    assert.doesNotMatch(text,/undefined|null|听懂这句/);
  }
});

test('conversation feedback depends on understanding and keeps the pet reply',()=>{
  const understood=speakingFeedback({understood:true,passed:false,transcript:'I am eight.',reply:'Nice to meet you!'}, {conversation:true});
  assert.match(understood,/波波听懂你的意思啦/);
  assert.match(understood,/波波：Nice to meet you!/);
  const unclear=speakingFeedback({understood:false,passed:true,score:0,transcript:'good',feedback:'发音差'}, {conversation:true});
  assert.match(unclear,/这次波波还没听懂/);
  assert.doesNotMatch(unclear,/%|发音|undefined|听懂你的意思/);
});
