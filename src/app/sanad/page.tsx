import type { Metadata } from "next";
import { fetchChapters } from "@/lib/quran";
import { SanadConsole } from "@/components/SanadConsole";
import type { ChapterLite } from "@/lib/chatIntent";

export const metadata: Metadata = {
  title: "SANAD — voice recitation assistant",
  description:
    "Say “Hey Sanad” and ask for any surah or ayah range — SANAD answers aloud and recites with live word highlighting.",
};

export default async function SanadPage() {
  const chapters = await fetchChapters();
  const lite: ChapterLite[] = chapters.map((c) => ({
    id: c.id,
    name: c.name_simple,
    arabicName: c.name_arabic,
    versesCount: c.verses_count,
  }));
  return <SanadConsole chapters={lite} />;
}
