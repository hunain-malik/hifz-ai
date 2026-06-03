import type { Verse } from "./quran";
import { transcribe } from "./whisper";

export type ContinuousCallbacks = {
  onActiveVerseChanged: (verseNumber: number | null) => void;
  onTranscribing: (verseNumber: number) => void;
  onResult: (verseNumber: number, transcript: string) => void;
  onError: (message: string) => void;
  onComplete: () => void;
};

export type ContinuousHandle = {
  stop: () => void;
  skipCurrent: () => void;
};

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

export async function startContinuousRecite(opts: {
  verses: Verse[];
  startIndex?: number;
  silenceRmsThreshold?: number;
  silenceDurationMs?: number;
  minSegmentMs?: number;
  callbacks: ContinuousCallbacks;
}): Promise<ContinuousHandle> {
  const startIndex = opts.startIndex ?? 0;
  const SILENCE_THRESHOLD = opts.silenceRmsThreshold ?? 0.015;
  const SILENCE_DURATION_MS = opts.silenceDurationMs ?? 1300;
  const MIN_SEGMENT_MS = opts.minSegmentMs ?? 800;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioContext = new AudioCtx();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  let currentIndex = startIndex;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let silenceStart: number | null = null;
  let segmentStart = 0;
  let stopped = false;
  let transitioning = false;
  let rafHandle: number | null = null;

  function startSegment() {
    if (stopped || currentIndex >= opts.verses.length) return;
    chunks = [];
    silenceStart = null;
    segmentStart = performance.now();
    const mime = pickMimeType();
    const r = new MediaRecorder(
      stream,
      mime ? { mimeType: mime } : undefined
    );
    r.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    r.onstop = () => {
      const myVerseNumber = opts.verses[currentIndex].verse_number;
      const blob = new Blob(chunks, {
        type: r.mimeType || "audio/webm",
      });

      if (!stopped) {
        opts.callbacks.onTranscribing(myVerseNumber);
        transcribe(blob)
          .then((text) =>
            opts.callbacks.onResult(myVerseNumber, text.trim())
          )
          .catch((err) =>
            opts.callbacks.onError(
              err instanceof Error ? err.message : "Transcription failed."
            )
          );

        currentIndex++;
        if (currentIndex < opts.verses.length) {
          opts.callbacks.onActiveVerseChanged(
            opts.verses[currentIndex].verse_number
          );
          startSegment();
        } else {
          finalize();
        }
      }
      transitioning = false;
    };
    recorder = r;
    r.start();
    opts.callbacks.onActiveVerseChanged(
      opts.verses[currentIndex].verse_number
    );
  }

  function tick() {
    if (stopped) return;
    rafHandle = requestAnimationFrame(tick);
    if (transitioning || !recorder || recorder.state !== "recording") return;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buffer);
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);

    const now = performance.now();
    if (rms < SILENCE_THRESHOLD) {
      if (silenceStart === null) silenceStart = now;
      else if (
        now - silenceStart > SILENCE_DURATION_MS &&
        now - segmentStart > MIN_SEGMENT_MS
      ) {
        transitioning = true;
        recorder.stop();
      }
    } else {
      silenceStart = null;
    }
  }

  function finalize() {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    stream.getTracks().forEach((t) => t.stop());
    if (audioContext.state !== "closed") void audioContext.close();
    opts.callbacks.onActiveVerseChanged(null);
    opts.callbacks.onComplete();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    } else {
      finalize();
    }
  }

  function skipCurrent() {
    if (
      stopped ||
      transitioning ||
      !recorder ||
      recorder.state !== "recording"
    )
      return;
    transitioning = true;
    recorder.stop();
  }

  startSegment();
  tick();

  return { stop, skipCurrent };
}
