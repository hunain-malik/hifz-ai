// SANAD · rasm normalization.
//
// The Uthmani rasm spells sounds in ways no ASR model reproduces: dagger
// alifs (مَـٰلِكِ), waw-with-dagger for the long ā (ٱلصَّلَوٰةَ), hamzat wasl,
// small silent letters. Diffing the recognizer's standard orthography
// against the rasm letter-for-letter manufactures "mistakes" the student
// never made. This module re-spells BOTH sides into a shared phonetic
// orthography before any comparison, so only genuine sound differences
// survive into grading. Tashkeel is preserved — harakat are gradable
// content, spelling conventions are not.

const TATWEEL = /ـ/g;
const ZERO_WIDTH = /[​-‏﻿]/g;

// Quranic annotation marks (stop signs, small seen, iqlab meem, small
// silent waw/ya, rub el hizb…) are reciter guidance, not phonetic content.
// U+06D6–U+06ED plus the Arabic Extended-A Quranic marks U+08D3–U+08FF.
const QURANIC_ANNOTATIONS = /[ۖ-ۭ࣓-ࣿ]/g;
// Maddah wave + small Quranic vowel marks: elongation guidance the
// recognizer never outputs — judging them from text is a phantom charge.
// (0654/0655 hamza marks are kept — they carry a real phoneme.)
const ELONGATION_MARKS = /[ٖٓ-ٟ]/g;

const DAGGER = "ٰ"; // dagger alif

export function rasmNormalize(input: string): string {
  let s = input
    .replace(ZERO_WIDTH, "")
    .replace(TATWEEL, "")
    .replace(QURANIC_ANNOTATIONS, "")
    .replace(ELONGATION_MARKS, "");

  // Waw/ya written for the long-ā sound (dagger alif riding on them):
  // ٱلصَّلَوٰةَ → الصلاة, ٱلرِّبَوٰا۟ → الربا. The carrier letter IS the alif sound.
  s = s.replace(new RegExp(`[وى]${DAGGER}`, "g"), "ا");

  // Uthmani final dotless yaa: preceded by kasra it IS yaa (فِى = fī) —
  // recognizers write فِي. Only a fatha-context final ى is the ā sound.
  s = s.replace(/ِى/g, "ِي");
  // …and a dotless ى CARRYING its own vowel (يُحْىِ = yuḥyī) is also yaa.
  s = s.replace(/ى(?=[َُِّ])/g, "ي");

  // Alif maqsura at word end sounds as ā; recognizers write either ى or ا.
  s = s.replace(/ى(?=[\sً-ٰ]*(\s|$))/g, "ا");

  // Tanween fath is PRONOUNCED "-an" — recognizers often spell that sound
  // with a literal ن (كبيرن for كَبِيرًا). Canonicalize the fathatan+alif
  // ending to ن on both sides so correct tajweed is never charged.
  s = s.replace(/(?:ًا|اً)(?=\s|$)/g, "َن");

  // Alif madda = hamza + long ā. The rasm often writes it ءَا (ءَامَنُوا۟)
  // while standard orthography writes آ (آمَنُوا) — decompose so both meet.
  s = s.replace(/آ/g, "ءَا");

  // The long-ā vowel itself is unjudgeable from TEXT: the rasm writes it as
  // dagger (رَحْمَـٰن), standard orthography sometimes as full alif (مالك)
  // and sometimes not at all (رحمن) — and the recognizer's spelling follows
  // its language prior, not the student's actual madd length. So fatha+alif
  // and dagger alif are both reduced to the bare fatha on both sides;
  // whether the madd was HELD correctly is the timing ensemble's job.
  s = s.replace(new RegExp(DAGGER, "g"), "");
  s = s.replace(/َا(?![ً-ٰ])/g, "َ");

  // Hamzat wasl (ٱ) carries no hamza of its own; unify with plain alif.
  s = s.replace(/ٱ/g, "ا");

  return s.replace(/\s+/g, " ").trim();
}
