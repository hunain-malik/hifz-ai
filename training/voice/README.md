# SANAD Voice — neural recitation training pipeline

The goal: a recitation voice **trained on sheikh recitations**, plugged into
the "Hey Sanad → recite" pipeline (`RecitationCard` treats the audio source
as swappable). This directory is the complete on-ramp: dataset building,
preparation, training recipe, and — the part that makes this defensible —
the **SANAD gate**: no generated ayah is ever used unless it passes the same
verification engine that grades students.

> **Why this can't run inside a Claude Code session:** training needs GPU
> days (A100/H100 or a 4090 for small runs), ~10–100 GB of recitation audio,
> and open network egress. The session container has none of those. Every
> script here is written to run on your machine or a rented GPU box
> (RunPod, Lambda, Vast.ai).

## The loop

```
1. build_manifest.py   → per-ayah (audio URL, Uthmani text) pairs, JSONL
2. prepare_dataset.py  → download, resample 24 kHz mono, trim, verify, split
3. [train]             → fine-tune an open TTS backbone (recipe below)
4. asr_transcribe.py   → run Tarteel Whisper over generated samples
5. gate.ts             → SANAD verdict on every sample: verified or rejected
      └── rejected samples become the next fine-tune's hard examples
```

Step 5 is the innovation: the same `src/lib/sanad` engine that grades
students grades the model. A generated ayah passes only if its verified
score is 100 with zero confirmed issues. **The voice cannot ship a mistake
SANAD can catch** — and as SANAD gains phoneme/tajweed heads (Phase B/C in
`docs/SANAD.md`), the gate tightens automatically.

## Step-by-step

```bash
cd training/voice
python -m venv .venv && .venv/Scripts/activate       # (Windows PowerShell)
pip install requests datasets soundfile librosa

# 1. Manifest: every ayah of every chosen reciter + its Uthmani text
python build_manifest.py --reciters Husary_64kbps Alafasy_64kbps \
    Abdul_Basit_Murattal_64kbps --out manifest.jsonl

# 2. Download + normalize into an HF-style dataset directory
python prepare_dataset.py --manifest manifest.jsonl --out dataset/ \
    --sample-rate 24000

# 3. Train (see recipe below), producing generated samples in generated/

# 4+5. The SANAD gate
python asr_transcribe.py --wavs generated/ --out transcripts.jsonl
npx tsx training/voice/gate.ts transcripts.jsonl   # from the repo root
```

## Training recipe (step 3)

Start from an open multilingual TTS backbone and fine-tune on the prepared
dataset. Recommended starting points, in order:

- **CosyVoice2** (Apache-2.0) — best license for a startup, strong Arabic.
- **F5-TTS** (MIT code) — fast to fine-tune, but check checkpoint licenses
  (the public Emilia-trained weights are CC-BY-NC — fine for research,
  not for shipping; retrain from scratch or license for production).
- **StyleTTS2** (MIT) — smaller, good for a first proof-of-life run.

Practical settings that matter for recitation (all of these exist to
preserve tajweed, which ordinary TTS destroys):

- **Never let the aligner "fix" durations.** Madd is 2–6 counts by rule;
  duration modeling must be learned from the data, not normalized away.
  Filter any preprocessing step that trims "abnormally long" vowels.
- Train on **full ayat** (not word clips) so waqf behavior at ayah ends —
  sukoon, qalqalah kubra, madd 'arid — is in-distribution.
- Keep **one reciter per fine-tune** first (Husary murattal is the
  pedagogical gold standard and the most metronomic — easiest to learn).
  Multi-sheikh style tokens are a later experiment, not day one.
- Text input should be the **Uthmani text with full tashkeel** from the
  manifest — the diacritics are the pronunciation. Do not strip them.
- 6,236 ayat ≈ 20–30 h per reciter — enough for fine-tuning, not for
  from-scratch. Budget roughly: StyleTTS2 fine-tune ~1–2 days on a 4090;
  CosyVoice2 fine-tune ~2–4 days on an A100.

## The bar for ever shipping it

This voice may only recite to a user when, over the **entire mushaf**:

1. every generated ayah passes the SANAD gate (100 verified, 0 confirmed
   issues, 0 uncertain), and
2. per-word durations sit inside the sheikh ensemble envelope
   (`src/lib/sanad/ensemble.ts`), and
3. qualified huffaz have signed off on a sampled audit — the gate catches
   what ASR can hear; a sheikh catches what it can't. The chain of
   transmission ends with humans, by design.

Until all three hold, the trained voice stays a research artifact and the
verified qari recordings remain the production voice.
