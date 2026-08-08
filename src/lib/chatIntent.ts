// Natural-language intent parsing for the recitation chatbot.
//
// Deterministic on purpose: recitation requests must resolve to an exact
// surah + ayah range with zero chance of "creative" misreadings, so this is
// a rule-based parser over the live chapter list from Quran.com rather than
// an LLM. Surah names match in English transliteration (any common spelling
// of the article and vowels) or by number, plus a few beloved aliases like
// Ayat al-Kursi.

import { findKbEntry, type KbEntry } from "./tajweedKb";

export type ChapterLite = {
  id: number;
  name: string; // name_simple, e.g. "Al-Mulk"
  arabicName: string;
  versesCount: number;
};

export type ChatIntent =
  | {
      kind: "recite";
      surahId: number;
      from: number;
      to: number;
      clamped: boolean;
    }
  | { kind: "kb"; entry: KbEntry }
  | { kind: "help" }
  | { kind: "greeting" }
  | { kind: "unknown"; hadReciteVerb: boolean };

// ── Normalization ──────────────────────────────────────────────────────

/** Lowercase, strip apostrophes/diacritic marks, collapse long vowels. */
function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[’'ʻʼ`´\-_]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/aa+/g, "a")
    .replace(/ee+/g, "i")
    .replace(/oo+/g, "u")
    .replace(/ii+/g, "i")
    .replace(/uu+/g, "u");
}

// Assimilated-article prefixes, longest first so "ash" wins over "as".
const ARTICLE_PREFIXES = [
  "ash", "adh", "ath", "al", "an", "ar", "as", "at", "az", "ad",
];

function stripArticle(w: string): string {
  for (const p of ARTICLE_PREFIXES) {
    if (w.startsWith(p) && w.length > p.length + 1) {
      return w.slice(p.length);
    }
  }
  return w;
}

/** All match keys a chapter name can be referred to by. */
function nameVariants(name: string): string[] {
  const base = normalizeWord(name);
  const noArticle = stripArticle(base);
  const out = new Set<string>([base, noArticle]);
  // "Fatihah" ↔ "Fatiha", "Baqarah" ↔ "Baqara"
  for (const v of [base, noArticle]) {
    if (v.endsWith("h")) out.add(v.slice(0, -1));
  }
  return [...out].filter((v) => v.length >= 2);
}

// Alternate spellings/titles that normalization alone can't derive.
const EXTRA_ALIASES: Record<string, number> = {
  fatiha: 1, alhamd: 1,
  imran: 3, aliimran: 3, alimran: 3,
  baraah: 9, baraa: 9,
  baniisrail: 17, baniisrael: 17,
  taha: 20,
  yasin: 36, yasen: 36,
  mumin: 40,
  hamim: 41,
  tabarak: 67,
  dahr: 76,
  inshirah: 94, alaminshirah: 94,
  lahab: 111,
};

export function buildSurahIndex(
  chapters: ChapterLite[]
): Map<string, number> {
  const index = new Map<string, number>();
  for (const c of chapters) {
    for (const v of nameVariants(c.name)) {
      // First registration wins so earlier surahs keep short ambiguous keys
      if (!index.has(v)) index.set(v, c.id);
    }
  }
  for (const [alias, id] of Object.entries(EXTRA_ALIASES)) {
    index.set(normalizeWord(alias), id);
  }
  return index;
}

// Words that commonly neighbor surah names and should never themselves
// match as a name (defensive: none currently collide, cheap to keep).
const STOPWORDS = new Set([
  "surah", "sura", "surat", "chapter", "recite", "play", "read", "the",
  "verse", "verses", "ayah", "ayat", "aya", "to", "from", "for", "me",
]);

function findSurahByName(
  tokens: string[],
  index: Map<string, number>
): number | null {
  // Prefer longer joins (trigram > bigram > unigram) so "ali imran" doesn't
  // stop at a bogus unigram match.
  for (const size of [3, 2, 1]) {
    for (let i = 0; i + size <= tokens.length; i++) {
      const slice = tokens.slice(i, i + size);
      if (size === 1 && STOPWORDS.has(slice[0])) continue;
      const joined = normalizeWord(slice.join(""));
      if (joined.length < 2) continue;
      const hit = index.get(joined) ?? index.get(stripArticle(joined));
      if (hit) return hit;
    }
  }
  return null;
}

// ── Main parser ────────────────────────────────────────────────────────

const RECITE_VERB =
  /\b(recite|play|read|listen|tilaw(?:ah?|a)|qir[a']?ah?|hear)\b/i;
const QUESTION_HINT =
  /\b(what|why|how|when|which|who|explain|meaning|difference|tell me about|teach)\b|\?/i;
const GREETING =
  /^\s*(salaam?|salam|assalamu?\s*alaik(?:um)?|as-salamu\s*alaykum|hi|hello|hey|marhaba)\b[\s!.]*$/i;
const HELP = /\b(help|what can you do|commands|how do i use|examples)\b/i;

export function parseChatIntent(
  raw: string,
  chapters: ChapterLite[],
  index: Map<string, number>
): ChatIntent {
  const text = raw.trim();
  if (!text) return { kind: "unknown", hadReciteVerb: false };

  if (GREETING.test(text)) return { kind: "greeting" };
  if (HELP.test(text)) return { kind: "help" };

  const lower = text.toLowerCase();
  const hadReciteVerb = RECITE_VERB.test(text);

  // Ayat al-Kursi — the most-requested single ayah deserves a shortcut.
  if (/kursi/i.test(lower)) {
    return makeRecite(2, 255, 255, chapters);
  }

  // Explicit verse-key form: "67:1-5", "2:255", "recite 18:10 to 18:12"
  const keyMatch = lower.match(
    /\b(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*(?:-|–|—|to|through)\s*(?:\d{1,3}\s*[:.]\s*)?(\d{1,3}))?/
  );
  if (keyMatch) {
    const surahId = Number(keyMatch[1]);
    if (surahId >= 1 && surahId <= 114) {
      const from = Number(keyMatch[2]);
      const to = keyMatch[3] ? Number(keyMatch[3]) : from;
      return makeRecite(surahId, from, to, chapters);
    }
  }

  // A tajweed/qira'at question wins when question words are present, or when
  // no recitation verb was used at all.
  const kbEntry = findKbEntry(lower);
  if (kbEntry && (QUESTION_HINT.test(text) || !hadReciteVerb)) {
    return { kind: "kb", entry: kbEntry };
  }

  // Surah by number: "surah 67", "chapter 36"
  let surahId: number | null = null;
  const numMatch = lower.match(
    /\b(?:surah?|surat|sura|chapter)\s*(?:number\s*)?(\d{1,3})\b/
  );
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (n >= 1 && n <= 114) surahId = n;
  }

  // Surah by name anywhere in the sentence
  if (surahId === null) {
    const tokens = lower.split(/\s+/).filter(Boolean);
    surahId = findSurahByName(tokens, index);
  }

  if (surahId !== null) {
    const chapter = chapters.find((c) => c.id === surahId)!;
    // Verse range: "verses 1-5", "ayah 255", "verse 1 to 5", "first verse"
    const range = lower.match(
      /\b(?:verses?|ayahs?|ayaat|ayat|aya)\s*(\d{1,3})(?:\s*(?:-|–|—|to|through|till|until|and)\s*(\d{1,3}))?/
    );
    if (range) {
      const from = Number(range[1]);
      const to = range[2] ? Number(range[2]) : from;
      return makeRecite(surahId, from, to, chapters);
    }
    // Bare trailing range: "al-mulk 1-5"
    const bare = lower.match(/\b(\d{1,3})\s*(?:-|–|—|to|through)\s*(\d{1,3})\b/);
    if (bare && !numMatch) {
      return makeRecite(surahId, Number(bare[1]), Number(bare[2]), chapters);
    }
    // No range → whole surah
    return makeRecite(surahId, 1, chapter.versesCount, chapters);
  }

  if (kbEntry) return { kind: "kb", entry: kbEntry };

  return { kind: "unknown", hadReciteVerb };
}

function makeRecite(
  surahId: number,
  from: number,
  to: number,
  chapters: ChapterLite[]
): ChatIntent {
  const chapter = chapters.find((c) => c.id === surahId);
  const max = chapter?.versesCount ?? 1;
  let f = Math.max(1, Math.min(from, max));
  let t = Math.max(1, Math.min(to, max));
  if (f > t) [f, t] = [t, f];
  const clamped = f !== from || t !== to;
  return { kind: "recite", surahId, from: f, to: t, clamped };
}
