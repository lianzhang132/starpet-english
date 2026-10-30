export const ALPHABET = [
  {letter:'A',sound:'/æ/',word:'apple',emoji:'🍎',meaning:'苹果'},
  {letter:'B',sound:'/b/',word:'ball',emoji:'⚽',meaning:'球'},
  {letter:'C',sound:'/k/',word:'cat',emoji:'🐱',meaning:'猫'},
  {letter:'D',sound:'/d/',word:'dog',emoji:'🐶',meaning:'狗',note:'示范美式 /dɑɡ/；英式 /dɒɡ/ 也正确。读完整单词，不读成 D-O-G。'},
  {letter:'E',sound:'/ɛ/',word:'egg',emoji:'🥚',meaning:'鸡蛋'},
  {letter:'F',sound:'/f/',word:'fish',emoji:'🐟',meaning:'鱼'},
  {letter:'G',sound:'/g/',word:'goat',emoji:'🐐',meaning:'山羊'},
  {letter:'H',sound:'/h/',word:'hat',emoji:'🎩',meaning:'帽子'},
  {letter:'I',sound:'/ɪ/',word:'insect',emoji:'🐞',meaning:'昆虫'},
  {letter:'J',sound:'/dʒ/',word:'juice',emoji:'🧃',meaning:'果汁'},
  {letter:'K',sound:'/k/',word:'kite',emoji:'🪁',meaning:'风筝'},
  {letter:'L',sound:'/l/',word:'lion',emoji:'🦁',meaning:'狮子'},
  {letter:'M',sound:'/m/',word:'moon',emoji:'🌙',meaning:'月亮'},
  {letter:'N',sound:'/n/',word:'nose',emoji:'👃',meaning:'鼻子'},
  {letter:'O',sound:'/ɑ/',word:'octopus',emoji:'🐙',meaning:'章鱼'},
  {letter:'P',sound:'/p/',word:'pig',emoji:'🐷',meaning:'猪'},
  {letter:'Q',sound:'/kw/',word:'queen',emoji:'👑',meaning:'女王'},
  {letter:'R',sound:'/r/',word:'rabbit',emoji:'🐰',meaning:'兔子'},
  {letter:'S',sound:'/s/',word:'sun',emoji:'☀️',meaning:'太阳'},
  {letter:'T',sound:'/t/',word:'tiger',emoji:'🐯',meaning:'老虎'},
  {letter:'U',sound:'/ʌ/',word:'umbrella',emoji:'☂️',meaning:'雨伞'},
  {letter:'V',sound:'/v/',word:'van',emoji:'🚐',meaning:'小货车'},
  {letter:'W',sound:'/w/',word:'water',emoji:'💧',meaning:'水'},
  {letter:'X',sound:'/ks/',word:'fox',emoji:'🦊',meaning:'狐狸（听尾音）'},
  {letter:'Y',sound:'/j/',word:'yellow',emoji:'💛',meaning:'黄色'},
  {letter:'Z',sound:'/z/',word:'zebra',emoji:'🦓',meaning:'斑马'}
];

export const PHONICS_SOUNDS = [
  {letters:'sh',sound:'/ʃ/',words:['ship','fish'],emoji:'🚢',hint:'像轻轻说“嘘”'},
  {letters:'ch',sound:'/tʃ/',words:['chair','lunch'],emoji:'🪑',hint:'嘴巴先挡住，再送气'},
  {letters:'th',sound:'/θ/',words:['three','bath'],emoji:'3️⃣',hint:'舌尖轻放在牙齿间'},
  {letters:'wh',sound:'/w/',words:['white','whale'],emoji:'🐋',hint:'圆唇送出 w 音'},
  {letters:'ee',sound:'/iː/',words:['tree','green'],emoji:'🌳',hint:'嘴角微笑，声音拉长'},
  {letters:'oo',sound:'/uː/',words:['moon','food'],emoji:'🌙',hint:'圆唇，声音拉长'},
  {letters:'ai',sound:'/eɪ/',words:['rain','train'],emoji:'🌧️',hint:'从 e 滑向 i'},
  {letters:'oa',sound:'/oʊ/',words:['boat','goat'],emoji:'⛵',hint:'圆唇，从 o 滑向尾音'},
  {letters:'ng',sound:'/ŋ/',words:['sing','king'],emoji:'🎤',hint:'声音留在鼻腔'},
  {letters:'ck',sound:'/k/',words:['duck','clock'],emoji:'🦆',hint:'词尾常见的 k 音'}
];

export const CVC_BLENDS = [
  {parts:['c','a','t'],sounds:['/k/','/æ/','/t/'],word:'cat',emoji:'🐱',meaning:'猫'},
  {parts:['d','o','g'],sounds:['/d/','/ɑ/','/g/'],word:'dog',emoji:'🐶',meaning:'狗',note:'当前示范为美式 /dɑɡ/；英式 /dɒɡ/、其他美式 /dɔɡ/ 也正确。'},
  {parts:['s','u','n'],sounds:['/s/','/ʌ/','/n/'],word:'sun',emoji:'☀️',meaning:'太阳'},
  {parts:['p','i','g'],sounds:['/p/','/ɪ/','/g/'],word:'pig',emoji:'🐷',meaning:'猪'},
  {parts:['h','e','n'],sounds:['/h/','/ɛ/','/n/'],word:'hen',emoji:'🐔',meaning:'母鸡'},
  {parts:['m','a','p'],sounds:['/m/','/æ/','/p/'],word:'map',emoji:'🗺️',meaning:'地图'},
  {parts:['b','e','d'],sounds:['/b/','/ɛ/','/d/'],word:'bed',emoji:'🛏️',meaning:'床'},
  {parts:['c','u','p'],sounds:['/k/','/ʌ/','/p/'],word:'cup',emoji:'🥤',meaning:'杯子'},
  {parts:['f','a','n'],sounds:['/f/','/æ/','/n/'],word:'fan',emoji:'🪭',meaning:'扇子'},
  {parts:['f','o','x'],sounds:['/f/','/ɑ/','/ks/'],word:'fox',emoji:'🦊',meaning:'狐狸'},
  {parts:['r','e','d'],sounds:['/r/','/ɛ/','/d/'],word:'red',emoji:'🔴',meaning:'红色'},
  {parts:['b','u','s'],sounds:['/b/','/ʌ/','/s/'],word:'bus',emoji:'🚌',meaning:'公交车'}
];

export const PHONICS_QUIZZES = CVC_BLENDS.map((item, index, items) => {
  const distractors = [items[(index + 3) % items.length].word, items[(index + 6) % items.length].word, items[(index + 9) % items.length].word];
  const correctIndex = index % 4;
  const answers = [...distractors];
  answers.splice(correctIndex, 0, item.word);
  return {id:`phonics-${item.word}`,emoji:'🎧',prompt:'听一听，选出波波读的单词',hint:`先看 ${item.parts.join(' · ')}，再听完整单词。`,answers,correctIndex,
    explanation:`${item.parts.join(' + ')} 连起来读成 ${item.word}。`,speech:item.word};
});
