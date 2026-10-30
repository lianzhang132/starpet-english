"""Outcome receipts recover interrupted responses without keeping recognized speech."""
import hashlib
import json
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from test_api import client
from app import main, speech

PCM = b"\x64\0" * 16_000
HEADERS = {"Content-Type": "application/octet-stream"}


def speaking_url(device, request="recording-result-1"):
    return (f"/api/v1/practice/speaking?deviceId={device}&sceneId=breakfast&lineIndex=0"
            f"&requestId={request}")


def conversation_url(device, request="recording-result-1", turn="food"):
    return (f"/api/v1/practice/conversation?deviceId={device}&missionId=chat-breakfast&turnId={turn}"
            f"&requestId={request}")


def test_lost_speaking_response_recovers_before_health_and_never_reruns_asr(monkeypatch):
    device = "replay-speaking-result"
    monkeypatch.setattr(speech, "available", lambda: True)
    calls = []
    monkeypatch.setattr(speech, "transcribe", lambda pcm: calls.append(pcm) or "good morning")
    first = client.post(speaking_url(device), content=PCM, headers=HEADERS).json()
    assert first["passed"] is True and first["score"] == 100 and first["xpAwarded"] == 10
    monkeypatch.setattr(speech, "available", lambda: pytest.fail("cached results must not check model health"))
    retry = client.post(speaking_url(device), content=PCM, headers=HEADERS).json()
    assert retry["passed"] is True and retry["score"] == 100 and retry["xpAwarded"] == 10
    assert retry["replayed"] is True and retry["transcript"] == "" and retry["audioStored"] is False
    assert calls == [PCM]
    assert client.get(f"/api/v1/report/{device}").json()["speakingAttempts"] == 1
    # Identity checks still apply even while the recognizer is unavailable.
    assert client.post(speaking_url(device), content=b"\x65\0" * 16_000, headers=HEADERS).status_code == 409
    assert client.post(speaking_url(device).replace("lineIndex=0", "lineIndex=1"), content=PCM, headers=HEADERS).status_code == 409


def test_incorrect_zero_credit_outcome_is_replayed_instead_of_changed(monkeypatch):
    device = "replay-incorrect-result"
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: "good night")
    first = client.post(speaking_url(device), content=PCM, headers=HEADERS).json()
    assert first["passed"] is False and first["xpAwarded"] == 0
    monkeypatch.setattr(speech, "transcribe", lambda pcm: pytest.fail("a retry must keep the first result"))
    retry = client.post(speaking_url(device), content=PCM, headers=HEADERS).json()
    assert retry["passed"] is False and retry["score"] == first["score"] and retry["xpAwarded"] == 0
    assert retry["replayed"] is True


@pytest.mark.parametrize("turn,recognized,next_turn,complete", [
    ("food", "I would like bread please", "drink", False),
    ("drink", "milk please", None, True),
])
def test_conversation_replay_keeps_turn_progress_without_recognized_content(monkeypatch, turn, recognized, next_turn, complete):
    device = "replay-conversation-" + turn
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: recognized)
    first = client.post(conversation_url(device, turn=turn), content=PCM, headers=HEADERS).json()
    assert first["understood"] is True and first["xpAwarded"] == 12
    monkeypatch.setattr(speech, "available", lambda: False)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: pytest.fail("model must not be invoked"))
    retry = client.post(conversation_url(device, turn=turn), content=PCM, headers=HEADERS).json()
    assert retry["understood"] is True and retry["xpAwarded"] == 12
    assert retry["nextTurnId"] == next_turn and retry["complete"] is complete
    assert retry["transcript"] == "" and retry["replayed"] is True
    with main.connection() as conn:
        meta = json.loads(conn.execute("SELECT result_meta FROM speech_results WHERE device_id=?", (device,)).fetchone()[0])
    assert meta == {"understood": True, "nextTurnId": next_turn, "complete": complete}


def test_parallel_recognitions_that_disagree_commit_one_shared_outcome(monkeypatch):
    device = "parallel-outcome-result"
    barrier = threading.Barrier(2)
    choices = iter(["good morning", "good night"])
    choice_lock = threading.Lock()

    def transcribe(pcm):
        with choice_lock:
            recognized = next(choices)
        barrier.wait(timeout=3)
        return recognized

    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", transcribe)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post(speaking_url(device), content=PCM, headers=HEADERS), range(2)))
    assert all(response.status_code == 200 for response in responses)
    first, second = [response.json() for response in responses]
    assert (first["passed"], first["score"], first["xpAwarded"]) == (second["passed"], second["score"], second["xpAwarded"])
    assert sorted([first["replayed"], second["replayed"]]) == [False, True]
    report = client.get(f"/api/v1/report/{device}").json()
    assert report["speakingAttempts"] == 1 and report["speakingPassed"] == int(first["passed"])


def test_receipt_metadata_excludes_transcripts_names_replies_and_missing_words():
    result = {"passed": True, "score": 90, "transcript": "My secret name is Lily",
              "feedback": "free text", "missingWords": ["secret"], "reply": "private reply"}
    meta = main.speech_result_meta("speaking", result)
    assert meta == {"passed": True, "score": 90}
    assert main.speech_result_meta("conversation", {"understood": True, "nextTurnId": "age", "complete": False,
                                                    "transcript": "My secret name is Lily", "reply": "Lily", "matched": "Lily"}) == {
        "understood": True, "nextTurnId": "age", "complete": False}


def test_database_migration_preserves_legacy_speech_receipts(tmp_path, monkeypatch):
    database = tmp_path / "old-receipts.db"
    with sqlite3.connect(database) as conn:
        conn.execute("CREATE TABLE speech_receipts(device_id TEXT NOT NULL, request_id TEXT NOT NULL, item_id TEXT NOT NULL, audio_hash TEXT NOT NULL, xp_awarded INTEGER NOT NULL, PRIMARY KEY(device_id, request_id))")
        conn.execute("INSERT INTO speech_receipts VALUES (?, ?, ?, ?, ?)",
                     ("legacy-positive", "legacy-take-1", "speaking:breakfast:0", hashlib.sha256(PCM).hexdigest(), 10))
    monkeypatch.setattr(main, "DATABASE_PATH", database)
    main.initialize_database()
    main.initialize_database()
    monkeypatch.setattr(speech, "available", lambda: pytest.fail("positive legacy receipt can be recovered offline"))
    response = client.post(speaking_url("legacy-positive", "legacy-take-1"), content=PCM, headers=HEADERS)
    assert response.status_code == 200
    result = response.json()
    assert result["passed"] is True and result["xpAwarded"] == 10 and result["replayed"] is True
    assert "score" not in result  # The older receipt did not preserve a score.
    with main.connection() as conn:
        row = dict(conn.execute("SELECT * FROM speech_receipts").fetchone())
        assert conn.execute("SELECT COUNT(*) FROM speech_results").fetchone()[0] == 0
    assert row["audio_hash"] == hashlib.sha256(PCM).hexdigest()
    assert set(row) == {"device_id", "request_id", "item_id", "audio_hash", "xp_awarded"}


def test_new_database_stays_compatible_with_older_bare_five_value_insert(monkeypatch):
    device, request = "rollback-writer-result", "rollback-writer-take"
    main.commit_speech_result(device, "new-writer-take", "speaking", "breakfast:0", PCM,
                              {"passed": True, "score": 100, "transcript": "good morning"}, 10)
    with main.connection() as conn:
        assert len(list(conn.execute("PRAGMA table_info(speech_receipts)"))) == 5
        # This exact column-less form is used by the previously released API.
        conn.execute("INSERT INTO speech_receipts VALUES (?, ?, ?, ?, ?)",
                     (device, request, "speaking:breakfast:0", hashlib.sha256(PCM).hexdigest(), 10))
        assert conn.execute("SELECT COUNT(*) FROM speech_results WHERE device_id=? AND request_id=?",
                            (device, request)).fetchone()[0] == 0
    monkeypatch.setattr(speech, "available", lambda: False)
    result = client.post(speaking_url(device, request), content=PCM, headers=HEADERS).json()
    assert result["passed"] is True and result["xpAwarded"] == 10 and result["replayed"] is True


def test_intermediate_six_column_database_moves_metadata_without_losing_rollback_compatibility(tmp_path, monkeypatch):
    database = tmp_path / "intermediate-receipts.db"
    expected_meta = {"passed": False, "score": 50}
    with sqlite3.connect(database) as conn:
        conn.execute("CREATE TABLE speech_receipts(device_id TEXT NOT NULL, request_id TEXT NOT NULL, item_id TEXT NOT NULL, audio_hash TEXT NOT NULL, xp_awarded INTEGER NOT NULL, result_meta TEXT NOT NULL DEFAULT '{}', PRIMARY KEY(device_id, request_id))")
        conn.execute("INSERT INTO speech_receipts VALUES (?, ?, ?, ?, ?, ?)",
                     ("intermediate-client", "intermediate-take", "speaking:breakfast:0",
                      hashlib.sha256(PCM).hexdigest(), 0, json.dumps(expected_meta)))
    monkeypatch.setattr(main, "DATABASE_PATH", database)
    main.initialize_database()
    main.initialize_database()
    with main.connection() as conn:
        row = dict(conn.execute("SELECT * FROM speech_receipts").fetchone())
        assert len(row) == 5 and row["xp_awarded"] == 0
        meta = json.loads(conn.execute("SELECT result_meta FROM speech_results").fetchone()[0])
        assert meta == expected_meta
        conn.execute("INSERT INTO speech_receipts VALUES (?, ?, ?, ?, ?)",
                     ("older-binary", "older-binary-take", "speaking:breakfast:0", hashlib.sha256(PCM).hexdigest(), 10))
    monkeypatch.setattr(speech, "available", lambda: pytest.fail("migrated outcome must replay offline"))
    result = client.post(speaking_url("intermediate-client", "intermediate-take"), content=PCM, headers=HEADERS).json()
    assert result["passed"] is False and result["score"] == 50 and result["xpAwarded"] == 0
    assert result["replayed"] is True


def test_legacy_zero_credit_is_not_assumed_incorrect_and_is_enriched_without_new_credit(monkeypatch):
    device, request = "legacy-zero-result", "legacy-zero-take"
    with main.connection() as conn:
        conn.execute("INSERT INTO speech_receipts(device_id, request_id, item_id, audio_hash, xp_awarded) VALUES (?, ?, ?, ?, 0)",
                     (device, request, "speaking:breakfast:0", hashlib.sha256(PCM).hexdigest()))
    monkeypatch.setattr(speech, "available", lambda: False)
    assert client.post(speaking_url(device, request), content=PCM, headers=HEADERS).status_code == 503
    monkeypatch.setattr(speech, "available", lambda: True)
    monkeypatch.setattr(speech, "transcribe", lambda pcm: "good morning")
    result = client.post(speaking_url(device, request), content=PCM, headers=HEADERS).json()
    assert result["passed"] is True and result["xpAwarded"] == 0
    monkeypatch.setattr(speech, "available", lambda: False)
    replay = client.post(speaking_url(device, request), content=PCM, headers=HEADERS).json()
    assert replay["passed"] is True and replay["score"] == 100 and replay["replayed"] is True
    assert replay["xpAwarded"] == 0
    assert client.get(f"/api/v1/report/{device}").json()["speakingAttempts"] == 0


@pytest.mark.parametrize("code", ["speech_busy", "speech_timeout", "speech_unavailable", "speech_invalid_response", "speech_invalid_audio"])
@pytest.mark.parametrize("kind", ["speaking", "conversation"])
def test_recognizer_errors_never_create_credit_receipts_or_attempts(monkeypatch, code, kind):
    device = "error-result-" + kind + "-" + code
    monkeypatch.setattr(speech, "available", lambda: True)

    def failed(pcm):
        raise RuntimeError(code)

    monkeypatch.setattr(speech, "transcribe", failed)
    url = speaking_url(device) if kind == "speaking" else conversation_url(device)
    response = client.post(url, content=PCM, headers=HEADERS)
    assert response.status_code == 503 and response.json()["detail"] == code
    with main.connection() as conn:
        for table in ("speech_receipts", "speech_results", "speech_rewards", "practice_events"):
            assert conn.execute(f"SELECT COUNT(*) FROM {table} WHERE device_id=?", (device,)).fetchone()[0] == 0
