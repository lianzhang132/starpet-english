"""Internal-only ASR acceptance: bundled synthetic clips, never child recordings."""
import audioop
import importlib.util
import json
import os
import time
import wave
from pathlib import Path

static = Path("/app/app/static")
clips = json.loads((static / "audio-manifest.json").read_text())["clips"]
if os.getenv("STARPET_BENCH_CLIENT"):
    spec = importlib.util.spec_from_file_location("starpet_benchmark_client", os.environ["STARPET_BENCH_CLIENT"])
    client = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(client)
else:
    from app import whisper_asr as client
assert client.available(), "ASR is not ready"


def infer(pcm):
    start = time.monotonic()
    return client.transcribe(pcm), round(time.monotonic() - start, 2)


results = []
for text in ("Good morning!", "Nice to meet you!", "I would like some milk, please.", "Go straight and turn left.", "I like cats.", "Good morning!", "Good morning!"):
    with wave.open(str(static / clips[text]["path"].removeprefix("/static/"))) as wav:
        pcm, _ = audioop.ratecv(wav.readframes(wav.getnframes()), 2, 1, wav.getframerate(), 16000, None)
    recognized, seconds = infer(pcm)
    normalized = lambda value: " ".join("".join(c.lower() if c.isalpha() else " " for c in value).split())
    passed = normalized(text) == normalized(recognized)
    results.append({"target": text, "recognized": recognized, "seconds": seconds, "exact": passed})
    print(json.dumps(results[-1]), flush=True)
for pcm, label in ((b"\0" * 32000, "one_second_silence"), (b"\0" * 160000, "five_second_silence")):
    recognized, seconds = infer(pcm)
    results.append({"case": label, "recognized": recognized, "seconds": seconds, "empty": recognized == ""})
    print(json.dumps(results[-1]), flush=True)
assert all(item.get("exact", item.get("empty")) for item in results), results
assert max(item["seconds"] for item in results) < 40, results
print(json.dumps({"passed": True, "cases": len(results), "maxSeconds": max(item["seconds"] for item in results)}))
