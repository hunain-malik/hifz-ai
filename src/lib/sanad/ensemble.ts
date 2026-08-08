// SANAD · sheikh-ensemble pacing envelope.
//
// Every sheikh renders the same ayah differently — different tempo,
// different madd stretch, different breathing. Grading a student against
// ONE reference recording punishes legitimate style. Instead, this module
// pulls per-word segment timings for several canonical murattal reciters
// and builds, for every word of the ayah, the RANGE of relative durations
// the masters actually use. A student is only flagged when they fall
// outside what any of the sheikhs do — style lives inside the envelope,
// mistakes live outside it.

import { fetchSurahAudio } from "../audio";
import type { WordTiming } from "../whisper";

// Murattal reciters used as the reference chain. Mujawwad/muallim styles are
// deliberately excluded — their stretch is pedagogical/performative and would
// widen the envelope into meaninglessness.
const ENSEMBLE_RECITER_IDS = [7, 3, 6, 9, 2]; // Mishary, Sudais, Husary, Minshawi, AbdulBaset

export type WordEnvelope = {
  min: number; // smallest fraction of ayah duration any sheikh gives this word
  max: number;
  mean: number;
};

export type VerseEnvelope = {
  verseKey: string;
  words: WordEnvelope[];
  reciterCount: number;
};

const surahEnvelopeCache = new Map<number, Promise<Map<string, VerseEnvelope>>>();

export function fetchSurahEnvelopes(
  surahId: number
): Promise<Map<string, VerseEnvelope>> {
  let p = surahEnvelopeCache.get(surahId);
  if (!p) {
    p = buildSurahEnvelopes(surahId);
    surahEnvelopeCache.set(surahId, p);
    p.catch(() => surahEnvelopeCache.delete(surahId));
  }
  return p;
}

async function buildSurahEnvelopes(
  surahId: number
): Promise<Map<string, VerseEnvelope>> {
  const settled = await Promise.allSettled(
    ENSEMBLE_RECITER_IDS.map((id) => fetchSurahAudio(id, surahId))
  );
  const reciters = settled
    .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchSurahAudio>>> => s.status === "fulfilled")
    .map((s) => s.value);

  const out = new Map<string, VerseEnvelope>();
  if (reciters.length < 3) return out; // too thin a chain to define a range

  // verse_key → per-reciter word-duration fractions
  const byVerse = new Map<string, number[][]>();
  for (const r of reciters) {
    for (const t of r.verseTimings) {
      if (t.segments.length === 0) continue;
      const verseDur = t.timestamp_to - t.timestamp_from;
      if (verseDur <= 0) continue;
      const fractions = t.segments.map(
        ([, startMs, endMs]) => Math.max(0, endMs - startMs) / verseDur
      );
      if (!byVerse.has(t.verse_key)) byVerse.set(t.verse_key, []);
      byVerse.get(t.verse_key)!.push(fractions);
    }
  }

  for (const [verseKey, perReciter] of byVerse) {
    // Only aggregate across reciters that agree on the word count (they
    // should — the segments come from the same Hafs text).
    const countTally = new Map<number, number>();
    for (const f of perReciter) {
      countTally.set(f.length, (countTally.get(f.length) ?? 0) + 1);
    }
    let modeCount = 0;
    let modeVotes = 0;
    for (const [len, votes] of countTally) {
      if (votes > modeVotes) {
        modeCount = len;
        modeVotes = votes;
      }
    }
    const usable = perReciter.filter((f) => f.length === modeCount);
    if (usable.length < 3 || modeCount === 0) continue;

    const words: WordEnvelope[] = [];
    for (let i = 0; i < modeCount; i++) {
      const vals = usable.map((f) => f[i]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      words.push({ min, max, mean });
    }
    out.set(verseKey, { verseKey, words, reciterCount: usable.length });
  }
  return out;
}

// ── Judging a student against the envelope ─────────────────────────────

export type PacingFlag = {
  wordIdx: number; // 0-based
  kind: "rushed" | "stretched";
  userFraction: number;
  envelope: WordEnvelope;
};

export type PacingVerdict = {
  flags: PacingFlag[];
  wordsJudged: number;
  reciterCount: number;
};

// The envelope captures the masters' range; students get grace beyond it
// before being flagged, since mic VAD and word-boundary jitter eat into
// user timings in ways studio recordings don't suffer.
const RUSH_GRACE = 0.55; // flag only below min × 0.55
const STRETCH_GRACE = 1.9; // flag only above max × 1.9

export function judgePacing(
  userWords: WordTiming[],
  envelope: VerseEnvelope
): PacingVerdict | null {
  // Only judge when the user's word count matches the reference — otherwise
  // the index alignment is fiction.
  if (userWords.length !== envelope.words.length) return null;
  const total = userWords.reduce((acc, w) => acc + (w.end - w.start), 0);
  if (total <= 0) return null;

  const flags: PacingFlag[] = [];
  for (let i = 0; i < userWords.length; i++) {
    const frac = (userWords[i].end - userWords[i].start) / total;
    const env = envelope.words[i];
    if (frac < env.min * RUSH_GRACE) {
      flags.push({ wordIdx: i, kind: "rushed", userFraction: frac, envelope: env });
    } else if (frac > env.max * STRETCH_GRACE) {
      flags.push({ wordIdx: i, kind: "stretched", userFraction: frac, envelope: env });
    }
  }
  return {
    flags,
    wordsJudged: userWords.length,
    reciterCount: envelope.reciterCount,
  };
}
