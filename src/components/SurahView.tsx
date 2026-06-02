"use client";

import { useEffect, useState } from "react";
import { DEFAULT_RECITER_ID, RECITERS, getReciter } from "@/lib/reciters";
import type { Verse } from "@/lib/quran";
import { AyahRow } from "./AyahRow";

const STORAGE_KEY = "hifz-ai.reciter";

export function SurahView({
  surahId,
  verses,
}: {
  surahId: number;
  verses: Verse[];
}) {
  const [reciterId, setReciterId] = useState<string>(DEFAULT_RECITER_ID);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && RECITERS.some((r) => r.id === saved)) {
      setReciterId(saved);
    }
  }, []);

  function chooseReciter(id: string) {
    setReciterId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  const reciter = getReciter(reciterId);

  return (
    <>
      <div className="mb-6 rounded-lg border border-stone-200 dark:border-stone-800 p-3 bg-white dark:bg-stone-900">
        <label
          htmlFor="reciter"
          className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5"
        >
          Reciter
        </label>
        <select
          id="reciter"
          value={reciterId}
          onChange={(e) => chooseReciter(e.target.value)}
          className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm"
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.style !== "murattal" ? ` (${r.style})` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">
          {reciter.arabicName}
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {verses.map((v) => (
          <AyahRow
            key={v.id}
            surahId={surahId}
            verse={v}
            reciter={reciter}
          />
        ))}
      </ol>
    </>
  );
}
