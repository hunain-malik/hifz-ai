"""Download and normalize the manifest into a TTS-ready dataset.

Output layout (LJSpeech-compatible + HF-loadable):
    dataset/
      wavs/<reciter>/<sss><aaa>.wav      24 kHz mono PCM
      metadata.csv                       path|text_uthmani|reciter|verse_key
      train.csv / eval.csv               98/2 split by ayah (eval spans juz)

Deliberate choices for recitation (see README):
- NO trimming of long vowels or "abnormal" durations — madd is the point.
- Only leading/trailing silence beyond 300 ms is trimmed.
- Full ayat only; text keeps complete tashkeel.

Usage:
    python prepare_dataset.py --manifest manifest.jsonl --out dataset/ --sample-rate 24000
"""

import argparse
import csv
import json
import os
import sys

try:
    import librosa
    import requests
    import soundfile as sf
except ImportError:
    print("pip install librosa soundfile requests", file=sys.stderr)
    sys.exit(1)


def download(url: str, path: str) -> bool:
    if os.path.exists(path):
        return True
    try:
        r = requests.get(url, headers={"User-Agent": "sanad-voice/0.1"},
                         timeout=(10, 60))
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
        return True
    except Exception as e:  # noqa: BLE001 — log and skip, dataset build must continue
        print(f"skip {url}: {e}", file=sys.stderr)
        return False


def trim_edges(y, sr, keep_ms=300, top_db=40):
    """Trim leading/trailing silence but KEEP `keep_ms` of padding — abrupt
    starts destroy the natural onset breath reciters use."""
    yt, idx = librosa.effects.trim(y, top_db=top_db)
    pad = int(sr * keep_ms / 1000)
    start = max(0, idx[0] - pad)
    end = min(len(y), idx[1] + pad)
    return y[start:end]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", default="dataset")
    ap.add_argument("--sample-rate", type=int, default=24000)
    ap.add_argument("--eval-every", type=int, default=50,
                    help="every Nth ayah goes to eval (spans the whole mushaf)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    rows = [json.loads(l) for l in open(args.manifest, encoding="utf-8")]
    meta, train, evalr = [], [], []

    for i, row in enumerate(rows):
        reciter_dir = os.path.join(args.out, "wavs", row["reciter"])
        os.makedirs(reciter_dir, exist_ok=True)
        surah, ayah = row["verse_key"].split(":")
        stem = f"{int(surah):03d}{int(ayah):03d}"
        mp3_path = os.path.join(reciter_dir, stem + ".mp3")
        wav_path = os.path.join(reciter_dir, stem + ".wav")

        if not os.path.exists(wav_path):
            if not download(row["audio_url"], mp3_path):
                continue
            y, _sr = librosa.load(mp3_path, sr=args.sample_rate, mono=True)
            y = trim_edges(y, args.sample_rate)
            sf.write(wav_path, y, args.sample_rate)
            os.remove(mp3_path)

        rel = os.path.relpath(wav_path, args.out)
        entry = [rel, row["text_uthmani"], row["reciter"], row["verse_key"]]
        meta.append(entry)
        (evalr if i % args.eval_every == 0 else train).append(entry)

    for name, data in [("metadata.csv", meta), ("train.csv", train), ("eval.csv", evalr)]:
        with open(os.path.join(args.out, name), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, delimiter="|")
            w.writerow(["path", "text_uthmani", "reciter", "verse_key"])
            w.writerows(data)

    print(f"{len(meta)} clips ready · train={len(train)} eval={len(evalr)}")


if __name__ == "__main__":
    main()
