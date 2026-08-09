"""Build the training manifest: one JSONL row per (reciter, ayah) with the
audio URL and the Uthmani text (full tashkeel — the diacritics ARE the
pronunciation).

Audio comes from EveryAyah's per-ayah archives (https://everyayah.com),
text from the Quran.com API. Run this on a machine with open internet;
the Claude Code session container cannot reach these hosts.

Usage:
    python build_manifest.py --reciters Husary_64kbps Alafasy_64kbps --out manifest.jsonl
"""

import argparse
import json
import sys

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)

QURAN_API = "https://api.quran.com/api/v4"
EVERYAYAH = "https://everyayah.com/data"

# EveryAyah directory names for commonly used murattal sets.
KNOWN_RECITERS = [
    "Husary_64kbps",
    "Husary_Muallim_128kbps",
    "Alafasy_64kbps",
    "Abdul_Basit_Murattal_64kbps",
    "Minshawy_Murattal_128kbps",
    "Abdurrahmaan_As-Sudais_64kbps",
]


def fetch_json(url: str) -> dict:
    # requests over urllib: browser-grade connection handling (proxy, IPv6
    # fallback) — urllib is known to hang on Windows networks where the
    # browser works fine.
    r = requests.get(url, headers={"User-Agent": "sanad-voice/0.1"}, timeout=(10, 30))
    r.raise_for_status()
    return r.json()


def fetch_uthmani_verses() -> list[dict]:
    """All 6,236 ayat with Uthmani text and verse keys."""
    verses = []
    page = 1
    while True:
        print(f"fetching verse text… page {page} ({len(verses)}/6236 so far)",
              flush=True)
        for attempt in range(3):
            try:
                data = fetch_json(
                    f"{QURAN_API}/quran/verses/uthmani?page={page}&per_page=1000"
                )
                break
            except Exception as e:  # noqa: BLE001 — retry transient network errors
                if attempt == 2:
                    raise
                print(f"  retry {attempt + 1}/2 after error: {e}", flush=True)
        batch = data.get("verses", [])
        if not batch:
            break
        verses.extend(batch)
        if len(batch) < 1000:
            break
        page += 1
    if len(verses) < 6236:
        print(f"warning: only {len(verses)} verses fetched", file=sys.stderr)
    return verses


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reciters", nargs="+", default=["Husary_64kbps"],
                    help=f"EveryAyah directory names, e.g. {KNOWN_RECITERS[:3]}")
    ap.add_argument("--out", default="manifest.jsonl")
    args = ap.parse_args()

    verses = fetch_uthmani_verses()
    rows = 0
    with open(args.out, "w", encoding="utf-8") as f:
        for reciter in args.reciters:
            for v in verses:
                surah_s, ayah_s = v["verse_key"].split(":")
                fname = f"{int(surah_s):03d}{int(ayah_s):03d}.mp3"
                f.write(json.dumps({
                    "reciter": reciter,
                    "verse_key": v["verse_key"],
                    "audio_url": f"{EVERYAYAH}/{reciter}/{fname}",
                    "text_uthmani": v["text_uthmani"],
                }, ensure_ascii=False) + "\n")
                rows += 1
    print(f"wrote {rows} rows ({len(args.reciters)} reciters) to {args.out}")


if __name__ == "__main__":
    main()
