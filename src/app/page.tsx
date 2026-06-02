import Link from "next/link";
import { fetchChapters, pageLabel } from "@/lib/quran";

export default async function Home() {
  const chapters = await fetchChapters();

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Practice. Listen. Recite.
        </h1>
        <p className="text-stone-600 dark:text-stone-400 max-w-2xl">
          Pick any surah, listen to a reciter, and recite into your mic to get
          word-level feedback. Phase 1 is Hafs only — multi-Qira&apos;at and
          tajweed checks come later.
        </p>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3">
          Surahs
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {chapters.map((c) => (
            <li key={c.id}>
              <Link
                href={`/surah/${c.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2.5 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors"
              >
                <span className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800 text-xs font-medium tabular-nums">
                    {c.id}
                  </span>
                  <span className="flex flex-col min-w-0 gap-1">
                    <span className="font-medium leading-tight">
                      {c.name_simple}
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      {c.translated_name.name} · {c.verses_count} verses
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <span
                        className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-medium px-1.5 py-0.5 tabular-nums whitespace-nowrap"
                        title={`Mushaf ${pageLabel(c.pages).toLowerCase()}`}
                      >
                        {pageLabel(c.pages)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md text-[10px] font-medium px-1.5 py-0.5 capitalize whitespace-nowrap ${
                          c.revelation_place === "makkah"
                            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                            : "bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                        }`}
                        title={`Revealed in ${c.revelation_place}`}
                      >
                        {c.revelation_place === "makkah" ? "Makki" : "Madani"}
                      </span>
                    </span>
                  </span>
                </span>
                <span
                  className="arabic shrink-0"
                  style={{ fontSize: "1.5rem", lineHeight: "1" }}
                >
                  {c.name_arabic}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
