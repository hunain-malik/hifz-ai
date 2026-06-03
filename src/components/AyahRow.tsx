"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Verse } from "@/lib/quran";
import { diffRecitation, accuracyScore, type DiffToken } from "@/lib/diff";
import { transcribe, type LoadStatus } from "@/lib/whisper";
import { usePlayer, useWordIndexFor } from "./PlayerProvider";
import type { ReciteRegistry } from "./SurahView";

type RecState =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "loading-model"; progress: number }
  | { kind: "transcribing" }
  | { kind: "result"; tokens: DiffToken[]; transcript: string }
  | { kind: "error"; message: string };

export function AyahRow({
  verse,
  registry,
  hasNext,
}: {
  verse: Verse;
  registry: ReciteRegistry;
  hasNext: boolean;
}) {
  const { store, audioStatus } = usePlayer();
  const [rec, setRec] = useState<RecState>({ kind: "idle" });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const words = useMemo(
    () => verse.text_uthmani.trim().split(/\s+/),
    [verse.text_uthmani]
  );
  const activeWord = useWordIndexFor(verse.verse_key);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        recorderRef.current?.stop();
      } catch {
        // recorder may not be in a stoppable state; ignore
      }
    },
    []
  );

  useEffect(() => {
    return registry.register(verse.verse_number, () => startReciteRef.current());
  }, [registry, verse.verse_number]);

  const startReciteRef = useRef<() => void>(() => {});

  function listen() {
    store.playFromVerse(verse.verse_key, { singleVerse: true });
  }

  async function startRecite() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setRec({
        kind: "error",
        message: "Microphone access isn't available in this browser.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void runTranscription(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRec({ kind: "recording" });
    } catch (err) {
      setRec({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not access microphone. Check permissions.",
      });
    }
  }

  function stopRecite() {
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
  }

  async function runTranscription(blob: Blob) {
    setRec({ kind: "transcribing" });
    try {
      const text = await transcribe(blob, {
        onStatus: (status: LoadStatus) => {
          if (status.kind === "loading") {
            setRec({ kind: "loading-model", progress: status.progress });
          } else if (status.kind === "ready") {
            setRec({ kind: "transcribing" });
          }
        },
      });
      const tokens = diffRecitation(verse.text_uthmani, text);
      setRec({ kind: "result", tokens, transcript: text });
    } catch (err) {
      setRec({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Transcription failed.",
      });
    }
  }

  startReciteRef.current = () => void startRecite();

  return (
    <li
      id={`ayah-${verse.verse_key}`}
      data-verse-key={verse.verse_key}
      data-page-number={verse.page_number}
      className={`rounded-lg border bg-white dark:bg-stone-900 p-4 transition-colors ${
        activeWord !== null
          ? "border-emerald-400 dark:border-emerald-700 shadow-sm"
          : "border-stone-200 dark:border-stone-800"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800 text-xs font-medium tabular-nums px-1.5">
            {verse.verse_number}
          </span>
          <span
            className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-xs font-bold px-2 py-0.5 tabular-nums whitespace-nowrap"
            title={`Mushaf page ${verse.page_number}`}
          >
            📖 Page {verse.page_number}
          </span>
        </div>
        <div className="flex gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={listen}
            disabled={audioStatus !== "ready"}
            className="text-xs rounded-md border border-stone-300 dark:border-stone-700 px-2.5 py-1 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40"
          >
            ▶ Listen
          </button>
          {rec.kind === "recording" ? (
            <button
              type="button"
              onClick={stopRecite}
              className="text-xs rounded-md bg-red-600 text-white px-2.5 py-1 hover:bg-red-700"
            >
              ⏹ Stop
            </button>
          ) : rec.kind === "loading-model" || rec.kind === "transcribing" ? (
            <button
              type="button"
              disabled
              className="text-xs rounded-md border border-stone-300 dark:border-stone-700 px-2.5 py-1 opacity-60"
            >
              {rec.kind === "loading-model"
                ? `Loading model… ${rec.progress}%`
                : "Transcribing…"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startRecite()}
              className="text-xs rounded-md bg-emerald-600 text-white px-2.5 py-1 hover:bg-emerald-700"
            >
              🎙 Recite
            </button>
          )}
        </div>
      </div>

      <p className="arabic">
        {words.map((w, i) => {
          const wordPos = i + 1;
          const isActive = activeWord === wordPos;
          return (
            <span
              key={i}
              className={`arabic-word ${
                isActive
                  ? "bg-emerald-200 dark:bg-emerald-900/70 text-emerald-950 dark:text-emerald-100"
                  : ""
              }`}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </p>

      {rec.kind === "recording" && (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          Recording — recite the ayah, then hit Stop.
        </p>
      )}
      {rec.kind === "loading-model" && (
        <div className="mt-3">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">
            First-time setup — downloading Quran recognition model (~90MB,
            cached after).
          </p>
          <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-600 transition-[width] duration-200"
              style={{ width: `${rec.progress}%` }}
            />
          </div>
        </div>
      )}
      {rec.kind === "transcribing" && (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          Transcribing with Tarteel Whisper…
        </p>
      )}
      {rec.kind === "result" && (
        <Feedback
          tokens={rec.tokens}
          transcript={rec.transcript}
          onReset={() => setRec({ kind: "idle" })}
          onAdvance={
            hasNext
              ? () => registry.advanceFrom(verse.verse_number)
              : undefined
          }
        />
      )}
      {rec.kind === "error" && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">
          {rec.message}{" "}
          <button
            onClick={() => setRec({ kind: "idle" })}
            className="underline"
          >
            try again
          </button>
        </div>
      )}
    </li>
  );
}

function Feedback({
  tokens,
  transcript,
  onReset,
  onAdvance,
}: {
  tokens: DiffToken[];
  transcript: string;
  onReset: () => void;
  onAdvance?: () => void;
}) {
  const score = accuracyScore(tokens);
  return (
    <div className="mt-4 border-t border-stone-200 dark:border-stone-800 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Feedback · {score}% words correct
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="text-xs text-stone-500 dark:text-stone-400 hover:underline"
          >
            retry
          </button>
          {onAdvance && (
            <button
              onClick={onAdvance}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              Next ayah →
            </button>
          )}
        </div>
      </div>
      <p className="arabic">
        {tokens.map((t, i) => (
          <span
            key={i}
            className={[
              "arabic-word",
              t.status === "correct" &&
                "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200",
              t.status === "missed" &&
                "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 underline decoration-dotted",
              t.status === "wrong" &&
                "bg-red-100 dark:bg-red-950/60 text-red-900 dark:text-red-200",
              t.status === "extra" &&
                "bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 line-through",
            ]
              .filter(Boolean)
              .join(" ")}
            title={
              t.status === "wrong"
                ? `Heard: ${t.actual ?? ""}`
                : t.status === "extra"
                  ? "Extra word heard"
                  : t.status === "missed"
                    ? "Not heard"
                    : ""
            }
          >
            {t.expected ?? t.actual}
          </span>
        ))}
      </p>
      <details className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        <summary className="cursor-pointer">What the model heard</summary>
        <p className="arabic mt-1" style={{ fontSize: "1.25rem", lineHeight: "2" }}>
          {transcript || "(empty)"}
        </p>
      </details>
    </div>
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}
