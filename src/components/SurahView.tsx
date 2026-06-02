"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_RECITER_ID, RECITERS, getReciter } from "@/lib/reciters";
import type { Verse } from "@/lib/quran";
import { AyahRow } from "./AyahRow";
import { PageDivider } from "./PageDivider";
import { ScrollPageIndicator } from "./ScrollPageIndicator";
import {
  PlayerProvider,
  useActiveVerseKey,
  useIsPlaying,
  usePlayer,
} from "./PlayerProvider";

export type ReciteRegistry = {
  register: (verseNumber: number, startRecite: () => void) => () => void;
  advanceFrom: (verseNumber: number) => void;
};

const STORAGE_KEY = "hifz-ai.reciter";

export function SurahView({
  surahId,
  verses,
}: {
  surahId: number;
  verses: Verse[];
}) {
  const [reciterId, setReciterId] = useState<number>(DEFAULT_RECITER_ID);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? Number(saved) : NaN;
    if (Number.isFinite(parsed) && RECITERS.some((r) => r.id === parsed)) {
      setReciterId(parsed);
    }
  }, []);

  function chooseReciter(id: number) {
    setReciterId(id);
    window.localStorage.setItem(STORAGE_KEY, String(id));
  }

  const reciter = getReciter(reciterId);
  const reciteRegistryRef = useRef(new Map<number, () => void>());
  const lastVerseNumber = verses[verses.length - 1]?.verse_number ?? 0;

  const registry: ReciteRegistry = {
    register: useCallback((verseNumber: number, startRecite: () => void) => {
      reciteRegistryRef.current.set(verseNumber, startRecite);
      return () => {
        reciteRegistryRef.current.delete(verseNumber);
      };
    }, []),
    advanceFrom: useCallback((verseNumber: number) => {
      const next = verseNumber + 1;
      const start = reciteRegistryRef.current.get(next);
      if (!start) return;
      const verseKey = `${surahId}:${next}`;
      const el = document.getElementById(`ayah-${verseKey}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(start, 350);
    }, [surahId]),
  };

  return (
    <PlayerProvider reciterId={reciter.id} surahId={surahId}>
      <ControlsBar reciterId={reciterId} onReciter={chooseReciter} />
      <ScrollPageIndicator verses={verses} />
      <ol className="flex flex-col gap-3">
        {verses.map((v, i) => {
          const prevPage = verses[i - 1]?.page_number;
          const showDivider =
            prevPage !== undefined && v.page_number !== prevPage;
          return (
            <Fragment key={v.id}>
              {showDivider && <PageDivider page={v.page_number} />}
              <AyahRow
                verse={v}
                registry={registry}
                hasNext={v.verse_number < lastVerseNumber}
              />
            </Fragment>
          );
        })}
      </ol>
    </PlayerProvider>
  );
}

function ControlsBar({
  reciterId,
  onReciter,
}: {
  reciterId: number;
  onReciter: (id: number) => void;
}) {
  const { store, audioStatus, audioError } = usePlayer();
  const isPlaying = useIsPlaying();
  const activeKey = useActiveVerseKey();
  const lastActiveKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeKey && activeKey !== lastActiveKeyRef.current) {
      lastActiveKeyRef.current = activeKey;
      const el = document.getElementById(`ayah-${activeKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeKey]);

  const reciter = getReciter(reciterId);

  return (
    <div className="mb-6 sticky top-14 z-10 rounded-lg border border-stone-200 dark:border-stone-800 p-3 bg-white/95 dark:bg-stone-900/95 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="reciter"
            className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5"
          >
            Reciter
          </label>
          <select
            id="reciter"
            value={reciterId}
            onChange={(e) => onReciter(Number(e.target.value))}
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
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            disabled={audioStatus !== "ready"}
            onClick={() => {
              if (isPlaying) store.togglePause();
              else if (activeKey) store.togglePause();
              else store.playFullSurah();
            }}
            className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {audioStatus === "loading"
              ? "Loading…"
              : isPlaying
                ? "⏸ Pause"
                : activeKey
                  ? "▶ Resume"
                  : "▶ Play full surah"}
          </button>
          <button
            type="button"
            disabled={audioStatus !== "ready" || !activeKey}
            onClick={() => store.stop()}
            className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40"
          >
            ⏹ Stop
          </button>
        </div>
      </div>
      {audioStatus === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
          Audio load failed: {audioError}
        </p>
      )}
    </div>
  );
}
