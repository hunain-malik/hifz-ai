import type { Metadata } from "next";
import { fetchChapters } from "@/lib/quran";
import { ChatBot } from "@/components/ChatBot";
import type { ChapterLite } from "@/lib/chatIntent";

export const metadata: Metadata = {
  title: "Recitation Chat — Hifz AI",
  description:
    "Ask the Quran-specialized assistant to recite any surah or ayah range with verified qari audio, or to explain tajweed and qira'at.",
};

export default async function ChatPage() {
  const chapters = await fetchChapters();
  const lite: ChapterLite[] = chapters.map((c) => ({
    id: c.id,
    name: c.name_simple,
    arabicName: c.name_arabic,
    versesCount: c.verses_count,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      <section className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Recitation Chat
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          A Quran-specialized assistant — it knows the mushaf, tajweed, and the
          qira&apos;at, and recites on request using verified recordings of
          certified qaris (never AI-generated audio).
        </p>
      </section>
      <ChatBot chapters={lite} />
    </div>
  );
}
