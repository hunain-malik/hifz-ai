"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_RECITER_ID, RECITERS, getReciter } from "@/lib/reciters";
import type { Verse } from "@/lib/quran";
import {
  startContinuousRecite,
  type ContinuousHandle,
} from "@/lib/continuousRecite";
import { AyahRow, type ContinuousOverride } from "./AyahRow";
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

type ContinuousState = {
  active: boolean;
  activeVerse: number | null;
  transcribing: Set<number>;
  transcripts: Map<number, string>;
  errorMessage: string | null;
};

const EMPTY_CONTINUOUS: ContinuousState = {
  active: false,
  activeVerse: null,
  transcribing: new Set(),
  transcripts: new Map(),
  errorMessage: null,
};

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
    advanceFrom: useCallback(
      (verseNumber: number) => {
        const next = verseNumber + 1;
        const start = reciteRegistryRef.current.get(next);
        if (!start) return;
        const verseKey = `${surahId}:${next}`;
        const el = document.getElementById(`ayah-${verseKey}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(start, 350);
      },
      [surahId]
    ),
  };

  const [continuous, setContinuous] =
    useState<ContinuousState>(EMPTY_CONTINUOUS);
  const sessionRef = useRef<ContinuousHandle | null>(null);

  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (continuous.activeVerse !== null) {
      const verseKey = `${surahId}:${continuous.activeVerse}`;
      const el = document.getElementById(`ayah-${verseKey}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [continuous.activeVerse, surahId]);

  async function startContinuous(fromVerseNumber?: number) {
    if (continuous.active) return;
    const startIndex = fromVerseNumber
      ? verses.findIndex((v) => v.verse_number === fromVerseNumber)
      : 0;
    setContinuous({
      ...EMPTY_CONTINUOUS,
      active: true,
      activeVerse: verses[Math.max(0, startIndex)]?.verse_number ?? null,
    });
    try {
      const session = await startContinuousRecite({
        verses,
        startIndex: Math.max(0, startIndex),
        callbacks: {
          onActiveVerseChanged: (verseNumber) =>
            setContinuous((s) => ({ ...s, activeVerse: verseNumber })),
          onTranscribing: (verseNumber) =>
            setContinuous((s) => {
              const next = new Set(s.transcribing);
              next.add(verseNumber);
              return { ...s, transcribing: next };
            }),
          onResult: (verseNumber, transcript) =>
            setContinuous((s) => {
              const nextTranscribing = new Set(s.transcribing);
              nextTranscribing.delete(verseNumber);
              const nextTranscripts = new Map(s.transcripts);
              nextTranscripts.set(verseNumber, transcript);
              return {
                ...s,
                transcribing: nextTranscribing,
                transcripts: nextTranscripts,
              };
            }),
          onError: (message) =>
            setContinuous((s) => ({ ...s, errorMessage: message })),
          onComplete: () =>
            setContinuous((s) => ({
              ...s,
              active: false,
              activeVerse: null,
            })),
        },
      });
      sessionRef.current = session;
    } catch (err) {
      setContinuous({
        ...EMPTY_CONTINUOUS,
        errorMessage:
          err instanceof Error
            ? err.message
            : "Could not start microphone session.",
      });
    }
  }

  function stopContinuous() {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }

  function skipCurrentInContinuous() {
    sessionRef.current?.skipCurrent();
  }

  function clearContinuousResults() {
    setContinuous(EMPTY_CONTINUOUS);
  }

  return (
    <PlayerProvider reciterId={reciter.id} surahId={surahId}>
      <ControlsBar
        reciterId={reciterId}
        onReciter={chooseReciter}
        continuousActive={continuous.active}
        continuousActiveVerse={continuous.activeVerse}
        continuousErrorMessage={continuous.errorMessage}
        hasContinuousResults={continuous.transcripts.size > 0}
        onStartContinuous={() => void startContinuous()}
        onStopContinuous={stopContinuous}
        onSkipContinuous={skipCurrentInContinuous}
        onClearContinuous={clearContinuousResults}
      />
      <ScrollPageIndicator verses={verses} />
      <ol className="flex flex-col gap-3">
        {verses.map((v, i) => {
          const prevPage = verses[i - 1]?.page_number;
          const showDivider =
            prevPage !== undefined && v.page_number !== prevPage;
          const override = continuousOverrideFor(continuous, v.verse_number);
          return (
            <Fragment key={v.id}>
              {showDivider && <PageDivider page={v.page_number} />}
              <AyahRow
                verse={v}
                registry={registry}
                hasNext={v.verse_number < lastVerseNumber}
                continuousOverride={override}
                continuousActive={continuous.active}
              />
            </Fragment>
          );
        })}
      </ol>
    </PlayerProvider>
  );
}

function continuousOverrideFor(
  state: ContinuousState,
  verseNumber: number
): ContinuousOverride | null {
  if (!state.active && state.transcripts.size === 0) return null;
  if (state.activeVerse === verseNumber) {
    return { kind: "recording" };
  }
  if (state.transcribing.has(verseNumber)) {
    return { kind: "transcribing" };
  }
  const t = state.transcripts.get(verseNumber);
  if (t !== undefined) {
    return { kind: "result", transcript: t };
  }
  return null;
}

function ControlsBar({
  reciterId,
  onReciter,
  continuousActive,
  continuousActiveVerse,
  continuousErrorMessage,
  hasContinuousResults,
  onStartContinuous,
  onStopContinuous,
  onSkipContinuous,
  onClearContinuous,
}: {
  reciterId: number;
  onReciter: (id: number) => void;
  continuousActive: boolean;
  continuousActiveVerse: number | null;
  continuousErrorMessage: string | null;
  hasContinuousResults: boolean;
  onStartContinuous: () => void;
  onStopContinuous: () => void;
  onSkipContinuous: () => void;
  onClearContinuous: () => void;
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
            disabled={continuousActive}
            className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm disabled:opacity-50"
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
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            disabled={audioStatus !== "ready" || continuousActive}
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
            ⏹ Stop audio
          </button>
          {continuousActive ? (
            <>
              <button
                type="button"
                onClick={onSkipContinuous}
                className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
                title="Force advance to the next ayah"
              >
                ⏭ Next ayah
              </button>
              <button
                type="button"
                onClick={onStopContinuous}
                className="rounded-md bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700"
              >
                ⏹ Stop reciting
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartContinuous}
              className="rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
              title="Recite continuously — the system auto-advances on natural pauses"
            >
              🎙 Continuous recite
            </button>
          )}
          {hasContinuousResults && !continuousActive && (
            <button
              type="button"
              onClick={onClearContinuous}
              className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Clear results
            </button>
          )}
        </div>
      </div>
      {continuousActive && (
        <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">
          🎙 Listening{continuousActiveVerse !== null ? ` — ayah ${continuousActiveVerse}` : ""}. Recite naturally; the system advances when you pause for ~1.3s.
        </p>
      )}
      {continuousErrorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
          {continuousErrorMessage}
        </p>
      )}
      {audioStatus === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
          Audio load failed: {audioError}
        </p>
      )}
    </div>
  );
}
