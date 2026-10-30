import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ALPHABET, PHONICS_SOUNDS, CVC_BLENDS } from '../app/static/phonics.mjs';
import { pcm16Wav } from '../../tools/voice-runtime/wav.mjs';
import { isChineseText } from '../app/static/text-language.mjs';

test('generated WAV uses finite, non-silent, peak-limited PCM16',()=>{
  const wav=pcm16Wav(Float32Array.from({length:12000},(_,i)=>Math.sin(i/10)));
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(20),1);
  assert.equal(wav.readUInt16LE(34),16);assert.equal(wav.readUInt32LE(24),24000);
  assert.throws(()=>pcm16Wav(new Float32Array(12000)),/silent/);
  assert.throws(()=>pcm16Wav(new Float32Array([NaN])),/finite/);
  let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));
  assert.ok(peak<28000&&peak>20000);
});

test('offline manifest covers course and phonics and hashes valid WAV data',async()=>{
  const root=new URL('../app/static/',import.meta.url);
  const {clips}=JSON.parse(await readFile(new URL('audio-manifest.json',root),'utf8'));
  const catalog=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
  const replies=JSON.parse(await readFile(new URL('voice-replies.json',root),'utf8'));
  const required=[...ALPHABET.flatMap(item=>[item.letter,item.word]),...PHONICS_SOUNDS.flatMap(item=>item.words),
    ...CVC_BLENDS.map(item=>item.word),...replies,...catalog.dialogues.flatMap(item=>item.lines),
    ...catalog.conversations.flatMap(item=>item.turns.map(turn=>turn.question)),
    ...catalog.lessons.flatMap(item=>[item.sentence,...item.words.map(word=>word.word),...item.questions.flatMap(question=>question.answers)])];
  for(const text of required.filter(text=>!isChineseText(text)))assert.ok(clips[text],`Missing clip: ${text}`);
  for(const [text,clip] of Object.entries(clips)){
    assert.equal(isChineseText(text),false,'English pack cannot contain Chinese text');
    assert.match(clip.path,/^\/static\/audio\/en-us\/[a-f0-9]{64}\.wav$/);
    const wav=await readFile(new URL(clip.path.slice('/static/'.length),root));
    assert.equal(createHash('sha256').update(wav).digest('hex'),clip.sha256,text);
    assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(34),16);
    assert.equal(wav.readUInt32LE(24),24000);assert.ok(clip.durationMs>=250&&clip.durationMs<=30000,text);
  }
});
