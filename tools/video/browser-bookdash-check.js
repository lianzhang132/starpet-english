// Invoke only on tools/video/serve-qa.py's memory-only local page.
(() => {
  if(location.href!=='http://127.0.0.1:8768/video-qa')throw new Error('Isolated QA origin required');
  if(document.hidden)throw new Error('Bring the local QA tab to the foreground before media acceptance');
  const qa=window.__videoQA;qa.phase='checking-six-files';qa.results=[];
  const check=(value,message)=>{if(!value)throw new Error(message)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn,timeout=20000)=>{const end=performance.now()+timeout;while(!fn()){if(document.hidden)throw new Error('QA tab moved to the background; acceptance stopped');if(performance.now()>end)throw new Error('Timeout: '+qa.phase);await wait(100)}};
  (async()=>{
    const legacy=JSON.stringify(qa.state.videoProgress.hello);
    check(document.querySelectorAll('[data-video]').length===14,'Library count');
    for(const book of qa.books){
      qa.room.open(book.id);await until(()=>qa.room.mediaReady&&qa.room.player.readyState>=2);
      const video=qa.room.player;check(video.videoWidth===960&&Math.round(video.duration)===book.duration,'Cannot decode '+book.id);
      check(video.paused,'Preparation autoplayed');qa.room.interactive=false;
      qa.room.continueStory();await until(()=>video.currentTime>.5);qa.room.pause();
      video.currentTime=book.duration-1.5;await until(()=>!video.seeking);qa.room.continueStory();await until(()=>video.ended,5000);
      check(!qa.state.videoProgress[book.id].completed,'Seek awarded completion');
      qa.results.push({id:book.id,decoded:true,headAndEnd:true,bytes:qa.room.sourceLease.bytes});
    }
    qa.phase='full-fifi';qa.room.interactive=true;qa.room.open('book-fifi-and-teddy');
    await until(()=>qa.room.mediaReady&&qa.room.player.readyState>=2);qa.room.continueStory();
    await until(()=>qa.room.pendingTurn,60000);check(qa.room.pendingTurn.promptEn==='Where is Teddy?','Wrong first turn');
    document.querySelector('[data-vact="story-sound"]').click();await wait(3000);
    check(qa.room.pendingTurn&&qa.room.player.paused,'Listening cleared invitation');
    document.querySelector('[data-vact="story-continue"]').click();qa.phase='full-fifi-second-turn';
    await until(()=>qa.room.pendingTurn,65000);check(qa.room.pendingTurn.promptEn==='There you are, Teddy!','Wrong second turn');
    document.querySelectorAll('[data-vact="story-continue"]')[1].click();qa.phase='full-fifi-ending';
    await until(()=>qa.room.player.ended,35000);check(qa.state.xp===17&&qa.state.stars===4,'Watching alone rewarded');
    const lesson=qa.room.lesson;
    for(const [i,q] of lesson.questions.entries())qa.room.answer(i,q.correctIndex);
    check(qa.state.xp===32&&qa.state.stars===5,'Completed story reward missing');
    qa.room.answer(0,lesson.questions[0].correctIndex);check(qa.state.xp===32,'Repeated reward');
    const cat=qa.books[0];qa.state.videoProgress[cat.id]={position:115,seconds:Array.from({length:92},(_,i)=>i)};
    qa.room.open(cat.id,'questions');await until(()=>qa.room.mediaReady&&qa.room.player.readyState>=2);
    check(qa.room.player.paused&&qa.room.questionFocus,'Question shortcut autoplayed');
    check(document.querySelector('#video-status').textContent.includes('无需再看一遍'),'Question shortcut unclear');
    check(JSON.stringify(qa.state.videoProgress.hello)===legacy,'Legacy changed');
    check(!qa.events.some(e=>e.error),'Playback/speech error');qa.room.pause();qa.stop();qa.phase='passed';
  })().catch(e=>{qa.phase='failed';qa.error=e.stack});
  return 'Started isolated real-media acceptance';
})()
