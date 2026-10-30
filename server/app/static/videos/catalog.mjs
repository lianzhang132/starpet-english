// Original learning animations, generated reproducibly by tools/video/build.mjs.
import {STORY_LESSONS} from './stories.mjs';
import {BOOKDASH_LESSONS} from './bookdash.mjs';
import {OPEN_FILMS} from './open-films.mjs';
const line=(start,en,zh,visual)=>({start,end:start+6,en,zh,visual});
const question=(id,prompt,options,correctIndex,explanation)=>({id,prompt,options:options.map(([en,zh])=>({en,zh})),correctIndex,explanation});
const BASIC_CLIPS = [
  {id:'hello',title:'在公园认识新朋友',titleEn:'Hello, Bobo!',description:'看波波挥手、介绍自己，再试着问好。',
    transcript:[line(0,'Hi! My name is Bobo.','嗨！我的名字叫波波。','hello'),line(8,'What is your name?','你叫什么名字？','name'),line(16,'Nice to meet you!','很高兴认识你！','friends')],
    questions:[question('hello-name','动画里的新朋友叫什么？',[['Bobo','波波'],['apple','苹果']],0,'My name is Bobo 是“我的名字叫波波”。')],
    practice:[{en:'Hi! My name is Bobo.',zh:'先模仿波波介绍自己',start:0,end:6,sceneId:'new-friend',lineIndex:0},{en:'Nice to meet you!',zh:'和新朋友问好',start:16,end:22,sceneId:'new-friend',lineIndex:2}]},
  {id:'colors',title:'波波的水果颜色屋',titleEn:'Fruit & Colors',description:'红苹果、黄香蕉：把听到的颜色和眼前的水果连起来。',
    transcript:[line(0,'red','红色','red'),line(6,'apple','苹果','apple'),line(12,'yellow','黄色','yellow'),line(18,'banana','香蕉','banana')],
    questions:[question('colors-fruit','视频中黄色的水果是哪一个？',[['apple','苹果'],['banana','香蕉']],1,'yellow 是黄色；banana 是香蕉。')],practice:[{en:'apple',zh:'苹果',start:6,end:12},{en:'banana',zh:'香蕉',start:18,end:24}]},
  {id:'breakfast',title:'早餐时，礼貌地要牛奶',titleEn:'Breakfast, Please!',description:'看到杯子、听到请求，理解怎样礼貌地点餐。',
    transcript:[line(0,'Good morning!','早上好！','morning'),line(6,'What would you like?','你想要什么？','table'),line(12,'I would like some milk, please.','我想要一些牛奶，谢谢。','milk'),line(20,'Thank you!','谢谢！','thanks')],
    questions:[question('breakfast-drink','波波想喝什么？',[['milk','牛奶'],['apple','苹果']],0,'I would like some milk, please. 是礼貌地要牛奶。')],
    practice:[{en:'I would like some milk, please.',zh:'试着自己点一杯牛奶',start:12,end:18,sceneId:'breakfast',lineIndex:2}]},
  {id:'pets',title:'和猫咪、小狗一起玩',titleEn:'My Animal Friends',description:'先认出小动物，再听懂“我喜欢……”的表达。',
    transcript:[line(0,'cat','猫','cat'),line(6,'I like cats.','我喜欢猫。','cats'),line(12,'dog','狗','dog'),line(18,'I like dogs.','我喜欢狗。','dogs')],
    questions:[question('pets-cat','cat 指的是哪种动物？',[['cat','猫 🐱'],['dog','狗 🐶']],0,'cat 是猫；dog 是狗。')],practice:[{en:'I like cats.',zh:'我喜欢猫',start:6,end:12},{en:'I like dogs.',zh:'我喜欢狗',start:18,end:24}]}
].map(item=>({...item,duration:28,level:'启蒙',src:`/static/videos/${item.id}.mp4`,poster:`/static/videos/${item.id}.jpg`,captions:`/static/videos/${item.id}.vtt`,source:{type:'original',credit:'星伴原创矢量动画；离线合成英语示范音，无广告、无外链。'}}));
export const VIDEO_LESSONS = [...BASIC_CLIPS,...STORY_LESSONS.map(item=>({...item,src:`/static/videos/${item.id}.mp4`,poster:`/static/videos/${item.id}.jpg`,captions:`/static/videos/${item.id}.vtt`,source:{type:'original',credit:'星伴原创剧情与二维角色动画；英语对白为离线合成示范音，含原创轻音效，无广告、无外链。'}})),...BOOKDASH_LESSONS,...OPEN_FILMS];
