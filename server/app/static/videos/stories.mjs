// Original short stories. Dialogue, animation beats and child-response gaps share one clock.
const STARTS = [0, 7, 14, 21, 28, 35, 42, 50, 57, 65];
const DURATION = 74;
const dialogue = (rows) => rows.map(([en, zh, visual, speaker = 'bobo'], index) => ({
  start: STARTS[index], end: STARTS[index] + 4, en, zh, visual, speaker,
}));
const beats = (scene, actions) => actions.map((action, index) => ({
  start: STARTS[index], end: STARTS[index + 1] ?? DURATION, scene, action,
}));
const question = (id, prompt, options, correctIndex, explanation) => ({
  id, prompt, options: options.map(([en, zh]) => ({en, zh})), correctIndex, explanation,
});
const respond = (id, at, promptEn, promptZh) => ({id, at, promptEn, promptZh, resumeAfter: 4});

export const STORY_LESSONS = [
  {
    id: 'story-balloon', kind: 'story', title: '波波和会跑的红气球', titleEn: 'The Runaway Red Balloon',
    description: '气球跑高了，波波够不到！一句求助请来小鸟，最后怎么多了一顶小帽子？',
    duration: DURATION, level: '故事启蒙',
    transcript: dialogue([
      ['Look! A red balloon.', '看！一个红气球。', 'show-balloon'],
      ['It is my balloon.', '这是我的气球。', 'hold-balloon'],
      ['Oh! Up it goes!', '哎呀！它往上飞啦！', 'balloon-escape'],
      ['Come down, little balloon!', '下来吧，小气球！', 'chase-balloon'],
      ['I cannot reach it.', '我够不到它。', 'jump-miss'],
      ['A little bird is here.', '一只小鸟来啦。', 'bird-arrive'],
      ['Can you help me?', '你能帮帮我吗？', 'ask-bird'],
      ['Here is your balloon!', '你的气球给你！', 'bird-return', 'bird'],
      ['Thank you, little bird!', '谢谢你，小鸟！', 'thank-bird'],
      ['Oops! That is my hat!', '哎呀！那是我的帽子！', 'hat-surprise'],
    ]),
    interactions: [
      respond('story-balloon-say-help', 46, 'Can you help me?', '和波波一起向小鸟求助：你能帮帮我吗？'),
      respond('story-balloon-say-thanks', 61, 'Thank you, little bird!', '小鸟帮上忙啦！和波波一起谢谢它。'),
    ],
    questions: [
      question('story-balloon-why-help', '波波为什么请小鸟帮忙？', [
        ['It is too high.', '气球太高了，他够不到。'],
        ['He wants a banana.', '他想要一根香蕉。'],
      ], 0, '气球往上飞，波波跳起来也够不到，所以他说 Can you help me? 请小鸟帮忙。'),
      question('story-balloon-funny-end', '最后波波为什么笑了？', [
        ['The bird eats the balloon.', '小鸟吃掉了气球。'],
        ['The bird wears his hat.', '小鸟戴上了他的帽子。'],
      ], 1, '小鸟送回气球，气球绳又碰到了波波的帽子，帽子轻轻落到小鸟头上啦。'),
    ],
    practice: [
      {en: 'Can you help me?', zh: '需要帮助时，试着开口请求', start: 42, end: 46},
      {en: 'Thank you, little bird!', zh: '得到帮助后，真诚地说谢谢', start: 57, end: 61},
    ],
    story: {
      setting: '晴天的公园；波波、小鸟和一只红气球。气球只飞到低树枝旁，没有危险。',
      beats: beats('park', [
        'show-balloon', 'hold-balloon', 'balloon-escape', 'chase-balloon', 'jump-miss',
        'bird-arrive', 'ask-bird', 'bird-return', 'thank-bird', 'hat-surprise',
      ]),
      takeaway: '够不到也没关系：可以礼貌求助，得到帮助后说谢谢。',
    },
  },
  {
    id: 'story-picnic', kind: 'story', title: '野餐篮里的小访客', titleEn: 'A Little Picnic Guest',
    description: '野餐篮边沙沙响，原来是肚子饿的小老鼠。一起分享后，它送来一个迷你小礼物。',
    duration: DURATION, level: '故事启蒙',
    transcript: dialogue([
      ["Let's have a picnic.", '我们来野餐吧。', 'open-basket'],
      ['An apple and a banana!', '一个苹果，还有一根香蕉！', 'show-fruit'],
      ['What is in my basket?', '我的篮子里是什么呀？', 'hear-rustle'],
      ['Hello, little mouse!', '你好，小老鼠！', 'mouse-peek'],
      ['I am hungry, too.', '我也饿了。', 'mouse-hungry', 'mouse'],
      ['Here is an apple.', '给你一个苹果。', 'offer-apple'],
      ['Would you like some?', '你想来一点吗？', 'invite-sharing'],
      ["Yes, please! Let's share.", '好呀，谢谢！我们一起分享。', 'mouse-share', 'mouse'],
      ['Thank you, my friend!', '谢谢你，我的朋友！', 'thank-mouse', 'mouse'],
      ['Look! A tiny green plate!', '看！一个小小的绿盘子！', 'leaf-plate'],
    ]),
    interactions: [
      respond('story-picnic-say-offer', 46, 'Would you like some?', '和波波一起邀请小老鼠：想来一点吗？'),
      respond('story-picnic-say-thanks', 61, 'Thank you, my friend!', '如果朋友与你分享，你可以怎样说谢谢？'),
    ],
    questions: [
      question('story-picnic-why-share', '波波为什么把苹果分享给小老鼠？', [
        ['The apple is a ball.', '因为苹果是一个皮球。'],
        ['The mouse is hungry.', '因为小老鼠也饿了。'],
      ], 1, '小老鼠说 I am hungry, too. 波波听懂它饿了，主动邀请它一起分享。'),
      question('story-picnic-friendship', '小老鼠送来树叶小盘子，故事里发生了什么变化？', [
        ['They become picnic friends.', '小访客成了一起野餐的朋友。'],
        ['Bobo has no food left.', '波波一点吃的都没有了。'],
      ], 0, '波波分享食物，小老鼠说谢谢，还回赠树叶盘子；野餐变成了朋友间的分享。'),
    ],
    practice: [
      {en: 'Would you like some?', zh: '主动邀请朋友分享一点食物', start: 42, end: 46},
      {en: 'Thank you, my friend!', zh: '谢谢愿意分享的朋友', start: 57, end: 61},
    ],
    story: {
      setting: '草地上的野餐垫；波波的篮子里有苹果和香蕉，小老鼠在篮边闻到香味。',
      beats: beats('picnic', [
        'open-basket', 'show-fruit', 'hear-rustle', 'mouse-peek', 'mouse-hungry',
        'offer-apple', 'invite-sharing', 'mouse-share', 'thank-mouse', 'leaf-plate',
      ]),
      takeaway: '一句邀请能把小访客变成朋友；分享可以是食物，也可以是一片用心准备的树叶。',
    },
  },
  {
    id: 'story-rain', kind: 'story', title: '下雨天的大伞', titleEn: 'Room Under My Umbrella',
    description: '突然下雨，小猫淋湿了。波波的大伞还有位置，可小鸭为什么偏偏喜欢伞外面？',
    duration: DURATION, level: '故事启蒙',
    transcript: dialogue([
      ["Let's go for a walk.", '我们去散步吧。', 'sunny-walk'],
      ['Oh! Here comes the rain.', '呀！下雨啦。', 'rain-start'],
      ['My umbrella is big.', '我的伞很大。', 'open-umbrella'],
      ['The little cat is wet.', '小猫淋湿了。', 'cat-wet'],
      ['Come closer, little cat.', '靠近一点，小猫。', 'move-closer'],
      ['There is room for you.', '这里还有你的位置。', 'cat-hesitate'],
      ['Come in, little cat!', '快进来，小猫！', 'invite-cat'],
      ['We are dry together.', '我们一起躲好雨啦。', 'share-umbrella', 'cat'],
      ['Come in, little duck!', '快进来，小鸭！', 'invite-duck'],
      ['Splash! I like the rain!', '啪嗒！我就喜欢下雨！', 'duck-splash', 'duck'],
    ]),
    interactions: [
      respond('story-rain-say-cat', 46, 'Come in, little cat!', '帮波波邀请淋湿的小猫进伞里吧。'),
      respond('story-rain-say-duck', 61, 'Come in, little duck!', '看到小鸭，也可以热情地邀请它。'),
    ],
    questions: [
      question('story-rain-why-invite', '波波为什么邀请小猫到伞下？', [
        ['The cat is wet.', '小猫淋湿了，需要躲雨。'],
        ['The cat wants an apple.', '小猫想要苹果。'],
      ], 0, '下雨让小猫淋湿了。波波发现伞下还有位置，就邀请它一起躲雨。'),
      question('story-rain-duck-choice', '小鸭为什么留在伞外玩？', [
        ['The umbrella is too small.', '因为伞太小，挤不下。'],
        ['The duck likes the rain.', '因为小鸭喜欢雨和小水坑。'],
      ], 1, '小鸭说 I like the rain! 它喜欢玩水；波波欢迎它，也尊重它自己的选择。'),
    ],
    practice: [
      {en: 'Come in, little cat!', zh: '热情邀请需要帮助的朋友', start: 42, end: 46},
      {en: 'Come in, little duck!', zh: '把同一句邀请送给另一位朋友', start: 57, end: 61},
    ],
    story: {
      setting: '安全的公园小路；温柔的小雨、大伞、小猫和爱踩浅水坑的小鸭。没有雷电和危险水域。',
      beats: beats('rain', [
        'sunny-walk', 'rain-start', 'open-umbrella', 'cat-wet', 'move-closer',
        'cat-hesitate', 'invite-cat', 'share-umbrella', 'invite-duck', 'duck-splash',
      ]),
      takeaway: '留一个位置，主动邀请朋友；也可以尊重朋友不一样的喜好。',
    },
  },
];
