import {VIDEO_LESSONS} from './videos/catalog.mjs';
import {normalizeVideo,WatchTracker,videoReady,videoNextStep} from './video-learning.mjs';
import {StoryPauses} from './story-playback.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const durationLabel=seconds=>seconds>=60?`${Math.floor(seconds/60)} 分 ${seconds%60} 秒`:`${seconds} 秒`;
export class VideoRoom{
  constructor({root,getState,save,speak,speakWhilePaused=speak,beforeMedia,practice,canAct,toast,onComplete=()=>{},reportError=()=>{},prepareVideo=null}){
    Object.assign(this,{root,getState,save,speak,speakWhilePaused,beforeMedia,practice,canAct,toast,onComplete,reportError,prepareVideo});this.tracker=new WatchTracker();this.chinese=true;this.interactive=true;
    const stories=VIDEO_LESSONS.filter(v=>v.kind==='story').length,books=VIDEO_LESSONS.filter(v=>v.kind==='storybook').length,films=VIDEO_LESSONS.filter(v=>v.kind==='film').length;
    root.innerHTML=`<div class="video-intro"><small>BOBO STORY CLUB</small><h2>和波波一起，看故事学英语</h2><p>${films} 集 3D 动画导读 + ${books} 集有声绘本 + ${stories} 集波波动画 + ${VIDEO_LESSONS.length-books-stories-films} 集基础短片 · 离线可看</p><p>先跟着画面看懂，再试着帮故事里的朋友说一句。故事约 1–3 分钟，基础短片 28 秒；可以自由重看，也不必每次都做题。</p></div><div id="video-library" class="video-library"></div><article id="video-player-room" class="card" hidden></article>`;
    this.library=root.querySelector('#video-library');this.playerRoom=root.querySelector('#video-player-room');this.renderLibrary();
    root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;event.stopPropagation();if(!canAct())return;
      if(button.dataset.video){this.open(button.dataset.video,button.dataset.vintent);return}
      if(button.dataset.vact==='questions'){this.pause();this.playerRoom.querySelector('.video-questions')?.scrollIntoView({block:'center',behavior:'smooth'});return}
      if(button.dataset.vact==='play'){this.continueStory();return}
      if(button.dataset.vact==='story-continue'){this.continueStory();return}
      if(button.dataset.vact==='story-sound'){if(this.pendingTurn){this.beforeMedia();this.speakWhilePaused(this.pendingTurn.promptEn)}return}
      if(button.dataset.vact==='interactive'){this.interactive=!this.interactive;button.textContent=this.interactive?'一起说：开':'一起说：关';button.setAttribute('aria-pressed',String(this.interactive));if(!this.interactive&&this.pendingTurn)this.continueStory();return}
      if(button.dataset.vact==='restart'){this.pause();this.resumePosition=null;this.player.currentTime=0;this.progress.position=0;this.storyPauses?.reset(0);this.persist();return}
      if(button.dataset.vact==='chinese'){this.chinese=!this.chinese;button.textContent=this.chinese?'中文提示：开':'中文提示：关';button.setAttribute('aria-pressed',String(this.chinese));this.caption();return}
      if(button.dataset.vact==='speed'){this.player.playbackRate=this.player.playbackRate===1?.8:1;button.textContent=this.player.playbackRate===1?'正常速度':'慢速 0.8×';return}
      if(button.dataset.segment!==undefined){const c=this.lesson.transcript[+button.dataset.segment];this.repeat(c);return}
      if(button.dataset.vsound){this.pause();this.beforeMedia();this.speak(decodeURIComponent(button.dataset.vsound));return}
      if(button.dataset.vquestion!==undefined){this.answer(+button.dataset.vquestion,+button.dataset.voption);return}
      if(button.dataset.practice!==undefined){const p=this.lesson.practice[+button.dataset.practice];this.pause();if(p.sceneId)this.practice(p.sceneId,p.lineIndex);else{this.beforeMedia();this.speak(p.en);this.toast('听完后大声说一遍。这个词句可自由模仿，不作识别评分。')}return}
    });
  }
  renderLibrary(){
    const progress=this.getState().videoProgress||{};
    const tiles=items=>items.map(v=>{const next=videoNextStep(progress[v.id],v);return `<button class="video-tile" data-video="${v.id}" data-vintent="${next.intent}" aria-pressed="${this.lesson?.id===v.id}"><img src="${v.poster}" alt="${esc(v.title)} 故事封面" loading="lazy"><span><small>${esc(v.level)} · ${durationLabel(v.duration)}</small><b>${esc(v.title)}</b>${v.story?`<span class="video-hook">${esc(v.story.takeaway)}</span>`:''}<em>${next.label}</em></span></button>`}).join('');
    this.library.innerHTML=[{kind:'film',title:'动画小剧场 · 3D 故事',hint:'和家长一起欣赏动物小喜剧。原片没有英语对白，本版另配简单英语导读和中文提示。'},{kind:'storybook',title:'绘本故事馆',hint:'跟着画面找小猫、找玩具熊，听一听，再帮故事里的朋友说一句。'},{kind:'story',title:'波波趣味动画',hint:'有小麻烦，也有好朋友帮忙。先看懂，不急着背单词。'},{kind:undefined,title:'基础短片',hint:'原来的问候、水果和动物短片也保留在这里。'}].map(group=>`<section class="video-shelf"><h3>${group.title}</h3><p>${group.hint}</p><div class="video-grid">${tiles(VIDEO_LESSONS.filter(v=>v.kind===group.kind))}</div></section>`).join('');
  }
  open(id,intent='watch'){
    const original=VIDEO_LESSONS.find(v=>v.id===id);if(!original)return;this.pause();this.beforeMedia();
    this.releaseSource();this.mediaReady=!this.prepareVideo;
    // Retire partial responses cached by previous APK readers without touching progress storage.
    const lesson={...original,src:original.src+'?v=local-stream-2'};this.lesson=lesson;
    const sourceMarkup=this.prepareVideo?'':`<source src="${lesson.src}" type="video/mp4">`;
    this.progress=normalizeVideo(this.getState().videoProgress?.[id],lesson);this.tracker.reset();this.segmentEnd=null;this.savedAt=0;this.pendingTurn=null;this.resumePosition=null;this.storyPauses=new StoryPauses(lesson.interactions||[]);
    this.playerRoom.hidden=false;this.playerRoom.innerHTML=`<div class="card-title"><h3>${esc(lesson.title)}</h3><span>英文示范音为合成语音</span></div><div class="video-screen"><video id="lesson-video" controls playsinline preload="metadata" poster="${lesson.poster}" aria-label="${esc(lesson.title)}">${sourceMarkup}<track kind="captions" src="${lesson.captions}" srclang="en" label="English"></video><div class="video-caption" aria-hidden="true"><b></b><span></span></div></div><p id="video-status" role="status">点击播放；可以随时暂停、重听。</p><div class="video-tools"><button data-vact="play">▶ 播放 / 继续</button><button data-vact="restart">↶ 回到开头</button><button data-vact="chinese" aria-pressed="${this.chinese}">中文提示：${this.chinese?'开':'关'}</button><button data-vact="speed">正常速度</button></div><p class="care-note">${esc(lesson.description)} 看过至少 80%，再答对理解题，首次完成可获得 15 XP + 1 ⭐。</p><h3>① 逐句听懂</h3><div class="video-transcript">${lesson.transcript.map((c,i)=>`<button data-segment="${i}"><b>🔁 ${esc(c.en)}</b><span>${esc(c.zh)}</span></button>`).join('')}</div><h3>② 看懂了吗？</h3><div class="video-questions">${lesson.questions.map((q,i)=>`<fieldset><legend>${esc(q.prompt)}</legend><div class="video-options">${q.options.map((o,j)=>`<div><button data-vquestion="${i}" data-voption="${j}">${esc(o.en)}<small>${esc(o.zh)}</small></button><button data-vsound="${encodeURIComponent(o.en)}" aria-label="听选项 ${esc(o.en)}">🔊</button></div>`).join('')}</div><p id="video-feedback-${i}" role="status">${this.progress.correct.includes(q.id)?'✓ 已答对；可以重新练习。':''}</p></fieldset>`).join('')}</div><h3>③ 轮到你说啦</h3><div class="video-practice">${lesson.practice.map((p,i)=>`<button data-practice="${i}"><b>${p.sceneId?'🎙️':'🔊'} ${esc(p.en)}</b><span>${esc(p.zh)} · ${p.sceneId?'进入跟读挑战':'听完自由模仿'}</span></button>`).join('')}</div><p class="care-note">${esc(lesson.source.credit)} 不是自动连续播放；看完让眼睛休息一下。</p>`;
    this.questionFocus=intent==='questions'&&videoNextStep(this.progress,lesson).intent==='questions';
    if(lesson.source.type==='cc-by'){
      const source=lesson.source;
      const logo=source.publisher==='Book Dash'?'<img src="/static/videos/bookdash-logo.png" alt="Book Dash" width="120">':'';
      this.playerRoom.insertAdjacentHTML('beforeend',`<details class="video-credits"><summary>原作与改编说明</summary>${logo}<p>${esc(source.credit)}</p><p>${esc(source.creators.join('；'))}</p><p>原作：<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.url)}</a></p><p>许可：<a href="${esc(source.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.license)}</a>。原作方未对星伴英语作背书。</p></details>`);
    }
    this.playerRoom.querySelector('.video-tools').insertAdjacentHTML('beforeend','<button data-vact="questions">↓ 去理解题</button>');
    if(['story','storybook','film'].includes(lesson.kind)){
      this.playerRoom.querySelector('.video-tools').insertAdjacentHTML('beforeend',`<button data-vact="interactive" aria-pressed="${this.interactive}">一起说：${this.interactive?'开':'关'}</button>`);
      this.playerRoom.querySelector('.video-screen').insertAdjacentHTML('beforeend','<div class="story-turn" hidden role="group" aria-label="帮波波说一句"><div><small>轮到你帮忙啦 · 可以跳过</small><h3></h3><p class="story-turn-zh"></p><p class="story-turn-note">试着说给波波听。不打开麦克风，也不打分。</p><div><button data-vact="story-sound">🔊 听一遍</button><button data-vact="story-continue">我试过啦，继续看 →</button><button data-vact="story-continue">这次先跳过</button></div></div></div>');
      this.playerRoom.querySelector('#video-status').textContent='点击播放看故事；“一起说”可以随时关闭。每次开口都是自愿的。';
    }
    this.player=this.playerRoom.querySelector('video');
    const video=this.player;
    video.addEventListener('loadedmetadata',()=>{if(video!==this.player)return;const recovering=this.resumePosition!==null,position=this.resumePosition??this.progress.position;this.resumePosition=null;if(position>0&&(recovering||position<lesson.duration-1))video.currentTime=Math.min(position,lesson.duration-.05);this.storyPauses.reset(video.currentTime)});
    video.addEventListener('play',()=>{if(video!==this.player)return;this.clearStoryTurn();this.beforeMedia();this.tracker.reset();this.status('正在播放 · 跟着画面听故事')});
    video.addEventListener('seeking',()=>{if(video===this.player){this.clearStoryTurn();this.tracker.reset();this.storyPauses.sample(video.currentTime,{seeking:true})}});
    video.addEventListener('pause',()=>{if(video===this.player){this.tracker.reset();this.persist()}});
    video.addEventListener('timeupdate',()=>{
      if(video!==this.player)return;
      if(!this.mediaReady)return;
      if(this.resumePosition!==null)return;
      this.tracker.sample(this.progress,lesson,video.currentTime,{playing:!video.paused,seeking:video.seeking,visible:!document.hidden,rate:video.playbackRate});this.caption();
      const turn=this.storyPauses.sample(video.currentTime,{playing:!video.paused,seeking:video.seeking,visible:!document.hidden,enabled:this.interactive});
      if(turn)this.offerStoryTurn(turn);
      if(this.segmentEnd!==null&&video.currentTime>=this.segmentEnd){video.pause();this.segmentEnd=null}
      if(Math.abs(video.currentTime-(this.savedAt||0))>=3){this.persist();this.savedAt=video.currentTime}
    });
    video.addEventListener('ended',()=>{if(video!==this.player)return;this.persist();this.status(this.progress.completed?'这一集学完啦！可以换个场景练习开口。':'看完啦！再试试下面的理解题。')});
    video.addEventListener('error',()=>{if(video===this.player){this.tracker.reset();if(Number.isFinite(video.currentTime)&&video.currentTime>0)this.progress.position=Math.min(lesson.duration,video.currentTime);this.reportError({videoId:lesson.id,code:video.error?.code||0,time:video.currentTime||0,readyState:video.readyState||0,networkState:video.networkState||0});this.persist();this.status('视频暂时中断，观看位置已保留。点“播放 / 继续”重试；也可以先听下面的句子。')}});
    this.renderLibrary();this.caption();
    if(this.questionFocus){this.playerRoom.querySelector('.video-questions')?.scrollIntoView({block:'center',behavior:'smooth'});this.status('已经看过这一集，可以直接答理解题；想看时也能继续播放。')}
    else this.playerRoom.scrollIntoView({block:'start',behavior:'smooth'});
    if(this.prepareVideo)this.prepareSource();
  }
  releaseSource(){this.sourceGeneration=(this.sourceGeneration||0)+1;this.sourceAbort?.abort();clearTimeout(this.sourceTimer);this.sourceLoading=false;this.sourceLease?.release();this.sourceLease=null}
  prepareSource(){
    if(this.sourceLoading||!this.player)return;
    this.releaseSource();const video=this.player,generation=this.sourceGeneration,path=this.lesson.src;
    this.mediaReady=false;this.sourceLoading=true;video.controls=false;
    const controller=this.sourceAbort=new AbortController();
    this.sourceTimer=setTimeout(()=>controller.abort(),15000);
    this.status('正在准备故事，马上就好…');
    Promise.resolve().then(()=>this.prepareVideo(path,controller.signal)).then(lease=>{
      if(generation!==this.sourceGeneration||controller.signal.aborted){lease.release();return}
      this.sourceLease=lease;this.mediaReady=true;video.src=lease.url;video.controls=true;video.load();
      this.status(this.questionFocus?'已经看过这一集，可以直接答理解题；无需再看一遍。':'故事准备好啦，点播放开始；可以随时暂停、重听。');
    }).catch(error=>{
      if(generation===this.sourceGeneration){this.reportError({videoId:this.lesson.id,code:0,time:0,reason:String(error?.message||error).slice(0,160)});this.status('故事暂时没有准备好，点“播放 / 继续”再试一次。')}
    }).finally(()=>{
      if(generation===this.sourceGeneration){clearTimeout(this.sourceTimer);this.sourceLoading=false}
    });
  }
  continueStory(){
    if(!this.player)return;const fromTurn=Boolean(this.pendingTurn);this.clearStoryTurn();
    if(!this.mediaReady){this.prepareSource();return}
    this.beforeMedia();
    if(this.player.error){this.resumePosition=this.progress.position;this.tracker.reset();this.player.load()}
    this.playVideo();
    if(fromTurn)this.player.scrollIntoView({block:'center',behavior:'smooth'});
  }
  playVideo(){const video=this.player,generation=this.playGeneration=(this.playGeneration||0)+1;video.play().catch(error=>{if(video===this.player&&generation===this.playGeneration&&!document.hidden&&error?.name!=='AbortError')this.toast('视频未能播放，请点“播放 / 继续”重试。')})}
  clearStoryTurn(){this.pendingTurn=null;const panel=this.playerRoom.querySelector('.story-turn');if(panel)panel.hidden=true}
  offerStoryTurn(turn){
    const panel=this.playerRoom.querySelector('.story-turn');if(!panel)return;
    this.pendingTurn=turn;this.player.pause();this.segmentEnd=null;
    panel.querySelector('h3').textContent=turn.promptEn;panel.querySelector('.story-turn-zh').textContent=turn.promptZh;panel.hidden=false;
    panel.scrollIntoView({block:'nearest',behavior:'smooth'});
    this.status('帮波波说一句，或者直接继续看；没有录音，也不影响奖励。');
  }
  status(text){const el=this.playerRoom.querySelector('#video-status');if(el)el.textContent=text}
  caption(){
    if(!this.player)return;const cue=this.lesson.transcript.find(c=>this.player.currentTime>=c.start&&this.player.currentTime<c.end);
    const caption=this.playerRoom.querySelector('.video-caption');caption.querySelector('b').textContent=cue?.en||'';caption.querySelector('span').textContent=this.chinese?(cue?.zh||''):'';caption.hidden=!cue;
    this.playerRoom.classList.toggle('hide-chinese',!this.chinese);
  }
  repeat(cue){if(!this.mediaReady){this.prepareSource();return}this.pause();this.beforeMedia();this.segmentEnd=cue.end;if(this.player.error){this.progress.position=cue.start;this.resumePosition=cue.start;this.player.load()}else this.player.currentTime=cue.start;this.playVideo()}
  answer(index,option){
    this.pause();const q=this.lesson.questions[index];if(!q)return;const correct=option===q.correctIndex;
    if(correct&&!this.progress.correct.includes(q.id))this.progress.correct.push(q.id);
    this.playerRoom.querySelector('#video-feedback-'+index).textContent=correct?'✓ 听懂啦！'+q.explanation:'再看一眼、再听一遍，你可以的。';this.persist();
  }
  persist(){
    if(!this.lesson||!this.progress)return;const app=this.getState();
    if(!this.progress.completed&&videoReady(this.progress,this.lesson)){this.progress.completed=true;this.onComplete();app.xp+=15;app.stars++;this.toast('这一集学会啦！15 XP + 1 ⭐，可以带波波吃点心。')}
    app.videoProgress={...app.videoProgress,[this.lesson.id]:this.progress};this.save();this.renderLibrary();
  }
  pause(){this.playGeneration=(this.playGeneration||0)+1;if(this.player){this.player.pause();this.tracker.reset();this.segmentEnd=null;this.clearStoryTurn();this.persist()}}
}
