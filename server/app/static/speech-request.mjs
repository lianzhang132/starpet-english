const RETRY_MESSAGES={
  speech_busy:'波波现在有点忙。录音还在本页，稍等一下点“重试识别”就好。',
  speech_timeout:'波波这次听得有点久。录音还在本页，可以点“重试识别”，不必重新录音。',
  speech_invalid_response:'波波这次没收到完整结果。录音还在本页，可以点“重试识别”。',
  speech_unavailable:'波波的语音服务暂时连不上。可以先听回放，稍后在本页重试识别。'
};

export async function readSpeechResponse(response,{conversation=false}={}) {
  let value;
  try{value=await response.json()}
  catch(error){if(error?.name==='AbortError')throw error}
  if(!response.ok){
    const fallback=response.status===429?'speech_busy':[408,504].includes(response.status)?'speech_timeout':response.status===503?'speech_unavailable':null;
    const code=typeof value?.detail==='string'&&Object.hasOwn(RETRY_MESSAGES,value.detail)?value.detail:fallback;
    throw new Error(RETRY_MESSAGES[code]||'这次未完成识别，录音还在本页，可以重试。');
  }
  // Replayed receipts intentionally omit transcripts; the outcome remains authoritative.
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value[conversation?'understood':'passed']!=='boolean'){
    throw new Error(RETRY_MESSAGES.speech_invalid_response);
  }
  return value;
}
