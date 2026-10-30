"""Bounded, memory-only client for the private whisper.cpp speech service.

The recognizer receives audio only, never the exercise's expected answer. An
explicitly configured but unhealthy service fails rather than changing engines.
Request fields follow whisper.cpp v1.9.5 examples/server/server.cpp.
"""
from __future__ import annotations

import io
import json
import math
import os
import struct
import threading
import time
import wave
from urllib.parse import urlsplit

import requests
from urllib3.exceptions import TimeoutError as UrllibTimeoutError

SAMPLE_RATE = 16_000
MAX_AUDIO_BYTES = SAMPLE_RATE * 2 * 20
MAX_RESPONSE_BYTES = 32 * 1024
HEALTH_TIMEOUT = (1, 2)
INFERENCE_TIMEOUT = (2, 40)

_slots = threading.BoundedSemaphore(1)
_health_lock = threading.Lock()
_health_cache: tuple[str, float, bool] = ("", 0.0, False)


def engine_name() -> str:
    return "whisper.cpp-small.en-q5_1"


def _base_url() -> str:
    raw = os.getenv("STARPET_WHISPER_URL", "").strip()
    try:
        url = urlsplit(raw)
        # This is an operator-owned base address, not an exercise/user URL.
        if (url.scheme not in {"http", "https"} or not url.hostname
                or url.username is not None or url.password is not None
                or url.query or url.fragment or url.path not in {"", "/"}):
            return ""
        url.port  # Reject malformed ports before making an HTTP request.
    except ValueError:
        return ""
    return raw.rstrip("/")


def _new_session() -> requests.Session:
    session = requests.Session()
    # Do not send child audio through ambient proxies or use ambient netrc auth.
    session.trust_env = False
    return session


def _read_json(response: requests.Response) -> object:
    try:
        declared = int(response.headers.get("Content-Length", "0"))
    except (TypeError, ValueError):
        declared = 0
    if declared > MAX_RESPONSE_BYTES:
        raise RuntimeError("speech_invalid_response")
    body = bytearray()
    for chunk in response.iter_content(chunk_size=4096):
        if not chunk:
            continue
        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
            raise RuntimeError("speech_invalid_response")
        body.extend(chunk)
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError, RecursionError):
        raise RuntimeError("speech_invalid_response") from None


def available() -> bool:
    global _health_cache
    base = _base_url()
    if not base:
        return False
    with _health_lock:
        cached_url, expires, result = _health_cache
        if cached_url == base and time.monotonic() < expires:
            return result
        result = False
        try:
            with _new_session() as session:
                with session.get(base + "/health", timeout=HEALTH_TIMEOUT,
                                 allow_redirects=False, stream=True) as response:
                    if response.status_code == 200:
                        payload = _read_json(response)
                        result = isinstance(payload, dict) and payload.get("status") == "ok"
        except (requests.RequestException, RuntimeError, OSError):
            # Health has no transcript/audio; expose only readiness to callers.
            result = False
        _health_cache = (base, time.monotonic() + (10 if result else 2), result)
        return result


def _mark_unhealthy(base: str) -> None:
    global _health_cache
    with _health_lock:
        _health_cache = (base, time.monotonic() + 2, False)


def _near_digital_silence(pcm: bytes) -> bool:
    # Far below the UI's speech-level guidance. This only rejects digital silence
    # and tiny quantization noise, not a softly spoken child's voice.
    peak = 0
    squares = 0
    for (sample,) in struct.iter_unpack("<h", pcm):
        amplitude = abs(sample)
        if amplitude > 4:
            return False
        peak = max(peak, amplitude)
        squares += sample * sample
    rms = math.sqrt(squares / (len(pcm) // 2))
    return peak <= 4 and rms <= 2


def _wav_bytes(pcm: bytes) -> bytes:
    with io.BytesIO() as memory:
        with wave.open(memory, "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(SAMPLE_RATE)
            audio.writeframes(pcm)
        return memory.getvalue()


def _request_timed_out(error: BaseException) -> bool:
    # requests wraps read timeouts during streaming in ConnectionError.
    return isinstance(error, (requests.Timeout, TimeoutError, UrllibTimeoutError)) or any(
        isinstance(arg, (requests.Timeout, TimeoutError, UrllibTimeoutError))
        for arg in error.args
    )


def transcribe(pcm: bytes) -> str:
    if not isinstance(pcm, bytes) or not pcm or len(pcm) % 2 or len(pcm) > MAX_AUDIO_BYTES:
        raise RuntimeError("speech_invalid_audio")
    base = _base_url()
    if not base:
        raise RuntimeError("speech_unavailable")
    if _near_digital_silence(pcm):
        return ""
    if not _slots.acquire(blocking=False):
        raise RuntimeError("speech_busy")
    try:
        with _new_session() as session:
            with session.post(
                base + "/inference",
                files={"file": ("recording.wav", _wav_bytes(pcm), "audio/wav")},
                data={"response_format": "json", "language": "en", "temperature": "0.0",
                      "temperature_inc": "0.0", "translate": "false", "no_timestamps": "true",
                      "token_timestamps": "false", "debug_mode": "false"},
                timeout=INFERENCE_TIMEOUT, allow_redirects=False, stream=True,
            ) as response:
                if response.status_code == 429:
                    raise RuntimeError("speech_busy")
                if response.status_code in {400, 413, 415, 422}:
                    raise RuntimeError("speech_invalid_audio")
                if response.status_code != 200:
                    raise RuntimeError("speech_unavailable")
                payload = _read_json(response)
                if (not isinstance(payload, dict) or "error" in payload
                        or not isinstance(payload.get("text"), str)):
                    raise RuntimeError("speech_invalid_response")
                return payload["text"].strip()
    except requests.RequestException as error:
        _mark_unhealthy(base)
        code = "speech_timeout" if _request_timed_out(error) else "speech_unavailable"
        raise RuntimeError(code) from None
    except OSError:
        _mark_unhealthy(base)
        raise RuntimeError("speech_unavailable") from None
    except RuntimeError as error:
        if str(error) in {"speech_unavailable", "speech_invalid_response"}:
            _mark_unhealthy(base)
        raise
    finally:
        _slots.release()
