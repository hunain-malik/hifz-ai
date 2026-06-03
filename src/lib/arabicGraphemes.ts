// Arabic grapheme parsing + letter/diacritic comparison for actionable
// recitation feedback (e.g. "missing tanween", "damma instead of fatha",
// "wrong letter ث vs س"). Compares ASR output to the expected Uthmani text
// at character level, not word level.

export type Grapheme = {
  letter: string;
  marks: string[];
  raw: string;
};

const ZERO_WIDTH = /[​-‏﻿]/g;
const TATWEEL = /ـ/g;

const MARK_RANGES: [number, number][] = [
  [0x064b, 0x065f], // standard tashkeel + tanween + sukun + dagger alif neighbors
  [0x0670, 0x0670], // dagger alif
  [0x06d6, 0x06ed], // quran-specific signs (small high marks, ruku' signs)
];

function isMark(ch: string): boolean {
  if (!ch) return false;
  const code = ch.codePointAt(0)!;
  for (const [lo, hi] of MARK_RANGES) {
    if (code >= lo && code <= hi) return true;
  }
  return false;
}

/** Strip everything that isn't a letter or recognized diacritic. */
function clean(s: string): string {
  return s.replace(ZERO_WIDTH, "").replace(TATWEEL, "");
}

/** Split a string into graphemes. Each grapheme = 1 base letter + any
 *  diacritics that follow it (until the next base letter or whitespace).
 *  Whitespace becomes its own "word boundary" grapheme with letter=" ". */
export function parseGraphemes(input: string): Grapheme[] {
  const s = clean(input);
  const out: Grapheme[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      out.push({ letter: " ", marks: [], raw: " " });
      i++;
      continue;
    }
    if (isMark(ch)) {
      // Orphan mark with no preceding letter — skip
      i++;
      continue;
    }
    const letter = ch;
    const marks: string[] = [];
    let j = i + 1;
    while (j < s.length && isMark(s[j])) {
      marks.push(s[j]);
      j++;
    }
    out.push({ letter, marks, raw: letter + marks.join("") });
    i = j;
  }
  return out;
}

// Normalize equivalent letter forms (alif variants, ya/alif maqsura, ta marbuta/ha)
const LETTER_EQUIV: Record<string, string> = {
  "آ": "ا", // آ → ا
  "أ": "ا", // أ → ا
  "إ": "ا", // إ → ا
  "ٱ": "ا", // ٱ → ا
  "ى": "ي", // ى → ي
  "ؤ": "و", // ؤ → و
  "ئ": "ي", // ئ → ي
};

function canonicalLetter(letter: string): string {
  return LETTER_EQUIV[letter] ?? letter;
}

// ── Mark naming for human-readable feedback ─────────────────────────────
const MARK_NAME: Record<string, string> = {
  "َ": "fatha",
  "ُ": "damma",
  "ِ": "kasra",
  "ْ": "sukun",
  "ّ": "shadda",
  "ً": "fathatan",
  "ٌ": "dammatan",
  "ٍ": "kasratan",
  "ٰ": "dagger-alif",
};

const MARK_ENGLISH: Record<string, string> = {
  "َ": "fatha (◌َ — short 'a')",
  "ُ": "damma (◌ُ — short 'u')",
  "ِ": "kasra (◌ِ — short 'i')",
  "ْ": "sukun (◌ْ — no vowel)",
  "ّ": "shadda (◌ّ — doubled letter)",
  "ً": "tanween fath (◌ً — 'an' ending)",
  "ٌ": "tanween damm (◌ٌ — 'un' ending)",
  "ٍ": "tanween kasr (◌ٍ — 'in' ending)",
  "ٰ": "dagger alif (long 'aa')",
};

function describeMark(mark: string): string {
  return MARK_ENGLISH[mark] ?? `mark (${mark.codePointAt(0)?.toString(16)})`;
}

function describeMarkShort(mark: string): string {
  return MARK_NAME[mark] ?? mark;
}

// ── Letter-confusion table (Stage 5 seed) ───────────────────────────────
// Common substitutions when Arabic phonemes don't exist in the speaker's L1.
const LETTER_TIPS: Record<string, string> = {
  "س->ث":
    "siin (س) → thaa (ث): touch the tip of your tongue between your front teeth.",
  "ث->س":
    "thaa (ث) → siin (س): you held it like /s/, but ث needs the tongue between the teeth.",
  "ه->ح":
    "haa (ه) → ḥaa (ح): ح is deeper in the throat, breathy but not pharyngeal.",
  "ح->ه":
    "ḥaa (ح) → haa (ه): pull the air from your upper throat, not your mouth.",
  "أ->ع":
    "hamza (ء) → ʿayn (ع): ع comes from the middle of the throat, hamza is just a glottal stop.",
  "ع->أ":
    "ʿayn (ع) → hamza (ء): you flattened ع. Constrict the middle of the throat.",
  "ك->ق":
    "kaaf (ك) → qaaf (ق): ق is much deeper — back of the tongue against the uvula.",
  "ق->ك":
    "qaaf (ق) → kaaf (ك): you said it forward; ق is pulled all the way back.",
  "د->ض":
    "daal (د) → ḍaad (ض): ض is heavy/emphatic. Tongue covers more roof of mouth.",
  "ض->د":
    "ḍaad (ض) → daal (د): you lost the emphasis. ض needs the tongue to spread heavy.",
  "ت->ط":
    "taa (ت) → ṭaa (ط): ط is the emphatic version. Tongue tip + lots of weight.",
  "ط->ت":
    "ṭaa (ط) → taa (ت): you said the light version. ط is heavy.",
  "ز->ظ":
    "zaay (ز) → ẓaa (ظ): ظ is emphatic and uses 'th' shape (between teeth).",
  "ظ->ز":
    "ẓaa (ظ) → zaay (ز): tongue should be between teeth, voiced and heavy.",
};

function letterPair(expected: string, actual: string): string | null {
  const key = `${expected}->${actual}`;
  return LETTER_TIPS[key] ?? null;
}

// ── Letter-level diff ──────────────────────────────────────────────────

export type LetterDiffStatus =
  | "correct"
  | "wrong-letter"
  | "wrong-marks"
  | "missing"
  | "extra";

export type LetterDiffToken = {
  expected: Grapheme | null;
  actual: Grapheme | null;
  status: LetterDiffStatus;
  feedback?: string;
  tip?: string;
};

export function diffGraphemes(
  expectedRaw: string,
  actualRaw: string
): LetterDiffToken[] {
  const expected = parseGraphemes(expectedRaw).filter((g) => g.letter !== " ");
  const actual = parseGraphemes(actualRaw).filter((g) => g.letter !== " ");
  const m = expected.length;
  const n = actual.length;

  // LCS by canonical-letter equality (ignore marks for alignment; rate them later)
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const eq =
        canonicalLetter(expected[i - 1].letter) ===
        canonicalLetter(actual[j - 1].letter);
      dp[i][j] = eq
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const out: LetterDiffToken[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const eLet = canonicalLetter(expected[i - 1].letter);
    const aLet = canonicalLetter(actual[j - 1].letter);
    if (eLet === aLet) {
      const e = expected[i - 1];
      const a = actual[j - 1];
      const marksMatch = sameMarks(e.marks, a.marks);
      if (marksMatch) {
        out.push({ expected: e, actual: a, status: "correct" });
      } else {
        out.push({
          expected: e,
          actual: a,
          status: "wrong-marks",
          feedback: describeMarkDifference(e, a),
        });
      }
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.push({ expected: expected[i - 1], actual: null, status: "missing" });
      i--;
    } else {
      out.push({ expected: null, actual: actual[j - 1], status: "extra" });
      j--;
    }
  }
  while (i > 0) {
    out.push({ expected: expected[i - 1], actual: null, status: "missing" });
    i--;
  }
  while (j > 0) {
    out.push({ expected: null, actual: actual[j - 1], status: "extra" });
    j--;
  }
  out.reverse();
  return collapseAdjacentToWrongLetter(out);
}

function sameMarks(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return aSorted.every((m, i) => m === bSorted[i]);
}

/** When a missing immediately precedes/follows an extra, treat it as a
 *  wrong-letter substitution. Lets us produce concrete "siin → thaa" tips. */
function collapseAdjacentToWrongLetter(
  tokens: LetterDiffToken[]
): LetterDiffToken[] {
  const out: LetterDiffToken[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const cur = tokens[k];
    const next = tokens[k + 1];
    if (
      next &&
      ((cur.status === "missing" && next.status === "extra") ||
        (cur.status === "extra" && next.status === "missing"))
    ) {
      const expected = cur.status === "missing" ? cur.expected : next.expected;
      const actual = cur.status === "extra" ? cur.actual : next.actual;
      if (expected && actual) {
        const tip =
          letterPair(expected.letter, actual.letter) ?? undefined;
        out.push({
          expected,
          actual,
          status: "wrong-letter",
          feedback: `You said ${actual.letter} (${labelLetter(actual.letter)}), should be ${expected.letter} (${labelLetter(expected.letter)})`,
          tip,
        });
        k++;
        continue;
      }
    }
    out.push(cur);
  }
  return out;
}

function describeMarkDifference(expected: Grapheme, actual: Grapheme): string {
  const eMarks = new Set(expected.marks);
  const aMarks = new Set(actual.marks);
  const missing = [...eMarks].filter((m) => !aMarks.has(m));
  const extra = [...aMarks].filter((m) => !eMarks.has(m));

  // Common case: one short vowel swap (fatha vs damma, etc.)
  if (missing.length === 1 && extra.length === 1) {
    const want = missing[0];
    const said = extra[0];
    return `Said ${describeMarkShort(said)}, should be ${describeMarkShort(want)} — ${describeMark(want)}`;
  }
  if (missing.length === 0 && extra.length > 0) {
    return `Added ${extra.map(describeMarkShort).join(" + ")} where there shouldn't be one`;
  }
  if (extra.length === 0 && missing.length > 0) {
    return `Missing ${missing.map((m) => `${describeMarkShort(m)} (${describeMark(m)})`).join(" + ")}`;
  }
  return `Marks differ: expected ${expected.marks.map(describeMarkShort).join(",")}, said ${actual.marks.map(describeMarkShort).join(",")}`;
}

/** Letter naming. */
const LETTER_LABEL: Record<string, string> = {
  "ا": "alif",
  "ب": "baa",
  "ت": "taa",
  "ث": "thaa",
  "ج": "jeem",
  "ح": "ḥaa",
  "خ": "khaa",
  "د": "daal",
  "ذ": "dhaal",
  "ر": "raa",
  "ز": "zaay",
  "س": "siin",
  "ش": "shiin",
  "ص": "ṣaad",
  "ض": "ḍaad",
  "ط": "ṭaa",
  "ظ": "ẓaa",
  "ع": "ʿayn",
  "غ": "ghayn",
  "ف": "faa",
  "ق": "qaaf",
  "ك": "kaaf",
  "ل": "laam",
  "م": "meem",
  "ن": "nuun",
  "ه": "haa",
  "و": "waaw",
  "ي": "yaa",
  "ة": "taa marbuta",
  "ء": "hamza",
};

function labelLetter(ch: string): string {
  return LETTER_LABEL[ch] ?? ch;
}

/** Generate compact summary lines for the Feedback panel — one bullet per
 *  meaningful error. Skips correct graphemes. */
export function summarizeLetterDiff(
  tokens: LetterDiffToken[],
  opts?: { limit?: number }
): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (t.status === "correct") continue;
    if (t.status === "wrong-marks" && t.feedback && t.expected) {
      out.push(`• ${t.expected.raw}: ${t.feedback}`);
    } else if (t.status === "wrong-letter" && t.feedback) {
      out.push(`• ${t.feedback}${t.tip ? ` — ${t.tip}` : ""}`);
    } else if (t.status === "missing" && t.expected) {
      out.push(
        `• Missed ${t.expected.letter} (${labelLetter(t.expected.letter)})`
      );
    } else if (t.status === "extra" && t.actual) {
      out.push(
        `• Added ${t.actual.letter} (${labelLetter(t.actual.letter)}) that isn't there`
      );
    }
    if (opts?.limit && out.length >= opts.limit) {
      out.push("• …more");
      break;
    }
  }
  return out;
}

export function letterAccuracy(tokens: LetterDiffToken[]): number {
  if (tokens.length === 0) return 0;
  const denom = tokens.filter((t) => t.status !== "extra").length;
  if (denom === 0) return 0;
  const correct = tokens.filter((t) => t.status === "correct").length;
  return Math.round((correct / denom) * 100);
}
