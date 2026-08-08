"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { fetchVerses, type Verse } from "@/lib/quran";
import { fetchSurahAudio, type SurahAudio, type VerseTiming } from "@/lib/audio";
import {
  buildSurahIndex,
  parseChatIntent,
  type ChapterLite,
} from "@/lib/chatIntent";
import type { KbEntry } from "@/lib/tajweedKb";
import { RECITERS, DEFAULT_RECITER_ID, getReciter } from "@/lib/reciters";

// ── Message model ──────────────────────────────────────────────────────

type Recitation = {
  surahId: number;
  surahName: string;
  arabicName: string;
  from: number;
  to: number;
  reciterId: number;
  autoplay: boolean;
  note?: string;
};

type Message =
  | { id: number; role: "user"; text: string }
  | {
      id: number;
      role: "bot";
      paragraphs: string[];
      recitation?: Recitation;
      kbTitle?: string;
    };

let nextId = 1;

const WELCOME: string[] = [
  "Assalamu alaykum! I'm the Hifz.ai recitation assistant — specialized in the Quran, its tajweed, and the qira'at, not general Arabic.",
  "Ask me to recite any passage — \"Recite Surah Al-Mulk verses 1–5\", \"recite 2:255\", \"play Ayat al-Kursi\" — and I'll recite it with live word-by-word highlighting. You can also ask about tajweed and qira'at: qalqalah, madd, ghunna, the rules of noon sakinah, the ten readings…",
  "One point of adab: when I recite, you hear verified recordings of certified qaris, never AI-generated audio. The Quran's sound is transmitted by unbroken chains of teachers — my job is to know it, navigate it, and grade against it, not to synthesize it.",
];

const SUGGESTIONS = [
  "Recite Surah Al-Fatihah",
  "Recite Al-Mulk verses 1–5",
  "Play Ayat al-Kursi",
  "What is qalqalah?",
  "Explain the rules of noon sakinah",
  "What are the ten Qira'at?",
];

export function ChatBot({ chapters }: { chapters: ChapterLite[] }) {
  const surahIndex = useMemo(() => buildSurahIndex(chapters), [chapters]);
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId++, role: "bot", paragraphs: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [reciterId, setReciterId] = useState(DEFAULT_RECITER_ID);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const intent = parseChatIntent(text, chapters, surahIndex);
      const out: Message[] = [{ id: nextId++, role: "user", text }];

      switch (intent.kind) {
        case "recite": {
          const c = chapters.find((ch) => ch.id === intent.surahId)!;
          const isWhole = intent.from === 1 && intent.to === c.versesCount;
          const rangeLabel = isWhole
            ? `the full surah (${c.versesCount} ayat)`
            : intent.from === intent.to
              ? `ayah ${intent.from}`
              : `ayat ${intent.from}–${intent.to}`;
          const paragraphs = [
            `Reciting Surah ${c.name} (${c.id}) — ${rangeLabel}, in the riwayah of Hafs 'an 'Asim.`,
          ];
          if (intent.clamped) {
            paragraphs.push(
              `Note: Surah ${c.name} has ${c.versesCount} ayat, so I adjusted your range to fit.`
            );
          }
          out.push({
            id: nextId++,
            role: "bot",
            paragraphs,
            recitation: {
              surahId: c.id,
              surahName: c.name,
              arabicName: c.arabicName,
              from: intent.from,
              to: intent.to,
              reciterId,
              autoplay: true,
            },
          });
          break;
        }
        case "kb": {
          const entry: KbEntry = intent.entry;
          const msg: Message = {
            id: nextId++,
            role: "bot",
            paragraphs: entry.answer,
            kbTitle: entry.title,
          };
          if (entry.demo) {
            const c = chapters.find((ch) => ch.id === entry.demo!.surahId);
            if (c) {
              msg.recitation = {
                surahId: c.id,
                surahName: c.name,
                arabicName: c.arabicName,
                from: entry.demo.from,
                to: entry.demo.to,
                reciterId,
                autoplay: false,
                note: entry.demo.note,
              };
            }
          }
          out.push(msg);
          break;
        }
        case "greeting":
          out.push({
            id: nextId++,
            role: "bot",
            paragraphs: [
              "Wa alaykum assalam wa rahmatullah! What would you like to hear? Try \"Recite Surah Yasin\" or ask me a tajweed question.",
            ],
          });
          break;
        case "help":
          out.push({
            id: nextId++,
            role: "bot",
            paragraphs: [
              "I can do two things, both strictly within the Quran:",
              "1. Recite — \"Recite Surah Al-Kahf verses 1–10\", \"play 36:1-12\", \"recite Ayat al-Kursi\", or just a surah name for the whole surah. I play verified qari recordings with live word highlighting; pick the reciter above.",
              "2. Teach — ask about tajweed and qira'at: makharij, sifat, madd, ghunna, qalqalah, noon/meem sakinah rules, waqf, the ten readings, Hafs vs Warsh. Many answers come with a demo passage you can play.",
            ],
          });
          break;
        case "unknown":
          out.push({
            id: nextId++,
            role: "bot",
            paragraphs: [
              intent.hadReciteVerb
                ? "I couldn't work out which surah you mean. Try a name or number — \"Recite Surah Al-Mulk verses 1–5\", \"recite 67:1-5\" — or ask for help to see examples."
                : "I stay within my specialty: reciting the Quran and explaining tajweed & qira'at. Try \"Recite Surah Ar-Rahman\" or \"What is madd?\" — or say \"help\" for examples.",
            ],
          });
          break;
      }
      setMessages((m) => [...m, ...out]);
      setInput("");
    },
    [chapters, surahIndex, reciterId]
  );

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 px-4 py-2.5 bg-stone-50 dark:bg-stone-950/60">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
            ﷽
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Recitation Assistant
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
              Quran-only · Hafs ʿan ʿAsim · verified qari audio
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
          Reciter
          <select
            value={reciterId}
            onChange={(e) => setReciterId(Number(e.target.value))}
            className="rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-1 text-xs"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[50vh] max-h-[65vh]">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 text-white px-4 py-2.5 text-sm whitespace-pre-wrap">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[95%] w-full sm:max-w-[85%] rounded-2xl rounded-bl-sm bg-stone-100 dark:bg-stone-800 px-4 py-3 text-sm space-y-2">
                {m.kbTitle && (
                  <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">
                    {m.kbTitle}
                  </p>
                )}
                {m.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="leading-relaxed text-stone-800 dark:text-stone-200"
                  >
                    {p}
                  </p>
                ))}
                {m.recitation && <RecitationCard rec={m.recitation} />}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-stone-200 dark:border-stone-800 px-4 py-3 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="shrink-0 text-xs rounded-full border border-stone-300 dark:border-stone-700 px-3 py-1 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try: "Recite Surah Al-Mulk verses 1–5" or "What is qalqalah?"'
            className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Message the recitation assistant"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-40"
            disabled={!input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Recitation card: fetch + range playback + live word highlight ──────

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

function RecitationCard({ rec }: { rec: Recitation }) {
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
