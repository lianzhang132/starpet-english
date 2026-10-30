export function pcmWav(pcm){
  if(!(pcm instanceof ArrayBuffer)||pcm.byteLength%2)throw new Error('Invalid PCM');
  const wav=new ArrayBuffer(44+pcm.byteLength),view=new DataView(wav);
  const str=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i))};
  str(0,'RIFF');view.setUint32(4,36+pcm.byteLength,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,pcm.byteLength,true);
  new Uint8Array(wav,44).set(new Uint8Array(pcm));return wav;
}
export function pcmHasVoice(pcm){
  const view=new DataView(pcm);let energy=0,peak=0;
  for(let i=0;i+1<pcm.byteLength;i+=2){const x=view.getInt16(i,true)/32768;energy+=x*x;peak=Math.max(peak,Math.abs(x))}
  // Detect near-digital silence only; quiet children's voices should still reach ASR.
  return peak>.002&&Math.sqrt(energy/Math.max(1,pcm.byteLength/2))>.0004;
}
