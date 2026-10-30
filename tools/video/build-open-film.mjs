// CC BY 4.0 film adaptation: keep the entire original film/music/credits,
// add English learning narration and a separate attribution card.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile,mkdir,stat,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {OPEN_FILMS} from '../../server/app/static/videos/open-films.mjs';
import {AUDIO_CLIPS} from '../../server/app/static/audio-manifest.mjs';
const require=createRequire(new URL('../voice-runtime/package.json',import.meta.url)),sharp=require('sharp');
const film=OPEN_FILMS[0],root=resolve(import.meta.dirname,'../../server/app/static');
const scratch=resolve(import.meta.dirname,'../../output/open-movie-sources'),source=resolve(scratch,'llamigos-original.mp4');
await mkdir(scratch,{recursive:true});
if(createHash('sha256').update(await readFile(source)).digest('hex')!==film.source.originalSha256)throw new Error('Original film needs re-review');
const evidence=await readFile(resolve(scratch,'llamigos-license.html'),'utf8');
if(!evidence.includes(film.source.licenseUrl)||!evidence.includes('You are free to share and adapt this content'))throw new Error('Missing publisher license evidence');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const lines=[film.titleEn,'Original film: Blender Studio / Blender Foundation','https://studio.blender.org/projects/caminandes-3/','CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/',
  'The complete original film, music and credits are preserved.',
  'StarPet adaptation: added synthetic English learning narration,',
  'Chinese support and activities; reduced music volume and resolution.',
  'The original film has no English dialogue.',
  'Blender Studio and the original creators do not endorse this app.'];
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#f5f8fc"/>${lines.map((line,i)=>`<text x="34" y="${62+i*48}" font-family="Arial,sans-serif" font-size="${i?20:30}" fill="#35445b">${esc(line)}</text>`).join('')}</svg>`);
const credit=resolve(scratch,'llamigos-adaptation-credits.png');await sharp(svg).png().toFile(credit);
const temporary=resolve(scratch,'film-llamigos.partial.mp4');
const args=['-y','-v','error','-i',source,'-loop','1','-framerate','24','-i',credit];
for(const cue of film.transcript){
  const clip=AUDIO_CLIPS[cue.en];if(!clip||clip.durationMs>(cue.end-cue.start-.1)*1000)throw new Error('Narration does not fit '+cue.en);
  args.push('-i',resolve(root,clip.path.slice('/static/'.length)));
}
const visual='[0:v]scale=960:540,fps=24,setsar=1,setpts=PTS-STARTPTS[v0];[1:v]trim=duration=9,setpts=PTS-STARTPTS,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0,tpad=stop_mode=clone:stop_duration=1[v]';
const audio='[0:a]volume=.3,apad[a0];'+film.transcript.map((c,i)=>`[${i+2}:a]adelay=${Math.round(c.start*1000)}:all=1[a${i+1}]`).join(';')+';'+Array.from({length:film.transcript.length+1},(_,i)=>`[a${i}]`).join('')+`amix=inputs=${film.transcript.length+1}:normalize=0,alimiter=limit=.92,apad[a]`;
args.push('-filter_complex',visual+';'+audio,'-map','[v]','-map','[a]','-t',String(film.duration),'-c:v','libx264','-preset','slow','-crf','25','-maxrate','600k','-bufsize','1200k','-pix_fmt','yuv420p','-c:a','aac','-b:a','80k','-movflags','+faststart',temporary);
console.log('Encoding complete licensed film with learning narration…');
const proc=spawn('ffmpeg',args,{windowsHide:true,stdio:'inherit'});if((await once(proc,'close'))[0]!==0)throw new Error('Film encoding failed');
if((await stat(temporary)).size>=16*1024*1024)throw new Error('Film exceeds safe local playback size');
await rename(temporary,resolve(root,'videos/film-llamigos.mp4'));
const poster=spawn('ffmpeg',['-y','-v','error','-ss','20','-i',source,'-frames:v','1','-vf','scale=960:540',resolve(root,'videos/film-llamigos.jpg')],{windowsHide:true,stdio:'inherit'});
if((await once(poster,'close'))[0]!==0)throw new Error('Poster failed');
const stamp=s=>{const ms=Math.round(s*1000);return `00:${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`};
await writeFile(resolve(root,'videos/film-llamigos.vtt'),'WEBVTT\n\n'+film.transcript.map(c=>`${stamp(c.start)} --> ${stamp(c.end)}\n${c.en}`).join('\n\n')+'\n');
await writeFile(resolve(root,'videos/open-film-sources.json'),JSON.stringify({format:1,reviewed:'2026-10-26',films:[{id:film.id,...film.source,adaptation:'Full original film, music and credits retained; added synthetic English learning narration, Chinese support and activities; adjusted music volume and resolution; appended adaptation credit card.'}]},null,2)+'\n');
console.log('Built',film.id,(await stat(resolve(root,'videos/film-llamigos.mp4'))).size,'bytes');
