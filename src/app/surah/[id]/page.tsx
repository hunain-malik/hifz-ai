import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchChapter, fetchVerses } from "@/lib/quran";
import { SurahView } from "@/components/SurahView";

export default async function SurahPage(props: PageProps<"/surah/[id]">) {
  const { id } = await props.params;
  const surahId = Number(id);
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) {
    notFound();
  }

  const [chapter, verses] = await Promise.all([
    fetchChapter(surahId),
    fetchVerses(surahId),
  ]);

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-stone-500 dark:text-stone-400 hover:underline"
      >
        ← All surahs
      </Link>
      <header className="mt-3 mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Surah {chapter.id}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {chapter.name_simple}{" "}
            <span className="text-stone-400 font-normal">
              · {chapter.translated_name.name}
            </span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {chapter.verses_count} verses · revealed in {chapter.revelation_place}
          </p>
        </div>
        <span className="arabic" style={{ fontSize: "2rem", lineHeight: "1" }}>
          {chapter.name_arabic}
        </span>
      </header>

      <SurahView surahId={surahId} verses={verses} />
    </div>
  );
}
