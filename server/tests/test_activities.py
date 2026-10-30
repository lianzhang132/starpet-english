from test_api import client
from app import speech, main
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone


def test_speech_retry_replays_credit_without_double_counting_and_rejects_id_reuse(monkeypatch):
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: "good morning")
    url = "/api/v1/practice/speaking?deviceId=receipt-device&sceneId=breakfast&lineIndex=0&requestId=one-take-123"
    headers = {"Content-Type": "application/octet-stream"}
    first = client.post(url, content=b"\0" * 32000, headers=headers)
    assert first.status_code == 200 and first.json()["xpAwarded"] == 10
    assert client.post(url, content=b"\0" * 32000, headers=headers).json()["xpAwarded"] == 10
    assert client.get("/api/v1/report/receipt-device").json()["speakingAttempts"] == 1
    assert client.post(url, content=b"\1" * 32000, headers=headers).status_code == 409
    assert client.post(url.replace("lineIndex=0", "lineIndex=1"), content=b"\0" * 32000, headers=headers).status_code == 409
    with main.connection() as conn:
        row = dict(conn.execute("SELECT * FROM speech_receipts WHERE device_id='receipt-device'").fetchone())
    assert set(row) == {"device_id", "request_id", "item_id", "audio_hash", "xp_awarded"}


def test_audio_minimum_matches_one_second(monkeypatch):
    monkeypatch.setattr(speech, "available", lambda: True)
    url = "/api/v1/practice/speaking?deviceId=duration-device&sceneId=breakfast&lineIndex=0"
    assert client.post(url, content=b"\0" * 31998, headers={"Content-Type": "application/octet-stream"}).status_code == 422


def test_parent_report_excludes_uncertain_speech_until_deferred_time():
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    payload = {"deviceId": "uncertain-speech-report", "xp": 0, "stars": 0, "streak": 0,
               "revision": 1, "mastery": {
                   "speaking:breakfast:0": {"level": 2, "attempts": 2, "correct": 2, "lastSeen": 1,
                                             "dueAt": now - 1000, "deferredUntil": now + 86400000}}}
    assert client.post("/api/v1/progress", json=payload).status_code == 200
    assert client.get("/api/v1/progress/uncertain-speech-report").json()["mastery"] == payload["mastery"]
    assert client.get("/api/v1/report/uncertain-speech-report").json()["dueCount"] == 0


def test_concurrent_speech_retry_commits_one_receipt_and_one_attempt():
    def submit(_):
        return main.speech_receipt("concurrent-voice-160", "concurrent-take-160", "speaking", "breakfast:0", b"\0" * 32000, True, 10)
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(submit, range(4))) == [10, 10, 10, 10]
    assert client.get("/api/v1/report/concurrent-voice-160").json()["speakingAttempts"] == 1


def test_activity_sync_preserves_older_clients_and_revision_checks_new_fields():
    base = {"deviceId": "activity-device", "xp": 30, "stars": 2, "streak": 1, "revision": 1}
    activity = {"petCare": {"bond": 8, "accessory": "crown"}, "videoProgress": {"hello": {"completed": True}},
                "learnedSentences": ["breakfast:0"], "speechReceipts": ["one-take-123"]}
    assert client.post("/api/v1/progress", json={**base, **activity}).status_code == 200
    assert client.post("/api/v1/progress", json={**base, **activity, "petCare": {"bond": 9}}).status_code == 409
    assert client.post("/api/v1/progress", json={**base, "revision": 2}).status_code == 200
    remote = client.get("/api/v1/progress/activity-device").json()
    for key, value in activity.items():
        assert remote[key] == value
    assert client.post("/api/v1/progress", json={**base, "revision": 3, "videoProgress": {"x": {"huge": "x" * 100001}}}).status_code == 422
