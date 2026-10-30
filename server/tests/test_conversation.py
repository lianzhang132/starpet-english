from app import speech
from app.conversation import evaluate_answer, public_missions
from test_api import client


def test_conversation_accepts_natural_short_answers_and_advances():
    intro = evaluate_answer("chat-intro", "name", "my name is Lily")
    assert intro["understood"] is True and intro["nextTurnId"] == "age"
    assert "Nice to meet you" in intro["reply"]
    assert intro["matched"] == "nickname"
    breakfast = evaluate_answer("chat-breakfast", "food", "some eggs please")
    assert breakfast["understood"] is True and breakfast["matched"] == "eggs"
    assert "Eggs are" in breakfast["reply"]
    assert "the sky" in evaluate_answer("chat-color", "object", "sky")["reply"]
    done = evaluate_answer("chat-animal", "ability", "it can fly")
    assert done["complete"] is True and done["nextTurnId"] is None


def test_conversation_keeps_question_when_answer_is_missing_or_unknown():
    silent = evaluate_answer("chat-mood", "mood", "")
    unknown = evaluate_answer("chat-color", "color", "I like triangles")
    assert not silent["understood"] and silent["nextTurnId"] == "mood"
    assert not unknown["understood"] and unknown["nextTurnId"] == "color"
    assert len(public_missions()) == 5
    assert "choices" not in public_missions()[0]["turns"][0]


def test_repeating_questions_and_negation_are_not_positive_answers():
    assert not evaluate_answer("chat-intro", "name", "what is your name")["understood"]
    assert not evaluate_answer("chat-intro", "name", "I am happy")["understood"]
    assert not evaluate_answer("chat-color", "color", "I don't like blue")["understood"]
    result = evaluate_answer("chat-color", "color", "not blue but red")
    assert result["understood"] and result["matched"] == "red"
    assert not evaluate_answer("chat-intro", "age", "I am 999")["understood"]
    assert not evaluate_answer("chat-intro", "age", "I am not eight")["understood"]
    assert evaluate_answer("chat-intro", "age", "I am eight years old")["understood"]


def test_invalid_conversation_does_not_transcribe_audio(monkeypatch):
    def unexpected(pcm):
        raise AssertionError("Invalid missions must not start recognition")
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", unexpected)
    response = client.post("/api/v1/practice/conversation?deviceId=invalid-chat&missionId=missing&turnId=name",
                           content=b"\0" * 32000, headers={"Content-Type": "application/octet-stream"})
    assert response.status_code == 404


def test_conversation_endpoint_never_stores_audio_and_rewards_once(monkeypatch):
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: "I like blue")
    url = "/api/v1/practice/conversation?deviceId=conversation-test&missionId=chat-color&turnId=color"
    headers = {"Content-Type": "application/octet-stream"}
    first = client.post(url, content=b"\0" * 32000, headers=headers).json()
    second = client.post(url, content=b"\0" * 32000, headers=headers).json()
    assert first["understood"] and first["xpAwarded"] == 12
    assert second["xpAwarded"] == 0
    assert first["audioStored"] is False
    report = client.get("/api/v1/report/conversation-test").json()
    assert report["conversationTurns"] == 2 and report["conversationUnderstood"] == 2


def test_phonics_quiz_is_a_server_validated_answer():
    response = client.post("/api/v1/practice/answer", json={
        "deviceId": "phonics-answer-test", "requestId": "phonics-request", "questionId": "phonics-cat", "answerIndex": 0
    })
    assert response.status_code == 200 and response.json()["correct"] is True
