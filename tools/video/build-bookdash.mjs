// Reproducible CC BY 4.0 picture-book readings, not full character animation.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {BOOKDASH_LESSONS} from '../../server/app/static/videos/bookdash.mjs';
import {AUDIO_CLIPS} from '../../server/app/static/audio-manifest.mjs';
const require=createRequire(new URL('../voice-runtime/package.json',import.meta.url)),sharp=require('sharp');
const root=resolve(import.meta.dirname,'../../server/app/static'),out=resolve(root,'videos');
const sources=resolve(import.meta.dirname,'../../output/bookdash-sources'),scratch=resolve(import.meta.dirname,'../../output/bookdash-build');
await mkdir(scratch,{recursive:true});
const fps=15,logo=await readFile(resolve(out,'bookdash-logo.png')),selected=process.argv.slice(2);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const text=(x,y,s,size=20,fill='#55516b')=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${fill}">${esc(s)}</text>`;
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">${s}</svg>`);
const stamp=s=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`};
const provenance=[];
for(const lesson of BOOKDASH_LESSONS){
  const folder=resolve(sources,lesson.slug),manifest=JSON.parse(await readFile(resolve(folder,'provenance.json'),'utf8'));
  if(manifest.license!==lesson.source.license||manifest.page!==lesson.source.url)throw new Error('Unreviewed source');
  if([...manifest.creators].sort().join('|')!==[...lesson.source.creators].sort().join('|'))throw new Error('Creator attribution mismatch: '+lesson.id);
  const frames=new Map();
  for(const index of [0,...lesson.transcript.map(c=>c.page)]){
    const item=manifest.images.find(p=>p.index===index),bytes=await readFile(resolve(folder,item.file));
    if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('Changed illustration');
    const art=await sharp(bytes).resize(900,400,{fit:'contain',background:'#fff'}).png().toBuffer();
    const footer=svg(text(28,29,lesson.titleEn,20)+text(28,486,'Book Dash | Adapted picture-book reading',16)+text(28,514,'Simplified English narration · Synthetic voice · CC BY 4.0',14));
    frames.set(index,await sharp({create:{width:960,height:540,channels:3,background:'#f9f6ef'}}).composite([{input:art,left:30,top:46},{input:footer},{input:await sharp(logo).resize(108,54).toBuffer(),left:824,top:470}]).png().toBuffer());
  }
  const creditText=text(34,60,lesson.titleEn,28)+text(34,105,'Originally published by Book Dash · CC BY 4.0',22)
    +lesson.source.creators.map((creator,i)=>text(34,150+i*30,creator,19)).join('')
    +text(34,298,lesson.source.url,16)+text(34,327,lesson.source.licenseUrl,16)
    +text(34,377,'StarPet adaptation: simplified narration, Chinese support, page transitions',17)
    +text(34,404,'and learning activities. Synthetic English voice. Original art preserved.',17)
    +text(34,437,'Book Dash and the original creators do not endorse this app.',17);
  const credits=await sharp({create:{width:960,height:540,channels:3,background:'#fffdf7'}}).composite([{input:svg(creditText)},{input:await sharp(logo).resize(140,70).toBuffer(),left:34,top:458}]).png().toBuffer();
  provenance.push({...lesson.source,id:lesson.id,title:lesson.titleEn,images:manifest.images,adaptation:'Simplified English narration and Chinese translation by StarPet; original illustrations preserved; added gentle page transitions and original learning activities; synthetic Kokoro voice.'});
  if(selected.length&&!selected.includes(lesson.id))continue;
  for(const cue of lesson.transcript){if(!AUDIO_CLIPS[cue.en]||AUDIO_CLIPS[cue.en].durationMs>(cue.end-cue.start-.15)*1000)throw new Error('Narration does not fit: '+cue.en)}
  const temporary=resolve(scratch,lesson.id+'.partial.mp4');
  const args=['-y','-loglevel','error','-f','image2pipe','-vcodec','png','-r',String(fps),'-i','pipe:0'];
  lesson.transcript.forEach(c=>args.push('-i',resolve(root,AUDIO_CLIPS[c.en].path.slice('/static/'.length))));
  const filters=lesson.transcript.map((c,i)=>`[${i+1}:a]adelay=${Math.round(c.start*1000)}:all=1[a${i}]`).join(';')+';'+lesson.transcript.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${lesson.transcript.length}:normalize=0,alimiter=limit=.92,apad[audio]`;
  args.push('-filter_complex',filters,'-map','0:v','-map','[audio]','-t',String(lesson.duration),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','80k','-movflags','+faststart',temporary);
  const proc=spawn('ffmpeg',args,{windowsHide:true,stdio:['pipe','inherit','inherit']}),done=once(proc,'close');let inputError;
  proc.stdin.on('error',error=>inputError=error);
  const creditAt=3+lesson.transcript.length*8.5;
  let lastKey='',current,previous=frames.get(0),transition=[];
  for(let n=0;n<lesson.duration*fps;n++){
    if(inputError)throw inputError;
    const t=n/fps,index=t<3?-1:Math.floor((t-3)/8.5),key=t>=creditAt?'credits':index<0?'cover':String(index);
    if(key!==lastKey){
      previous=current||frames.get(0);current=key==='credits'?credits:key==='cover'?frames.get(0):frames.get(lesson.transcript[index].page);lastKey=key;
      transition=[];for(let step=0;step<6;step++){
        const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><image href="data:image/png;base64,${current.toString('base64')}" width="960" height="540" opacity="${(step+1)/6}"/></svg>`);
        transition.push(await sharp(previous).composite([{input:overlay}]).png().toBuffer());
      }
    }
    const since=key==='credits'?t-creditAt:key==='cover'?t:t-(3+index*8.5),frame=since<.4?transition[Math.min(5,Math.floor(since*fps))]:current;
    if(!proc.stdin.write(frame))await once(proc.stdin,'drain');
    if(n%(fps*30)===0)console.log(JSON.stringify({book:lesson.id,seconds:Math.floor(t),duration:lesson.duration}));
  }
  proc.stdin.end();if((await done)[0]!==0)throw new Error('Encoding failed: '+lesson.id);
  await rename(temporary,resolve(out,lesson.id+'.mp4'));
  await sharp(frames.get(lesson.transcript[0].page)).jpeg({quality:88}).toFile(resolve(out,lesson.id+'.jpg'));
  await writeFile(resolve(out,lesson.id+'.vtt'),'WEBVTT\n\n'+lesson.transcript.map(c=>`${stamp(c.start)} --> ${stamp(c.end)}\n${c.en}`).join('\n\n')+'\n');
  await writeFile(resolve(scratch,lesson.id+'-credits.png'),credits);
  console.log('Built licensed picture-book reading:',lesson.id);
}
await writeFile(resolve(out,'bookdash-sources.json'),JSON.stringify({format:1,reviewed:'2026-10-26',logo:{url:'https://bookdash.org/wp-content/themes/bd/assets/images/book-dash-logo-md.svg',conversion:'Unmodified publisher SVG rendered to PNG'},books:provenance},null,2)+'\n');
