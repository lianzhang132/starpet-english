import {resolve} from 'node:path';
import { KokoroTTS } from 'kokoro-js';
import { StyleTextToSpeech2Model, AutoTokenizer } from '@huggingface/transformers';

export const VOICE_MODEL={id:'onnx-community/Kokoro-82M-v1.0-ONNX',
  revision:'1939ad2a8e416c0acfeecc08a694d14ef25f2231',voice:'af_heart',dtype:'q8',speed:.94};
export async function loadVoice(){
  // Kokoro's convenience loader drops revision/cache_dir in 1.2.1. Use its public constructor.
  const options={revision:VOICE_MODEL.revision,cache_dir:process.env.STARPET_VOICE_CACHE || resolve(import.meta.dirname,'../../.cache/voice'),
    progress_callback:p=>{if(p.status==='done')console.log('Ready:',p.file)}};
  const [model,tokenizer]=await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(VOICE_MODEL.id,{...options,dtype:VOICE_MODEL.dtype,device:'cpu'}),
    AutoTokenizer.from_pretrained(VOICE_MODEL.id,options)
  ]);
  return new KokoroTTS(model,tokenizer);
}
