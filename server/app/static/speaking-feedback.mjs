// A recognizer's transcript is uncertain; it is not a child's pronunciation score.
export function speakingFeedback(result, {conversation=false}={}) {
  const value=result&&typeof result==='object'?result:{};
  const understood=(conversation?value.understood:value.passed)===true;
  const encouragement=understood
    ?conversation?'波波听懂你的意思啦！勇敢开口真棒。':'波波听懂这句啦！勇敢开口真棒。'
    :conversation?'这次波波还没听懂，先听听回放，再试一次。':'这次波波没听准，先听听回放，再试一次。';
  const transcript=typeof value.transcript==='string'?value.transcript.trim():'';
  const recognition=transcript?`系统识别（可能听错）：${transcript}`:value.replayed===true?'已恢复这次练习结果，可以继续练习。':'系统识别（可能听错）：（这次没有识别到完整句子）';
  const lines=[encouragement,recognition];
  const reply=typeof value.reply==='string'?value.reply.trim():'';
  if(conversation&&reply)lines.push(`波波：${reply}`);
  return lines.join('\n');
}
