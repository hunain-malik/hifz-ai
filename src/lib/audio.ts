import type { Reciter } from "./reciters";

const EVERYAYAH_BASE = "https://everyayah.com/data";

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

export function ayahAudioUrl(
  reciter: Reciter,
  surah: number,
  ayah: number
): string {
  return `${EVERYAYAH_BASE}/${reciter.everyAyahPath}/${pad3(surah)}${pad3(ayah)}.mp3`;
}
