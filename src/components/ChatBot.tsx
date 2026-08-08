"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildSurahIndex,
  parseChatIntent,
  type ChapterLite,
} from "@/lib/chatIntent";
import { RecitationCard, type Recitation } from "./RecitationCard";
import type { KbEntry } from "@/lib/tajweedKb";
import { RECITERS, DEFAULT_RECITER_ID, getReciter } from "@/lib/reciters";
import {
  isVoiceSupported,
  speak,
  startVoice,
  stopSpeaking,
  type VoiceController,
  type VoiceState,
} from "@/lib/voice";

// ── Message model ──────────────────────────────────────────────────────

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
  "Assalamu alaykum! I'm SANAD — the Hifz.ai recitation assistant, specialized in the Quran, its tajweed, and the qira'at, not general Arabic.",
  "Ask me to recite any passage — \"Recite Surah Al-Mulk verses 1–5\", \"recite 2:255\", \"play Ayat al-Kursi\" — and I'll recite it with live word-by-word highlighting. You can also ask about tajweed and qira'at: qalqalah, madd, ghunna, the rules of noon sakinah, the ten readings…",
  "Or go hands-free: press the Hey Sanad button, then just say \"Hey Sanad — recite Surah Al-Mulk, verses one to five\" and I'll answer out loud and recite.",
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

  // ── "Hey Sanad" voice mode ──
  const [voiceState, setVoiceState] = useState<VoiceState>("off");
  const [voiceDetail, setVoiceDetail] = useState<string | null>(null);
  const voiceRef = useRef<VoiceController | null>(null);
  const voiceOnRef = useRef(false);
  const sendRef = useRef<(t: string) => void>(() => {});

  function toggleVoice() {
    if (voiceRef.current) {
      voiceRef.current.stop();
      voiceRef.current = null;
      voiceOnRef.current = false;
      stopSpeaking();
      return;
    }
    if (!isVoiceSupported()) {
      setVoiceState("unsupported");
      setVoiceDetail(
        "Voice needs a Chromium browser (Chrome, Edge, Brave, Arc)."
      );
      return;
    }
    voiceOnRef.current = true;
    voiceRef.current = startVoice({
      onState: (s, d) => {
        setVoiceState(s);
        setVoiceDetail(d ?? null);
        if (s === "error" || s === "off") {
          voiceOnRef.current = false;
          voiceRef.current = null;
        }
      },
      onWake: () => speak("Yes?"),
      onCommand: (text) => sendRef.current(text),
    });
  }

  useEffect(
    () => () => {
      voiceRef.current?.stop();
      stopSpeaking();
    },
    []
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const intent = parseChatIntent(text, chapters, surahIndex);
      const out: Message[] = [{ id: nextId++, role: "user", text }];
      let spoken: string | null = null;

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
          spoken = `Reciting Surah ${c.name}, ${rangeLabel}, in the voice of ${getReciter(reciterId).name}.`;
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
          const firstSentence = entry.answer[0].split(/(?<=[.!?])\s/)[0];
          spoken = `${entry.title}. ${firstSentence}`;
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
          spoken =
            "Wa alaykum assalam! What would you like to hear?";
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
          spoken =
            "I can recite any surah or ayah range, and answer questions about tajweed and the qira'at.";
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
          spoken = intent.hadReciteVerb
            ? "I couldn't work out which surah you mean. Try a name or number."
            : "I stay within the Quran, tajweed, and the qira'at. Ask me to recite something.";
          break;
      }
      setMessages((m) => [...m, ...out]);
      setInput("");
      if (voiceOnRef.current && spoken) speak(spoken);
    },
    [chapters, surahIndex, reciterId]
  );
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 px-4 py-2.5 bg-stone-50 dark:bg-stone-950/60">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
            ﷽
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">
              SANAD · Recitation Assistant
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
              Quran-only · Hafs ʿan ʿAsim · verified qari audio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleVoice}
            className={`text-xs font-medium rounded-md px-3 py-1.5 border transition-colors ${
              voiceState === "listening"
                ? "bg-emerald-600 text-white border-emerald-600 animate-pulse"
                : voiceState === "awaiting-command"
                  ? "bg-indigo-600 text-white border-indigo-600 animate-pulse"
                  : "border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
            title='Hands-free mode: say "Hey Sanad", then your request'
          >
            {voiceState === "listening"
              ? "🎙 Listening for “Hey Sanad”…"
              : voiceState === "awaiting-command"
                ? "🎙 Yes? Speak your request…"
                : "🎙 Hey Sanad"}
          </button>
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
      </div>
      {(voiceState === "error" || voiceState === "unsupported") &&
        voiceDetail && (
          <p className="px-4 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 border-b border-stone-200 dark:border-stone-800">
            {voiceDetail}
          </p>
        )}

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
