from test_api import client
from app import speech, whisper_asr


def test_configured_whisper_routes_audio_and_reports_the_same_engine(monkeypatch):
    monkeypatch.setenv("STARPET_WHISPER_URL", "http://starpet-asr:8080")
    seen = []
    monkeypatch.setattr(whisper_asr, "available", lambda: True)
    monkeypatch.setattr(whisper_asr, "transcribe", lambda pcm: seen.append(pcm) or "Good morning.")
    assert speech.available()
    assert speech.transcribe(b"\1\0" * 16000) == "Good morning."
    assert seen == [b"\1\0" * 16000]
    status = client.get("/api/v1/speech/status").json()
    assert status["engine"] == "whisper.cpp-small.en-q5_1" and status["available"]


def test_whisper_failure_never_silently_uses_the_old_recognizer(monkeypatch):
    monkeypatch.setenv("STARPET_WHISPER_URL", "http://starpet-asr:8080")
    monkeypatch.setattr(whisper_asr, "available", lambda: False)
    assert speech.available() is False
    response = client.post("/api/v1/practice/speaking?deviceId=unavailable-whisper-test&sceneId=breakfast&lineIndex=0",
                           content=b"\0" * 32000, headers={"Content-Type": "application/octet-stream"})
    assert response.status_code == 503
