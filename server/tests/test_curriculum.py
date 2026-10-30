from app.content import COURSE_WORLDS
from app.curriculum import LESSONS, LESSON_QUIZZES


def test_all_advertised_lessons_have_playable_content():
    assert {lesson['id'] for lesson in LESSONS} == {lesson['id'] for world in COURSE_WORLDS for lesson in world['lessons']}
    assert len(LESSONS) == 24 and len(LESSON_QUIZZES) == 96
    assert len({question['id'] for question in LESSON_QUIZZES}) == 96
    for lesson in LESSONS:
        assert len(lesson['words']) == 3 and lesson['sentence'] and lesson['translation']
    for question in LESSON_QUIZZES:
        assert len(question['answers']) == len(set(question['answers'])) == 4
        assert 0 <= question['correctIndex'] < 4
