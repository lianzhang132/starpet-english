import { PcmRecorder } from './recorder.js';
import { LearningSync } from './sync.mjs?v=1.5.4';
import { DIALOGUE_TRANSLATIONS } from './dialogues.mjs';
import { ALPHABET, PHONICS_SOUNDS, CVC_BLENDS, PHONICS_QUIZZES } from './phonics.mjs?v=1.5.4';
import { CONVERSATION_MISSIONS } from './conversations.mjs';
import { normalizeMastery, recordAttempt, deferUncertainSpeech } from './mastery.mjs';
import { reviewQueue, isListeningQuestion } from './review.mjs';
import { planDaily, normalizeLessonProgress } from './study-plan.mjs';
import { refreshStudyDay, studyExtrasSnapshot, restoreStudyExtras } from './study-session.mjs';
import { Speaker } from './speaker.mjs?v=1.5.4';
import { LISTENING_PROMPT, questionSpeech } from './question-audio.mjs?v=1.5.4';
import { petInvitationPlan } from './pet-plan.mjs';
import { AUDIO_CLIPS } from './audio-manifest.mjs';
import { apiFetch, hasNativeBridge, isAndroidCompat, nativeCall, randomId } from './runtime.mjs';
import { PetRoom } from './pet-room.mjs';
import { VideoRoom } from './video-room.mjs';
import { prepareLocalVideo } from './video-source.mjs';
import { normalizeCare } from './pet-care.mjs';
import { pcmWav, pcmHasVoice } from './speech-audio.mjs';
import { speakingFeedback } from './speaking-feedback.mjs';
import { readSpeechResponse } from './speech-request.mjs';

const storedDeviceId=localStorage.getItem('starpet-device');
let storedProgress=null;
try{const value=JSON.parse(localStorage.getItem('starpet-progress-v2')||'null');if(value&&typeof value==='object'&&!Array.isArray(value))storedProgress=value}catch(_){/* Server recovery below keeps the old record intact. */}
let bootstrapReady=Boolean(storedProgress)||!storedDeviceId;
let restoreRunning=false;
const appState = Object.assign({
  deviceId: storedDeviceId || `${isAndroidCompat?'compat':'web'}-${randomId()}`,
  xp: 0, stars: 0, streak: 0, daily: 0,
  completedLessons: [], learnedWords: [], learnedSentences: [], phonicsPracticed: [], lastDay: '', dailyDay: '', dailyWords: [], dailySentences: [], dailyQuizzes: [], dailyAttemptIds: [],
  quizIndex: 0, selectedScene: null, dialogueStep: 0, mastery: {}, lessonProgress: {}, cardCursor: 0, pendingNextTurnId: null,
  petCare: {}, videoProgress: {}, speechReceipts: []
}, storedProgress||{});
appState.mastery=normalizeMastery(appState.mastery);
appState.petCare=normalizeCare(appState.petCare);
if(!appState.videoProgress||typeof appState.videoProgress!=='object'||Array.isArray(appState.videoProgress))appState.videoProgress={};
if(!Array.isArray(appState.speechReceipts))appState.speechReceipts=[];
let petRoom,videoRoom;
if(!appState.lessonProgress||typeof appState.lessonProgress!=='object'||Array.isArray(appState.lessonProgress))appState.lessonProgress={};
localStorage.setItem('starpet-device', appState.deviceId);

const pageMeta = {
  home: ['早上好，小探险家！', '波波已经准备好陪你学习啦'],
  course: ['英语冒险地图', '完成课程，让波波一步步长大'],
  phonics: ['波波字母拼读实验室', '点每个小喇叭，听清后大声模仿'],
  dialogue: ['和波波聊英语', '在真实情景里练出开口的勇气'],
  videos: ['波波的英语故事屋', '看小故事、帮小忙，英语自然说出来'],
  growth: ['我的成长星球', '每一次坚持都值得被看见']
};
const petMessages = ['Hi，小探险家！今天一起收集 3 颗星星吧！','摸摸头会让我更有精神～ Let’s go!','勇敢尝试就很棒！You are amazing!','学完今天的单词，我们一起玩吧！'];
const worlds = [
  ['hello','👋','你好，世界','Hello World','问候、自我介绍与礼貌用语','#6B5CF6',75],
  ['family','🏡','温暖的家','My Family','家人、房间与日常起居','#FF8B72',35],
  ['school','🎒','校园冒险','School Day','文具、课程与同学交流','#34B8D1',10],
  ['food','🍜','美食小镇','Food Town','食物、喜好与点餐表达','#F3A63B',0],
  ['city','🚌','城市出发','Around Town','地点、交通与问路交流','#45B97C',0],
  ['travel','✈️','世界旅行',"Let's Travel",'把所学英语用在真实交流中','#9B64D8',0]
];
const words = [['👋','hello','你好','/həˈləʊ/'],['🍎','apple','苹果','/ˈæpəl/'],['😊','happy','开心的','/ˈhæpi/']];
const quizzes = [
  {id:'q-apple',emoji:'🍎',prompt:'“苹果”用英语怎么说？',hint:'它是红红的水果，读音以 A 开头。',answers:['orange','apple','banana','grape'],correctIndex:1},
  {id:'q-morning',emoji:'🌅',prompt:'早上见到老师，应该说什么？',hint:'Good + 一天的开始。',answers:['Good night!','Goodbye!','Good morning!','Thank you!'],correctIndex:2},
  {id:'q-cats',emoji:'🐱',prompt:'选择正确的句子：我喜欢猫。',hint:'“喜欢”是 like。',answers:['I like cats.','I like dogs.','I can see a cat.','The cat is sleeping.'],correctIndex:0}
];
const scenes = [
  {id:'new-friend',kind:'repeat',icon:'🛝',title:'认识新朋友',subtitle:'跟读姓名、年龄和问候',level:'跟读',color:'#6B5CF6',lines:['Hi! My name is Bobo.','What is your name?','Nice to meet you!']},
  {id:'breakfast',kind:'repeat',icon:'🥪',title:'早餐时间',subtitle:'跟读食物和饮料表达',level:'跟读',color:'#FF8B72',lines:['Good morning!','What would you like?','I would like some milk, please.']},
  {id:'classroom',kind:'repeat',icon:'🧑‍🏫',title:'英语课堂',subtitle:'跟读常见课堂指令',level:'跟读',color:'#34B8D1',lines:['Open your book, please.','Listen and repeat.','Great job!']},
  {id:'restaurant',kind:'repeat',icon:'🍽️',title:'小小餐厅',subtitle:'跟读一次简单点餐',level:'跟读',color:'#F3A63B',lines:['May I have the menu?','I would like noodles.','Thank you!']},
  {id:'directions',kind:'repeat',icon:'🗺️',title:'城市问路',subtitle:'跟读问路和方向表达',level:'跟读',color:'#45B97C',lines:['Excuse me, where is the park?','Go straight and turn left.','Thank you very much!']},
  {id:'hotel',kind:'repeat',icon:'🏨',title:'旅行住店',subtitle:'跟读入住常见句子',level:'跟读',color:'#9B64D8',lines:['Hello, I have a reservation.','May I have the room key?','Have a nice stay!']}
];
const allScenes=[...CONVERSATION_MISSIONS.map(scene=>({...scene,kind:'conversation'})),...scenes];

let lessons = [], activeQuestions = quizzes, activeReasons = {}, activeLesson = null, sessionCorrect = 0, studyMode = 'quiz', cardIndex = 0, parentReportText = null;
const allWords = () => lessons.length ? [...new Map(lessons.flatMap(l=>l.words).map(w=>[w.word,w])).values()] : words.map(w=>({emoji:w[0],word:w[1],meaning:w[2]}));
function worldProgress(id){return appState.completedLessons.filter(x=>x.startsWith(id+'-')).length*25}
function lessonActionLabel(id){
  if(appState.completedLessons.includes(id))return '✓ 自由重练';
  const progress=appState.lessonProgress[id];
  if(!progress)return '开始学习 →';
  return progress.phase==='quiz'?'继续闯关 →':`继续第 ${progress.cardIndex+1} 张词卡 →`;
}
function renderWorlds(){
  document.querySelector('#world-grid').innerHTML=worlds.map(w=>`<article class="world-card" data-world="${w[0]}" tabindex="0" role="button"><div class="world-head"><div class="world-icon" style="background:${w[5]}18">${w[1]}</div><div class="world-name"><h3>${w[2]}</h3><span style="color:${w[5]}">${w[3]}</span></div><b class="world-lock">›</b></div><p>${w[4]}</p><div class="world-progress"><span style="width:${worldProgress(w[0])}%;background:${w[5]}"></span></div><div class="world-foot"><span>${worldProgress(w[0])/25}/4 节已完成</span><b style="color:${w[5]}">选择课程 →</b></div></article>`).join('');
}
function selectWorld(id){
  const unit=worlds.find(w=>w[0]===id), content=lessons.filter(l=>l.worldId===id);
  if(!content.length){toast('课程正在加载，请稍后重试。');return}
  document.querySelector('#world-grid').innerHTML=`<div class="lesson-back"><button class="secondary" data-action="worlds">← 返回冒险地图</button><h2>${unit[1]} ${unit[2]}</h2></div>`+content.map((l,i)=>`<article class="world-card lesson-card" data-lesson="${l.id}" role="button" tabindex="0"><h3>第 ${i+1} 课 · ${l.words[0].emoji}</h3><p>${l.sentence}</p><p>${l.translation}</p><div class="world-foot"><span>3 张词卡 · 4 道练习</span><b>${lessonActionLabel(l.id)}</b></div></article>`).join('');
}
function lessonState(){return appState.lessonProgress[activeLesson.id]}
function finishLesson(){
  addUnique(appState.completedLessons,activeLesson.id);delete appState.lessonProgress[activeLesson.id];save();renderWorlds();toast('课程完成！波波为你骄傲！');
}
function startLessonQuiz(){
  const progress=lessonState();activeQuestions=activeLesson.questions.filter(q=>!progress.correctIds.includes(q.id));
  if(!activeQuestions.length){finishLesson();document.querySelector('#modal').hidden=true;return}
  studyMode='lesson-quiz';activeReasons={};
  const savedIndex=activeQuestions.findIndex(q=>q.id===progress.nextQuestionId);
  appState.quizIndex=savedIndex>=0?savedIndex:0;
  document.querySelector('#modal').hidden=false;renderQuiz();
}
function openLesson(id){
  activeLesson=lessons.find(l=>l.id===id);if(!activeLesson)return;
  const saved=normalizeLessonProgress(appState.lessonProgress,[activeLesson])[id];
  appState.lessonProgress[id]=saved||{phase:'cards',cardIndex:0,correctIds:[],nextQuestionId:null};
  if(saved?.phase==='quiz'){startLessonQuiz();return}
  studyMode='lesson-cards';cardIndex=appState.lessonProgress[id].cardIndex;
  document.querySelector('#modal').hidden=false;renderCards();
}
function cardDeck(){return studyMode==='lesson-cards'?[...activeLesson.words,{word:activeLesson.sentence,meaning:activeLesson.translation,emoji:'💬'}]:allWords()}
function renderCards(){
  const deck=cardDeck(), card=deck[cardIndex];
  document.querySelector('#quiz-count').textContent=`词卡 ${cardIndex+1}/${deck.length}`;
  document.querySelector('#quiz-reason').textContent=studyMode==='lesson-cards'?'本课词卡 · 听一听':'自由词卡 · 听一听';
  document.querySelector('#quiz-emoji').textContent=card.emoji;document.querySelector('#quiz-prompt').textContent=card.word;
  document.querySelector('#quiz-hint').textContent='想一想意思，再翻卡看看。';
  document.querySelector('#answers').innerHTML='<button class="answer" data-action="hear-card">🔊 听发音</button><button class="answer" data-action="flip-card">翻卡看中文</button>';
  document.querySelector('#answer-result').hidden=false;document.querySelector('#result-text').textContent='跟着波波读一遍吧';
  const next=document.querySelector('[data-action="next-quiz"],[data-action="next-card"]');next.dataset.action='next-card';next.textContent=studyMode==='lesson-cards'&&cardIndex===deck.length-1?'开始闯关 →':'下一张 →';
  readCurrentQuestion();
}
function nextCard(){
  const deck=cardDeck();
  if(studyMode==='lesson-cards'){
    const progress=lessonState();
    if(cardIndex===deck.length-1){progress.phase='quiz';progress.nextQuestionId=activeLesson.questions[0].id;save();startLessonQuiz();return}
    cardIndex++;progress.cardIndex=cardIndex;
  }else{cardIndex=(cardIndex+1)%deck.length;appState.cardCursor=cardIndex}
  save();renderCards();
}
function renderBindings(){
  studyDay(false);
  const dailyPlan=todaysPlan();
  const quizDone=appState.dailyQuizzes.length>=3||(lessons.length>0&&dailyPlan.items.length===0);
  appState.daily = [appState.dailyWords.length >= 3, quizDone, appState.dailySentences.length >= 3].filter(Boolean).length;
  document.querySelectorAll('[data-bind]').forEach(el=>{const key=el.dataset.bind;el.textContent=appState[key]});
  document.querySelector('#daily-progress').style.width=`${appState.daily*33.333}%`;
  const speak=document.querySelector('#task-speak');
  const tasks = [...document.querySelectorAll('.task-list li')];
  [appState.dailyWords.length >= 3, quizDone, appState.dailySentences.length >= 3].forEach((done, i) => { tasks[i].classList.toggle('done', done); tasks[i].querySelector('i').textContent = done ? '✓' : '○'; });
  tasks[0].querySelector('span').textContent = '听读 3 个单词'; tasks[1].querySelector('span').textContent = lessons.length>0&&dailyPlan.items.length===0?'今天的题目已完成':'答对 3 道练习';
  document.querySelector('#today-plan').textContent=dailyPlan.items.length?`波波准备了 ${dailyPlan.dueCount} 道到期复习、${dailyPlan.newCount} 道新题`:'暂无待做题目，试试开口说英语';
  document.querySelectorAll('.lesson-card[data-lesson]').forEach(card=>{const label=card.querySelector('.world-foot b');if(label)label.textContent=lessonActionLabel(card.dataset.lesson)});
  document.querySelector('#gift-hint').textContent=appState.daily>=3?'今天的任务完成啦！🎁':`还有 ${3-appState.daily} 项小任务`;
  document.querySelector('.weekly-card h3').textContent = '词卡足迹';
  document.querySelector('.weekly-card strong').textContent = appState.learnedWords.length;
  document.querySelector('.weekly-card span').textContent = '已听过单词';
  document.querySelector('.weekly-card em').textContent = '每天复习，慢慢记牢';
  document.querySelector('.level-banner h2').textContent = `英语小探险家 · Lv. ${Math.floor(appState.xp/100)+1}`;
  document.querySelector('.level-banner p').textContent = `再获得 ${100-appState.xp%100} XP，就能升到下一级！`;
  document.querySelector('.level-progress span').style.width = `${appState.xp%100}%`;
  const stats = [[appState.learnedWords.length,'听过词卡'],[appState.learnedSentences.length,'跟读通过句子'],[appState.streak,'连续学习天数'],[appState.stars,'宠物星星']];
  document.querySelectorAll('.stat').forEach((el,i)=>{el.querySelector('b').textContent=stats[i][0];el.querySelector('span').textContent=stats[i][1]});
  document.querySelector('.chart-card h3').textContent = '今天的小目标';
  document.querySelector('.chart-card .card-title span').textContent = `${appState.daily}/3 已完成`;
  document.querySelector('.bars').innerHTML = [[appState.dailyWords.length,'词卡'],[appState.dailyQuizzes.length,'答题'],[appState.dailySentences.length,'跟读']].map(([n,label])=>`<div><i style="height:${Math.max(3,Math.min(100,n/3*100))}%"></i><span>${label}</span></div>`).join('');
  document.querySelector('.report-card small').textContent = '根据本机实际练习记录';
  document.querySelector('.report-card p').textContent = parentReportText||`累计听过 ${appState.learnedWords.length} 个单词，跟读通过 ${appState.learnedSentences.length} 句，动画理解完成 ${Object.values(appState.videoProgress).filter(p=>p?.completed===true).length} 集。点“查看练习统计”可看到到期复习建议。`;
  document.querySelector('#review-count').textContent=reviewItems().length;
  petRoom?.render();
}
const learningSync = new LearningSync({
  storage: localStorage, deviceId: appState.deviceId,
  post: (path, body) => apiFetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  onStatus: (status, pending) => {
    document.querySelector('#cloud-dot').classList.toggle('online', status === 'synced');
    const label=document.querySelector('#cloud-text');
    label.textContent = status === 'synced' ? '已同步' : status === 'conflict' ? '同步冲突 · 本机已保留' : `本机已保存 · 待同步 ${pending}`;
    label.title = status === 'conflict' ? '另一份进度更新较新，未覆盖任何记录。请保留本机数据并联系家长。' : '联网后自动重试；请勿清除浏览器数据。';
  }
});
function save(){
  parentReportText=null;
  const extras=studyExtrasSnapshot(appState);
  try {
    localStorage.setItem('starpet-progress-v2',JSON.stringify(appState));
    learningSync.stageProgress({xp:appState.xp,stars:appState.stars,streak:appState.streak,completedLessons:appState.completedLessons,learnedWords:appState.learnedWords,mastery:appState.mastery,lessonProgress:appState.lessonProgress,petCare:appState.petCare,videoProgress:appState.videoProgress,learnedSentences:appState.learnedSentences,speechReceipts:appState.speechReceipts,...extras});
    learningSync.flush();
  } catch (_) { toast('本机存储暂不可用，请勿关闭页面，并请家长检查存储空间。'); }
  renderBindings();
  if(hasNativeBridge()){
    const invitation=petInvitationPlan(CONVERSATION_MISSIONS,appState.mastery);
    nativeCall('progress',{xp:appState.xp,stars:appState.stars,petBond:appState.petCare.bond,petAccessory:appState.petCare.accessory,...invitation}).catch(()=>{});
  }
}
function applyRecoveredProgress(progress){
  if(progress.deviceId!==appState.deviceId)return;
  for(const key of ['xp','stars','streak'])if(Number.isSafeInteger(progress[key])&&progress[key]>=0)appState[key]=progress[key];
  for(const key of ['completedLessons','learnedWords','learnedSentences','speechReceipts'])if(Array.isArray(progress[key]))appState[key]=progress[key];
  appState.petCare=normalizeCare(progress.petCare);
  if(progress.videoProgress&&typeof progress.videoProgress==='object'&&!Array.isArray(progress.videoProgress))appState.videoProgress=progress.videoProgress;
  appState.mastery=normalizeMastery(progress.mastery);
  appState.lessonProgress=lessons.length?normalizeLessonProgress(progress.lessonProgress,lessons):(progress.lessonProgress||{});
  restoreStudyExtras(appState,progress);
}
async function recoverProgress(){
  if(bootstrapReady||restoreRunning)return;
  restoreRunning=true;
  try{
    const queued=learningSync.read().progress;
    if(queued)applyRecoveredProgress(queued);
    else{
      const response=await apiFetch(`/api/v1/progress/${encodeURIComponent(appState.deviceId)}`);
      if(!response.ok)throw new Error('progress_unavailable');
      const remote=await response.json();
      if(remote.updatedAt){
        if(!learningSync.adoptServerRevision(remote.revision||0))throw new Error('pending_local_work');
        applyRecoveredProgress(remote);
      }
    }
    bootstrapReady=true;renderWorlds();save();openPetMission();
  }catch(_){
    document.querySelector('#cloud-text').textContent='旧进度待恢复 · 请联网';
    document.querySelector('#cloud-dot').classList.remove('online');
  }finally{restoreRunning=false}
}
window.addEventListener('online', () => {if(!bootstrapReady)recoverProgress();else learningSync.flush()});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshDailyUi(); learningSync.flush(); openPetMission(); } });
setInterval(() => { if (!document.hidden && learningSync.pendingCount()) learningSync.flush(); }, 30000);
function studyDay(studying=true){return refreshStudyDay(appState,{studying})}
function refreshDailyUi(){if(studyDay(false)&&bootstrapReady)save();else renderBindings()}
function addUnique(list,value){if(!list.includes(value))list.push(value)}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200)}
const speaker = new Speaker({native:hasNativeBridge(),callNative:nativeCall,
  getClip:text=>AUDIO_CLIPS[text.trim().replace(/\s+/g,' ')],createAudio:path=>new Audio(path),
  synthesis:window.speechSynthesis,Utterance:window.SpeechSynthesisUtterance,
  onActive:active=>document.querySelectorAll('.pet-stage,.buddy-row').forEach(el=>el.classList.toggle('talking',active)),
  onError:toast});
let questionReadGeneration=0;
function questionReadState(active){
  const button=document.querySelector('#quiz-read');
  button.classList.toggle('is-playing',active);
  button.setAttribute('aria-label',active?'正在朗读题目，点击从头重听':'重新朗读题目');
  document.querySelector('#quiz-read-label').textContent=active?'正在读…':'再听一遍';
}
function resetQuestionRead(){questionReadGeneration++;questionReadState(false)}
const speak = text => {resetQuestionRead();replayAudio?.pause();videoRoom?.pause();return speaker.speak(text)};
const stopEnglish = () => {resetQuestionRead();speaker.stop();replayAudio?.pause()};
async function readCurrentQuestion(){
  if(document.hidden||document.querySelector('#modal').hidden)return;
  const text=studyMode.includes('cards')?cardDeck()[cardIndex]?.word:questionSpeech(studyMode,activeQuestions[appState.quizIndex]);
  const generation=++questionReadGeneration;questionReadState(true);
  await speaker.speak(text);
  if(generation===questionReadGeneration)questionReadState(false);
}
let phonicsMode='letters';
function phonicsButton(label,text,key){return `<button data-action="phonics-speak" data-speech="${encodeURIComponent(text)}" data-phonics-key="${key}">🔊 ${label}</button>`}
function renderPhonics(){
  const grid=document.querySelector('#phonics-grid');if(!grid)return;
  document.querySelectorAll('[data-phonics-mode]').forEach(button=>{const active=button.dataset.phonicsMode===phonicsMode;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
  if(phonicsMode==='letters')grid.innerHTML=ALPHABET.map(item=>`<article class="phonics-card ${appState.phonicsPracticed.includes(`word-${item.word}`)?'practiced':''}"><div class="letter-pair"><b>${item.letter}</b><span>${item.letter.toLowerCase()}</span></div><i>${item.emoji}</i><h3>${item.word}</h3><p>${item.sound} · ${item.meaning}</p>${item.note?`<p class="pronunciation-note">${item.note}</p>`:''}<div>${phonicsButton(`字母名 ${item.letter}`,item.letter,`letter-${item.letter}`)}${phonicsButton(item.word,item.word,`word-${item.word}`)}</div></article>`).join('');
  else if(phonicsMode==='sounds')grid.innerHTML=PHONICS_SOUNDS.map((item,index)=>`<article class="sound-card ${appState.phonicsPracticed.includes(`sound-${index}-0`)?'practiced':''}"><span>${item.emoji}</span><div><h3>${item.letters} <small>${item.sound}</small></h3><p>${item.hint}</p><div>${item.words.map((word,i)=>phonicsButton(word,word,`sound-${index}-${i}`)).join('')}</div></div></article>`).join('');
  else grid.innerHTML=CVC_BLENDS.map((item,index)=>`<article class="blend-card ${appState.phonicsPracticed.includes(`blend-${index}-word`)?'practiced':''}"><span>${item.emoji}</span><div class="blend-parts">${item.parts.map((part,i)=>`<b><em>${part}</em><small>${item.sounds[i]}</small></b>`).join('<i>+</i>')}<i>→</i><strong>${item.word}</strong></div><p>${item.meaning}</p>${item.note?`<p class="pronunciation-note">${item.note}</p>`:''}<div><button data-action="phonics-tip" data-tip="${encodeURIComponent(`${item.sounds.join(' → ')}，由慢到快连起来，再听完整单词。`)}">🧩 拼读步骤</button>${phonicsButton(item.word,item.word,`blend-${index}-word`)}</div></article>`).join('');
  updatePhonicsProgress();
}
function updatePhonicsProgress(){
  document.querySelector('#phonics-progress').textContent=`已试听 ${appState.phonicsPracticed.length} 个发音`;
  document.querySelectorAll('[data-phonics-key]').forEach(button=>button.classList.toggle('heard',appState.phonicsPracticed.includes(button.dataset.phonicsKey)));
}
async function practicePhonics(target){
  const text=decodeURIComponent(target.dataset.speech),key=target.dataset.phonicsKey;
  if(!await speak(text))return;
  if(!appState.phonicsPracticed.includes(key)){
    appState.phonicsPracticed.push(key);
  }
  studyDay();save();
  target.classList.add('heard');target.closest('article')?.classList.add('practiced');updatePhonicsProgress();
}
function showPage(name){
  if(!pageMeta[name])return;cancelRecording();videoRoom?.pause();
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${name}`));
  document.querySelectorAll('.nav-button').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  document.querySelector('#page-title').textContent=pageMeta[name][0];document.querySelector('#page-subtitle').textContent=pageMeta[name][1];
  if(name==='phonics')renderPhonics();
  if(name==='videos')videoRoom?.renderLibrary();
  renderBindings();
}
function renderContent(){
  document.querySelector('#home-words').innerHTML=words.map(w=>`<button class="word-item" data-word="${w[1]}"><i>${w[0]}</i><b>${w[1]}</b><span>${w[2]}</span></button>`).join('');
  renderWorlds();
  document.querySelector('#scene-list').innerHTML='<h3 class="scene-heading">先回答波波 · 真互动</h3>'+CONVERSATION_MISSIONS.map(s=>sceneCard(s)).join('')+'<h3 class="scene-heading">先模仿波波 · 跟读</h3>'+scenes.map(s=>sceneCard(s)).join('');
  renderPhonics();
}
function sceneCard(s){return `<article class="scene-card" data-scene="${s.id}"><div class="world-icon" style="background:${s.color}18">${s.icon}</div><div><h3>${s.title} <small style="color:${s.color}">${s.level}</small></h3><p>${s.subtitle}</p></div><b>›</b></article>`}
function questionPool(){return [...quizzes.map(q=>({...q,conceptKey:q.id==='q-apple'?'word:apple':q.id})),...lessons.flatMap(lesson=>lesson.questions.map((q,index)=>({...q,lessonId:lesson.id,conceptKey:index<lesson.words.length?`word:${lesson.words[index].word.toLowerCase()}`:q.id}))),...PHONICS_QUIZZES]}
function todaysPlan(questions=questionPool(),limit=6){studyDay(false);return planDaily({questions,mastery:appState.mastery,dailyQuizzes:appState.dailyQuizzes,dailyAttemptIds:appState.dailyAttemptIds,completedLessons:appState.completedLessons,limit:Math.min(limit,Math.max(0,6-appState.dailyAttemptIds.length))})}
function openQuiz(){
  const plan=todaysPlan();
  if(!plan.items.length){toast(appState.dailyAttemptIds.length>=6?'今天已经做了 6 道题，和波波说一句英语吧！':'今天没有到期或新题，和波波说一句英语吧！');return}
  activeLesson=null;activeQuestions=plan.items.map(item=>item.question);
  activeReasons=Object.fromEntries(plan.items.map(item=>[item.question.id,item.reason]));
  studyMode='daily';sessionCorrect=0;appState.quizIndex=0;document.querySelector('#modal').hidden=false;renderQuiz();
}
function renderQuiz(){
  const q=activeQuestions[appState.quizIndex],listening=isListeningQuestion(studyMode,q);const next=document.querySelector('[data-action="next-quiz"],[data-action="next-card"]');next.dataset.action='next-quiz';next.textContent=appState.quizIndex<activeQuestions.length-1?'下一题 →':'完成';document.querySelector('#quiz-count').textContent=`第 ${appState.quizIndex+1}/${activeQuestions.length} 题`;document.querySelector('#quiz-reason').textContent=activeReasons[q.id]||({review:'今天到期，看看还记得吗','lesson-quiz':'本课练习',listen:'听音练习','phonics-listen':'拼读练习'}[studyMode]||'自由练习');document.querySelector('#quiz-emoji').textContent=listening?'🎧':q.emoji;document.querySelector('#quiz-prompt').textContent=listening?LISTENING_PROMPT:q.prompt;document.querySelector('#quiz-hint').textContent=listening?'先听完，再选择；点小喇叭可以重听':q.hint||'';
  document.querySelector('#answers').innerHTML=q.answers.map((a,i)=>`<div class="answer-row"><button class="answer" data-answer="${i}"><i>${String.fromCharCode(65+i)}</i><span>${a}</span></button><button class="option-sound" data-action="speak-option" data-option-index="${i}" aria-label="播放选项 ${String.fromCharCode(65+i)}：${a}">🔊</button></div>`).join('');document.querySelector('#answer-result').hidden=true;
  readCurrentQuestion();
}
function reviewItems(){return reviewQueue(appState.mastery,questionPool(),allScenes)}
function openReview(){
  const due=reviewItems();
  if(!due.length){toast('现在没有到期内容。波波会安排下一次复习！');return}
  const first=due[0];
  if(first.kind==='speaking'){showPage('dialogue');selectScene(first.sceneId,first.index);toast('这句英语该复习啦，和波波再聊一次！');return}
  activeLesson=null;activeQuestions=due.filter(item=>item.kind==='quiz').slice(0,10).map(item=>item.question);activeReasons={};
  studyMode='review';sessionCorrect=0;appState.quizIndex=0;document.querySelector('#modal').hidden=false;renderQuiz();
}
function openPhonicsQuiz(){
  const plan=todaysPlan(PHONICS_QUIZZES,6);
  if(!plan.items.length){toast('拼读题还没到复习时间，可以先听字母发音。');return}
  activeLesson=null;activeQuestions=plan.items.map(item=>item.question);activeReasons=Object.fromEntries(plan.items.map(item=>[item.question.id,item.reason]));
  studyMode='phonics-listen';sessionCorrect=0;appState.quizIndex=0;document.querySelector('#modal').hidden=false;renderQuiz();
}
async function selectAnswer(index){
  const q=activeQuestions[appState.quizIndex];const buttons=[...document.querySelectorAll('.answer')];if(buttons.every(x=>x.disabled))return;buttons.forEach(x=>x.disabled=true);buttons[q.correctIndex].classList.add('correct');
  stopEnglish();
  const correct=index===q.correctIndex;if(correct)sessionCorrect++;if(!correct)buttons[index].classList.add('wrong');studyDay();recordAttempt(appState.mastery,q.id,correct);addUnique(appState.dailyAttemptIds,q.id);
  if(activeLesson&&studyMode==='lesson-quiz'&&correct)addUnique(lessonState().correctIds,q.id);
  if(correct&&!appState.dailyQuizzes.includes(q.id)){appState.xp+=15;appState.stars++;addUnique(appState.dailyQuizzes,q.id)}save();
  const result=document.querySelector('#answer-result');result.hidden=false;document.querySelector('#result-text').textContent=(correct?'答对啦！⭐ ':'再听再想，就会记牢。 ')+(q.explanation||'');if(!correct)speak(q.answers[q.correctIndex]);
  try { learningSync.stageAnswer(q.id,index,randomId()); learningSync.flush(); }
  catch (_) { toast('这次答题记录未能保存，请家长检查本机存储空间。'); }
}
function isConversation(){return appState.selectedScene?.kind==='conversation'}
function currentDialogue(){
  const scene=appState.selectedScene;if(!scene)return null;
  return isConversation()?scene.turns[appState.dialogueStep]:{id:String(appState.dialogueStep),question:scene.lines[appState.dialogueStep],hint:DIALOGUE_TRANSLATIONS[scene.id]?.[appState.dialogueStep]};
}
let dialogueFinished=false;
function selectScene(id,index=0){
  const scene=allScenes.find(item=>item.id===id);if(!scene)return;
  cancelRecording();appState.selectedScene=scene;dialogueFinished=false;
  const length=scene.kind==='conversation'?scene.turns.length:scene.lines.length;
  appState.dialogueStep=Number.isInteger(index)&&index>=0&&index<length?index:0;appState.pendingNextTurnId=null;
  document.querySelector('#dialogue-empty').hidden=true;document.querySelector('#dialogue-active').hidden=false;
  document.querySelectorAll('.scene-card').forEach(el=>el.classList.toggle('active',el.dataset.scene===id));
  renderDialogue();speakQuestion();
}
function dialogueHint(){return currentDialogue()?.hint || '先听一遍，再跟着波波说。'}
function renderDialogue(){
  const scene=appState.selectedScene;if(!scene)return;const turn=currentDialogue();
  document.querySelector('#scene-emoji').textContent=scene.icon;
  document.querySelector('#dialogue-line').textContent=turn.question;
  document.querySelector('#dialogue-hint').textContent=dialogueFinished?'这一轮聊完啦！可以换个答案再聊。':dialogueHint();
  document.querySelector('[data-action="next-line"]').textContent=dialogueFinished?'再聊一次 ↻':appState.pendingNextTurnId?'继续下一问 →':isConversation()?'换一个问题 →':'下一句 →';
  document.querySelector('.speech-card').classList.toggle('conversation',isConversation());
  const step=appState.dialogueStep+1,total=isConversation()?scene.turns.length:scene.lines.length;
  document.querySelector('.buddy-row span').textContent=dialogueFinished?'完成一轮交流 ⭐':`第 ${step}/${total} 句 · ${isConversation()?'波波问，你来答':'先听，再模仿'}`;
  speechButton();
}
async function speakQuestion(){
  const turn=currentDialogue();if(!turn)return;
  const generation=speechGeneration;speechPhase='talking';speechButton();
  await speak(turn.question);
  if(generation===speechGeneration){speechPhase='idle';speechButton()}
}
function nextDialogue(){
  if(!appState.selectedScene)return;const conversation=isConversation();cancelRecording();
  if(dialogueFinished){appState.dialogueStep=0;dialogueFinished=false}
  else if(conversation&&appState.pendingNextTurnId){
    const next=appState.selectedScene.turns.findIndex(turn=>turn.id===appState.pendingNextTurnId);
    appState.dialogueStep=next>=0?next:0;
  }else{const length=conversation?appState.selectedScene.turns.length:appState.selectedScene.lines.length;if(appState.dialogueStep===length-1){dialogueFinished=true;renderDialogue();document.querySelector('#speech-result').textContent='这一轮练习结束。可以选新场景，也可以点“再聊一次”重练。';return}appState.dialogueStep++}
  appState.pendingNextTurnId=null;renderDialogue();speakQuestion();
}

const recorder = new PcmRecorder(); let speechPhase='idle', speechGeneration=0, recordingTimer, speechAbort, meterTimer, recentTake=null, replayAudio=null, replayUrl=null;
function speechButton(){
  const button=document.querySelector('[data-action="speak-line"]');
  button.textContent={idle:dialogueFinished?'这轮聊完啦 ⭐':isConversation()?'🎙️ 回答波波':'🎙️ 点击跟读',starting:'准备麦克风…',recording:'⏹ 说完了',checking:'正在听…',talking:'🔊 波波在说话…'}[speechPhase];
  button.disabled=dialogueFinished||(speechPhase!=='idle'&&speechPhase!=='recording')||!document.querySelector('#audio-consent').checked;
  document.querySelector('[data-action="cancel-speech"]').hidden=speechPhase==='idle';
  document.querySelector('[data-action="replay-speech"]').hidden=!recentTake||speechPhase!=='idle';
  document.querySelector('[data-action="retry-speech"]').hidden=!recentTake?.retry||speechPhase!=='idle'||!document.querySelector('#audio-consent').checked;
  document.querySelector('#recording-meter').hidden=speechPhase!=='recording';
}
function clearTake(){replayAudio?.pause();replayAudio=null;if(replayUrl)URL.revokeObjectURL(replayUrl);replayUrl=null;recentTake=null}
function cancelRecording(){speechGeneration++;clearTimeout(recordingTimer);clearInterval(meterTimer);speechAbort?.abort();stopEnglish();recorder.cancel().catch(()=>{});clearTake();speechPhase='idle';speechButton();document.querySelector('#speech-result').textContent=''}
async function replayTake(){
  if(!recentTake||speechPhase!=='idle')return;stopEnglish();
  if(!replayUrl)replayUrl=URL.createObjectURL(new Blob([pcmWav(recentTake.pcm)],{type:'audio/wav'}));
  replayAudio=new Audio(replayUrl);replayAudio.onended=()=>speechButton();
  try{await replayAudio.play()}catch(_){toast('回放暂不可用，可以重新录一次。')}
}
async function toggleRecording(){
  if(speechPhase==='recording'){await finishRecording();return}
  if(dialogueFinished||speechPhase!=='idle'||!document.querySelector('#audio-consent').checked)return;
  clearTake();const generation=++speechGeneration;speechPhase='starting';speechButton();stopEnglish();videoRoom?.pause();
  document.querySelector('#speech-result').textContent='正在准备麦克风。如系统询问，请允许本次录音。';
  try{
    const started=await recorder.start({onLevel:level=>{if(generation===speechGeneration)document.querySelector('#recording-meter meter').value=Math.min(1,level*4)}});
    if(generation!==speechGeneration)return;if(!started){speechPhase='idle';speechButton();return}
    speechPhase='recording';document.querySelector('#speech-result').textContent='波波在听。说完点“说完了”，最长录 15 秒。';
    const updateMeter=()=>{document.querySelector('#recording-meter span').textContent=`已录 ${Math.floor(recorder.recordedSeconds)} 秒 / 15 秒 · 声音条会跟着你动`};updateMeter();meterTimer=setInterval(updateMeter,250);recordingTimer=setTimeout(finishRecording,15000);
  }
  catch(error){if(generation!==speechGeneration)return;speechPhase='idle';document.querySelector('#speech-result').textContent=error.name==='NotAllowedError'?'麦克风未授权；可以继续听音学习。':error.name==='NotReadableError'?'系统暂时无法打开麦克风，请关闭其他录音或通话应用后重试。':error.name==='NotFoundError'?'没有找到可用麦克风，请检查设备后重试。':'麦克风暂不可用，请检查设备后重试。'}
  speechButton();
}
async function finishRecording(){
  if(speechPhase!=='recording')return;const generation=speechGeneration;const sceneId=appState.selectedScene.id,lineIndex=appState.dialogueStep,conversation=isConversation(),turn=currentDialogue();
  speechPhase='checking';clearTimeout(recordingTimer);clearInterval(meterTimer);speechButton();
  try{
    const pcm=await recorder.stop();if(generation!==speechGeneration)return;
    if(pcm.byteLength<32000)throw new Error('录音不足一秒；请慢慢说完，再点“说完了”。');
    recentTake={pcm,sceneId,lineIndex,conversation,turn,requestId:randomId(),retry:false};
    if(!pcmHasVoice(pcm))throw new Error('录音里几乎没有声音。检查麦克风后再说一次；也可以先听听回放。');
    await submitTake(generation);
  }catch(error){if(generation===speechGeneration)document.querySelector('#speech-result').textContent=error.message}
  finally{if(generation===speechGeneration){speechPhase='idle';speechButton()}}
}
async function submitTake(generation=speechGeneration){
  const take=recentTake;if(!take||!document.querySelector('#audio-consent').checked)return;
  const {pcm,sceneId,lineIndex,conversation,turn,requestId}=take;
  speechPhase='checking';speechButton();stopEnglish();document.querySelector('#speech-result').textContent='波波正在听懂你的句子… 网络较慢时可以取消。';
  const controller=new AbortController();speechAbort=controller;const timeout=setTimeout(()=>controller.abort(),92000);
  try{
    const endpoint=(conversation?`/api/v1/practice/conversation?deviceId=${encodeURIComponent(appState.deviceId)}&missionId=${encodeURIComponent(sceneId)}&turnId=${encodeURIComponent(turn.id)}`:`/api/v1/practice/speaking?deviceId=${encodeURIComponent(appState.deviceId)}&sceneId=${encodeURIComponent(sceneId)}&lineIndex=${lineIndex}`)+`&requestId=${encodeURIComponent(requestId)}`;
    const response=await apiFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:pcm,signal:controller.signal});
    const result=await readSpeechResponse(response,{conversation});if(generation!==speechGeneration)return;
    take.retry=false;
    const fresh=!appState.speechReceipts.includes(requestId);
    if(fresh){
      studyDay();const itemId=`${conversation?'conversation':'speaking'}:${sceneId}:${conversation?turn.id:lineIndex}`;
      if(conversation?result.understood:result.passed)recordAttempt(appState.mastery,itemId,true);
      else deferUncertainSpeech(appState.mastery,itemId);
      if((conversation?result.understood:result.passed)&&Number.isInteger(result.xpAwarded))appState.xp+=Math.max(0,Math.min(12,result.xpAwarded));
      appState.speechReceipts=[...appState.speechReceipts,requestId].slice(-200);
    }
    if(conversation){
      const status=document.querySelector('#speech-result');
      status.textContent=speakingFeedback(result,{conversation:true});
      appState.pendingNextTurnId=result.understood?result.nextTurnId:null;
      if(result.understood){
        addUnique(appState.learnedSentences,`conversation:${sceneId}:${turn.id}`);
        addUnique(appState.dailySentences,`conversation:${sceneId}:${turn.id}`);
        dialogueFinished=result.complete===true;
      }
      save();renderDialogue();speechPhase='talking';speechButton();
      const played=typeof result.reply==='string'&&result.reply.trim()?await speak(result.reply):false;
      if(generation!==speechGeneration)return;
      if(result.understood&&result.nextTurnId&&played){
        const next=appState.selectedScene.turns.findIndex(item=>item.id===result.nextTurnId);
        if(next>=0){
          clearTake();document.querySelector('#speech-result').textContent='上一句听懂啦！接下来听新问题，再点麦克风回答。';
          appState.dialogueStep=next;appState.pendingNextTurnId=null;renderDialogue();
          await speak(currentDialogue().question);
        }
      }else if(dialogueFinished)toast('聊完一轮啦！下次试试不同的答案。');
    }
    else{document.querySelector('#speech-result').textContent=speakingFeedback(result);if(result.passed){addUnique(appState.learnedSentences,`${sceneId}:${lineIndex}`);addUnique(appState.dailySentences,`${sceneId}:${lineIndex}`)}save()}
  }catch(error){if(generation===speechGeneration){take.retry=true;document.querySelector('#speech-result').textContent=error.name==='AbortError'?'连接超时；可以重试识别，不必重新录音。':error instanceof TypeError?'暂时连不上语音服务。可以先听回放，联网后在本页重试识别。':error.message}}
  finally{clearTimeout(timeout);if(generation===speechGeneration){speechPhase='idle';speechButton()}}
}
document.querySelector('#audio-consent').addEventListener('change',()=>{if(!document.querySelector('#audio-consent').checked)cancelRecording();speechButton()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelRecording();videoRoom?.pause()}});
window.addEventListener('starpet-pause',()=>{cancelRecording();videoRoom?.pause()});

document.addEventListener('click',event=>{
  const target=event.target.closest('button,[data-action],[data-world],[data-scene],[data-lesson]');if(!target)return;
  if(!bootstrapReady){recoverProgress();toast('正在恢复以前的学习记录，请联网稍等。');return}
  if(['quiz','cards','listen','review','phonics-quiz'].includes(target.dataset.action)){cancelRecording();videoRoom?.pause()}
  if(target.dataset.page)showPage(target.dataset.page);
  if(target.dataset.pageLink)showPage(target.dataset.pageLink);
  if(target.dataset.word){const word=target.dataset.word;speak(word).then(completed=>{if(!completed)return;studyDay();addUnique(appState.learnedWords,word);addUnique(appState.dailyWords,word);save()});toast(`${word} · 跟着读一遍吧`) }
  if(target.dataset.world)selectWorld(target.dataset.world);
  if(target.dataset.lesson)openLesson(target.dataset.lesson);
  if(target.dataset.scene)selectScene(target.dataset.scene);
  if(target.dataset.phonicsMode){phonicsMode=target.dataset.phonicsMode;renderPhonics()}
  if(target.dataset.answer!==undefined)selectAnswer(Number(target.dataset.answer));
  switch(target.dataset.action){
    case'quiz':openQuiz();break;
    case'worlds':renderWorlds();break;
    case'cards':{activeLesson=null;studyMode='cards';const unseen=allWords().findIndex(w=>!appState.learnedWords.includes(w.word));cardIndex=unseen>=0?unseen:(Number.isInteger(appState.cardCursor)?appState.cardCursor%allWords().length:0);document.querySelector('#modal').hidden=false;renderCards();break}
    case'hear-card':{const card=cardDeck()[cardIndex],isWord=studyMode!=='lesson-cards'||cardIndex<activeLesson.words.length;speak(card.word).then(completed=>{if(!completed||!isWord)return;studyDay();addUnique(appState.learnedWords,card.word);addUnique(appState.dailyWords,card.word);save()});break}
    case'flip-card':document.querySelector('#quiz-hint').textContent=cardDeck()[cardIndex].meaning;break;
    case'next-card':nextCard();break;
    case'listen':{const candidates=questionPool().filter(q=>q.id==='q-apple'||(q.lessonId&&q.id.includes('-word-')));const plan=todaysPlan(candidates,6);if(!plan.items.length){toast('听音题暂时没有新题或到期题目。');break}activeLesson=null;activeQuestions=plan.items.map(item=>item.question);activeReasons=Object.fromEntries(plan.items.map(item=>[item.question.id,item.reason]));studyMode='listen';appState.quizIndex=0;sessionCorrect=0;document.querySelector('#modal').hidden=false;renderQuiz();break}
    case'phonics-quiz':openPhonicsQuiz();break;
    case'phonics-tip':toast(decodeURIComponent(target.dataset.tip));break;
    case'review':openReview();break;
    case'read-question':readCurrentQuestion();break;
    case'speak-option':speak(activeQuestions[appState.quizIndex].answers[Number(target.dataset.optionIndex)]);break;
    case'phonics-speak':practicePhonics(target);break;
    case'speak':showPage('dialogue');toast('选一个场景，勇敢开口吧！');break;
    case'feed':document.querySelector('#pet-care-room').scrollIntoView({behavior:'smooth',block:'center'});break;
    case'pet':petRoom.act('touch');break;
    case'cancel-speech':cancelRecording();toast('本次录音已取消并清除。');break;
    case'replay-speech':replayTake();break;
    case'retry-speech':if(speechPhase==='idle'&&recentTake?.retry)submitTake();break;
    case'close-modal':stopEnglish();document.querySelector('#modal').hidden=true;break;
    case'next-quiz':
      if(appState.quizIndex<activeQuestions.length-1){appState.quizIndex++;if(activeLesson){lessonState().nextQuestionId=activeQuestions[appState.quizIndex].id;save()}renderQuiz()}
      else{stopEnglish();document.querySelector('#modal').hidden=true;if(activeLesson){const remaining=activeLesson.questions.length-lessonState().correctIds.length;if(!remaining)finishLesson();else{lessonState().nextQuestionId=activeLesson.questions.find(q=>!lessonState().correctIds.includes(q.id))?.id||null;save();toast(`这课还剩 ${remaining} 道题，下次只练没答对的。`)}}else toast(`完成练习，答对 ${sessionCorrect}/${activeQuestions.length} 题。`);appState.quizIndex=0}break;
    case'hear':if(speechPhase==='idle')speakQuestion();break;
    case'hint':toast(dialogueHint());break;
    case'speak-line':toggleRecording();break;
    case'next-line':nextDialogue(false);break;
    case'end-dialogue':cancelRecording();appState.selectedScene=null;document.querySelector('#dialogue-empty').hidden=false;document.querySelector('#dialogue-active').hidden=true;document.querySelectorAll('.scene-card').forEach(x=>x.classList.remove('active'));break;
    case'report':apiFetch(`/api/v1/report/${encodeURIComponent(appState.deviceId)}`).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(r=>{parentReportText=r.highlight;document.querySelector('.report-card p').textContent=parentReportText}).catch(()=>toast('暂时无法连接；本机记录仍可查看。'));break;
  }
});
document.querySelector('#modal').addEventListener('click',e=>{if(e.target.id==='modal'){stopEnglish();e.currentTarget.hidden=true}});

document.querySelector('#quiz-emoji').addEventListener('click',()=>{const q=activeQuestions[appState.quizIndex];if(!studyMode.includes('cards')&&isListeningQuestion(studyMode,q))readCurrentQuestion()});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role="button"]')){e.preventDefault();e.target.click()}});
async function openPetMission(){
  if(!bootstrapReady||!hasNativeBridge()||document.hidden)return;
  try{
    const result=await nativeCall('takePetMission');
    if(result.care===true){document.querySelector('#modal').hidden=true;showPage('home');document.querySelector('#pet-care-room').scrollIntoView({block:'center'});return}
    if(result.mission&&allScenes.some(scene=>scene.id===result.mission)){
      document.querySelector('#modal').hidden=true;
      showPage('dialogue');selectScene(result.mission);
    }
  }catch(_){ /* A normal launcher start has no pet invitation. */ }
}
window.addEventListener('starpet-resume',()=>{refreshDailyUi();openPetMission()});
const canInteract=()=>{if(bootstrapReady)return true;recoverProgress();toast('正在恢复以前的记录，请联网稍等。');return false};
petRoom=new PetRoom({root:document.querySelector('#pet-care-room'),getState:()=>appState,save,speak,toast,canAct:canInteract});
videoRoom=new VideoRoom({root:document.querySelector('#page-videos'),getState:()=>appState,save,speak,speakWhilePaused:text=>speaker.speak(text),toast,canAct:canInteract,onComplete:()=>studyDay(),prepareVideo:isAndroidCompat?prepareLocalVideo:null,beforeMedia:cancelRecording,reportError:details=>{if(hasNativeBridge())nativeCall('videoError',details).catch(()=>{})},practice:(id,index)=>{showPage('dialogue');selectScene(id,index)}});
appState.selectedScene=null;
studyDay(false);renderContent();renderBindings();
if(bootstrapReady){save();openPetMission()}else recoverProgress();
apiFetch('/api/v1/catalog').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(c=>{lessons=c.lessons||[];appState.lessonProgress=normalizeLessonProgress(appState.lessonProgress,lessons);localStorage.setItem('starpet-lessons',JSON.stringify(lessons));renderWorlds();renderBindings()}).catch(()=>{try{lessons=JSON.parse(localStorage.getItem('starpet-lessons')||'[]')}catch{lessons=[]}appState.lessonProgress=normalizeLessonProgress(appState.lessonProgress,lessons);renderBindings()});
setInterval(()=>{if(!document.hidden)refreshDailyUi()},60000);
