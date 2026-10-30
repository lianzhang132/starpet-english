export interface WordItem {
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  emoji: string;
}

export interface LessonItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  minutes: number;
  stars: number;
  locked: boolean;
}

export interface CourseWorld {
  id: string;
  title: string;
  englishTitle: string;
  description: string;
  icon: string;
  color: string;
  progress: number;
  lessons: LessonItem[];
}

export interface DialogueScene {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  level: string;
  lines: string[];
}

export interface QuizItem {
  id: string;
  explanation?: string;
  prompt: string;
  hint: string;
  emoji: string;
  answers: string[];
  correctIndex: number;
}

export const DAILY_WORDS: WordItem[] = [
  { word: 'hello', phonetic: '/həˈləʊ/', meaning: '你好', example: 'Hello, I am Bobo!', emoji: '👋' },
  { word: 'apple', phonetic: '/ˈæpəl/', meaning: '苹果', example: 'I like this red apple.', emoji: '🍎' },
  { word: 'happy', phonetic: '/ˈhæpi/', meaning: '开心的', example: 'I am happy today.', emoji: '😊' },
  { word: 'family', phonetic: '/ˈfæməli/', meaning: '家人', example: 'I love my family.', emoji: '🏠' },
  { word: 'school', phonetic: '/skuːl/', meaning: '学校', example: 'I go to school.', emoji: '🏫' },
  { word: 'friend', phonetic: '/frend/', meaning: '朋友', example: 'You are my friend.', emoji: '🤝' }
];

export const QUIZZES: QuizItem[] = [
  {
    id: 'q-apple',
    prompt: '“苹果”用英语怎么说？',
    hint: '它是红红的水果，读音以 A 开头。',
    emoji: '🍎',
    answers: ['orange', 'apple', 'banana', 'grape'],
    correctIndex: 1
  },
  {
    id: 'q-morning',
    prompt: '早上见到老师，应该说什么？',
    hint: 'Good + 一天的开始。',
    emoji: '🌅',
    answers: ['Good night!', 'Goodbye!', 'Good morning!', 'Thank you!'],
    correctIndex: 2
  },
  {
    id: 'q-cats',
    prompt: '选择正确的句子：我喜欢猫。',
    hint: '“喜欢”是 like。',
    emoji: '🐱',
    answers: ['I like cats.', 'I like dogs.', 'I can see a cat.', 'The cat is sleeping.'],
    correctIndex: 0
  }
];

export const COURSE_WORLDS: CourseWorld[] = [
  {
    id: 'hello', title: '你好，世界', englishTitle: 'Hello World', description: '问候、自我介绍与礼貌用语',
    icon: '👋', color: '#6B5CF6', progress: 75,
    lessons: [
      { id: 'hello-1', title: 'Hello!', subtitle: '打招呼', icon: '👋', minutes: 6, stars: 3, locked: false },
      { id: 'hello-2', title: 'My name is…', subtitle: '介绍自己', icon: '🙋', minutes: 8, stars: 2, locked: false },
      { id: 'hello-3', title: 'Thank you', subtitle: '礼貌表达', icon: '💛', minutes: 7, stars: 0, locked: false },
      { id: 'hello-4', title: 'Nice to meet you', subtitle: '认识新朋友', icon: '🤝', minutes: 9, stars: 0, locked: true }
    ]
  },
  {
    id: 'family', title: '温暖的家', englishTitle: 'My Family', description: '家人、房间与日常起居',
    icon: '🏡', color: '#FF8B72', progress: 35,
    lessons: [
      { id: 'family-1', title: 'My family', subtitle: '家庭成员', icon: '👨‍👩‍👧', minutes: 8, stars: 3, locked: false },
      { id: 'family-2', title: 'My room', subtitle: '我的房间', icon: '🛏️', minutes: 8, stars: 1, locked: false },
      { id: 'family-3', title: 'Breakfast time', subtitle: '早餐时间', icon: '🥣', minutes: 10, stars: 0, locked: false },
      { id: 'family-4', title: 'Good night', subtitle: '睡前表达', icon: '🌙', minutes: 6, stars: 0, locked: true }
    ]
  },
  {
    id: 'school', title: '校园冒险', englishTitle: 'School Day', description: '文具、课程与同学交流',
    icon: '🎒', color: '#34B8D1', progress: 10,
    lessons: [
      { id: 'school-1', title: 'My school bag', subtitle: '认识文具', icon: '✏️', minutes: 8, stars: 1, locked: false },
      { id: 'school-2', title: 'In the classroom', subtitle: '课堂指令', icon: '📚', minutes: 10, stars: 0, locked: false },
      { id: 'school-3', title: 'What time is it?', subtitle: '时间表达', icon: '🕘', minutes: 10, stars: 0, locked: true },
      { id: 'school-4', title: 'Let’s play!', subtitle: '邀请同学', icon: '⚽', minutes: 8, stars: 0, locked: true }
    ]
  },
  {
    id: 'food', title: '美食小镇', englishTitle: 'Food Town', description: '食物、喜好与点餐表达',
    icon: '🍜', color: '#F3A63B', progress: 0,
    lessons: [
      { id: 'food-1', title: 'Fruits', subtitle: '缤纷水果', icon: '🍓', minutes: 7, stars: 0, locked: false },
      { id: 'food-2', title: 'I like…', subtitle: '表达喜好', icon: '😋', minutes: 8, stars: 0, locked: true },
      { id: 'food-3', title: 'At the restaurant', subtitle: '餐厅点餐', icon: '🍽️', minutes: 12, stars: 0, locked: true },
      { id: 'food-4', title: 'How much?', subtitle: '询问价格', icon: '💰', minutes: 10, stars: 0, locked: true }
    ]
  },
  {
    id: 'city', title: '城市出发', englishTitle: 'Around Town', description: '地点、交通与问路交流',
    icon: '🚌', color: '#45B97C', progress: 0,
    lessons: [
      { id: 'city-1', title: 'Places', subtitle: '城市地点', icon: '🏥', minutes: 9, stars: 0, locked: true },
      { id: 'city-2', title: 'By bus', subtitle: '交通方式', icon: '🚌', minutes: 9, stars: 0, locked: true },
      { id: 'city-3', title: 'Where is…?', subtitle: '问路', icon: '🗺️', minutes: 12, stars: 0, locked: true },
      { id: 'city-4', title: 'Turn left', subtitle: '方向指引', icon: '↩️', minutes: 10, stars: 0, locked: true }
    ]
  },
  {
    id: 'travel', title: '世界旅行', englishTitle: 'Let’s Travel', description: '把所学英语用在真实交流中',
    icon: '✈️', color: '#9B64D8', progress: 0,
    lessons: [
      { id: 'travel-1', title: 'At the airport', subtitle: '机场交流', icon: '🛫', minutes: 12, stars: 0, locked: true },
      { id: 'travel-2', title: 'At the hotel', subtitle: '入住酒店', icon: '🏨', minutes: 12, stars: 0, locked: true },
      { id: 'travel-3', title: 'Can you help me?', subtitle: '寻求帮助', icon: '🙋', minutes: 10, stars: 0, locked: true },
      { id: 'travel-4', title: 'My travel story', subtitle: '完整表达', icon: '📷', minutes: 15, stars: 0, locked: true }
    ]
  }
];

export const DIALOGUE_SCENES: DialogueScene[] = [
  {
    id: 'new-friend', title: '认识新朋友', subtitle: '介绍姓名、年龄和爱好', icon: '🛝', color: '#6B5CF6', level: '入门',
    lines: ['Hi! My name is Bobo.', 'What is your name?', 'Nice to meet you!']
  },
  {
    id: 'breakfast', title: '早餐时间', subtitle: '说出想吃的食物和饮料', icon: '🥪', color: '#FF8B72', level: '基础',
    lines: ['Good morning!', 'What would you like?', 'I would like some milk, please.']
  },
  {
    id: 'classroom', title: '英语课堂', subtitle: '听懂老师的课堂指令', icon: '🧑‍🏫', color: '#34B8D1', level: '基础',
    lines: ['Open your book, please.', 'Listen and repeat.', 'Great job!']
  },
  {
    id: 'restaurant', title: '小小餐厅', subtitle: '完成一次简单点餐', icon: '🍽️', color: '#F3A63B', level: '进阶',
    lines: ['May I have the menu?', 'I would like noodles.', 'Thank you!']
  },
  {
    id: 'directions', title: '城市问路', subtitle: '询问地点并听懂方向', icon: '🗺️', color: '#45B97C', level: '进阶',
    lines: ['Excuse me, where is the park?', 'Go straight and turn left.', 'Thank you very much!']
  },
  {
    id: 'hotel', title: '旅行住店', subtitle: '办理入住和提出需求', icon: '🏨', color: '#9B64D8', level: '挑战',
    lines: ['Hello, I have a reservation.', 'May I have the room key?', 'Have a nice stay!']
  }
];
