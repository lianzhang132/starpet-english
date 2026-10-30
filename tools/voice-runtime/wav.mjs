// Generated assets use standard PCM16 WAV, supported by Android MediaPlayer and browsers.
export function pcm16Wav(samples,rate=24000){
  if(!samples.length||samples.length/rate>30)throw new Error('Invalid clip duration');
  let peak=0,squares=0;
  for(const value of samples){if(!Number.isFinite(value))throw new Error('Non-finite audio');peak=Math.max(peak,Math.abs(value));squares+=value*value}
  if(peak<.03||Math.sqrt(squares/samples.length)<.002)throw new Error('Near-silent generated clip');
  const gain=Math.min(2,.85/peak),wav=Buffer.alloc(44+samples.length*2);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]*gain))*32767),44+i*2);
  return wav;
}
