export function normalizeVideo(raw={},lesson){
  const seconds=Array.isArray(raw?.seconds)?[...new Set(raw.seconds.filter(n=>Number.isInteger(n)&&n>=0&&n<lesson.duration))]:[];
  const correct=Array.isArray(raw?.correct)?lesson.questions.filter(q=>raw.correct.includes(q.id)).map(q=>q.id):[];
  return {position:Number.isFinite(raw?.position)?Math.max(0,Math.min(lesson.duration,raw.position)):0,seconds,correct,completed:raw?.completed===true};
}
export function videoReady(progress,lesson){return progress.seconds.length>=Math.ceil(lesson.duration*.8)&&lesson.questions.every(q=>progress.correct.includes(q.id))}
// A watched story and a completed lesson are different milestones.
export function videoNextStep(raw,lesson){
  const p=normalizeVideo(raw,lesson);
  if(p.completed)return {intent:'watch',label:'✓ 已完成 · 可重看'};
  if(p.seconds.length>=Math.ceil(lesson.duration*.8))return {intent:'questions',label:'完成理解题 · 不用从头重看'};
  if(p.seconds.length)return {intent:'watch',label:'继续看 · 已看 '+Math.min(100,Math.round(p.seconds.length/lesson.duration*100))+'%'};
  return {intent:'watch',label:'开始观看'};
}
// Only elapsed playback earns coverage, never a seek, a hidden page, or a stalled timer.
export class WatchTracker{
  constructor(){this.reset()}
  reset(){this.time=null;this.wall=null}
  sample(progress,lesson,time,{playing=true,seeking=false,visible=true,rate=1,now=performance.now()}={}){
    if(!playing||seeking||!visible||!Number.isFinite(time)){this.reset();return false}
    let changed=false;
    if(this.time!==null){
      const delta=time-this.time,elapsed=(now-this.wall)/1000;
      if(delta>0&&elapsed>=0&&delta<=Math.min(2.5,elapsed*rate+.4)){
        // Include only fully traversed second boundaries; overlap cannot farm views.
        for(let n=Math.ceil(this.time);n+1<=time&&n<lesson.duration;n++)if(!progress.seconds.includes(n)){progress.seconds.push(n);changed=true}
        // A fractional last second can be covered across consecutive timeupdates.
        const n=Math.floor(time)-1;
        if(n>=0&&this.anchor<=n&&time>=n+1&&!progress.seconds.includes(n)){progress.seconds.push(n);changed=true}
      }else this.anchor=time;
    }else this.anchor=time;
    this.time=time;this.wall=now;progress.position=Math.min(lesson.duration,Math.max(0,time));return changed;
  }
}
