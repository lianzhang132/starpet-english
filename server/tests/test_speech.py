from app import speech
from test_api import client


def test_sentence_matching_handles_case_contractions_and_missing_words():
    assert speech.match_sentence("I'm happy!", "I am happy")["score"] == 100
    assert speech.match_sentence("I would like some milk please", "milk")["passed"] is False
    assert speech.match_sentence("Hello!", "")["score"] == 0
    assert speech.match_sentence("Turn left", "turn right")["missingWords"] == ["left"]


def test_speech_endpoint_requires_valid_audio_and_never_rewards_silence(monkeypatch):
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: "")
    url = "/api/v1/practice/speaking?deviceId=speech-test&sceneId=breakfast&lineIndex=0"
    headers = {"Content-Type": "application/octet-stream"}
    assert client.post(url, content=b"short", headers=headers).status_code == 422
    assert client.post(url, content=b"\0" * (speech.MAX_AUDIO_BYTES + 2), headers=headers).status_code == 413
    result = client.post(url, content=b"\0" * 32000, headers=headers).json()
    assert result["score"] == result["xpAwarded"] == 0
    assert result["audioStored"] is False


def test_speech_award_is_once_per_sentence_per_day_and_report_counts_attempts(monkeypatch):
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: "good morning")
    url = "/api/v1/practice/speaking?deviceId=speech-reward-test&sceneId=breakfast&lineIndex=0"
    headers = {"Content-Type": "application/octet-stream"}
    first = client.post(url, content=b"\0" * 32000, headers=headers).json()
    second = client.post(url, content=b"\0" * 32000, headers=headers).json()
    assert first["score"] == 100 and first["xpAwarded"] == 10
    assert second["xpAwarded"] == 0
    report = client.get("/api/v1/report/speech-reward-test").json()
    assert report["speakingAttempts"] == 2
    assert report["speakingPassed"] == 2


def test_unavailable_speech_is_explicit(monkeypatch):
    monkeypatch.setattr(speech, "available", lambda: False)
    assert client.get("/api/v1/speech/status").json()["available"] is False
    response = client.post("/api/v1/practice/speaking?deviceId=test-device&sceneId=breakfast&lineIndex=0", content=b"\0" * 32000, headers={"Content-Type": "application/octet-stream"})
    assert response.status_code == 503


def test_high_similarity_does_not_reward_opposite_or_changed_content():
    cases = [
        ("Go straight and turn left.", "Go straight and turn right."),
        ("I would like some milk please.", "I would not like some milk please."),
        ("May I have the room key?", "May I have the room cat?"),
        ("I am eight years old.", "I am nine years old."),
        ("I am 8 years old.", "I am 9 years old."),
    ]
    for target, actual in cases:
        result = speech.match_sentence(target, actual)
        assert result["score"] >= 80
        assert result["passed"] is False


def test_common_contractions_numbers_and_small_politeness_omissions_are_understood():
    for target, actual in [
        ("I cannot swim", "I can't swim"),
        ("You are welcome", "You're welcome"),
        ("I am eight years old", "I'm 8 years old"),
        ("I would like some milk please", "I'd like milk please"),
        ("May I have the menu", "May I have a menu"),
    ]:
        assert speech.match_sentence(target, actual)["passed"] is True


def test_missing_words_counts_repeated_words_and_never_rewards_empty_target():
    repeated = speech.match_sentence("Go go go and jump", "go go and jump")
    assert repeated["missingWords"] == ["go"]
    assert repeated["passed"] is False
    assert speech.match_sentence("!!!", "hello")["passed"] is False


def test_opposite_direction_does_not_receive_endpoint_xp(monkeypatch):
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: "go straight and turn right")
    response = client.post("/api/v1/practice/speaking?deviceId=speech-opposite-test&sceneId=directions&lineIndex=1",
                           content=b"\0" * 32000, headers={"Content-Type": "application/octet-stream"})
    assert response.status_code == 200
    assert response.json()["passed"] is False
    assert response.json()["xpAwarded"] == 0
