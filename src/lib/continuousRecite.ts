import type { Verse } from "./quran";
import { transcribe } from "./whisper";

export type ContinuousCallbacks = {
  onActiveVerseChanged: (verseNumber: number | null) => void;
  onTranscribing: (verseNumber: number) => void;
  onResult: (verseNumber: number, transcript: string) => void;
  onError: (verseNumber: number | null, message: string) => void;
  onComplete: () => void;
  onMicLevel?: (level: number, threshold: number, isSilent: boolean) => void;
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
  silenceDurationMs?: number;
  minSegmentMs?: number;
  callbacks: ContinuousCallbacks;
}): Promise<ContinuousHandle> {
  const startIndex = opts.startIndex ?? 0;
  const SILENCE_DURATION_MS = opts.silenceDurationMs ?? 900;
  const MIN_SEGMENT_MS = opts.minSegmentMs ?? 700;
  const CALIBRATION_MS = 600;
  const MIN_THRESHOLD = 0.012;
  const THRESHOLD_MULTIPLIER = 2.2;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  });

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioContext = new AudioCtx();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const timeData = new Uint8Array(analyser.frequencyBinCount);

  let currentIndex = startIndex;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let silenceStart: number | null = null;
  let segmentStart = 0;
  let stopped = false;
  let transitioning = false;
  let rafHandle: number | null = null;

  let silenceThreshold = MIN_THRESHOLD;
  let ambientSamples: number[] = [];
  let calibratedAt: number | null = null;

  function computeRms(): number {
    analyser.getByteTimeDomainData(timeData);
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sumSquares += v * v;
    }
    return Math.sqrt(sumSquares / timeData.length);
  }

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
          .catch((err) => {
            opts.callbacks.onError(
              myVerseNumber,
              err instanceof Error ? err.message : "Transcription failed."
            );
            opts.callbacks.onResult(myVerseNumber, "");
          });

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

    const rms = computeRms();
    const now = performance.now();

    if (calibratedAt === null) {
      ambientSamples.push(rms);
      if (now - segmentStart < CALIBRATION_MS) {
        opts.callbacks.onMicLevel?.(rms, silenceThreshold, false);
        return;
      }
      ambientSamples.sort((a, b) => a - b);
      const median =
        ambientSamples[Math.floor(ambientSamples.length / 2)] ?? MIN_THRESHOLD;
      silenceThreshold = Math.max(
        MIN_THRESHOLD,
        median * THRESHOLD_MULTIPLIER
      );
      ambientSamples = [];
      calibratedAt = now;
    }

    const isSilent = rms < silenceThreshold;
    opts.callbacks.onMicLevel?.(rms, silenceThreshold, isSilent);

    if (transitioning || !recorder || recorder.state !== "recording") return;

    if (isSilent) {
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
