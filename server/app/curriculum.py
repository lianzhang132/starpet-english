"""Original bilingual lesson material, from greetings to everyday conversation."""

# Each lesson has three word cards, three vocabulary checks and one sentence check.
_UNITS = [
    ("hello-1", "Hello!", "你好！", [("hello", "你好", "👋"), ("morning", "早晨", "🌅"), ("goodbye", "再见", "🙋")]),
    ("hello-2", "My name is Lily.", "我的名字是莉莉。", [("name", "名字", "🏷️"), ("I", "我", "🙋"), ("you", "你", "👉")]),
    ("hello-3", "Thank you for your help.", "谢谢你的帮助。", [("please", "请", "🙏"), ("thanks", "谢谢", "💛"), ("sorry", "对不起", "🙇")]),
    ("hello-4", "Nice to meet you!", "很高兴认识你！", [("friend", "朋友", "🤝"), ("meet", "遇见", "👋"), ("happy", "开心的", "😊")]),
    ("family-1", "This is my mother.", "这是我的妈妈。", [("mother", "妈妈", "👩"), ("father", "爸爸", "👨"), ("sister", "姐妹", "👧")]),
    ("family-2", "The book is on the desk.", "书在书桌上。", [("bed", "床", "🛏️"), ("desk", "书桌", "🪑"), ("room", "房间", "🏠")]),
    ("family-3", "I would like some milk.", "我想要一些牛奶。", [("milk", "牛奶", "🥛"), ("bread", "面包", "🍞"), ("egg", "鸡蛋", "🥚")]),
    ("family-4", "Good night, Mum!", "晚安，妈妈！", [("night", "夜晚", "🌙"), ("sleep", "睡觉", "😴"), ("tired", "疲倦的", "🥱")]),
    ("school-1", "May I use your pencil?", "我可以用你的铅笔吗？", [("pencil", "铅笔", "✏️"), ("book", "书", "📕"), ("bag", "书包", "🎒")]),
    ("school-2", "Open your book, please.", "请打开你的书。", [("open", "打开", "📖"), ("listen", "听", "👂"), ("read", "阅读", "📚")]),
    ("school-3", "It is eight o'clock.", "现在是八点。", [("one", "一", "1️⃣"), ("eight", "八", "8️⃣"), ("clock", "时钟", "🕗")]),
    ("school-4", "Let us play football!", "我们一起踢足球吧！", [("play", "玩", "🛝"), ("football", "足球", "⚽"), ("run", "跑", "🏃")]),
    ("food-1", "I like apples.", "我喜欢苹果。", [("apple", "苹果", "🍎"), ("banana", "香蕉", "🍌"), ("orange", "橙子", "🍊")]),
    ("food-2", "I do not like fish.", "我不喜欢鱼。", [("like", "喜欢", "💜"), ("fish", "鱼", "🐟"), ("rice", "米饭", "🍚")]),
    ("food-3", "I would like noodles, please.", "请给我一份面条。", [("menu", "菜单", "📋"), ("noodles", "面条", "🍜"), ("water", "水", "💧")]),
    ("food-4", "How much is this apple?", "这个苹果多少钱？", [("how much", "多少钱", "💰"), ("two", "二", "2️⃣"), ("five", "五", "5️⃣")]),
    ("city-1", "Where is the park?", "公园在哪里？", [("park", "公园", "🌳"), ("hospital", "医院", "🏥"), ("shop", "商店", "🏪")]),
    ("city-2", "I go to school by bus.", "我乘公交车去学校。", [("bus", "公交车", "🚌"), ("bike", "自行车", "🚲"), ("train", "火车", "🚆")]),
    ("city-3", "Excuse me, where is the shop?", "打扰一下，商店在哪里？", [("where", "哪里", "📍"), ("near", "在附近", "↔️"), ("street", "街道", "🛣️")]),
    ("city-4", "Go straight and turn left.", "直走，然后向左转。", [("left", "左边", "⬅️"), ("right", "右边", "➡️"), ("straight", "直地", "⬆️")]),
    ("travel-1", "Here is my ticket.", "这是我的票。", [("ticket", "票", "🎫"), ("plane", "飞机", "✈️"), ("airport", "机场", "🛫")]),
    ("travel-2", "May I have the room key?", "可以给我房间钥匙吗？", [("hotel", "酒店", "🏨"), ("key", "钥匙", "🔑"), ("reservation", "预订", "🗓️")]),
    ("travel-3", "Can you help me, please?", "你能帮帮我吗？", [("help", "帮助", "🙋"), ("lost", "迷路的", "🧭"), ("phone", "电话", "☎️")]),
    ("travel-4", "I went to the park today.", "我今天去了公园。", [("today", "今天", "📅"), ("photo", "照片", "📷"), ("beautiful", "美丽的", "🌷")]),
]

LESSONS = []
LESSON_QUIZZES = []
for unit_index, (lesson_id, sentence, translation, vocabulary) in enumerate(_UNITS):
    words = [{"word": word, "meaning": meaning, "emoji": emoji} for word, meaning, emoji in vocabulary]
    questions = []
    for word_index, word in enumerate(words):
        distractors = [item[0] for item in _UNITS[(unit_index + 1) % len(_UNITS)][3] if item[0] != word["word"]][:3]
        position = (unit_index + word_index) % 4
        answers = list(distractors)
        answers.insert(position, word["word"])
        questions.append({"id": f"{lesson_id}-word-{word_index}", "prompt": f'“{word["meaning"]}”用英语怎么说？',
                          "hint": "先想一想词卡上的图片。", "emoji": word["emoji"], "answers": answers,
                          "correctIndex": position, "explanation": f'{word["word"]} 的意思是“{word["meaning"]}”。'})
    choices = [_UNITS[(unit_index + offset) % len(_UNITS)][2] for offset in (1, 2, 3)]
    position = unit_index % 4
    choices.insert(position, translation)
    questions.append({"id": f"{lesson_id}-sentence", "prompt": sentence, "hint": "这句话是什么意思？",
                      "emoji": "💬", "answers": choices, "correctIndex": position, "explanation": translation})
    lesson = {"id": lesson_id, "worldId": lesson_id.rsplit("-", 1)[0], "words": words,
              "sentence": sentence, "translation": translation, "questions": questions}
    LESSONS.append(lesson)
    LESSON_QUIZZES.extend(questions)
