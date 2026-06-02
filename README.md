# Hifz AI

A Quran memorization and recitation-practice web app. Pick any ayah, listen to a prominent reciter, recite into your mic, and get word-level feedback from an AI model fine-tuned on Quran recitation.

> **Not a replacement for a qualified teacher.** AI cannot judge tajweed at phoneme level. Use this to drill word accuracy and as a recitation companion alongside a real `mu'allim`.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **Quran text:** [quran.com API v4](https://api-docs.quran.com/) — Uthmani script, Hafs (phase 1)
- **Reciter audio:** [everyayah.com](https://everyayah.com/) — Mishary, Sudais, Husary (Murattal + Mujawwad), Minshawi, Ghamdi, Al-Shatri, Muaiqly, Shuraim
- **ASR:** [`tarteel-ai/whisper-base-ar-quran`](https://huggingface.co/tarteel-ai/whisper-base-ar-quran) via HuggingFace Inference API — Whisper fine-tuned on Quran recitation
- **Diff:** Arabic-normalized LCS word alignment (`src/lib/diff.ts`)

## Getting started

```bash
cp .env.local.example .env.local
# Add your HuggingFace token to HF_API_KEY in .env.local
# Get one at https://huggingface.co/settings/tokens

npm install
npm run dev
```

Open <http://localhost:3000>.

## Roadmap

- **Phase 1 (current)** — Hafs only. Surah/ayah browser, reciter picker + playback, mic record → word-level diff.
- **Phase 2** — Tajweed heuristics (madd duration, waqf compliance, ghunna). Supabase auth + per-user progress.
- **Phase 3** — Multi-Qira'at: Warsh (Nafi'), Qalun (Nafi'), Al-Duri (Abu Amr) text overlays + reciters per Riwayah.
- **Phase 4** — Hifz mode: spaced repetition over ayat/juz, streaks, weakest-ayah surfacing, blind-recite mode.

## Word-diff legend

- **Green** — recited correctly
- **Amber (dotted underline)** — expected word not heard (missed)
- **Red** — wrong word substituted (hover for what was heard)
- **Strikethrough** — extra word inserted that wasn't in the ayah

The diff strips Arabic diacritics (tashkeel) and normalizes letter forms before matching, so different fonts/orthographies of the same word still count as correct.

## Acknowledgements

- The team behind [Tarteel AI](https://www.tarteel.ai/) for open-sourcing their Whisper-Quran model
- [quran.com](https://quran.com) and [everyayah.com](https://everyayah.com) for the free APIs and recitation archives
- The reciters themselves — may Allah accept from them
