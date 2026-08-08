"use client";

// Recitation playback card shared by the SANAD console and the chat page:
// fetches the verse text + the reciter's word-segment timings, plays exactly
// the requested ayah range, and highlights the live word.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchVerses, type Verse } from "@/lib/quran";
import { fetchSurahAudio, type SurahAudio, type VerseTiming } from "@/lib/audio";
import { getReciter } from "@/lib/reciters";

export type Recitation = {
  surahId: number;
  surahName: string;
  arabicName: string;
  from: number;
  to: number;
  reciterId: number;
  autoplay: boolean;
  note?: string;
};


// Session caches so repeated requests don't refetch text/timings.
const versesCache = new Map<number, Promise<Verse[]>>();
const audioCache = new Map<string, Promise<SurahAudio>>();

function getVersesCached(surahId: number): Promise<Verse[]> {
  let p = versesCache.get(surahId);
  if (!p) {
    p = fetchVerses(surahId);
    versesCache.set(surahId, p);
    p.catch(() => versesCache.delete(surahId));
  }
  return p;
}

function getAudioCached(reciterId: number, surahId: number): Promise<SurahAudio> {
  const key = `${reciterId}:${surahId}`;
  let p = audioCache.get(key);
  if (!p) {
    p = fetchSurahAudio(reciterId, surahId);
    audioCache.set(key, p);
    p.catch(() => audioCache.delete(key));
  }
  return p;
}

type CardState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; verses: Verse[]; audio: SurahAudio };

export function RecitationCard({ rec }: { rec: Recitation }) {
  const [state, setState] = useState<CardState>({ kind: "loading" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [active, setActive] = useState<{
    verseKey: string;
    wordPos: number | null;
  } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reciter = getReciter(rec.reciterId);

  // `rec` is immutable per message (a fresh card mounts for each reply), so
  // this runs once and the initial "loading" state needs no reset.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getVersesCached(rec.surahId),
      getAudioCached(rec.reciterId, rec.surahId),
    ])
      .then(([verses, audio]) => {
        if (cancelled) return;
        setState({ kind: "ready", verses, audio });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : "Failed to load recitation",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [rec.surahId, rec.reciterId]);

  const rangeTimings = useMemo(() => {
    if (state.kind !== "ready") return null;
    const inRange = state.audio.verseTimings.filter((t) => {
      const n = verseNumberOf(t.verse_key);
      return n >= rec.from && n <= rec.to;
    });
    return inRange.length > 0 ? inRange : null;
  }, [state, rec.from, rec.to]);

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsPlaying(false);
    setActive(null);
  }, []);

  const play = useCallback(() => {
    if (state.kind !== "ready" || !rangeTimings) return;
    const startMs = rangeTimings[0].timestamp_from;
    const endMs = rangeTimings[rangeTimings.length - 1].timestamp_to;
    let a = audioRef.current;
    if (!a) {
      a = new Audio(state.audio.audioUrl);
      a.preload = "auto";
      audioRef.current = a;
    }
    seekTo(a, startMs / 1000);

    const tick = () => {
      const el = audioRef.current;
      if (!el) return;
      const ms = Math.floor(el.currentTime * 1000);
      if (ms >= endMs - 10 || el.ended) {
        stopPlayback();
        return;
      }
      const timing = rangeTimings.find(
        (t) => ms >= t.timestamp_from && ms <= t.timestamp_to
      );
      if (timing) {
        setActive({
          verseKey: timing.verse_key,
          wordPos: wordAt(timing, ms),
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    a.play()
      .then(() => {
        setBlocked(false);
        setIsPlaying(true);
        tick();
      })
      .catch(() => setBlocked(true));
  }, [state, rangeTimings, stopPlayback]);

  // Autoplay recitation replies — the send click counts as the user gesture,
  // but browsers may still block after the async fetch; `blocked` falls back
  // to a manual play button.
  const autoplayTried = useRef(false);
  useEffect(() => {
    if (
      rec.autoplay &&
      !autoplayTried.current &&
      state.kind === "ready" &&
      rangeTimings
    ) {
      autoplayTried.current = true;
      play();
    }
  }, [rec.autoplay, state, rangeTimings, play]);

  // Keep the active ayah in view inside the card's scroll area
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-chat-verse="${active.verseKey}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active?.verseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const rangeLabel =
    rec.from === rec.to
      ? `${rec.surahId}:${rec.from}`
      : `${rec.surahId}:${rec.from}–${rec.to}`;

  return (
    <div className="mt-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-stone-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 truncate">
            {rec.surahName}{" "}
            <span className="arabic inline" style={{ fontSize: "1rem", lineHeight: 1 }}>
              {rec.arabicName}
            </span>{" "}
            · {rangeLabel}
          </p>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 truncate">
            {reciter.name} · {reciter.style}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state.kind === "ready" && rangeTimings && (
            <button
              type="button"
              onClick={isPlaying ? stopPlayback : play}
              className={`text-xs font-medium rounded-md px-3 py-1.5 text-white ${
                isPlaying
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isPlaying ? "⏹ Stop" : "▶ Recite"}
            </button>
          )}
          <Link
            href={`/surah/${rec.surahId}`}
            className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
          >
            Open surah →
          </Link>
        </div>
      </div>

      {rec.note && (
        <p className="px-3 pt-2 text-[11px] italic text-stone-500 dark:text-stone-400">
          {rec.note}
        </p>
      )}

      {state.kind === "loading" && (
        <p className="px-3 py-3 text-xs text-stone-500 dark:text-stone-400">
          Loading verses and timing data…
        </p>
      )}
      {state.kind === "error" && (
        <p className="px-3 py-3 text-xs text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state.kind === "ready" && !rangeTimings && (
        <p className="px-3 py-3 text-xs text-amber-700 dark:text-amber-400">
          This reciter has no timing data for that range — try another reciter.
        </p>
      )}
      {blocked && (
        <p className="px-3 pt-2 text-[11px] text-amber-700 dark:text-amber-400">
          Your browser blocked autoplay — press ▶ Recite to hear it.
        </p>
      )}

      {state.kind === "ready" && (
        <div ref={containerRef} className="px-3 py-2 max-h-80 overflow-y-auto">
          {state.verses
            .filter(
              (v) => v.verse_number >= rec.from && v.verse_number <= rec.to
            )
            .map((v) => (
              <ChatAyah
                key={v.verse_key}
                verse={v}
                activeWordPos={
                  active?.verseKey === v.verse_key ? active.wordPos : null
                }
                isActiveVerse={active?.verseKey === v.verse_key}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function ChatAyah({
  verse,
  activeWordPos,
  isActiveVerse,
}: {
  verse: Verse;
  activeWordPos: number | null;
  isActiveVerse: boolean;
}) {
  // Same filtering as AyahRow: drop bare waqf marks so word indices line up
  // with the reciter's per-word segments.
  const words = useMemo(
    () => verse.text_uthmani.trim().split(/\s+/).filter(hasArabicLetter),
    [verse.text_uthmani]
  );
  return (
    <p
      data-chat-verse={verse.verse_key}
      className={`arabic rounded-md px-1 transition-colors ${
        isActiveVerse ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
      }`}
      style={{ fontSize: "1.6rem", lineHeight: 2.4 }}
    >
      {words.map((w, i) => (
        <span
          key={i}
          className={`arabic-word ${
            activeWordPos === i + 1
              ? "bg-emerald-200 dark:bg-emerald-900/70 text-emerald-950 dark:text-emerald-100"
              : ""
          }`}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
      <span className="text-emerald-700 dark:text-emerald-400 text-base mx-1">
        ﴿{verse.verse_number}﴾
      </span>
    </p>
  );
}

function seekTo(el: HTMLAudioElement, seconds: number) {
  el.currentTime = seconds;
}

function verseNumberOf(verseKey: string): number {
  const idx = verseKey.indexOf(":");
  return idx >= 0 ? Number(verseKey.slice(idx + 1)) : NaN;
}

function wordAt(timing: VerseTiming, ms: number): number | null {
  for (const [wordPos, startMs, endMs] of timing.segments) {
    if (ms >= startMs && ms <= endMs) return wordPos;
  }
  return null;
}

function hasArabicLetter(token: string): boolean {
  for (const ch of token) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    if (
      (code >= 0x0621 && code <= 0x064a) ||
      (code >= 0x0671 && code <= 0x06d3)
    ) {
      return true;
    }
  }
  return false;
}
