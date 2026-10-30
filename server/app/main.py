from __future__ import annotations

import json
import hashlib
import mimetypes
import os
import sqlite3
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Annotated, Iterator

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool
from . import speech
from .conversation import evaluate_answer, public_missions
from .phonics import PHONICS_QUIZZES

from .content import COURSE_WORLDS, DIALOGUES, QUIZZES, WORDS
from .curriculum import LESSONS, LESSON_QUIZZES

ALL_QUIZZES = QUIZZES + LESSON_QUIZZES + PHONICS_QUIZZES

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
DATABASE_PATH = Path(os.getenv("STARPET_DATABASE", str(APP_DIR.parent / "data" / "starpet.db")))

# Some Windows registry entries map .js to text/plain, which blocks ES modules.
mimetypes.init()
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/vnd.android.package-archive", ".apk")

app = FastAPI(
    title="StarPet English API",
    version="1.8.1",
    description="星伴英语：面向儿童、最少采集数据的学习进度服务",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DATABASE_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connection() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS profiles (
              device_id TEXT PRIMARY KEY,
              nickname TEXT NOT NULL DEFAULT '小探险家',
              grade INTEGER NOT NULL DEFAULT 3,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS progress (
              device_id TEXT PRIMARY KEY,
              xp INTEGER NOT NULL DEFAULT 0,
              stars INTEGER NOT NULL DEFAULT 0,
              streak INTEGER NOT NULL DEFAULT 0,
              completed_lessons TEXT NOT NULL DEFAULT '[]',
              learned_words TEXT NOT NULL DEFAULT '[]',
              mastery TEXT NOT NULL DEFAULT '{}',
              lesson_progress TEXT NOT NULL DEFAULT '{}',
              updated_at TEXT NOT NULL,
              FOREIGN KEY(device_id) REFERENCES profiles(device_id)
            );
            CREATE TABLE IF NOT EXISTS practice_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              device_id TEXT NOT NULL,
              kind TEXT NOT NULL,
              item_id TEXT NOT NULL,
              correct INTEGER NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS speech_rewards (
              device_id TEXT NOT NULL,
              item_id TEXT NOT NULL,
              day TEXT NOT NULL,
              PRIMARY KEY(device_id, item_id, day)
            );
            CREATE TABLE IF NOT EXISTS quiz_submissions (
              device_id TEXT NOT NULL,
              request_id TEXT NOT NULL,
              question_id TEXT NOT NULL,
              answer_index INTEGER NOT NULL,
              result TEXT NOT NULL,
              PRIMARY KEY(device_id, request_id)
            );
            CREATE TABLE IF NOT EXISTS speech_receipts (
              device_id TEXT NOT NULL,
              request_id TEXT NOT NULL,
              item_id TEXT NOT NULL,
              audio_hash TEXT NOT NULL,
              xp_awarded INTEGER NOT NULL,
              PRIMARY KEY(device_id, request_id)
            );
            CREATE TABLE IF NOT EXISTS speech_results (
              device_id TEXT NOT NULL,
              request_id TEXT NOT NULL,
              result_meta TEXT NOT NULL DEFAULT '{}',
              PRIMARY KEY(device_id, request_id),
              FOREIGN KEY(device_id, request_id) REFERENCES speech_receipts(device_id, request_id)
            );
            """
        )
        # Additive migration: keep existing learning records intact.
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(progress)")}
        if "client_revision" not in columns:
            conn.execute("ALTER TABLE progress ADD COLUMN client_revision INTEGER NOT NULL DEFAULT 0")
        if "mastery" not in columns:
            conn.execute("ALTER TABLE progress ADD COLUMN mastery TEXT NOT NULL DEFAULT '{}'")
        if "lesson_progress" not in columns:
            conn.execute("ALTER TABLE progress ADD COLUMN lesson_progress TEXT NOT NULL DEFAULT '{}'")
        if "activity_state" not in columns:
            conn.execute("ALTER TABLE progress ADD COLUMN activity_state TEXT NOT NULL DEFAULT '{}'")
        receipt_columns = {row["name"] for row in conn.execute("PRAGMA table_info(speech_receipts)")}
        if "result_meta" in receipt_columns:
            # Repair intermediate builds while retaining their outcomes. The
            # receipt table must keep its five-column shape: released older
            # binaries use INSERT ... VALUES with no explicit column list.
            conn.execute("INSERT OR IGNORE INTO speech_results(device_id, request_id, result_meta) "
                         "SELECT device_id, request_id, result_meta FROM speech_receipts")
            conn.execute("ALTER TABLE speech_receipts DROP COLUMN result_meta")


initialize_database()


class ProfileInput(BaseModel):
    deviceId: str = Field(min_length=6, max_length=80)
    nickname: str = Field(default="小探险家", min_length=1, max_length=20)
    grade: int = Field(default=3, ge=1, le=6)


StudyItemId = Annotated[str, Field(min_length=1, max_length=100)]


class StudySessionInput(BaseModel):
    day: str = Field(max_length=10)
    lastStudyDay: str = Field(max_length=10)
    dailyWords: list[StudyItemId] = Field(max_length=10000)
    dailySentences: list[StudyItemId] = Field(max_length=10000)
    dailyQuizzes: list[StudyItemId] = Field(max_length=10000)
    dailyAttemptIds: list[StudyItemId] = Field(max_length=10000)

    @field_validator("day", "lastStudyDay")
    @classmethod
    def calendar_day(cls, value: str) -> str:
        if value == "":
            return value
        parts = value.split("-")
        if len(parts) != 3 or len(parts[0]) != 4 or any(not part.isascii() or not part.isdigit() for part in parts):
            raise ValueError("invalid calendar day")
        parsed = date(*(int(part) for part in parts))
        return f"{parsed.year}-{parsed.month}-{parsed.day}"


class ProgressInput(BaseModel):
    deviceId: str = Field(min_length=6, max_length=80)
    xp: int = Field(ge=0, le=10_000_000)
    stars: int = Field(ge=0, le=1_000_000)
    streak: int = Field(ge=0, le=100_000)
    completedLessons: list[str] = Field(default_factory=list)
    learnedWords: list[str] = Field(default_factory=list)
    mastery: dict[str, dict[str, int]] = Field(default_factory=dict)
    lessonProgress: dict[str, dict[str, object]] | None = None
    petCare: dict[str, object] | None = Field(default=None, max_length=10)
    videoProgress: dict[str, dict[str, object]] | None = Field(default=None, max_length=100)
    learnedSentences: list[str] | None = Field(default=None, max_length=10000)
    speechReceipts: list[str] | None = Field(default=None, max_length=200)
    studySession: StudySessionInput | None = None
    phonicsPracticed: list[StudyItemId] | None = Field(default=None, max_length=1000)
    cardCursor: int | None = Field(default=None, ge=0, le=10000)
    revision: int | None = Field(default=None, ge=1, le=9_007_199_254_740_991)


class PracticeAnswer(BaseModel):
    deviceId: str = Field(min_length=6, max_length=80)
    questionId: str = Field(min_length=1, max_length=80)
    answerIndex: int = Field(ge=0, le=20)
    requestId: str | None = Field(default=None, min_length=6, max_length=80)


def ensure_profile(conn: sqlite3.Connection, device_id: str) -> None:
    now = utc_now()
    conn.execute(
        "INSERT OR IGNORE INTO profiles(device_id, nickname, grade, created_at, updated_at) VALUES (?, '小探险家', 3, ?, ?)",
        (device_id, now, now),
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "starpet-english", "version": app.version}


@app.get("/api/v1/catalog")
def catalog() -> dict[str, object]:
    return {"worlds": COURSE_WORLDS, "words": WORDS, "quizzes": QUIZZES, "dialogues": DIALOGUES,
            "lessons": LESSONS, "conversations": public_missions()}


@app.get("/api/v1/speech/status")
def speech_status() -> dict[str, object]:
    return {"available": speech.available(), "language": "en-US", "maxSeconds": 20,
            "audioStored": False, "metric": "sentence_match", "engine": speech.engine_name()}


@app.post("/api/v1/practice/speaking")
async def check_speaking(request: Request, deviceId: str = Query(min_length=6, max_length=80),
                         sceneId: str = Query(max_length=80), lineIndex: int = Query(ge=0, le=30),
                         requestId: str | None = Query(default=None, min_length=6, max_length=80)) -> dict[str, object]:
    scene = next((item for item in DIALOGUES if item["id"] == sceneId), None)
    if scene is None or lineIndex >= len(scene["lines"]):
        raise HTTPException(404, "scene_line_not_found")
    if request.headers.get("content-type", "").split(";")[0] != "application/octet-stream":
        raise HTTPException(415, "expected_pcm16_mono_16000")
    pcm = bytearray()
    async for chunk in request.stream():
        if len(pcm) + len(chunk) > speech.MAX_AUDIO_BYTES:
            raise HTTPException(413, "audio_too_long")
        pcm.extend(chunk)
    if len(pcm) < 32000 or len(pcm) % 2:
        raise HTTPException(422, "audio_too_short_or_invalid")
    item_id = f"{sceneId}:{lineIndex}"
    cached = read_speech_receipt(deviceId, requestId, "speaking", item_id, pcm)
    if cached is not None:
        return cached
    if not speech.available():
        raise HTTPException(503, "speech_unavailable")
    try:
        transcript = await run_in_threadpool(speech.transcribe, bytes(pcm))
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
    result = speech.match_sentence(scene["lines"][lineIndex], transcript)
    return commit_speech_result(deviceId, requestId, "speaking", item_id, pcm, result, 10)


@app.post("/api/v1/practice/conversation")
async def check_conversation(request: Request, deviceId: str = Query(min_length=6, max_length=80),
                             missionId: str = Query(min_length=1, max_length=80),
                             turnId: str = Query(min_length=1, max_length=80),
                             requestId: str | None = Query(default=None, min_length=6, max_length=80)) -> dict[str, object]:
    try:
        evaluate_answer(missionId, turnId, "")
    except KeyError as error:
        raise HTTPException(404, str(error.args[0])) from error
    if request.headers.get("content-type", "").split(";")[0] != "application/octet-stream":
        raise HTTPException(415, "expected_pcm16_mono_16000")
    pcm = bytearray()
    async for chunk in request.stream():
        if len(pcm) + len(chunk) > speech.MAX_AUDIO_BYTES:
            raise HTTPException(413, "audio_too_long")
        pcm.extend(chunk)
    if len(pcm) < 32000 or len(pcm) % 2:
        raise HTTPException(422, "audio_too_short_or_invalid")
    item_id = f"{missionId}:{turnId}"
    cached = read_speech_receipt(deviceId, requestId, "conversation", item_id, pcm)
    if cached is not None:
        return cached
    if not speech.available():
        raise HTTPException(503, "speech_unavailable")
    try:
        transcript = await run_in_threadpool(speech.transcribe, bytes(pcm))
        result = evaluate_answer(missionId, turnId, transcript)
    except KeyError as error:
        raise HTTPException(404, str(error.args[0])) from error
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
    return commit_speech_result(deviceId, requestId, "conversation", item_id, pcm,
                                {**result, "transcript": transcript}, 12)


def speech_result_meta(kind: str, result: dict[str, object]) -> dict[str, object]:
    """Persist outcomes only, never transcripts, names, replies, or missing words."""
    if kind == "speaking":
        meta: dict[str, object] = {"passed": result.get("passed") is True}
        score = result.get("score")
        if type(score) is int and 0 <= score <= 100:
            meta["score"] = score
        return meta
    next_turn = result.get("nextTurnId")
    return {"understood": result.get("understood") is True,
            "complete": result.get("complete") is True,
            "nextTurnId": next_turn if isinstance(next_turn, str) and len(next_turn) <= 80 else None}


def replay_speech_result(previous: sqlite3.Row, kind: str, item_id: str,
                         request_id: str) -> dict[str, object] | None:
    try:
        meta = json.loads(previous["result_meta"])
    except (ValueError, TypeError):
        meta = {}
    outcome = "passed" if kind == "speaking" else "understood"
    if not isinstance(meta, dict) or type(meta.get(outcome)) is not bool:
        # Old zero-credit receipts may mean either an incorrect answer or a
        # correct answer already rewarded that day. Never invent their outcome.
        if previous["xp_awarded"] <= 0:
            return None
        meta = {outcome: True}
        if kind == "conversation":
            mission_id, _, turn_id = item_id.rpartition(":")
            mission = next((item for item in public_missions() if item["id"] == mission_id), None)
            if mission is None:
                return None
            index = next((i for i, turn in enumerate(mission["turns"]) if turn["id"] == turn_id), -1)
            if index < 0:
                return None
            meta["nextTurnId"] = mission["turns"][index + 1]["id"] if index + 1 < len(mission["turns"]) else None
            meta["complete"] = meta["nextTurnId"] is None
    result = {outcome: meta[outcome], "transcript": "", "xpAwarded": previous["xp_awarded"],
              "requestId": request_id, "audioStored": False, "replayed": True}
    if kind == "speaking":
        result["metric"] = "sentence_match"
        if type(meta.get("score")) is int and 0 <= meta["score"] <= 100:
            result["score"] = meta["score"]
        result["feedback"] = "已恢复这次跟读的结果。"
    else:
        result.update({"complete": meta.get("complete") is True,
                       "nextTurnId": meta.get("nextTurnId"),
                       "feedback": "已恢复这次回答的结果。",
                       "reply": "Great job! Let's keep talking." if meta[outcome] else "Please try again."})
    return result


def validate_speech_receipt(previous: sqlite3.Row, identity: str, digest: str) -> None:
    if previous["item_id"] != identity or previous["audio_hash"] != digest:
        raise HTTPException(409, "request_id_reused")


def fetch_speech_receipt(conn: sqlite3.Connection, device_id: str, request_id: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT receipt.*, COALESCE(result.result_meta, '{}') AS result_meta "
        "FROM speech_receipts AS receipt LEFT JOIN speech_results AS result "
        "ON result.device_id=receipt.device_id AND result.request_id=receipt.request_id "
        "WHERE receipt.device_id=? AND receipt.request_id=?", (device_id, request_id)
    ).fetchone()


def read_speech_receipt(device_id: str, request_id: str | None, kind: str,
                        item_id: str, pcm: bytes) -> dict[str, object] | None:
    if not request_id:
        return None
    with connection() as conn:
        previous = fetch_speech_receipt(conn, device_id, request_id)
    if previous is None:
        return None
    validate_speech_receipt(previous, f"{kind}:{item_id}", hashlib.sha256(pcm).hexdigest())
    return replay_speech_result(previous, kind, item_id, request_id)


def speech_receipt(device_id: str, request_id: str | None, kind: str, item_id: str,
                   pcm: bytes, correct: bool, xp: int) -> int:
    """Compatibility helper for callers that need only the credited amount."""
    result = {"passed" if kind == "speaking" else "understood": correct}
    return int(commit_speech_result(device_id, request_id, kind, item_id, pcm, result, xp)["xpAwarded"])


def commit_speech_result(device_id: str, request_id: str | None, kind: str, item_id: str,
                         pcm: bytes, result: dict[str, object], xp: int) -> dict[str, object]:
    """Atomically keep the first outcome and credit; concurrent retries share it."""
    identity = f"{kind}:{item_id}"
    digest = hashlib.sha256(pcm).hexdigest()
    meta = speech_result_meta(kind, result)
    correct = meta["passed" if kind == "speaking" else "understood"] is True
    with connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if request_id:
            previous = fetch_speech_receipt(conn, device_id, request_id)
            if previous:
                validate_speech_receipt(previous, identity, digest)
                cached = replay_speech_result(previous, kind, item_id, request_id)
                if cached is not None:
                    return cached
                # An older zero-credit receipt can be enriched after recognition,
                # while preserving its credit and original single practice event.
                conn.execute("INSERT INTO speech_results(device_id, request_id, result_meta) VALUES (?, ?, ?) "
                             "ON CONFLICT(device_id, request_id) DO UPDATE SET result_meta=excluded.result_meta",
                             (device_id, request_id, json.dumps(meta)))
                return {**result, "xpAwarded": previous["xp_awarded"], "requestId": request_id,
                        "audioStored": False, "replayed": False}
        ensure_profile(conn, device_id)
        conn.execute("INSERT INTO practice_events(device_id, kind, item_id, correct, created_at) VALUES (?, ?, ?, ?, ?)",
                     (device_id, kind, item_id, int(correct), utc_now()))
        awarded = 0
        if correct:
            inserted = conn.execute("INSERT OR IGNORE INTO speech_rewards(device_id, item_id, day) VALUES (?, ?, ?)",
                                    (device_id, item_id if kind == "speaking" else identity,
                                     (datetime.now(UTC) + timedelta(hours=8)).date().isoformat()))
            awarded = xp if inserted.rowcount else 0
        if request_id:
            conn.execute("INSERT INTO speech_receipts(device_id, request_id, item_id, audio_hash, xp_awarded) "
                         "VALUES (?, ?, ?, ?, ?)", (device_id, request_id, identity, digest, awarded))
            conn.execute("INSERT INTO speech_results(device_id, request_id, result_meta) VALUES (?, ?, ?)",
                         (device_id, request_id, json.dumps(meta)))
    return {**result, "xpAwarded": awarded, "requestId": request_id, "audioStored": False, "replayed": False}


@app.post("/api/v1/profile")
def save_profile(profile: ProfileInput) -> dict[str, object]:
    now = utc_now()
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO profiles(device_id, nickname, grade, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
              nickname=excluded.nickname, grade=excluded.grade, updated_at=excluded.updated_at
            """,
            (profile.deviceId, profile.nickname, profile.grade, now, now),
        )
    return {"ok": True, "updatedAt": now}


@app.get("/api/v1/profile/{device_id}")
def get_profile(device_id: str) -> dict[str, object]:
    with connection() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE device_id = ?", (device_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="profile_not_found")
    return {
        "deviceId": row["device_id"],
        "nickname": row["nickname"],
        "grade": row["grade"],
        "updatedAt": row["updated_at"],
    }


@app.post("/api/v1/progress")
def save_progress(progress: ProgressInput) -> dict[str, object]:
    now = utc_now()
    with connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        previous = conn.execute("SELECT * FROM progress WHERE device_id = ?", (progress.deviceId,)).fetchone()
        lesson_progress = progress.lessonProgress if progress.lessonProgress is not None else (
            json.loads(previous["lesson_progress"]) if previous else {}
        )
        activity = json.loads(previous["activity_state"]) if previous else {}
        for key in ("petCare", "videoProgress", "learnedSentences", "speechReceipts", "studySession", "phonicsPracticed", "cardCursor"):
            value = getattr(progress, key)
            if value is not None:
                if isinstance(value, BaseModel):
                    value = value.model_dump()
                if len(json.dumps(value)) > 100000:
                    raise HTTPException(422, "activity_too_large")
                activity[key] = value
        revision = progress.revision or 0
        if previous and previous["client_revision"] > 0:
            stored_revision = previous["client_revision"]
            same_content = (
                previous["xp"] == progress.xp and previous["stars"] == progress.stars
                and previous["streak"] == progress.streak
                and json.loads(previous["completed_lessons"]) == progress.completedLessons
                and json.loads(previous["learned_words"]) == progress.learnedWords
                and json.loads(previous["mastery"]) == progress.mastery
                and json.loads(previous["lesson_progress"]) == lesson_progress
                and json.loads(previous["activity_state"]) == activity
            )
            if revision < stored_revision or (revision == stored_revision and not same_content):
                raise HTTPException(409, "progress_revision_conflict")
            if revision == stored_revision:
                return {"ok": True, "updatedAt": previous["updated_at"], "revision": revision}
        ensure_profile(conn, progress.deviceId)
        conn.execute(
            """
            INSERT INTO progress(device_id, xp, stars, streak, completed_lessons, learned_words, mastery, lesson_progress, updated_at, client_revision)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
              xp=excluded.xp, stars=excluded.stars, streak=excluded.streak,
              completed_lessons=excluded.completed_lessons,
              learned_words=excluded.learned_words, mastery=excluded.mastery,
              lesson_progress=excluded.lesson_progress, updated_at=excluded.updated_at,
              client_revision=excluded.client_revision
            """,
            (
                progress.deviceId,
                progress.xp,
                progress.stars,
                progress.streak,
                json.dumps(progress.completedLessons, ensure_ascii=False),
                json.dumps(progress.learnedWords, ensure_ascii=False),
                json.dumps(progress.mastery, ensure_ascii=False),
                json.dumps(lesson_progress, ensure_ascii=False),
                now,
                revision,
            ),
        )
        conn.execute("UPDATE progress SET activity_state=? WHERE device_id=?",
                     (json.dumps(activity, ensure_ascii=False), progress.deviceId))
    return {"ok": True, "updatedAt": now, "revision": revision}


@app.get("/api/v1/progress/{device_id}")
def get_progress(device_id: str) -> dict[str, object]:
    with connection() as conn:
        row = conn.execute("SELECT * FROM progress WHERE device_id = ?", (device_id,)).fetchone()
    if row is None:
        return {
            "deviceId": device_id,
            "xp": 0,
            "stars": 0,
            "streak": 0,
            "completedLessons": [],
            "learnedWords": [],
            "mastery": {},
            "lessonProgress": {},
            "petCare": {}, "videoProgress": {}, "learnedSentences": [], "speechReceipts": [],
            "updatedAt": None,
            "revision": 0,
        }
    return {
        "deviceId": row["device_id"],
        "xp": row["xp"],
        "stars": row["stars"],
        "streak": row["streak"],
        "completedLessons": json.loads(row["completed_lessons"]),
        "learnedWords": json.loads(row["learned_words"]),
        "mastery": json.loads(row["mastery"]),
        "lessonProgress": json.loads(row["lesson_progress"]),
        **json.loads(row["activity_state"]),
        "updatedAt": row["updated_at"],
        "revision": row["client_revision"],
    }


@app.post("/api/v1/practice/answer")
def check_answer(answer: PracticeAnswer) -> dict[str, object]:
    quiz = next((item for item in ALL_QUIZZES if item["id"] == answer.questionId), None)
    if quiz is None:
        raise HTTPException(status_code=404, detail="question_not_found")
    if answer.answerIndex >= len(quiz["answers"]):
        raise HTTPException(422, "answer_index_out_of_range")
    correct = answer.answerIndex == quiz["correctIndex"]
    result = {
        "correct": correct,
        "correctIndex": quiz["correctIndex"],
        "explanation": quiz["explanation"],
        "xpAwarded": 15 if correct else 3,
    }
    with connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if answer.requestId:
            previous = conn.execute(
                "SELECT * FROM quiz_submissions WHERE device_id = ? AND request_id = ?",
                (answer.deviceId, answer.requestId),
            ).fetchone()
            if previous:
                if previous["question_id"] != answer.questionId or previous["answer_index"] != answer.answerIndex:
                    raise HTTPException(409, "request_id_reused")
                return json.loads(previous["result"])
        ensure_profile(conn, answer.deviceId)
        conn.execute(
            "INSERT INTO practice_events(device_id, kind, item_id, correct, created_at) VALUES (?, 'quiz', ?, ?, ?)",
            (answer.deviceId, answer.questionId, int(correct), utc_now()),
        )
        if answer.requestId:
            conn.execute(
                "INSERT INTO quiz_submissions(device_id, request_id, question_id, answer_index, result) VALUES (?, ?, ?, ?, ?)",
                (answer.deviceId, answer.requestId, answer.questionId, answer.answerIndex, json.dumps(result)),
            )
    return result


@app.get("/api/v1/report/{device_id}")
def parent_report(device_id: str) -> dict[str, object]:
    with connection() as conn:
        totals = conn.execute(
            """
            SELECT COUNT(*) AS attempts, COALESCE(SUM(correct), 0) AS correct
            FROM practice_events WHERE device_id = ?
            """,
            (device_id,),
        ).fetchone()
        progress = conn.execute("SELECT * FROM progress WHERE device_id = ?", (device_id,)).fetchone()
        speaking = conn.execute("SELECT COUNT(*) AS attempts, COALESCE(SUM(correct), 0) AS passed FROM practice_events WHERE device_id = ? AND kind = 'speaking'", (device_id,)).fetchone()
        conversation = conn.execute("SELECT COUNT(*) AS attempts, COALESCE(SUM(correct), 0) AS understood FROM practice_events WHERE device_id = ? AND kind = 'conversation'", (device_id,)).fetchone()
    attempts = int(totals["attempts"])
    correct = int(totals["correct"])
    mastery = json.loads(progress["mastery"]) if progress else {}
    now_ms = int(datetime.now(UTC).timestamp() * 1000)
    due_count = sum(1 for item in mastery.values() if isinstance(item, dict)
                    and isinstance(item.get("dueAt"), int) and item["dueAt"] <= now_ms)
    weak_count = sum(1 for item in mastery.values() if isinstance(item, dict)
                     and item.get("attempts", 0) > 0 and item.get("level") == 0)
    activities = json.loads(progress["activity_state"]) if progress else {}
    video_completed = sum(1 for value in activities.get("videoProgress", {}).values()
                          if isinstance(value, dict) and value.get("completed") is True)
    if due_count:
        advice = f"今天有 {due_count} 项到期复习，先完成它们，再学新内容。"
    elif weak_count:
        advice = f"有 {weak_count} 项还在巩固中，暂时不必重复已会的题。"
    else:
        advice = "今天没有到期复习，可以继续新课或和波波练口语。"
    return {
        "deviceId": device_id,
        "attempts": attempts,
        "accuracy": round(correct / attempts, 3) if attempts else 0,
        "xp": int(progress["xp"]) if progress else 0,
        "streak": int(progress["streak"]) if progress else 0,
        "speakingAttempts": int(speaking["attempts"]),
        "speakingPassed": int(speaking["passed"]),
        "conversationTurns": int(conversation["attempts"]),
        "conversationUnderstood": int(conversation["understood"]),
        "dueCount": due_count,
        "needsPracticeCount": weak_count,
        "videosCompleted": video_completed,
        "highlight": f"累计练习 {attempts} 次，其中开口尝试 {int(speaking['attempts']) + int(conversation['attempts'])} 次。动画理解完成 {video_completed} 集。{advice}",
    }


@app.get("/")
def web_preview() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
