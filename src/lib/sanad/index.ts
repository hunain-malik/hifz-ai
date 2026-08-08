// SANAD (سند) — verification-first recitation grading.
// See docs/SANAD.md for the architecture and roadmap.

export { judgeRecitation } from "./verdict";
export type { SanadReport, SanadTier, SanadWordVerdict } from "./verdict";
export { rasmNormalize } from "./rasm";
export { letterDistance, wordPhoneticSimilarity } from "./phonetics";
export { fetchSurahEnvelopes, judgePacing } from "./ensemble";
export type { PacingVerdict, VerseEnvelope } from "./ensemble";
