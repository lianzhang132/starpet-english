// Mixed prompts must not hand English vocabulary to a Chinese TTS voice.
export const isChineseText = text => /[\u3400-\u9fff]/.test(text);

export function speechSegments(text) {
  const segments=[];
  let current='',language=null;
  const flush=()=>{
    const value=language==='en'?current.trim().replace(/^[“”‘’"'（）()。，：；！？]+|[“”‘’"'（）()。，：；！？]+$/g,'').trim():current.trim();
    if(/[A-Za-z0-9\u3400-\u9fff]/.test(value))segments.push(value);
    current='';
  };
  for(const character of String(text||'')){
    const next=isChineseText(character)?'zh':/[A-Za-z]/.test(character)?'en':null;
    if(next&&language&&next!==language)flush();
    if(next)language=next;
    current+=character;
  }
  flush();
  return segments;
}
