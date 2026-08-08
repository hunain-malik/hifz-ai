// SANAD · verification-first grading.
//
// The engine knows exactly what the student was supposed to say, so instead
// of trusting the recognizer's transcript as testimony, every discrepancy is
// interrogated: Was this the Uthmani rasm misleading the diff? A sound the
// recognizer plausibly invented? A repetition while self-correcting? Only
// what survives interrogation is asserted as a mistake — everything else is
// dismissed (with the reason shown) or marked uncertain. A tutor that is
// sometimes silent is useful; one that invents mistakes is not.

import { diffRecitation, tokenize } from "../diff";
import {
  diffGraphemes,
  parseGraphemes,
  summarizeLetterDiff,
  type LetterDiffToken,
} from "../arabicGraphemes";
import { rasmNormalize } from "./rasm";
import { canon, wordPhoneticSimilarity } from "./phonetics";

export type SanadTier =
  | "match" // recited exactly
  | "accepted" // discrepancy dismissed — rasm/recognizer/waqf variance
  | "uncertain" // recognizer can't distinguish reliably; do not accuse
  | "mistake-likely" // specific, small deviation — flag with humility
  | "mistake"; // confident deviation

export type SanadWordVerdict = {
  expectedWordIdx: number; // 0-based index into the expected (Arabic) words
  expected: string; // rasm-normalized expected word
  heard: string | null; // what the recognizer aligned here (null = nothing)
  tier: SanadTier;
  reason?: string; // human-readable justification for non-match tiers
  issues: string[]; // letter/harakah detail for mistake tiers
  similarity: number; // phonetic similarity 0..1 (1 for match/missing n/a)
};

export type SanadReport = {
  words: SanadWordVerdict[];
  extras: { text: string; dismissedAsRepetition: boolean }[];
  score: number; // 0-100: verified accuracy counting only what's confirmed
  dismissed: { word: string; reason: string }[];
  uncertain: { word: string; reason: string }[];
  issues: string[]; // confirmed/likely problems, human-readable
  /** True when word verdicts can be mapped 1:1 onto the displayed words. */
  alignedToDisplay: boolean;
};

// Below this many letters, a missed word is more often recognizer VAD
// clipping than an actual skip.
const SHORT_WORD_LETTERS = 2;

const NEAR_SIM = 0.8;
const LIKELY_SIM = 0.55;

function lettersOf(word: string): string[] {
  return parseGraphemes(word)
    .filter((g) => g.letter !== " ")
    .map((g) => canon(g.letter));
}

const PHONETIC_MARKS = /[ً-ٰ]/;

function hasPhoneticMarks(word: string): boolean {
  return PHONETIC_MARKS.test(word);
}

function marksOnlyProblem(tokens: LetterDiffToken[]): boolean {
  return (
    tokens.length > 0 &&
    tokens.every((t) => t.status === "correct" || t.status === "wrong-marks")
  );
}

export function judgeRecitation(
  expectedRaw: string,
  transcript: string
): SanadReport {
  const expectedNorm = rasmNormalize(expectedRaw);
  const actualNorm = rasmNormalize(transcript);

  // Word-level alignment on rasm-normalized text. tokenize() strips tashkeel
  // for alignment; the per-word grapheme diff below re-examines marks.
  const expectedWords = expectedNorm.split(/\s+/).filter(Boolean);
  const actualWords = actualNorm.split(/\s+/).filter(Boolean);
  const alignTokens = diffRecitation(expectedNorm, actualNorm);

  // Map normalized-token positions back to the raw word strings (tashkeel
  // intact) so mark-level grading sees the harakat.
  const expectedTokenCount = tokenize(expectedNorm).length;
  const alignedToDisplay = expectedTokenCount === expectedWords.length;

  const words: SanadWordVerdict[] = [];
  const extras: SanadReport["extras"] = [];
  let eIdx = 0;
  let aIdx = 0;

  for (const t of alignTokens) {
    if (t.status === "correct" || t.status === "wrong") {
      // Even a word whose letters matched still gets its harakat examined —
      // the word aligner strips tashkeel, the grapheme diff restores it.
      const expWord = expectedWords[eIdx] ?? t.expected ?? "";
      const actWord = actualWords[aIdx] ?? t.actual ?? "";
      words.push(
        judgeWordPair(eIdx, expWord, actWord, t.status === "correct")
      );
      eIdx++;
      aIdx++;
      continue;
    }
    if (t.status === "missed") {
      const expWord = expectedWords[eIdx] ?? t.expected ?? "";
      const letters = lettersOf(expWord);
      if (letters.length <= SHORT_WORD_LETTERS) {
        words.push({
          expectedWordIdx: eIdx,
          expected: expWord,
          heard: null,
          tier: "uncertain",
          reason:
            "Short word not heard — the recognizer often clips short words; recite again to confirm",
          issues: [],
          similarity: 0,
        });
      } else {
        words.push({
          expectedWordIdx: eIdx,
          expected: expWord,
          heard: null,
          tier: "mistake",
          reason: "Word skipped",
          issues: [`• Missed the word ${expWord}`],
          similarity: 0,
        });
      }
      eIdx++;
      continue;
    }
    // extra
    const actWord = actualWords[aIdx] ?? t.actual ?? "";
    const prevExpected = expectedWords[eIdx - 1];
    const nextExpected = expectedWords[eIdx];
    const bare = (w: string | undefined) =>
      w ? tokenize(w).join("") : "";
    const isRepetition =
      bare(actWord) !== "" &&
      (bare(actWord) === bare(prevExpected) || bare(actWord) === bare(nextExpected));
    extras.push({ text: actWord, dismissedAsRepetition: isRepetition });
    aIdx++;
  }

  // ── Aggregate ──
  const dismissed: SanadReport["dismissed"] = [];
  const uncertain: SanadReport["uncertain"] = [];
  const issues: string[] = [];
  let credit = 0;

  for (const w of words) {
    switch (w.tier) {
      case "match":
        credit += 1;
        break;
      case "accepted":
        credit += 1;
        dismissed.push({ word: w.expected, reason: w.reason ?? "" });
        break;
      case "uncertain":
        credit += 0.5;
        uncertain.push({ word: w.expected, reason: w.reason ?? "" });
        break;
      case "mistake-likely":
        credit += 0.25;
        issues.push(...w.issues);
        break;
      case "mistake":
        issues.push(...w.issues);
        break;
    }
  }
  for (const ex of extras) {
    if (!ex.dismissedAsRepetition) {
      issues.push(`• Added ${ex.text} — not part of this ayah`);
    }
  }

  const score =
    words.length === 0 ? 0 : Math.round((credit / words.length) * 100);

  return { words, extras, score, dismissed, uncertain, issues, alignedToDisplay };
}

function judgeWordPair(
  eIdx: number,
  expWord: string,
  actWord: string,
  wordLevelMatched: boolean
): SanadWordVerdict {
  const letterTokens = diffGraphemes(expWord, actWord);
  const expLetters = lettersOf(expWord);
  const actLetters = lettersOf(actWord);
  const sim = wordPhoneticSimilarity(expLetters, actLetters);

  // Every letter and mark accounted for (after rasm + tajweed tolerance).
  if (letterTokens.every((t) => t.status === "correct")) {
    if (wordLevelMatched) {
      return {
        expectedWordIdx: eIdx,
        expected: expWord,
        heard: actWord,
        tier: "match",
        issues: [],
        similarity: 1,
      };
    }
    return {
      expectedWordIdx: eIdx,
      expected: expWord,
      heard: actWord,
      tier: "accepted",
      reason:
        "Spelling/recitation variance covered by rasm and tajweed rules — not a mistake",
      issues: [],
      similarity: sim,
    };
  }

  if (marksOnlyProblem(letterTokens)) {
    // A transcript with no tashkeel at all is the recognizer declining to
    // vocalize, not the student mis-vocalizing — never grade harakat off it.
    if (!hasPhoneticMarks(actWord)) {
      return {
        expectedWordIdx: eIdx,
        expected: expWord,
        heard: actWord,
        tier: "accepted",
        reason: "Recognizer omitted vowel marks — harakat not judged",
        issues: [],
        similarity: sim,
      };
    }
    return {
      expectedWordIdx: eIdx,
      expected: expWord,
      heard: actWord,
      tier: "mistake-likely",
      reason: "Letters right, harakah differs — check the vowels",
      issues: summarizeLetterDiff(letterTokens, { limit: 3 }).map(
        (s) => `${s} (in ${expWord})`
      ),
      similarity: sim,
    };
  }

  if (sim >= NEAR_SIM) {
    return {
      expectedWordIdx: eIdx,
      expected: expWord,
      heard: actWord,
      tier: "uncertain",
      reason: `Heard "${actWord}" — acoustically too close to "${expWord}" for the recognizer to judge; recite again to confirm`,
      issues: [],
      similarity: sim,
    };
  }

  const tier: SanadTier = sim >= LIKELY_SIM ? "mistake-likely" : "mistake";
  return {
    expectedWordIdx: eIdx,
    expected: expWord,
    heard: actWord,
    tier,
    reason: `Heard "${actWord}" instead of "${expWord}"`,
    issues: summarizeLetterDiff(letterTokens, { limit: 3 }).map(
      (s) => `${s} (in ${expWord})`
    ),
    similarity: sim,
  };
}
