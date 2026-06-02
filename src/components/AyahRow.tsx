"use client";

import { useEffect, useRef, useState } from "react";
import type { Reciter } from "@/lib/reciters";
import type { Verse } from "@/lib/quran";
import { ayahAudioUrl } from "@/lib/audio";
import { diffRecitation, accuracyScore, type DiffToken } from "@/lib/diff";

type State =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "transcribing" }
  | { kind: "result"; tokens: DiffToken[]; transcript: string }
  | { kind: "error"; message: string };

export function AyahRow({
  surahId,
  verse,
  reciter,
}: {
  surahId: number;
  verse: Verse;
  reciter: Reciter;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = ayahAudioUrl(reciter, surahId, verse.verse_number);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function play() {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    } else {
      audioRef.current.src = audioUrl;
    }
    void audioRef.current.play();
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stream.getTracks().forEach((t) => t.stop());
        void transcribe(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setState({ kind: "recording" });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not access microphone. Check permissions.",
      });
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setState({ kind: "transcribing" });
  }

  async function transcribe(blob: Blob) {
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(error ?? `Transcription failed (${res.status}).`);
      }
      const { text } = (await res.json()) as { text: string };
      const tokens = diffRecitation(verse.text_uthmani, text);
      setState({ kind: "result", tokens, transcript: text });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Transcription failed.",
      });
    }
  }

  function reset() {
    setState({ kind: "idle" });
  }

  return (
    <li className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800 text-xs font-medium tabular-nums px-1.5">
          {verse.verse_number}
        </span>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={play}
            className="text-xs rounded-md border border-stone-300 dark:border-stone-700 px-2.5 py-1 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            ▶ Listen
          </button>
          {state.kind === "recording" ? (
            <button
              type="button"
              onClick={stopRecording}
              className="text-xs rounded-md bg-red-600 text-white px-2.5 py-1 hover:bg-red-700"
            >
              ⏹ Stop
            </button>
          ) : state.kind === "transcribing" ? (
            <button
              type="button"
              disabled
              className="text-xs rounded-md border border-stone-300 dark:border-stone-700 px-2.5 py-1 opacity-60"
            >
              Transcribing…
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="text-xs rounded-md bg-emerald-600 text-white px-2.5 py-1 hover:bg-emerald-700"
            >
              🎙 Recite
            </button>
          )}
        </div>
      </div>

      <p className="arabic">{verse.text_uthmani}</p>

      {state.kind === "result" && (
        <Feedback
          tokens={state.tokens}
          transcript={state.transcript}
          onReset={reset}
        />
      )}
      {state.kind === "error" && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.message}{" "}
          <button onClick={reset} className="underline">
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
}: {
  tokens: DiffToken[];
  transcript: string;
  onReset: () => void;
}) {
  const score = accuracyScore(tokens);
  return (
    <div className="mt-4 border-t border-stone-200 dark:border-stone-800 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Feedback · {score}% words correct
        </p>
        <button
          onClick={onReset}
          className="text-xs text-stone-500 dark:text-stone-400 hover:underline"
        >
          retry
        </button>
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
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}
