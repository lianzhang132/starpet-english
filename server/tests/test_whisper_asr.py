"""Client contract tests; no model, network, or recorded child audio required."""
import io
import json
import struct
import threading
import wave

import pytest
import requests
from urllib3.exceptions import ReadTimeoutError

from app import whisper_asr


PCM = struct.pack("<h", 100) * 16_000


class FakeResponse:
    def __init__(self, payload=None, *, body=None, status=200, headers=None, chunks=None):
        self.status_code = status
        self.headers = headers or {}
        self.body = json.dumps(payload).encode() if body is None else body
        self.chunks = chunks
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True

    def iter_content(self, chunk_size):
        if self.chunks is not None:
            yield from self.chunks
        else:
            for start in range(0, len(self.body), chunk_size):
                yield self.body[start:start + chunk_size]


class FakeSession:
    def __init__(self, *, get=None, post=None):
        self.get_result = get or FakeResponse({"status": "ok"})
        self.post_result = post or FakeResponse({"text": " Good morning. "})
        self.calls = []
        self.closed = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed += 1

    def _request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        value = self.get_result if method == "GET" else self.post_result
        if isinstance(value, BaseException):
            raise value
        return value(url, **kwargs) if callable(value) else value

    def get(self, url, **kwargs):
        return self._request("GET", url, **kwargs)

    def post(self, url, **kwargs):
        return self._request("POST", url, **kwargs)


@pytest.fixture(autouse=True)
def isolated_client(monkeypatch):
    monkeypatch.setenv("STARPET_WHISPER_URL", "http://whisper-asr:8080/")
    monkeypatch.setattr(whisper_asr, "_health_cache", ("", 0.0, False))
    monkeypatch.setattr(whisper_asr, "_slots", threading.BoundedSemaphore(1))


def use_session(monkeypatch, session):
    monkeypatch.setattr(whisper_asr, "_new_session", lambda: session)
    return session


def test_wav_contract_and_audio_only_deterministic_request(monkeypatch):
    session = use_session(monkeypatch, FakeSession())
    assert whisper_asr.transcribe(PCM) == "Good morning."
    method, url, options = session.calls[0]
    assert (method, url) == ("POST", "http://whisper-asr:8080/inference")
    assert options["timeout"] == (2, 40)
    assert options["allow_redirects"] is False and options["stream"] is True
    assert options["data"]["language"] == "en"
    assert options["data"]["response_format"] == "json"
    assert float(options["data"]["temperature"]) == 0
    assert float(options["data"]["temperature_inc"]) == 0
    assert not {"prompt", "grammar", "target", "initial_prompt", "carry_initial_prompt"} & options["data"].keys()
    filename, body, mime = options["files"]["file"]
    assert filename == "recording.wav" and mime == "audio/wav"
    with wave.open(io.BytesIO(body), "rb") as recording:
        assert recording.getnchannels() == 1 and recording.getsampwidth() == 2
        assert recording.getframerate() == 16_000 and recording.getnframes() == 16_000
        assert recording.readframes(recording.getnframes()) == PCM
    assert session.closed == 1 and session.post_result.closed


def test_session_does_not_use_environment_proxies_or_netrc():
    with whisper_asr._new_session() as session:
        assert session.trust_env is False


def test_health_success_cached_ten_seconds_and_url_changes_recheck(monkeypatch):
    now = [100.0]
    monkeypatch.setattr(whisper_asr.time, "monotonic", lambda: now[0])
    session = use_session(monkeypatch, FakeSession())
    assert whisper_asr.available() is True
    now[0] = 109.99
    assert whisper_asr.available() is True and len(session.calls) == 1
    now[0] = 110.01
    assert whisper_asr.available() is True and len(session.calls) == 2
    monkeypatch.setenv("STARPET_WHISPER_URL", "http://other-service:8080")
    assert whisper_asr.available() is True and len(session.calls) == 3
    assert session.calls[0][2] == {"timeout": (1, 2), "allow_redirects": False, "stream": True}


def test_health_failure_retries_after_two_seconds(monkeypatch):
    now = [100.0]
    monkeypatch.setattr(whisper_asr.time, "monotonic", lambda: now[0])
    session = use_session(monkeypatch, FakeSession(get=requests.ConnectionError("private detail")))
    assert whisper_asr.available() is False
    session.get_result = FakeResponse({"status": "ok"})
    now[0] = 101.99
    assert whisper_asr.available() is False and len(session.calls) == 1
    now[0] = 102.01
    assert whisper_asr.available() is True and len(session.calls) == 2


@pytest.mark.parametrize("response", [
    FakeResponse({"status": "loading model"}, status=503),
    FakeResponse({"status": "loading model"}),
    FakeResponse({"status": "ok"}, status=302),
    FakeResponse(body=b"not json"),
    FakeResponse({"status": "ok"}, headers={"Content-Length": "32769"}),
])
def test_only_verified_ready_health_is_available(monkeypatch, response):
    use_session(monkeypatch, FakeSession(get=response))
    assert whisper_asr.available() is False


@pytest.mark.parametrize("url", ["", "file:///recording", "http://user:secret@host", "http://host:invalid", "http://host?x=1", "http://host/inference"])
def test_invalid_configuration_never_calls_network(monkeypatch, url):
    session = use_session(monkeypatch, FakeSession())
    monkeypatch.setenv("STARPET_WHISPER_URL", url)
    assert whisper_asr.available() is False
    with pytest.raises(RuntimeError, match="^speech_unavailable$"):
        whisper_asr.transcribe(PCM)
    assert not session.calls


@pytest.mark.parametrize("pcm", [b"", b"\0", b"\0" * (whisper_asr.MAX_AUDIO_BYTES + 2), None, bytearray(PCM)],
                         ids=["empty", "odd-byte-count", "over-twenty-seconds", "none", "mutable-bytes"])
def test_invalid_pcm_never_calls_network(monkeypatch, pcm):
    session = use_session(monkeypatch, FakeSession())
    with pytest.raises(RuntimeError, match="^speech_invalid_audio$"):
        whisper_asr.transcribe(pcm)
    assert not session.calls


def test_twenty_second_boundary_is_accepted(monkeypatch):
    session = use_session(monkeypatch, FakeSession())
    assert whisper_asr.transcribe(PCM * 20) == "Good morning."
    assert len(session.calls[0][2]["files"]["file"][1]) == whisper_asr.MAX_AUDIO_BYTES + 44


@pytest.mark.parametrize("sample", [0, 1, -1, 2, -2])
def test_near_digital_silence_never_invokes_model(monkeypatch, sample):
    session = use_session(monkeypatch, FakeSession())
    assert whisper_asr.transcribe(struct.pack("<h", sample) * 16_000) == ""
    assert not session.calls


def test_quiet_voice_and_small_transient_are_not_silenced(monkeypatch):
    session = use_session(monkeypatch, FakeSession())
    assert whisper_asr.transcribe(struct.pack("<h", 5) * 16_000) == "Good morning."
    assert whisper_asr.transcribe(b"\0" * 31_998 + struct.pack("<h", 10)) == "Good morning."
    assert len(session.calls) == 2


def test_second_inference_is_rejected_immediately_and_slot_is_released(monkeypatch):
    entered, release = threading.Event(), threading.Event()

    def slow_post(url, **kwargs):
        entered.set()
        assert release.wait(3)
        return FakeResponse({"text": "hello"})

    session = use_session(monkeypatch, FakeSession(post=slow_post))
    results = []
    worker = threading.Thread(target=lambda: results.append(whisper_asr.transcribe(PCM)))
    worker.start()
    assert entered.wait(2)
    try:
        with pytest.raises(RuntimeError, match="^speech_busy$"):
            whisper_asr.transcribe(PCM)
        assert len(session.calls) == 1
    finally:
        release.set()
        worker.join(3)
    assert not worker.is_alive() and results == ["hello"]
    assert whisper_asr.transcribe(PCM) == "hello"


@pytest.mark.parametrize("error,code", [
    (requests.Timeout("secret transcript"), "speech_timeout"),
    (requests.ConnectionError(ReadTimeoutError(None, None, "private text")), "speech_timeout"),
    (requests.ConnectionError("internal hostname"), "speech_unavailable"),
])
def test_transport_errors_are_explicit_and_do_not_leak_details(monkeypatch, error, code):
    session = use_session(monkeypatch, FakeSession(post=error))
    with pytest.raises(RuntimeError, match="^" + code + "$"):
        whisper_asr.transcribe(PCM)
    assert whisper_asr.available() is False
    session.post_result = FakeResponse({"text": "hello"})
    assert whisper_asr.transcribe(PCM) == "hello"


@pytest.mark.parametrize("status,code", [(302, "speech_unavailable"), (400, "speech_invalid_audio"), (413, "speech_invalid_audio"), (429, "speech_busy"), (503, "speech_unavailable")])
def test_http_errors_and_redirects_are_not_transcripts(monkeypatch, status, code):
    response = FakeResponse({"text": "not a usable result"}, status=status)
    use_session(monkeypatch, FakeSession(post=response))
    with pytest.raises(RuntimeError, match="^" + code + "$"):
        whisper_asr.transcribe(PCM)
    assert response.closed


@pytest.mark.parametrize("response", [
    FakeResponse(body=b"invalid json"), FakeResponse(body=b"\xff"),
    FakeResponse([]), FakeResponse({"text": None}), FakeResponse({"error": "model failed"}),
    FakeResponse({"error": "model failed", "text": "invalid success"}),
    FakeResponse({"text": "ignored"}, headers={"Content-Length": "32769"}),
    FakeResponse(chunks=[b" " * 16_384, b" " * 16_385]),
])
def test_invalid_or_oversized_responses_fail_closed_and_release_slot(monkeypatch, response):
    session = use_session(monkeypatch, FakeSession(post=response))
    with pytest.raises(RuntimeError, match="^speech_invalid_response$"):
        whisper_asr.transcribe(PCM)
    assert response.closed
    session.post_result = FakeResponse({"text": "hello"})
    assert whisper_asr.transcribe(PCM) == "hello"


def test_exact_response_limit_and_empty_transcript_are_valid(monkeypatch):
    body = b'{"text":"' + b"a" * (whisper_asr.MAX_RESPONSE_BYTES - 11) + b'"}'
    assert len(body) == whisper_asr.MAX_RESPONSE_BYTES
    session = use_session(monkeypatch, FakeSession(post=FakeResponse(body=body)))
    assert len(whisper_asr.transcribe(PCM)) == whisper_asr.MAX_RESPONSE_BYTES - 11
    session.post_result = FakeResponse({"text": "  "})
    assert whisper_asr.transcribe(PCM) == ""
