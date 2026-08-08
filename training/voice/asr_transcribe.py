"""Transcribe generated recitation samples with Quran-fine-tuned Whisper —
the first half of the SANAD gate (gate.ts is the second half).

Expects generated wavs named <sss><aaa>.wav (e.g. 067001.wav) or any name
listed in a sidecar keys.jsonl mapping {"file": ..., "verse_key": ...,
"text_uthmani": ...}. Emits transcripts.jsonl rows:
    {"verse_key", "expected", "transcript", "file"}

Usage:
    pip install transformers torch librosa
    python asr_transcribe.py --wavs generated/ --manifest manifest.jsonl --out transcripts.jsonl
"""

import argparse
import glob
import json
import os
import sys

try:
    import librosa
    from transformers import pipeline
except ImportError:
    print("pip install transformers torch librosa", file=sys.stderr)
    sys.exit(1)

# Same fine-tune family the app uses in-browser (tarteel-ai's Quran Whisper).
MODEL_ID = "tarteel-ai/whisper-base-ar-quran"


def load_expected(manifest: str) -> dict[str, str]:
    out = {}
    for line in open(manifest, encoding="utf-8"):
        row = json.loads(line)
        out[row["verse_key"]] = row["text_uthmani"]
    return out


def key_from_name(path: str) -> str | None:
    stem = os.path.splitext(os.path.basename(path))[0]
    if len(stem) == 6 and stem.isdigit():
        return f"{int(stem[:3])}:{int(stem[3:])}"
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wavs", required=True)
    ap.add_argument("--manifest", required=True,
                    help="manifest.jsonl from build_manifest.py (for expected text)")
    ap.add_argument("--out", default="transcripts.jsonl")
    args = ap.parse_args()

    expected = load_expected(args.manifest)
    asr = pipeline("automatic-speech-recognition", model=MODEL_ID)

    files = sorted(glob.glob(os.path.join(args.wavs, "**", "*.wav"), recursive=True))
    written = 0
    with open(args.out, "w", encoding="utf-8") as f:
        for path in files:
            key = key_from_name(path)
            if key is None or key not in expected:
                print(f"skip (no verse key): {path}", file=sys.stderr)
                continue
            audio, _ = librosa.load(path, sr=16000, mono=True)
            result = asr(audio, chunk_length_s=30)
            f.write(json.dumps({
                "verse_key": key,
                "expected": expected[key],
                "transcript": (result.get("text") or "").strip(),
                "file": path,
            }, ensure_ascii=False) + "\n")
            written += 1
    print(f"transcribed {written}/{len(files)} → {args.out}")


if __name__ == "__main__":
    main()
