"""Bounded, child-safe conversation missions and deterministic answer matching."""
from __future__ import annotations

import re


CONVERSATION_MISSIONS = [
    {
        "id": "chat-intro", "icon": "👋", "title": "波波认识你", "subtitle": "回答姓名和年龄",
        "level": "开口", "color": "#6B5CF6",
        "turns": [
            {"id": "name", "question": "What is your name?", "hint": "可以说：My name is Lily.", "kind": "name"},
            {"id": "age", "question": "How old are you?", "hint": "可以说：I am eight years old.", "kind": "age"},
        ],
    },
    {
        "id": "chat-mood", "icon": "😊", "title": "今天的心情", "subtitle": "说说现在的感受",
        "level": "互动", "color": "#FF8B72",
        "turns": [
            {"id": "mood", "question": "How are you today?", "hint": "试试：I am happy / good / tired.", "kind": "choice",
             "choices": {"happy": ["happy", "great", "good", "fine"], "tired": ["tired", "sleepy"], "sad": ["sad", "upset"]}},
            {"id": "happy-thing", "question": "What makes you happy?", "hint": "可以说：My family / My pet / Playing games.", "kind": "choice",
             "choices": {"family": ["family", "mom", "mum", "dad"], "friends": ["friend", "friends"],
                         "play": ["play", "playing", "game", "games"], "pet": ["pet", "cat", "dog"],
                         "music": ["music", "song", "sing", "singing"], "reading": ["read", "reading", "book", "books"]}},
        ],
    },
    {
        "id": "chat-breakfast", "icon": "🥪", "title": "早餐点单", "subtitle": "告诉波波想吃什么",
        "level": "互动", "color": "#F3A63B",
        "turns": [
            {"id": "food", "question": "What would you like for breakfast?", "hint": "试试：I would like some bread, please.", "kind": "choice",
             "choices": {"bread": ["bread", "toast"], "eggs": ["egg", "eggs"], "fruit": ["apple", "banana", "fruit"],
                         "noodles": ["noodle", "noodles"], "rice": ["rice"]}},
            {"id": "drink", "question": "What would you like to drink?", "hint": "可以说：Milk, please / I would like juice.", "kind": "choice",
             "choices": {"milk": ["milk"], "juice": ["juice"], "water": ["water"], "tea": ["tea"]}},
        ],
    },
    {
        "id": "chat-color", "icon": "🌈", "title": "颜色侦探", "subtitle": "说喜欢的颜色和物品",
        "level": "互动", "color": "#34B8D1",
        "turns": [
            {"id": "color", "question": "What color do you like?", "hint": "试试：I like blue.", "kind": "choice",
             "choices": {color: [color] for color in ["red", "orange", "yellow", "green", "blue", "purple", "pink", "black", "white", "brown"]}},
            {"id": "object", "question": "What can you see in that color?", "hint": "可以说：I can see a blue bag.", "kind": "choice",
             "choices": {"bag": ["bag"], "book": ["book"], "pen": ["pen", "pencil"], "shirt": ["shirt", "coat"],
                         "toy": ["toy", "ball"], "sky": ["sky"], "flower": ["flower"], "car": ["car", "bus"]}},
        ],
    },
    {
        "id": "chat-animal", "icon": "🐼", "title": "动物朋友", "subtitle": "聊喜欢的动物和本领",
        "level": "互动", "color": "#45B97C",
        "turns": [
            {"id": "animal", "question": "What animal do you like?", "hint": "试试：I like pandas.", "kind": "choice",
             "choices": {"cat": ["cat", "cats"], "dog": ["dog", "dogs"], "panda": ["panda", "pandas"],
                         "rabbit": ["rabbit", "rabbits"], "bird": ["bird", "birds"], "fish": ["fish"],
                         "tiger": ["tiger", "tigers"], "lion": ["lion", "lions"]}},
            {"id": "ability", "question": "What can it do?", "hint": "可以说：It can run / jump / swim / fly.", "kind": "choice",
             "choices": {"run": ["run", "runs", "running"], "jump": ["jump", "jumps", "jumping"],
                         "swim": ["swim", "swims", "swimming"], "fly": ["fly", "flies", "flying"],
                         "climb": ["climb", "climbs", "climbing"]}},
        ],
    },
]


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower().replace("’", "'"))


def _mission(mission_id: str) -> dict | None:
    return next((item for item in CONVERSATION_MISSIONS if item["id"] == mission_id), None)


def public_missions() -> list[dict]:
    """Return prompts and hints, without matcher internals."""
    return [{key: value for key, value in mission.items() if key != "turns"} | {
        "turns": [{key: value for key, value in turn.items() if key in {"id", "question", "hint"}}
                  for turn in mission["turns"]]
    } for mission in CONVERSATION_MISSIONS]


def evaluate_answer(mission_id: str, turn_id: str, transcript: str) -> dict[str, object]:
    mission = _mission(mission_id)
    if mission is None:
        raise KeyError("mission_not_found")
    index = next((i for i, turn in enumerate(mission["turns"]) if turn["id"] == turn_id), -1)
    if index < 0:
        raise KeyError("turn_not_found")
    turn = mission["turns"][index]
    words = _words(transcript)
    if not words:
        return {"understood": False, "reply": "I didn't hear you. Please try again.", "feedback": "波波没有听清，靠近一点再说一次。",
                "nextTurnId": turn_id, "complete": False}

    if words == _words(turn["question"]):
        return {"understood": False, "reply": "That's my question! Now tell me your answer.",
                "feedback": "你把问题说出来啦！这次试着回答波波，看看下面的例子。",
                "nextTurnId": turn_id, "complete": False}
    answer = ""
    if turn["kind"] == "name":
        cleaned = " ".join(words)
        match = re.fullmatch(r"(?:my name is|i am|i m|call me) ([a-z]+(?: [a-z]+){0,2})", cleaned)
        short_name = len(words) == 1 and words[0] in {"lily", "lucy", "tom", "sam", "amy", "bobo", "jack", "ben"}
        names = match.group(1).split() if match else words if short_name else []
        if names and not set(names) & {"happy", "tired", "sad", "good", "fine", "what", "your", "name", "not", "no", "dont", "know", "years", "old"}:
            answer = "nickname"
            reply = "Nice to meet you! You can call me Bobo."
        else:
            reply = "Try saying: My name is Lily."
    elif turn["kind"] == "age":
        number_words = {"four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"}
        candidates = [word for word in words if word in number_words or word in {str(n) for n in range(4, 15)}]
        answer = candidates[0] if len(candidates) == 1 and not set(words) & {"not", "no", "don", "dont"} else ""
        reply = f"Wow, {answer}! You are a great English explorer!" if answer else "Try saying: I am eight years old."
    else:
        # Keep negative statements from turning into positive praise: "not blue, but red".
        variants = {variant: label for label, values in turn["choices"].items() for variant in values}
        for clause in re.split(r"\b(?:but|however|instead)\b", transcript.lower()):
            clause_words = _words(clause)
            if set(clause_words) & {"not", "no", "never", "don", "dont", "cannot", "t"}:
                continue
            answer = next((variants[word] for word in clause_words if word in variants), "")
            if answer:
                break
        reply = _choice_reply(turn_id, answer) if answer else "I heard you. Try one of the example answers."

    if not answer:
        return {"understood": False, "reply": reply, "feedback": "已经开口就是进步！参考提示换一种说法再试试。",
                "nextTurnId": turn_id, "complete": False}
    next_id = mission["turns"][index + 1]["id"] if index + 1 < len(mission["turns"]) else None
    return {"understood": True, "reply": reply, "feedback": "波波听懂啦！你们真的聊起来了。",
            "nextTurnId": next_id, "complete": next_id is None, "matched": answer}


def _choice_reply(turn_id: str, answer: str) -> str:
    replies = {
        "mood": {"happy": "I'm happy to hear that! Let's play together.", "sad": "Thank you for telling me. I'm here with you.", "tired": "Thanks for telling me. We can take a little break."}.get(answer, "Thanks for telling me."),
        "happy-thing": f"That sounds lovely! { {'pet': 'Pets', 'play': 'Playing'}.get(answer, answer.capitalize())} can make a day special.",
        "food": f"Yum! {answer.capitalize()} {'are' if answer in {'eggs', 'noodles'} else 'is'} a tasty breakfast.",
        "drink": f"Great choice! Here is your {answer}.",
        "color": f"I like {answer}, too! Let's be color detectives.",
        "object": f"Good spotting! You found {'the' if answer == 'sky' else 'a'} {answer}.",
        "animal": f"A {answer} is a wonderful animal friend!",
        "ability": f"You said: It can {answer}. Thanks for sharing!",
    }
    return replies[turn_id]
