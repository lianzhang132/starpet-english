// Produces original H.264/AAC scene animations from code-native SVG frames.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {VIDEO_LESSONS} from '../../server/app/static/videos/catalog.mjs';
import {AUDIO_CLIPS} from '../../server/app/static/audio-manifest.mjs';
const require=createRequire(new URL('../voice-runtime/package.json',import.meta.url)),sharp=require('sharp');
const root=resolve(import.meta.dirname,'../../server/app/static'),folder=resolve(root,'videos');
await mkdir(folder,{recursive:true});
const bobo=(await readFile(resolve(root,'assets/bobo.png'))).toString('base64');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const apple='<path d="M0 -48 C-60 -95 -86 -15 -45 48 Q0 78 42 46 C85 -16 55 -93 0 -48" fill="#ef646f"/><path d="M0 -48 Q-8 -90 25 -94" fill="none" stroke="#775332" stroke-width="9"/><ellipse cx="26" cy="-79" rx="23" ry="10" fill="#63b98b" transform="rotate(-25 26 -79)"/>';
const banana='<path d="M-60 -62 Q-56 45 65 7 Q25 93 -46 39 Q-76 12 -60 -62" fill="#ffcf53" stroke="#c89b23" stroke-width="4"/>';
const milk='<path d="M-50 -70 L50 -70 L40 65 Q0 80 -40 65 Z" fill="#faffff" stroke="#92c9d3" stroke-width="5"/><path d="M-45 -26 L45 -26 L39 63 Q0 74 -39 63Z" fill="#e6f2f7"/><text y="26" text-anchor="middle" font-size="22" fill="#48738d">MILK</text>';
function animal(dog=false){return `<ellipse cy="38" rx="60" ry="43" fill="${dog?'#c58a50':'#f4bc77'}"/><path d="M-46 -22 L-61 -70 L-12 -44 M46 -22 L61 -70 L12 -44" fill="${dog?'#87532b':'#f4bc77'}" stroke="${dog?'#87532b':'#f4bc77'}" stroke-width="16"/><ellipse cy="-10" rx="59" ry="46" fill="${dog?'#d9a46b':'#ffce91'}"/><circle cx="-20" cy="-16" r="5"/><circle cx="20" cy="-16" r="5"/><path d="M-6 0 L6 0 L0 7 Z" fill="#65404a"/><path d="M-15 16 Q0 27 15 16" stroke="#65404a" stroke-width="3" fill="none"/>${dog?'':'<path d="M-40 3 L-72 -4 M-40 14 L-73 20 M40 3 L72 -4 M40 14 L73 20" stroke="#8f694f" stroke-width="3"/>'}`}
function frame(lesson,t){
  const cue=lesson.transcript.find(c=>t>=c.start&&t<c.end)||lesson.transcript.filter(c=>c.start<=t).at(-1)||lesson.transcript[0];
  const bounce=Math.sin(t*3)*9,phase=t-cue.start,show=1-Math.exp(-Math.max(0,phase)*4);
  let object='',label='',color='#d9f3df';
  if(lesson.id==='colors'){const fruit=['red','apple'].includes(cue.visual);object=fruit?apple:banana;label=fruit?'red · apple':'yellow · banana';color=fruit?'#ffe0e2':'#fff3c4'}
  else if(lesson.id==='breakfast'){object=milk;label=cue.visual==='morning'?'Good morning!':cue.visual==='thanks'?'Thank you!':'milk';color='#e0f3ff'}
  else if(lesson.id==='pets'){const dog=cue.visual.startsWith('dog');object=animal(dog);label=dog?'dog':'cat';color='#ffedcf'}
  else{object=`<image href="data:image/png;base64,${bobo}" x="-98" y="-116" width="196" height="196"/><path d="M-108 -44 Q-156 -${74+Math.sin(t*8)*15} -128 -100" fill="none" stroke="#8d81ea" stroke-width="15" stroke-linecap="round"/>`;label=cue.visual==='name'?'Your name?':cue.visual==='friends'?'Nice to meet you!':'Bobo';color='#eee5ff'}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#f5f6ff"/><circle cx="860" cy="60" r="120" fill="#fff0c9"/><path d="M0 380 Q250 310 480 390 T960 340 V540 H0Z" fill="#d3eddf"/><text x="44" y="56" font-family="Arial" font-weight="bold" font-size="27" fill="#4d4972">${esc(lesson.titleEn)}</text><text x="44" y="84" font-family="Arial" font-size="15" fill="#73708e">STARPet · Watch, listen, then say it!</text><ellipse cx="230" cy="431" rx="120" ry="18" fill="#bfd4d4"/><image href="data:image/png;base64,${bobo}" x="65" y="${125+bounce}" width="320" height="320"/><circle cx="657" cy="266" r="158" fill="${color}"/><g transform="translate(657 ${262+bounce}) scale(${(1.4*show).toFixed(3)})">${object}</g><rect x="450" y="416" width="420" height="72" rx="28" fill="white"/><text x="660" y="461" text-anchor="middle" font-family="Arial" font-size="${label.length>15?28:37}" font-weight="bold" fill="#4d4972">${esc(label)}</text><circle cx="390" cy="180" r="${12+Math.sin(t*5)*3}" fill="#f5c84e"/><text x="900" y="510" text-anchor="end" font-family="Arial" font-size="14" fill="#61766c">${Math.floor(t/lesson.duration*100)}%</text></svg>`;
}
for(const lesson of VIDEO_LESSONS.filter(item=>item.kind===undefined)){
  const args=['-y','-loglevel','error','-f','image2pipe','-vcodec','png','-r','15','-i','pipe:0'];
  for(const cue of lesson.transcript){const clip=AUDIO_CLIPS[cue.en];if(!clip)throw new Error('Missing audio: '+cue.en);if(clip.durationMs>6000)throw new Error('Cue too short');args.push('-i',resolve(root,clip.path.replace('/static/','')))}
  const filters=lesson.transcript.map((c,i)=>`[${i+1}:a]adelay=${c.start*1000}:all=1[a${i}]`).join(';')+';'+lesson.transcript.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${lesson.transcript.length}:normalize=0,apad[audio]`;
  args.push('-filter_complex',filters,'-map','0:v','-map','[audio]','-t',String(lesson.duration),'-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',resolve(folder,lesson.id+'.mp4'));
  const proc=spawn('ffmpeg',args,{windowsHide:true,stdio:['pipe','inherit','inherit']});const done=once(proc,'close');
  for(let i=0;i<lesson.duration*15;i++){
    const svg=Buffer.from(frame(lesson,i/15));const png=await sharp(svg).png().toBuffer();
    if(i===30)await sharp(svg).jpeg({quality:85}).toFile(resolve(folder,lesson.id+'.jpg'));
    if(!proc.stdin.write(png))await once(proc.stdin,'drain');
  }
  proc.stdin.end();if((await done)[0]!==0)throw new Error('ffmpeg failed');
  const stamp=s=>`00:${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.000`;
  await writeFile(resolve(folder,lesson.id+'.vtt'),'WEBVTT\n\n'+lesson.transcript.map(c=>`${stamp(c.start)} --> ${stamp(c.end)}\n${c.en}`).join('\n\n')+'\n');
  console.log('Built original lesson',lesson.id);
}
