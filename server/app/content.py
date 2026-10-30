COURSE_WORLDS = [
    {
        "id": "hello",
        "title": "你好，世界",
        "englishTitle": "Hello World",
        "description": "问候、自我介绍与礼貌用语",
        "icon": "👋",
        "color": "#6B5CF6",
        "lessons": [
            {"id": "hello-1", "title": "Hello!", "subtitle": "打招呼", "minutes": 6},
            {"id": "hello-2", "title": "My name is…", "subtitle": "介绍自己", "minutes": 8},
            {"id": "hello-3", "title": "Thank you", "subtitle": "礼貌表达", "minutes": 7},
            {"id": "hello-4", "title": "Nice to meet you", "subtitle": "认识新朋友", "minutes": 9},
        ],
    },
    {
        "id": "family",
        "title": "温暖的家",
        "englishTitle": "My Family",
        "description": "家人、房间与日常起居",
        "icon": "🏡",
        "color": "#FF8B72",
        "lessons": [
            {"id": "family-1", "title": "My family", "subtitle": "家庭成员", "minutes": 8},
            {"id": "family-2", "title": "My room", "subtitle": "我的房间", "minutes": 8},
            {"id": "family-3", "title": "Breakfast time", "subtitle": "早餐时间", "minutes": 10},
            {"id": "family-4", "title": "Good night", "subtitle": "睡前表达", "minutes": 6},
        ],
    },
    {
        "id": "school",
        "title": "校园冒险",
        "englishTitle": "School Day",
        "description": "文具、课程与同学交流",
        "icon": "🎒",
        "color": "#34B8D1",
        "lessons": [
            {"id": "school-1", "title": "My school bag", "subtitle": "认识文具", "minutes": 8},
            {"id": "school-2", "title": "In the classroom", "subtitle": "课堂指令", "minutes": 10},
            {"id": "school-3", "title": "What time is it?", "subtitle": "时间表达", "minutes": 10},
            {"id": "school-4", "title": "Let's play!", "subtitle": "邀请同学", "minutes": 8},
        ],
    },
    {
        "id": "food",
        "title": "美食小镇",
        "englishTitle": "Food Town",
        "description": "食物、喜好与点餐表达",
        "icon": "🍜",
        "color": "#F3A63B",
        "lessons": [
            {"id": "food-1", "title": "Fruits", "subtitle": "缤纷水果", "minutes": 7},
            {"id": "food-2", "title": "I like…", "subtitle": "表达喜好", "minutes": 8},
            {"id": "food-3", "title": "At the restaurant", "subtitle": "餐厅点餐", "minutes": 12},
            {"id": "food-4", "title": "How much?", "subtitle": "询问价格", "minutes": 10},
        ],
    },
    {
        "id": "city",
        "title": "城市出发",
        "englishTitle": "Around Town",
        "description": "地点、交通与问路交流",
        "icon": "🚌",
        "color": "#45B97C",
        "lessons": [
            {"id": "city-1", "title": "Places", "subtitle": "城市地点", "minutes": 9},
            {"id": "city-2", "title": "By bus", "subtitle": "交通方式", "minutes": 9},
            {"id": "city-3", "title": "Where is…?", "subtitle": "问路", "minutes": 12},
            {"id": "city-4", "title": "Turn left", "subtitle": "方向指引", "minutes": 10},
        ],
    },
    {
        "id": "travel",
        "title": "世界旅行",
        "englishTitle": "Let's Travel",
        "description": "把所学英语用在真实交流中",
        "icon": "✈️",
        "color": "#9B64D8",
        "lessons": [
            {"id": "travel-1", "title": "At the airport", "subtitle": "机场交流", "minutes": 12},
            {"id": "travel-2", "title": "At the hotel", "subtitle": "入住酒店", "minutes": 12},
            {"id": "travel-3", "title": "Can you help me?", "subtitle": "寻求帮助", "minutes": 10},
            {"id": "travel-4", "title": "My travel story", "subtitle": "完整表达", "minutes": 15},
        ],
    },
]

WORDS = [
    {"id": "hello", "word": "hello", "phonetic": "/həˈləʊ/", "meaning": "你好", "example": "Hello, I am Bobo!", "emoji": "👋"},
    {"id": "apple", "word": "apple", "phonetic": "/ˈæpəl/", "meaning": "苹果", "example": "I like this red apple.", "emoji": "🍎"},
    {"id": "happy", "word": "happy", "phonetic": "/ˈhæpi/", "meaning": "开心的", "example": "I am happy today.", "emoji": "😊"},
    {"id": "family", "word": "family", "phonetic": "/ˈfæməli/", "meaning": "家人", "example": "I love my family.", "emoji": "🏠"},
    {"id": "school", "word": "school", "phonetic": "/skuːl/", "meaning": "学校", "example": "I go to school.", "emoji": "🏫"},
    {"id": "friend", "word": "friend", "phonetic": "/frend/", "meaning": "朋友", "example": "You are my friend.", "emoji": "🤝"},
]

QUIZZES = [
    {"id": "q-apple", "prompt": "“苹果”用英语怎么说？", "emoji": "🍎", "answers": ["orange", "apple", "banana", "grape"], "correctIndex": 1, "explanation": "apple 是苹果，记住 a-a-apple。"},
    {"id": "q-morning", "prompt": "早上见到老师，应该说什么？", "emoji": "🌅", "answers": ["Good night!", "Goodbye!", "Good morning!", "Thank you!"], "correctIndex": 2, "explanation": "早上好是 Good morning!"},
    {"id": "q-cats", "prompt": "选择正确的句子：我喜欢猫。", "emoji": "🐱", "answers": ["I like cats.", "I like dogs.", "I can see a cat.", "The cat is sleeping."], "correctIndex": 0, "explanation": "I like cats. 表示我喜欢猫。"},
]

DIALOGUE_TRANSLATIONS = {
    "new-friend": ["你好！我的名字是波波。", "你叫什么名字？", "很高兴认识你！"],
    "breakfast": ["早上好！", "你想要些什么？", "我想要一些牛奶，谢谢。"],
    "classroom": ["请打开你的书。", "听一听，再跟着读。", "做得很棒！"],
    "restaurant": ["可以给我菜单吗？", "我想要面条。", "谢谢你！"],
    "directions": ["打扰一下，公园在哪里？", "直走，然后向左转。", "非常感谢你！"],
    "hotel": ["你好，我有预订。", "可以给我房间钥匙吗？", "祝你入住愉快！"],
}

DIALOGUES = [
    {"id": "new-friend", "title": "认识新朋友", "icon": "🛝", "level": "入门", "lines": ["Hi! My name is Bobo.", "What is your name?", "Nice to meet you!"]},
    {"id": "breakfast", "title": "早餐时间", "icon": "🥪", "level": "基础", "lines": ["Good morning!", "What would you like?", "I would like some milk, please."]},
    {"id": "classroom", "title": "英语课堂", "icon": "🧑‍🏫", "level": "基础", "lines": ["Open your book, please.", "Listen and repeat.", "Great job!"]},
    {"id": "restaurant", "title": "小小餐厅", "icon": "🍽️", "level": "进阶", "lines": ["May I have the menu?", "I would like noodles.", "Thank you!"]},
    {"id": "directions", "title": "城市问路", "icon": "🗺️", "level": "进阶", "lines": ["Excuse me, where is the park?", "Go straight and turn left.", "Thank you very much!"]},
    {"id": "hotel", "title": "旅行住店", "icon": "🏨", "level": "挑战", "lines": ["Hello, I have a reservation.", "May I have the room key?", "Have a nice stay!"]},
]

for dialogue in DIALOGUES:
    dialogue["translations"] = DIALOGUE_TRANSLATIONS[dialogue["id"]]
