"use client";

// SANAD standalone console — the voice-first, Jarvis-style surface.
// One orb, one response. Wake it, speak, it answers aloud and recites.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSurahIndex,
  parseChatIntent,
  type ChapterLite,
} from "@/lib/chatIntent";
import { RECITERS, DEFAULT_RECITER_ID, getReciter } from "@/lib/reciters";
import {
  isVoiceSupported,
  speak,
  startVoice,
  stopSpeaking,
  type VoiceController,
  type VoiceState,
} from "@/lib/voice";
import { RecitationCard, type Recitation } from "./RecitationCard";

type ConsoleResponse = {
  title?: string;
  paragraphs: string[];
  recitation?: Recitation;
};

const EXAMPLES = [
  "Hey Sanad — recite Surah Al-Fatihah",
  "Hey Sanad — recite Al-Mulk, verses one to five",
  "Hey Sanad — what is qalqalah?",
];

export function SanadConsole({ chapters }: { chapters: ChapterLite[] }) {
  const surahIndex = useMemo(() => buildSurahIndex(chapters), [chapters]);
  const [reciterId, setReciterId] = useState(DEFAULT_RECITER_ID);
  const [voiceState, setVoiceState] = useState<VoiceState>("off");
  const [voiceDetail, setVoiceDetail] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [response, setResponse] = useState<ConsoleResponse | null>(null);
  const [input, setInput] = useState("");
  const voiceRef = useRef<VoiceController | null>(null);
  const handleRef = useRef<(t: string) => void>(() => {});

  const handle = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setLastHeard(text);
      const intent = parseChatIntent(text, chapters, surahIndex);

      switch (intent.kind) {
        case "recite": {
          const c = chapters.find((ch) => ch.id === intent.surahId)!;
          const isWhole = intent.from === 1 && intent.to === c.versesCount;
          const rangeLabel = isWhole
            ? `the full surah (${c.versesCount} ayat)`
            : intent.from === intent.to
              ? `ayah ${intent.from}`
              : `ayat ${intent.from}–${intent.to}`;
          setResponse({
            paragraphs: [
              `Surah ${c.name} — ${rangeLabel} · Hafs ʿan ʿAsim.`,
              ...(intent.clamped
                ? [`(Adjusted: Surah ${c.name} has ${c.versesCount} ayat.)`]
                : []),
            ],
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
          speak(
            `Reciting Surah ${c.name}, ${rangeLabel}, in the voice of ${getReciter(reciterId).name}.`
          );
          break;
        }
        case "kb": {
          const entry = intent.entry;
          const rec: Recitation | undefined = entry.demo
            ? (() => {
                const c = chapters.find((ch) => ch.id === entry.demo!.surahId);
                return c
                  ? {
                      surahId: c.id,
                      surahName: c.name,
                      arabicName: c.arabicName,
                      from: entry.demo.from,
                      to: entry.demo.to,
                      reciterId,
                      autoplay: false,
                      note: entry.demo.note,
                    }
                  : undefined;
              })()
            : undefined;
          setResponse({
            title: entry.title,
            paragraphs: entry.answer,
            recitation: rec,
          });
          const firstSentence = entry.answer[0].split(/(?<=[.!?])\s/)[0];
          speak(`${entry.title}. ${firstSentence}`);
          break;
        }
        case "greeting":
          setResponse({
            paragraphs: ["Wa alaykum assalam wa rahmatullah. What would you like to hear?"],
          });
          speak("Wa alaykum assalam! What would you like to hear?");
          break;
        case "help":
          setResponse({
            paragraphs: [
              "Say “recite” + any surah name, number, or verse range — or ask about tajweed and the qira'at.",
            ],
          });
          speak(
            "I can recite any surah or ayah range, and answer questions about tajweed and the qira'at."
          );
          break;
        case "unknown":
          setResponse({
            paragraphs: [
              intent.hadReciteVerb
                ? "I couldn't work out which surah you mean — try a name or number, like “recite Surah Al-Mulk, verses one to five.”"
                : "I stay within the Quran, tajweed, and the qira'at. Ask me to recite something.",
            ],
          });
          speak(
            intent.hadReciteVerb
              ? "I couldn't work out which surah you mean."
              : "I stay within the Quran. Ask me to recite something."
          );
          break;
      }
      setInput("");
    },
    [chapters, surahIndex, reciterId]
  );
  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  function toggleVoice() {
    if (voiceRef.current) {
      voiceRef.current.stop();
      voiceRef.current = null;
      stopSpeaking();
      return;
    }
    if (!isVoiceSupported()) {
      setVoiceState("unsupported");
      setVoiceDetail("Voice needs a Chromium browser (Chrome, Edge, Brave, Arc).");
      return;
    }
    voiceRef.current = startVoice({
      onState: (s, d) => {
        setVoiceState(s);
        setVoiceDetail(d ?? null);
        if (s === "error" || s === "off") voiceRef.current = null;
      },
      onWake: () => speak("Yes?"),
      onCommand: (text) => handleRef.current(text),
    });
  }

  useEffect(
    () => () => {
      voiceRef.current?.stop();
      stopSpeaking();
    },
    []
  );

  const awake = voiceState === "listening" || voiceState === "awaiting-command";

  return (
    <div className="rounded-2xl bg-stone-950 text-stone-100 border border-stone-800 px-4 py-10 flex flex-col items-center gap-6 min-h-[72vh]">
      <div className="w-full max-w-2xl flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
          SANAD <span className="text-stone-600">·</span> سند
        </p>
        <label className="flex items-center gap-2 text-xs text-stone-400">
          Voice
          <select
            value={reciterId}
            onChange={(e) => setReciterId(Number(e.target.value))}
            className="rounded-md border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-200"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* The orb */}
      <button
        type="button"
        onClick={toggleVoice}
        aria-label={awake ? "Put SANAD to sleep" : "Wake SANAD"}
        className={`relative mt-2 h-36 w-36 rounded-full transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 ${
          awake
            ? "bg-[radial-gradient(circle_at_35%_35%,#fbbf24,#b45309_55%,#451a03_90%)] shadow-[0_0_80px_18px_rgba(245,158,11,0.35)]"
            : "bg-[radial-gradient(circle_at_35%_35%,#57534e,#292524_60%,#0c0a09_95%)] shadow-[0_0_30px_4px_rgba(120,113,108,0.25)]"
        }`}
      >
        {voiceState === "awaiting-command" && (
          <span className="absolute inset-[-10px] rounded-full border-2 border-amber-400/70 animate-ping" />
        )}
        {voiceState === "listening" && (
          <span className="absolute inset-[-6px] rounded-full border border-amber-500/40 animate-pulse" />
        )}
      </button>

      <div className="text-center space-y-1">
        <p className="text-sm text-stone-300">
          {voiceState === "off" && "Tap the orb, then say “Hey Sanad…”"}
          {voiceState === "listening" && "Listening for “Hey Sanad”…"}
          {voiceState === "awaiting-command" && "Yes? Speak your request."}
          {voiceState === "unsupported" && (voiceDetail ?? "Voice unsupported here.")}
          {voiceState === "error" && (voiceDetail ?? "Voice error.")}
        </p>
        {lastHeard && (
          <p className="text-xs text-stone-500">
            Heard: <span className="italic">“{lastHeard}”</span>
          </p>
        )}
      </div>

      {response && (
        <div className="w-full max-w-2xl rounded-xl bg-stone-900 border border-stone-800 p-4 space-y-2">
          {response.title && (
            <p className="text-xs uppercase tracking-wider font-semibold text-amber-400">
              {response.title}
            </p>
          )}
          {response.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-stone-200">
              {p}
            </p>
          ))}
          {response.recitation && <RecitationCard rec={response.recitation} />}
        </div>
      )}

      {!response && (
        <div className="text-center text-xs text-stone-600 space-y-1">
          {EXAMPLES.map((e) => (
            <p key={e}>“{e}”</p>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handle(input);
        }}
        className="w-full max-w-2xl mt-auto flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="…or type: recite Surah Al-Mulk verses 1–5"
          className="flex-1 rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 outline-none focus:ring-2 focus:ring-amber-500/50"
          aria-label="Type a command to SANAD"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg bg-amber-600 text-stone-950 font-semibold px-4 py-2 text-sm hover:bg-amber-500 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
