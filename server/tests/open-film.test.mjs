import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {OPEN_FILMS} from '../app/static/videos/open-films.mjs';
import {AUDIO_CLIPS} from '../app/static/audio-manifest.mjs';
import {VIDEO_LESSONS} from '../app/static/videos/catalog.mjs';
import {prepareLocalVideo} from '../app/static/video-source.mjs';
import {createHash} from 'node:crypto';

test('licensed 3D film is presented as an English-guided adaptation, distinct from picture books',()=>{
  const film=OPEN_FILMS[0];assert.equal(OPEN_FILMS.length,1);assert.equal(film.kind,'film');
  assert.equal(VIDEO_LESSONS.at(-1).id,film.id);assert.equal(VIDEO_LESSONS.length,14);
  assert.match(film.description,/原片没有英语对白/);assert.match(film.description,/家长/);
  assert.equal(film.source.url,'https://studio.blender.org/projects/caminandes-3/');
  assert.equal(film.source.license,'CC BY 4.0');assert.match(film.source.credit,/原片、原配乐和完整制作名单保留/);
  assert.match(film.source.originalSha256,/^[a-f0-9]{64}$/);
});
test('film narration is bilingual, short, audible offline and leaves quiet response gaps',()=>{
  const film=OPEN_FILMS[0];let previousEnd=0;
  for(const cue of film.transcript){assert.ok(cue.start>=previousEnd);assert.ok(cue.end<film.duration);assert.ok(cue.zh);assert.ok(AUDIO_CLIPS[cue.en].durationMs<(cue.end-cue.start-.1)*1000);previousEnd=cue.end}
  for(const turn of film.interactions){assert.ok(film.practice.some(p=>p.en===turn.promptEn));assert.ok(!film.transcript.some(c=>c.start<turn.at+4&&c.end>turn.at))}
});
test('complete adapted film stays within the bounded local reader and retains caption/attribution files',async()=>{
  const root=new URL('../app/static/videos/',import.meta.url);
  const info=await stat(new URL('film-llamigos.mp4',root));assert.ok(info.size>1000000&&info.size<16*1024*1024);
  const vtt=await readFile(new URL('film-llamigos.vtt',root),'utf8');for(const c of OPEN_FILMS[0].transcript)assert.ok(vtt.includes(c.en));
  const data=JSON.parse(await readFile(new URL('open-film-sources.json',root)));
  assert.equal(data.films[0].originalSha256,OPEN_FILMS[0].source.originalSha256);assert.match(data.films[0].adaptation,/Full original film/);
});
test('the actual longer film is read byte-for-byte while the default size ceiling still rejects excess',async()=>{
  const bytes=await readFile(new URL('../app/static/videos/film-llamigos.mp4',import.meta.url));let blob;
  const lease=await prepareLocalVideo(OPEN_FILMS[0].src,undefined,{
    fetcher:async()=>new Response(bytes,{headers:{'Content-Length':String(bytes.length)}}),
    createURL:value=>{blob=value;return 'blob:actual-film'},revokeURL(){},
  });
  assert.equal(lease.bytes,bytes.length);
  assert.equal(createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
  lease.release();
  await assert.rejects(prepareLocalVideo(OPEN_FILMS[0].src,undefined,{
    fetcher:async()=>({ok:true,headers:{get:()=>String(16*1024*1024+1)},body:{getReader:()=>assert.fail('Oversize film must not be read')}}),
  }),/too large/);
});
