import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLocalVideo} from '../app/static/video-source.mjs';

const path='/static/videos/story-balloon.mp4?v=local-stream-2';
function response(chunks,declared) {
  const queue=[...chunks],state={cancelled:0,released:0};
  return {state,ok:true,headers:{get:()=>String(declared)},body:{getReader:()=>({
    read:async()=>queue.length?{done:false,value:queue.shift()}:{done:true},
    cancel:async()=>{state.cancelled++},releaseLock:()=>{state.released++},
  })}};
}

test('only a complete bounded read becomes a playable Blob; its lease releases once',async()=>{
  const data=response([new Uint8Array([1,2]),new Uint8Array([3,4,5])],5);
  const requests=[],released=[];let created;
  const lease=await prepareLocalVideo(path,undefined,{fetcher:async(...args)=>{requests.push(args);return data},
    createURL:blob=>{created=blob;return 'blob:one'},revokeURL:url=>released.push(url)});
  assert.equal(created.type,'video/mp4');assert.equal(created.size,5);assert.equal(lease.bytes,5);
  assert.equal(requests[0][1].cache,'no-store');assert.equal(data.state.released,1);
  lease.release();lease.release();assert.deepEqual(released,['blob:one']);
});

test('a truncated response cannot create a video URL',async()=>{
  let created=false;const data=response([new Uint8Array(3)],10);
  await assert.rejects(prepareLocalVideo(path,undefined,{fetcher:async()=>data,createURL:()=>{created=true}}),/incomplete/);
  assert.equal(created,false);assert.equal(data.state.released,1);
});

test('oversized declarations are rejected before reading and overlong streams are cancelled',async()=>{
  const declared=response([],100);
  declared.body.getReader=()=>assert.fail('Oversized declared video must not be read');
  await assert.rejects(prepareLocalVideo(path,undefined,{maxBytes:10,fetcher:async()=>declared}),/too large/);
  const extra=response([new Uint8Array(8)],4);
  await assert.rejects(prepareLocalVideo(path,undefined,{maxBytes:10,fetcher:async()=>extra}),/exceeded/);
  assert.equal(extra.state.cancelled,1);assert.equal(extra.state.released,1);
});

test('cancelling a read stops the reader and never allocates a playback URL',async()=>{
  const controller=new AbortController(),data=response([new Uint8Array(3)],3);
  const original=data.body.getReader;
  data.body.getReader=()=>{const reader=original();const read=reader.read;reader.read=async()=>{controller.abort();return read()};return reader};
  await assert.rejects(prepareLocalVideo(path,controller.signal,{fetcher:async()=>data}),{name:'AbortError'});
  assert.equal(data.state.cancelled,1);assert.equal(data.state.released,1);
});

test('already cancelled requests never fetch and unrelated destinations are refused',async()=>{
  const controller=new AbortController();controller.abort();
  const fetcher=()=>assert.fail('No fetch expected');
  await assert.rejects(prepareLocalVideo(path,controller.signal,{fetcher}),{name:'AbortError'});
  for(const invalid of ['https://example.com/film.mp4','/static/videos/../private.mp4','/static/videos/film.mp4?remote=1'])
    await assert.rejects(prepareLocalVideo(invalid,undefined,{fetcher}),/Invalid/);
});

test('older WebViews without a stream reader still require the exact declared size',async()=>{
  const data={ok:true,headers:{get:()=> '3'},arrayBuffer:async()=>new ArrayBuffer(3)};
  const lease=await prepareLocalVideo(path,undefined,{fetcher:async()=>data,createURL:()=> 'blob:legacy',revokeURL:()=>{}});
  assert.equal(lease.bytes,3);lease.release();
  data.arrayBuffer=async()=>new ArrayBuffer(2);
  await assert.rejects(prepareLocalVideo(path,undefined,{fetcher:async()=>data}),/incomplete/);
});

test('HarmonyOS duplicate equal Content-Length values are accepted but conflicting values are refused',async()=>{
  const data=response([new Uint8Array(5)],5);
  data.headers.get=()=> '5, 5';
  const lease=await prepareLocalVideo(path,undefined,{fetcher:async()=>data,createURL:()=> 'blob:harmony',revokeURL(){}});
  assert.equal(lease.bytes,5);lease.release();
  for(const value of ['5, 6','5,','5, invalid','0x5','-5']) {
    data.headers.get=()=>value;
    await assert.rejects(prepareLocalVideo(path,undefined,{fetcher:async()=>data}),/size unavailable/);
  }
});
