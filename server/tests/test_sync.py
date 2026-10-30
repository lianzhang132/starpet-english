import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from test_api import client
from app import main
from app.content import DIALOGUES, DIALOGUE_TRANSLATIONS


def progress(device, revision, stars=4):
    return {"deviceId": device, "revision": revision, "xp": 60, "stars": stars,
            "streak": 1, "completedLessons": ["hello-1"], "learnedWords": ["hello"],
            "mastery": {"q-apple": {"level": 1, "attempts": 1, "correct": 1, "lastSeen": 100, "dueAt": 200}}}


def test_progress_retry_is_idempotent_and_feeding_can_reduce_stars():
    body = progress("sync-feed-test", 1)
    first = client.post("/api/v1/progress", json=body)
    retry = client.post("/api/v1/progress", json=body)
    assert first.status_code == retry.status_code == 200
    assert first.json() == retry.json()
    assert client.post("/api/v1/progress", json=progress("sync-feed-test", 2, stars=3)).status_code == 200
    stored = client.get("/api/v1/progress/sync-feed-test").json()
    assert stored["stars"] == 3 and stored["revision"] == 2


def test_old_conflicting_and_legacy_snapshots_cannot_replace_new_progress():
    body = progress("sync-stale-test", 7, stars=2)
    assert client.post("/api/v1/progress", json=body).status_code == 200
    for stale in [progress("sync-stale-test", 6), progress("sync-stale-test", 7),
                  {key: value for key, value in body.items() if key != "revision"}]:
        assert client.post("/api/v1/progress", json=stale).status_code == 409
    stored = client.get("/api/v1/progress/sync-stale-test").json()
    assert stored["revision"] == 7 and stored["stars"] == 2


def test_answer_retry_records_one_attempt_but_a_new_attempt_counts():
    body = {"deviceId": "sync-answer-test", "requestId": "request-one", "questionId": "q-apple", "answerIndex": 1}
    first = client.post("/api/v1/practice/answer", json=body)
    retry = client.post("/api/v1/practice/answer", json=body)
    assert first.status_code == retry.status_code == 200
    assert first.json() == retry.json()
    assert client.get("/api/v1/report/sync-answer-test").json()["attempts"] == 1
    assert client.post("/api/v1/practice/answer", json={**body, "requestId": "request-two", "answerIndex": 0}).status_code == 200
    report = client.get("/api/v1/report/sync-answer-test").json()
    assert report["attempts"] == 2 and report["accuracy"] == 0.5


def test_request_id_cannot_be_reused_for_different_answers():
    body = {"deviceId": "sync-conflict-test", "requestId": "request-conflict", "questionId": "q-apple", "answerIndex": 1}
    assert client.post("/api/v1/practice/answer", json=body).status_code == 200
    assert client.post("/api/v1/practice/answer", json={**body, "answerIndex": 0}).status_code == 409
    assert client.post("/api/v1/practice/answer", json={**body, "questionId": "q-cats"}).status_code == 409
    assert client.get("/api/v1/report/sync-conflict-test").json()["attempts"] == 1


def test_concurrent_retries_commit_one_answer():
    body = {"deviceId": "sync-concurrent-test", "requestId": "request-concurrent", "questionId": "q-apple", "answerIndex": 1}
    with ThreadPoolExecutor(max_workers=6) as pool:
        responses = list(pool.map(lambda _: client.post("/api/v1/practice/answer", json=body), range(12)))
    assert all(response.status_code == 200 for response in responses)
    assert client.get("/api/v1/report/sync-concurrent-test").json()["attempts"] == 1


def test_invalid_answer_does_not_create_a_practice_event():
    body = {"deviceId": "sync-invalid-test", "requestId": "invalid-answer", "questionId": "q-apple", "answerIndex": 9}
    assert client.post("/api/v1/practice/answer", json=body).status_code == 422
    assert client.get("/api/v1/report/sync-invalid-test").json()["attempts"] == 0


def test_database_migration_preserves_existing_progress(tmp_path, monkeypatch):
    database = tmp_path / "old.db"
    with sqlite3.connect(database) as conn:
        conn.execute("CREATE TABLE progress(device_id TEXT PRIMARY KEY, xp INTEGER, stars INTEGER, streak INTEGER, completed_lessons TEXT, learned_words TEXT, updated_at TEXT)")
        conn.execute("INSERT INTO progress VALUES ('old-client', 90, 6, 2, '[]', '[\"hello\"]', 'before-migration')")
    monkeypatch.setattr(main, "DATABASE_PATH", database)
    main.initialize_database()
    main.initialize_database()  # Restart must not reapply/break the migration.
    saved = client.get("/api/v1/progress/old-client").json()
    assert saved["xp"] == 90 and saved["stars"] == 6 and saved["revision"] == 0
    assert saved["learnedWords"] == ["hello"] and saved["mastery"] == {} and saved["lessonProgress"] == {}


def test_lesson_cursor_round_trip_and_retry():
    body = progress("lesson-cursor-test", 1)
    body["lessonProgress"] = {"hello-2": {"phase": "quiz", "cardIndex": 3,
                                             "correctIds": ["hello-2-word-0"],
                                             "nextQuestionId": "hello-2-word-1"}}
    assert client.post("/api/v1/progress", json=body).status_code == 200
    assert client.post("/api/v1/progress", json=body).status_code == 200
    assert client.get("/api/v1/progress/lesson-cursor-test").json()["lessonProgress"] == body["lessonProgress"]
    old_client = progress("lesson-cursor-test", 2)
    assert client.post("/api/v1/progress", json=old_client).status_code == 200
    assert client.get("/api/v1/progress/lesson-cursor-test").json()["lessonProgress"] == body["lessonProgress"]


def test_parent_report_shows_actionable_due_review():
    body = progress("report-due-test", 1)
    assert client.post("/api/v1/progress", json=body).status_code == 200
    report = client.get("/api/v1/report/report-due-test").json()
    assert report["dueCount"] == 1
    assert "先完成" in report["highlight"]


def test_chinese_dialogue_hints_match_generated_web_and_native_assets():
    root = Path(__file__).resolve().parents[2]
    web = (root / "server/app/static/dialogues.mjs").read_text(encoding="utf-8")
    native = (root / "entry/src/main/ets/data/DialogueTranslations.ets").read_text(encoding="utf-8")
    assert json.loads(web.split('export const DIALOGUE_TRANSLATIONS = ', 1)[1].strip().rstrip(';')) == DIALOGUE_TRANSLATIONS
    native_data = json.loads(native.split('export const DIALOGUE_TRANSLATIONS: SceneTranslation[] = ', 1)[1].strip().rstrip(';'))
    assert {item['id']: item['lines'] for item in native_data} == DIALOGUE_TRANSLATIONS
    for scene in DIALOGUES:
        assert len(scene['lines']) == len(scene['translations']) == 3
        assert all(scene['translations'])


def test_browser_modules_have_executable_javascript_content_type():
    for name in ["app.js", "recorder.js", "sync.mjs", "dialogues.mjs", "runtime.mjs", "server-config.mjs"]:
        response = client.get(f"/static/{name}")
        assert response.status_code == 200
        assert response.headers['content-type'].startswith('text/javascript')


def test_apk_offline_catalog_contains_the_complete_server_catalog():
    root = Path(__file__).resolve().parents[2]
    bundled = json.loads((root / "server/app/static/catalog.json").read_text(encoding="utf-8"))
    assert bundled == client.get('/api/v1/catalog').json()
