// SANAD · phonetic model of Quranic Arabic.
//
// Every letter is described by its makhraj (articulation place), manner,
// voicing, and emphasis — the same features tajweed teachers use. Distance
// between two letters is a weighted feature difference, so the engine can
// tell a near-miss the recognizer plausibly invented (س↔ص, ك↔ق) from a
// confident deviation the student actually made (س↔ب). Verdicts are graded
// on that continuum instead of a binary equal/not-equal.

export type LetterFeatures = {
  place: number; // 0 bilabial → 9 glottal, following the makharij front-to-back
  manner: "stop" | "fricative" | "affricate" | "nasal" | "lateral" | "tap" | "glide" | "vowel";
  voiced: boolean;
  emphatic: boolean; // isti'la / itbaq (heavy letters)
};

const F = (
  place: number,
  manner: LetterFeatures["manner"],
  voiced: boolean,
  emphatic = false
): LetterFeatures => ({ place, manner, voiced, emphatic });

// Place scale: 0 bilabial · 1 labiodental · 2 interdental · 3 dental/alveolar
// 4 postalveolar · 5 palatal · 6 velar · 7 uvular · 8 pharyngeal · 9 glottal
export const LETTER_FEATURES: Record<string, LetterFeatures> = {
  "ب": F(0, "stop", true),
  "م": F(0, "nasal", true),
  "و": F(0, "glide", true),
  "ف": F(1, "fricative", false),
  "ث": F(2, "fricative", false),
  "ذ": F(2, "fricative", true),
  "ظ": F(2, "fricative", true, true),
  "ت": F(3, "stop", false),
  "د": F(3, "stop", true),
  "ط": F(3, "stop", false, true),
  "ض": F(3, "stop", true, true),
  "ن": F(3, "nasal", true),
  "ر": F(3, "tap", true),
  "ل": F(3, "lateral", true),
  "س": F(3, "fricative", false),
  "ز": F(3, "fricative", true),
  "ص": F(3, "fricative", false, true),
  "ش": F(4, "fricative", false),
  "ج": F(4, "affricate", true),
  "ي": F(5, "glide", true),
  "ك": F(6, "stop", false),
  "ق": F(7, "stop", false),
  "خ": F(7, "fricative", false),
  "غ": F(7, "fricative", true),
  "ح": F(8, "fricative", false),
  "ع": F(8, "fricative", true),
  "ه": F(9, "fricative", false),
  "ء": F(9, "stop", false),
  "ا": F(9, "vowel", true),
  "ة": F(9, "fricative", false), // compares like ه (its waqf pronunciation)
};

const CANON: Record<string, string> = {
  "آ": "ا", "أ": "ء", "إ": "ء", "ٱ": "ا", "ؤ": "ء", "ئ": "ء", "ى": "ي",
};

export function canon(letter: string): string {
  return CANON[letter] ?? letter;
}

const MANNER_NEAR: Record<string, string[]> = {
  stop: ["affricate"],
  affricate: ["stop", "fricative"],
  fricative: ["affricate"],
};

/** 0 = same sound, 1 = maximally different. */
export function letterDistance(a: string, b: string): number {
  const ca = canon(a);
  const cb = canon(b);
  if (ca === cb) return 0;
  const fa = LETTER_FEATURES[ca];
  const fb = LETTER_FEATURES[cb];
  if (!fa || !fb) return 1;
  let d = (Math.abs(fa.place - fb.place) / 9) * 0.45;
  if (fa.manner !== fb.manner) {
    d += MANNER_NEAR[fa.manner]?.includes(fb.manner) ? 0.15 : 0.3;
  }
  if (fa.voiced !== fb.voiced) d += 0.12;
  if (fa.emphatic !== fb.emphatic) d += 0.18;
  return Math.min(1, d);
}

// Weak letters the recognizer inserts/drops freely (madd carriers, hamza,
// glides) cost less to insert/delete than a full consonant.
const WEAK = new Set(["ا", "و", "ي", "ء", "ه"]);
const INDEL_STRONG = 0.7;
const INDEL_WEAK = 0.3;

function indelCost(letter: string): number {
  return WEAK.has(canon(letter)) ? INDEL_WEAK : INDEL_STRONG;
}

/**
 * Phonetic similarity between two words (letters only, marks ignored),
 * 1 = same sounds, 0 = unrelated. Weighted edit distance over the feature
 * space, normalized by the heavier word's total letter weight.
 */
export function wordPhoneticSimilarity(
  expectedLetters: string[],
  actualLetters: string[]
): number {
  const m = expectedLetters.length;
  const n = actualLetters.length;
  if (m === 0 && n === 0) return 1;
  if (m === 0 || n === 0) return 0;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) dp[i][0] = dp[i - 1][0] + indelCost(expectedLetters[i - 1]);
  for (let j = 1; j <= n; j++) dp[0][j] = dp[0][j - 1] + indelCost(actualLetters[j - 1]);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sub = dp[i - 1][j - 1] + letterDistance(expectedLetters[i - 1], actualLetters[j - 1]);
      const del = dp[i - 1][j] + indelCost(expectedLetters[i - 1]);
      const ins = dp[i][j - 1] + indelCost(actualLetters[j - 1]);
      dp[i][j] = Math.min(sub, del, ins);
    }
  }

  const weight = (letters: string[]) =>
    letters.reduce((acc, l) => acc + indelCost(l), 0);
  const denom = Math.max(weight(expectedLetters), weight(actualLetters));
  if (denom === 0) return 1;
  return Math.max(0, 1 - dp[m][n] / denom);
}
