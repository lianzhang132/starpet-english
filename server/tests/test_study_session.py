import pytest
from test_api import client


def body(device="study-session-roundtrip", revision=1):
    return {"deviceId": device, "revision": revision, "xp": 1425, "stars": 5, "streak": 4,
            "phonicsPracticed": ["letter-A", "word-apple"], "cardCursor": 9,
            "studySession": {"day": "2026-10-23", "lastStudyDay": "2026-10-22",
                             "dailyWords": [], "dailySentences": [], "dailyQuizzes": [], "dailyAttemptIds": []}}


def test_learning_session_round_trip_and_idempotent_retry():
    payload = body()
    payload["studySession"].update(day="2026-10-22", dailyWords=["apple"], dailyQuizzes=["q-apple"],
                                   dailySentences=["breakfast:0"], dailyAttemptIds=["q-apple", "q-cats"])
    first = client.post("/api/v1/progress", json=payload)
    assert first.status_code == 200
    assert client.post("/api/v1/progress", json=payload).json() == first.json()
    remote = client.get("/api/v1/progress/" + payload["deviceId"]).json()
    for key in ("studySession", "phonicsPracticed", "cardCursor", "xp", "stars", "streak"):
        assert remote[key] == payload[key]


def test_older_client_omission_or_null_preserves_daily_and_phonics_records():
    payload = body("study-session-old-client")
    assert client.post("/api/v1/progress", json=payload).status_code == 200
    legacy = {key: value for key, value in payload.items() if key not in ("studySession", "phonicsPracticed", "cardCursor")}
    for revision, extra in [(2, {}), (3, {"studySession": None, "phonicsPracticed": None, "cardCursor": None})]:
        assert client.post("/api/v1/progress", json={**legacy, "revision": revision, **extra}).status_code == 200
    remote = client.get("/api/v1/progress/" + payload["deviceId"]).json()
    for key in ("studySession", "phonicsPracticed", "cardCursor"):
        assert remote[key] == payload[key]


def test_same_revision_cannot_replace_new_session_or_phonics_but_next_revision_can():
    payload = body("study-session-conflict")
    assert client.post("/api/v1/progress", json=payload).status_code == 200
    for changed in ({"phonicsPracticed": []}, {"cardCursor": 0},
                    {"studySession": {**payload["studySession"], "dailyWords": ["banana"]}}):
        assert client.post("/api/v1/progress", json={**payload, **changed}).status_code == 409
    changed = {**payload, "revision": 2, "phonicsPracticed": [], "cardCursor": 0}
    assert client.post("/api/v1/progress", json=changed).status_code == 200
    remote = client.get("/api/v1/progress/" + payload["deviceId"]).json()
    assert remote["phonicsPracticed"] == [] and remote["cardCursor"] == 0


def test_new_calendar_day_can_clear_daily_counts_without_erasing_last_study_day():
    payload = body("study-session-rollover")
    payload["studySession"].update(day="2026-10-22", dailyWords=["apple"], dailyAttemptIds=["q-apple"])
    assert client.post("/api/v1/progress", json=payload).status_code == 200
    tomorrow = body("study-session-rollover", revision=2)
    assert client.post("/api/v1/progress", json=tomorrow).status_code == 200
    remote = client.get("/api/v1/progress/" + payload["deviceId"]).json()
    assert remote["studySession"] == tomorrow["studySession"]
    assert remote["streak"] == 4 and remote["xp"] == 1425


@pytest.mark.parametrize("field,value", [
    ("day", "2026-02-30"), ("day", "tomorrow"), ("lastStudyDay", "2026-13-1"),
    ("dailyWords", ["x" * 101]), ("dailyAttemptIds", "q-apple"),
])
def test_invalid_session_does_not_overwrite_saved_progress(field, value):
    payload = body("study-session-invalid-" + field + "-" + str(len(str(value))))
    assert client.post("/api/v1/progress", json=payload).status_code == 200
    invalid = {**payload, "revision": 2, "studySession": {**payload["studySession"], field: value}}
    assert client.post("/api/v1/progress", json=invalid).status_code == 422
    assert client.get("/api/v1/progress/" + payload["deviceId"]).json()["revision"] == 1


def test_partial_daily_snapshot_is_rejected_instead_of_erasing_missing_lists():
    payload = body("study-session-partial")
    del payload["studySession"]["dailyAttemptIds"]
    assert client.post("/api/v1/progress", json=payload).status_code == 422


def test_padded_dates_are_normalized_and_first_day_without_learning_is_supported():
    payload = body("study-session-dates")
    payload["studySession"].update(day="2028-02-29", lastStudyDay="")
    assert client.post("/api/v1/progress", json=payload).status_code == 200
    remote = client.get("/api/v1/progress/" + payload["deviceId"]).json()
    assert remote["studySession"]["day"] == "2028-2-29"
    assert remote["studySession"]["lastStudyDay"] == ""


@pytest.mark.parametrize("extra", [{"phonicsPracticed": ["x"] * 1001}, {"cardCursor": -1}])
def test_extra_learning_records_have_bounded_sizes(extra):
    assert client.post("/api/v1/progress", json={**body("study-session-bounds"), **extra}).status_code == 422
