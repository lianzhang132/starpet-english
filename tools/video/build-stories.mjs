// Original, offline story films. No child's recordings or external video sources.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {VIDEO_LESSONS} from '../../server/app/static/videos/catalog.mjs';
import {AUDIO_CLIPS} from '../../server/app/static/audio-manifest.mjs';
import {pcm16Wav} from '../voice-runtime/wav.mjs';
import {renderStoryFrame} from './story-render.mjs';

const require=createRequire(new URL('../voice-runtime/package.json',import.meta.url)),sharp=require('sharp');
const root=resolve(import.meta.dirname,'../../server/app/static');
const folder=resolve(root,'videos'),scratch=resolve(import.meta.dirname,'../../output/story-build');
await mkdir(folder,{recursive:true});await mkdir(scratch,{recursive:true});
const fps=20,rate=24000;
const effects={wind:1.1,hop:.35,chirp:.6,sparkle:.8,rustle:.7,rain:1.4};
for(const [kind,duration] of Object.entries(effects)){
  const samples=new Float32Array(Math.ceil(duration*rate));let seed=7;
  for(let i=0;i<samples.length;i++){
    const t=i/rate,p=t/duration,envelope=Math.sin(Math.PI*p)**2;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
    const frequency=kind==='hop'?250+350*(1-p):kind==='chirp'?1400+650*Math.sin(p*8):kind==='sparkle'?[523.25,659.25,783.99][Math.min(2,Math.floor(p*3))]:180;
    samples[i]=envelope*.24*(['wind','rustle','rain'].includes(kind)?noise:Math.sin(2*Math.PI*frequency*t));
  }
  await writeFile(resolve(scratch,kind+'.wav'),pcm16Wav(samples,rate));
}
const sounds={
  'story-balloon':[[14.3,'wind'],[29.4,'hop'],[35.4,'chirp'],[69.8,'sparkle']],
  'story-picnic':[[14.4,'rustle'],[35.7,'hop'],[51.2,'sparkle'],[67.2,'sparkle']],
  'story-rain':[[7.4,'rain'],[15.4,'hop'],[67,'hop'],[70,'hop'],[72,'hop']],
};
const stamp=seconds=>`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(Math.floor(seconds)%60).padStart(2,'0')}.${String(Math.round((seconds%1)*1000)).padStart(3,'0')}`;
const audioOnly=process.argv.includes('--audio-only'),selected=process.argv.slice(2).filter(arg=>arg!=='--audio-only');
for(const lesson of VIDEO_LESSONS.filter(v=>v.kind==='story'&&(!selected.length||selected.includes(v.id)))){
  const cues=[];
  for(const cue of lesson.transcript){
    const clip=AUDIO_CLIPS[cue.en];if(!clip)throw new Error('Missing story audio: '+cue.en);
    if(clip.durationMs/1000>cue.end-cue.start-.15)throw new Error('Dialogue does not fit scene: '+cue.en);
    const file=resolve(root,clip.path.slice('/static/'.length)),wav=await readFile(file);
    if(wav.readUInt32LE(24)!==rate||wav.readUInt16LE(22)!==1)throw new Error('Unexpected voice format');
    cues.push({...cue,file,wav});
  }
  const audioInputs=[...cues.map(c=>({file:c.file,at:c.start,gain:1})),...(sounds[lesson.id]||[]).map(([at,kind])=>({file:resolve(scratch,kind+'.wav'),at,gain:.16}))];
  const temporary=resolve(scratch,lesson.id+'.partial.mp4');
  const args=audioOnly?['-y','-loglevel','error','-i',resolve(folder,lesson.id+'.mp4')]:['-y','-loglevel','error','-f','image2pipe','-vcodec','png','-r',String(fps),'-i','pipe:0'];
  audioInputs.forEach(input=>args.push('-i',input.file));
  const filters=audioInputs.map((a,i)=>`[${i+1}:a]volume=${a.gain},adelay=${Math.round(a.at*1000)}:all=1[a${i}]`).join(';')+';'+audioInputs.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${audioInputs.length}:normalize=0,alimiter=limit=.92,apad[audio]`;
  args.push('-filter_complex',filters,'-map','0:v','-map','[audio]','-t',String(lesson.duration));
  args.push(...(audioOnly?['-c:v','copy']:['-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p']));
  args.push('-c:a','aac','-b:a','96k','-movflags','+faststart',temporary);
  const proc=spawn('ffmpeg',args,{windowsHide:true,stdio:['pipe','inherit','inherit']});
  const done=once(proc,'close');let inputError=null;proc.stdin.on('error',error=>{inputError=error});
  for(let i=0;!audioOnly&&i<lesson.duration*fps;i++){
    if(inputError)throw inputError;
    const t=i/fps,cue=cues.find(c=>t>=c.start&&t<c.end);let speechLevel=0;
    if(cue){
      const start=Math.floor((t-cue.start)*rate),end=Math.min((cue.wav.length-44)/2,start+Math.floor(rate/fps));let sum=0;
      for(let n=start;n<end;n++){const sample=cue.wav.readInt16LE(44+n*2)/32768;sum+=sample*sample}
      speechLevel=end>start?Math.min(1,Math.sqrt(sum/(end-start))*8):0;
    }
    const svg=Buffer.from(renderStoryFrame(lesson,t,{speechLevel,speaker:cue?.speaker}));
    const png=await sharp(svg).png().toBuffer();
    if(i===Math.round(10*fps))await sharp(svg).jpeg({quality:88}).toFile(resolve(folder,lesson.id+'.jpg'));
    if(i% (fps*14)===0){await sharp(svg).png().toFile(resolve(scratch,`${lesson.id}-${Math.floor(t)}.png`));console.log(JSON.stringify({story:lesson.id,renderedSeconds:Math.floor(t),duration:lesson.duration}))}
    if(!proc.stdin.write(png))await once(proc.stdin,'drain');
  }
  proc.stdin.end();const [code]=await done;if(code!==0)throw new Error('Story encoding failed: '+lesson.id);
  await rename(temporary,resolve(folder,lesson.id+'.mp4'));
  await writeFile(resolve(folder,lesson.id+'.vtt'),'WEBVTT\n\n'+cues.map(c=>`${stamp(c.start)} --> ${stamp(c.end)}\n${c.en}`).join('\n\n')+'\n');
  console.log('Built story:',lesson.id);
}
