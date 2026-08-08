# Hifz AI

A Quran memorization and recitation-practice web app. Pick any surah, listen to a prominent reciter with live word-level highlighting as they recite, then recite into your mic to get word-level accuracy feedback.

🌐 **Live:** <https://hifz-ai-beta.vercel.app/>

> **Not a replacement for a qualified teacher.** Speech recognition can't judge tajweed at phoneme level. Use this to drill word accuracy and as a recitation companion alongside a real `mu'allim`.

## Features

- 114 surahs from quran.com with English + Arabic names and Mushaf page ranges
- 12 reciters (Mishary, Sudais, Husary, Minshawi, AbdulBaset, Al-Shatri, Hani Ar-Rifai, Shuraim, Al-Tablawi — Murattal, Mujawwad, and Mu'allim styles)
- **Single full-surah audio file** per reciter — gapless playback, pause/resume, jump-to-ayah
- **Live word highlighting** during playback, synced from word-level segment timings
- Auto-scroll to the active ayah as the reciter moves
- **Recite mode**: in-browser speech recognition (Web Speech API, ar-SA), diffed against the ayah text
- "Next ayah →" advances recite mode through a surah automatically
- **Recitation Chat** (`/chat`): a Quran-specialized assistant — ask "Recite Surah Al-Mulk verses 1–5" (or `67:1-5`, "Ayat al-Kursi", any surah name/number) and it recites the exact range with live word highlighting, or ask it tajweed/qira'at questions (madd, qalqalah, noon sakinah, the ten readings…) answered from a hand-checked knowledge base, many with playable demo passages. Recitation is always verified qari audio — never AI-generated.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **Quran text & audio:** Quran.com API v4 + qurancdn.com audio files (with word-level segments)
- **ASR:** browser-native [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) (`ar-SA`) — no server, no API keys
- **Diff:** Arabic-normalized LCS word alignment in `src/lib/diff.ts`
- **Player:** custom `PlayerStore` (`src/lib/playerStore.ts`) + React `useSyncExternalStore` hooks so only the active ayah re-renders on each frame

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No env vars needed.

Recite mode requires a Chromium-based browser (Chrome, Edge, Brave, Arc). Firefox and Safari don't ship Web Speech API; playback and word highlighting still work there.

## Roadmap

- **Phase 1 (current)** — Hafs only. Surah/ayah browser, reciter playback with word highlighting, recite + diff.
- **Phase 2** — Tajweed heuristics (madd duration, waqf compliance, ghunna). Supabase auth + per-user progress.
- **Phase 3** — Multi-Qira'at: Warsh (Nafi'), Qalun (Nafi'), Al-Duri (Abu Amr) text overlays + reciters per Riwayah.
- **Phase 4** — Hifz mode: spaced repetition over ayat/juz, streaks, weakest-ayah surfacing, blind-recite mode.

## SANAD — verification-first grading

Recite-mode feedback is arbitrated by **SANAD** (`src/lib/sanad/`, see [docs/SANAD.md](docs/SANAD.md)): instead of trusting the recognizer's transcript as testimony, every discrepancy is interrogated — Uthmani-rasm spelling variance, tajweed rules (idgham, waqf, qalqalah), recognizer noise, and self-correction repetitions are *dismissed* (and listed, transparently); phonetically-near calls the recognizer can't reliably distinguish (س↔ص, ك↔ق) are marked *uncertain* rather than accused; only confident deviations are asserted as mistakes. Pacing is judged against the **range across five master reciters**, not one reference — every sheikh recites differently, and style lives inside that envelope.

## Word-diff legend

- **Green** — recited correctly (or flag dismissed by SANAD — hover to see why)
- **Sky blue (dotted underline)** — uncertain: recognizer can't judge it; recite again
- **Amber (dotted underline)** — expected word not heard (missed)
- **Red** — wrong word substituted (hover for what the recognizer heard)
- **Strikethrough** — extra word inserted that wasn't in the ayah

The diff strips Arabic diacritics (tashkeel) and normalizes letter forms before matching, so different orthographies of the same word still count as correct.

## Acknowledgements

- [quran.com](https://quran.com) and [qurancdn.com](https://api.qurancdn.com) for the free text + audio APIs with word-level timings
- The reciters whose recordings power the listening side — may Allah accept from them
