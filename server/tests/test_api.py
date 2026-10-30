import os
import tempfile
from pathlib import Path

temporary_directory = tempfile.TemporaryDirectory()
os.environ["STARPET_DATABASE"] = str(Path(temporary_directory.name) / "test.db")

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_and_catalog() -> None:
    assert client.get("/api/health").json()["status"] == "ok"
    catalog = client.get("/api/v1/catalog").json()
    assert len(catalog["worlds"]) == 6
    assert len(catalog["quizzes"]) >= 3


def test_progress_round_trip() -> None:
    body = {
        "deviceId": "test-device-001",
        "xp": 135,
        "stars": 29,
        "streak": 5,
        "completedLessons": ["hello-1"],
        "learnedWords": ["hello", "apple"],
    }
    response = client.post("/api/v1/progress", json=body)
    assert response.status_code == 200
    stored = client.get("/api/v1/progress/test-device-001").json()
    assert stored["xp"] == 135
    assert stored["completedLessons"] == ["hello-1"]
    assert stored["mastery"] == {}


def test_practice_answer() -> None:
    response = client.post(
        "/api/v1/practice/answer",
        json={"deviceId": "test-device-001", "questionId": "q-apple", "answerIndex": 1},
    )
    assert response.status_code == 200
    assert response.json()["correct"] is True
