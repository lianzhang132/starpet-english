"""Phonics listening questions mirrored by the offline web bundle."""

PHONICS_WORDS = ["cat", "dog", "sun", "pig", "hen", "map", "bed", "cup", "fan", "fox", "red", "bus"]


def build_phonics_quizzes() -> list[dict]:
    quizzes = []
    for index, word in enumerate(PHONICS_WORDS):
        answers = [PHONICS_WORDS[(index + offset) % len(PHONICS_WORDS)] for offset in (3, 6, 9)]
        correct_index = index % 4
        answers.insert(correct_index, word)
        quizzes.append({
            "id": f"phonics-{word}", "emoji": "🎧", "prompt": "听一听，选出波波读的单词", "hint": "听完整单词再选择。",
            "answers": answers, "correctIndex": correct_index, "explanation": f"再听一遍：{word}。",
        })
    return quizzes


PHONICS_QUIZZES = build_phonics_quizzes()
