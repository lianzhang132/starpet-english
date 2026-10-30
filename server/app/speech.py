"""Bounded English ASR. Audio and transcripts are never persisted."""
from __future__ import annotations

import json
import os
import re
import threading
from collections import Counter
from pathlib import Path

MODEL_PATH = Path(os.getenv("STARPET_SPEECH_MODEL", "/models/vosk-model-small-en-us-0.15"))
MAX_AUDIO_BYTES = 16_000 * 2 * 20
_model = None
_model_lock = threading.Lock()
_slots = threading.BoundedSemaphore(2)
_CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
    "let's": "let us", "what's": "what is", "where's": "where is",
    "don't": "do not", "doesn't": "does not", "didn't": "did not",
    "can't": "can not", "cannot": "can not", "won't": "will not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "wouldn't": "would not", "shouldn't": "should not", "couldn't": "could not",
    "i'd": "i would", "i'll": "i will", "i've": "i have",
}
_NUMBER_WORDS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
                 "fifteen sixteen seventeen eighteen nineteen twenty").split()
# These small omissions can still count as an understandable first attempt. Real
# content words (including pronouns, negation, direction and quantity) may not change.
_OPTIONAL_WORDS = {"a", "an", "the", "some", "please", "and", "uh", "um"}


def available() -> bool:
    if os.getenv("STARPET_WHISPER_URL", "").strip():
        from . import whisper_asr
        return whisper_asr.available()
    if not (MODEL_PATH / "am" / "final.mdl").is_file():
        return False
    try:
        import vosk
        return vosk is not None
    except (ImportError, OSError):
        return False


def transcribe(pcm: bytes) -> str:
    if os.getenv("STARPET_WHISPER_URL", "").strip():
        from . import whisper_asr
        return whisper_asr.transcribe(pcm)
    global _model
    if not available():
        raise RuntimeError("speech_unavailable")
    if not _slots.acquire(blocking=False):
        raise RuntimeError("speech_busy")
    try:
        from vosk import KaldiRecognizer, Model, SetLogLevel
        with _model_lock:
            if _model is None:
                SetLogLevel(-1)
                _model = Model(str(MODEL_PATH))
        # Do not bias the recognizer with the expected answer.
        recognizer = KaldiRecognizer(_model, 16000)
        parts: list[str] = []
        for offset in range(0, len(pcm), 8000):
            if recognizer.AcceptWaveform(pcm[offset:offset + 8000]):
                parts.append(json.loads(recognizer.Result()).get("text", ""))
        parts.append(json.loads(recognizer.FinalResult()).get("text", ""))
        return " ".join(part for part in parts if part).strip()
    finally:
        _slots.release()


def engine_name() -> str:
    if os.getenv("STARPET_WHISPER_URL", "").strip():
        from . import whisper_asr
        return whisper_asr.engine_name()
    return "vosk-small-en-us-0.15"


def tokens(text: str) -> list[str]:
    text = text.lower().replace("’", "'")
    text = re.sub(r"\b(?:" + "|".join(re.escape(word) for word in _CONTRACTIONS) + r")\b",
                  lambda match: _CONTRACTIONS[match.group(0)], text)
    words = re.findall(r"[a-z]+|\d+", text)
    return [_NUMBER_WORDS[int(word)] if word.isdigit() and int(word) <= 20 else word for word in words]


def match_sentence(target: str, transcript: str) -> dict[str, object]:
    expected, actual = tokens(target), tokens(transcript)
    previous = list(range(len(actual) + 1))
    for i, word in enumerate(expected, 1):
        current = [i]
        for j, spoken in enumerate(actual, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (word != spoken)))
        previous = current
    score = round(100 * max(0, 1 - previous[-1] / max(len(expected), len(actual), 1))) if actual else 0
    expected_core = [word for word in expected if word not in _OPTIONAL_WORDS]
    actual_core = [word for word in actual if word not in _OPTIONAL_WORDS]
    passed = bool(expected_core) and score >= 80 and expected_core == actual_core
    # Similarity alone previously accepted e.g. "turn right" for "turn left" in
    # a five-word sentence, or an added "not" that reverses what the child says.
    feedback = "这句话听懂啦！试试不看文字再说一次。" if passed else "这次波波没听准。先听听回放，再试一次就好。"
    if not actual:
        feedback = "波波这次没有听清。靠近一点，再试一次吧。"
    actual_remaining = Counter(actual)
    missing = []
    for word in expected:
        if actual_remaining[word]:
            actual_remaining[word] -= 1
        elif word not in missing:
            missing.append(word)
    return {"transcript": transcript, "score": score, "metric": "sentence_match", "passed": passed,
            "feedback": feedback, "missingWords": missing}
