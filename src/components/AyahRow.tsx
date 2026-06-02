"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Verse } from "@/lib/quran";
import { diffRecitation, accuracyScore, type DiffToken } from "@/lib/diff";
import {
  isSpeechRecognitionAvailable,
  startRecognition,
  type Recognizer,
} from "@/lib/speechRecognition";
import { usePlayer, useWordIndexFor } from "./PlayerProvider";
import type { ReciteRegistry } from "./SurahView";

type RecState =
  | { kind: "idle" }
  | { kind: "listening" }
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
  const recognizerRef = useRef<Recognizer | null>(null);

  const words = useMemo(
    () => verse.text_uthmani.trim().split(/\s+/),
    [verse.text_uthmani]
  );
  const activeWord = useWordIndexFor(verse.verse_key);

  useEffect(
    () => () => {
      recognizerRef.current?.abort();
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

  function startRecite() {
    if (!isSpeechRecognitionAvailable()) {
      setRec({
        kind: "error",
        message:
          "Speech recognition isn't available in this browser. Use Chrome or Edge.",
      });
      return;
    }
    setRec({ kind: "listening" });
    recognizerRef.current = startRecognition({
      lang: "ar-SA",
      onResult: (transcript) => {
        const tokens = diffRecitation(verse.text_uthmani, transcript);
        setRec({ kind: "result", tokens, transcript });
      },
      onError: (message) => setRec({ kind: "error", message }),
      onEnd: () => {
        recognizerRef.current = null;
      },
    });
  }

  startReciteRef.current = startRecite;

  function stopRecite() {
    recognizerRef.current?.stop();
  }

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
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800 text-xs font-medium tabular-nums px-1.5">
            {verse.verse_number}
          </span>
          <span
            className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-xs font-semibold px-2 py-0.5 tabular-nums whitespace-nowrap"
            title={`Mushaf page ${verse.page_number}`}
          >
            📖 p.{verse.page_number}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={listen}
            disabled={audioStatus !== "ready"}
            className="text-xs rounded-md border border-stone-300 dark:border-stone-700 px-2.5 py-1 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40"
          >
            ▶ Listen
          </button>
          {rec.kind === "listening" ? (
            <button
              type="button"
              onClick={stopRecite}
              className="text-xs rounded-md bg-red-600 text-white px-2.5 py-1 hover:bg-red-700"
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecite}
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

      {rec.kind === "listening" && (
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          Listening — recite the ayah, then hit Stop.
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
