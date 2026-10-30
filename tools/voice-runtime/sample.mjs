import { loadVoice, VOICE_MODEL } from './model.mjs';
import { pcm16Wav } from './wav.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const destination=resolve(import.meta.dirname,'../../output/voice-samples');
await mkdir(destination,{recursive:true});
console.log('Loading pinned Kokoro model; this is local inference, not an API request.');
const tts=await loadVoice();
const sentences=[
  ['bobo','Hello! I am Bobo. What would you like for breakfast?'],
  ['milk','I would like some milk, please.'],
  ['encouragement','Nice try! Listen once more. Then you can have another go.'],
  ['words','Apple. Cat. Dog. Ship.'],
  ['letter-a','A.']
];
const results=[];
for(const [id,text] of sentences){
  const start=Date.now();
  const audio=await tts.generate(text,{voice:'af_heart',speed:.94});
  await writeFile(resolve(destination,`${id}.wav`),pcm16Wav(audio.audio,audio.sampling_rate));
  results.push({id,text,seconds:audio.audio.length/audio.sampling_rate,elapsedMs:Date.now()-start});
  console.log(JSON.stringify(results.at(-1)));
}
await writeFile(resolve(destination,'manifest.json'),JSON.stringify({...VOICE_MODEL,results},null,2)+'\n');
