# SANAD (سند) — the verification-first recitation engine

**Sanad**: the unbroken chain of transmission through which the Quran's sound
reaches us. This engine grades a student the way the chain does — by
*verifying* their recitation against what is known, never by trusting a
transcription as testimony.

## Why not transcribe-then-diff?

The v0 pipeline was: ASR → transcript → text diff vs the Uthmani mushaf.
Two structural flaws:

1. **The rasm is not phonetic spelling.** The Uthmani text writes مَـٰلِكِ
   (dagger alif), ٱلصَّلَوٰةَ (waw carrying the long ā), hamzat wasl, small
   silent letters. Recognizers output standard orthography. A letter-level
   diff between the two manufactures mistakes the student never made.
2. **A transcript is a lossy verdict.** By the time audio has been collapsed
   to text, every recognizer ambiguity has been silently resolved — and the
   diff then presents that guess as fact against the student.

SANAD inverts the direction: **we already know exactly what the student was
supposed to say.** The engine's job is not "what did I hear?" but "does the
evidence support a deviation from the known target — and how confident am I?"

## Architecture (Phase A — implemented, in-browser)

```
audio ──► Quran-fine-tuned Whisper (Tarteel) ──► transcript
                                                    │
        expected ayah (Uthmani) ──► rasm normalizer ┤  shared phonetic
        transcript ─────────────► rasm normalizer ──┤  orthography
                                                    ▼
                                          word alignment (LCS)
                                                    │
                              per-word interrogation of every flag
                              │  rasm/orthography variance?  → dismissed
                              │  tajweed rule (idgham, waqf…)?→ dismissed
                              │  repetition self-correction?  → dismissed
                              │  no tashkeel in ASR output?   → not judged
                              │  phonetically near (س↔ص,ك↔ق)? → UNCERTAIN
                              │  short word dropped by VAD?   → UNCERTAIN
                              │  confident deviation?         → MISTAKE
                                                    ▼
             tiered verdicts: match / accepted / uncertain / likely / mistake
                                                    +
        sheikh-ensemble pacing: per-word duration envelope across 5 masters
```

Key components (`src/lib/sanad/`):

- **`rasm.ts`** — re-spells both sides into a shared phonetic orthography.
  Dagger alifs, waw-as-ā, hamzat wasl, alif madda decomposition, Quranic
  annotation marks. The long-ā vowel is deliberately reduced on *both* sides:
  the recognizer's spelling of madd follows its language prior, not the
  student's held duration — so madd length is delegated to timing, where it
  actually lives.
- **`phonetics.ts`** — every letter described by makhraj (place), manner,
  voicing, and emphasis; distance between letters is a weighted feature
  difference. This is what lets the engine say "س for ص is a near-miss the
  recognizer plausibly invented" vs "س for ب is a real deviation."
- **`verdict.ts`** — the interrogation loop producing tiered verdicts and a
  transparent report: what was dismissed (and why), what is uncertain, what
  is confirmed. Scoring counts only what survives interrogation.
- **`ensemble.ts`** — *every sheikh recites differently.* Per-word duration
  fractions are collected across five canonical murattal reciters
  (Mishary, Sudais, Husary, Minshawi, AbdulBaset) to form an envelope of
  what the masters actually do. Students are flagged only outside that
  envelope, with generous grace — style lives inside the range, mistakes
  outside it.

### The grading stance

A tutor that is sometimes silent is useful; one that invents mistakes is
not. SANAD never asserts anything it cannot defend:

| Tier | Meaning | Score credit |
|---|---|---|
| `match` | recited exactly | 1.0 |
| `accepted` | flag dismissed — rasm/recognizer/tajweed/waqf variance | 1.0 |
| `uncertain` | recognizer cannot distinguish; student asked to re-recite | 0.5 |
| `mistake-likely` | small specific deviation (e.g. harakah) | 0.25 |
| `mistake` | confident deviation (skipped/substituted word) | 0 |

## Roadmap

- **Phase B — forced alignment & GOP.** Replace open-vocabulary decoding
  with constrained decoding/forced alignment against the known ayah using a
  phoneme-level CTC model (e.g. wav2vec2 fine-tuned on Quranic phonemes).
  Per-phoneme Goodness-of-Pronunciation scores replace text diffing
  entirely: the model outputs "how well did this segment match the expected
  phoneme," which is the question we actually have. This is the single
  biggest accuracy unlock and the point where SANAD stops depending on any
  transcription at all.
- **Phase C — tajweed classifiers.** Dedicated acoustic heads on top of the
  aligned segments: madd duration regression (2/4/6 counts against the
  student's own tempo), ghunna nasality detection (nasal-band energy over
  noon/meem segments), qalqalah burst detection at stops. Each rule graded
  by a model built for that rule — sheikh-level specificity comes from
  specialists, not one generalist.
- **Phase D — the chain, widened.** Multi-riwayah acceptance (Hafs, Warsh,
  Qalun — a deviation in one riwayah may be canon in another), per-sheikh
  style profiles so pacing feedback can say "you're closest to Husary's
  tarteel," and the SANAD API extracted as the grading backend for Hifz.ai
  proper.

## Honest limits of Phase A

- Letter verdicts still ride on Whisper's transcript; Phase A makes its
  *interpretation* honest, but only Phase B removes the dependency.
- The `uncertain` tier is a feature, not an evasion: with text-level
  evidence alone, س/ص-class distinctions genuinely cannot be judged. They
  are surfaced to the student instead of being guessed either way.
- Ensemble pacing needs real word timings from the recognizer; when the
  ONNX build can't produce them, pacing is skipped rather than faked.
