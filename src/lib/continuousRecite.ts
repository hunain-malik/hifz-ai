import type { Verse } from "./quran";
import {
  transcribeFloat32WithTimings,
  transcribeWithTimings,
  type WordTiming,
} from "./whisper";
import { alignUserToExpected, diffRecitation, tokenize } from "./diff";

export type ContinuousCallbacks = {
  onActiveVerseChanged: (verseNumber: number | null) => void;
  onTranscribing: (verseNumber: number) => void;
  onResult: (
    verseNumber: number,
    transcript: string,
    audioBlob: Blob,
    words: WordTiming[]
  ) => void;
  onError: (verseNumber: number | null, message: string) => void;
  onComplete: () => void;
  onMicLevel?: (level: number, threshold: number, isSilent: boolean) => void;
  /** Live word index in the EXPECTED ayah text being highlighted right now. */
  onLiveExpectedWordIdx?: (verseNumber: number, expectedIdx: number) => void;
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
  liveHighlights?: boolean;
  livePollMs?: number;
  callbacks: ContinuousCallbacks;
}): Promise<ContinuousHandle> {
  const startIndex = opts.startIndex ?? 0;
  const SILENCE_DURATION_MS = opts.silenceDurationMs ?? 900;
  const MIN_SEGMENT_MS = opts.minSegmentMs ?? 700;
  const CALIBRATION_MS = 600;
  const MIN_THRESHOLD = 0.012;
  const THRESHOLD_MULTIPLIER = 2.2;
  const LIVE_POLL_MS = opts.livePollMs ?? 1500;
  const LIVE_MAX_BUFFER_SEC = 12;
  const SAMPLE_RATE = 16000;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  });

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioContext = new AudioCtx({ sampleRate: SAMPLE_RATE });
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const timeData = new Uint8Array(analyser.frequencyBinCount);

  // Live PCM ring buffer for streaming transcription (Phase B)
  let liveBuffer: Float32Array[] = [];
  let liveBufferSamples = 0;
  let liveProcessor: ScriptProcessorNode | null = null;
  let liveTranscribing = false;
  let livePollTimer: number | null = null;
  let liveSegmentSampleStart = 0; // samples since this verse's segment began
  let totalSamples = 0;

  if (opts.liveHighlights !== false) {
    const bufferSize = 4096;
    liveProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    liveProcessor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      liveBuffer.push(new Float32Array(data));
      liveBufferSamples += data.length;
      totalSamples += data.length;
      // Drop old samples to keep buffer bounded
      const maxSamples = LIVE_MAX_BUFFER_SEC * SAMPLE_RATE;
      while (liveBufferSamples > maxSamples && liveBuffer.length > 1) {
        const dropped = liveBuffer.shift()!;
        liveBufferSamples -= dropped.length;
        liveSegmentSampleStart = Math.max(
          0,
          liveSegmentSampleStart - dropped.length
        );
      }
    };
    source.connect(liveProcessor);
    liveProcessor.connect(audioContext.destination);
  }

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
    liveSegmentSampleStart = totalSamples;
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
        transcribeWithTimings(blob)
          .then(({ text, words }) =>
            opts.callbacks.onResult(
              myVerseNumber,
              text.trim(),
              blob,
              words
            )
          )
          .catch((err) => {
            opts.callbacks.onError(
              myVerseNumber,
              err instanceof Error ? err.message : "Transcription failed."
            );
            opts.callbacks.onResult(myVerseNumber, "", blob, []);
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
    if (livePollTimer !== null) {
      clearTimeout(livePollTimer);
      livePollTimer = null;
    }
    if (liveProcessor) {
      liveProcessor.disconnect();
      liveProcessor.onaudioprocess = null;
      liveProcessor = null;
    }
    stream.getTracks().forEach((t) => t.stop());
    if (audioContext.state !== "closed") void audioContext.close();
    opts.callbacks.onActiveVerseChanged(null);
    opts.callbacks.onComplete();
  }

  async function pollLive() {
    if (stopped || liveTranscribing) {
      schedulePoll();
      return;
    }
    if (currentIndex >= opts.verses.length) return;
    // Grab the audio for the current segment only (samples since segment start)
    const segmentSamples = totalSamples - liveSegmentSampleStart;
    if (segmentSamples < SAMPLE_RATE * 0.5) {
      // Less than 0.5s captured for this segment; skip
      schedulePoll();
      return;
    }
    // Concat buffer chunks into single Float32 covering current segment
    const total = liveBufferSamples;
    const overall = new Float32Array(total);
    let offset = 0;
    for (const chunk of liveBuffer) {
      overall.set(chunk, offset);
      offset += chunk.length;
    }
    // Slice from segmentStart to end. liveSegmentSampleStart is in *current
    // buffer* coords (we adjusted it when dropping old chunks).
    const sliceStart = Math.max(0, liveSegmentSampleStart);
    const segmentAudio = overall.subarray(sliceStart);
    if (segmentAudio.length < SAMPLE_RATE * 0.5) {
      schedulePoll();
      return;
    }
    const liveVerseNumber = opts.verses[currentIndex].verse_number;
    const expectedText = opts.verses[currentIndex].text_uthmani;

    liveTranscribing = true;
    try {
      const { text } = await transcribeFloat32WithTimings(
        new Float32Array(segmentAudio)
      );
      if (stopped || liveVerseNumber !== opts.verses[currentIndex].verse_number) {
        liveTranscribing = false;
        return;
      }
      const tokens = diffRecitation(expectedText, text);
      const alignment = alignUserToExpected(tokens);
      const userTokens = tokenize(text);
      const lastUserIdx = userTokens.length - 1;
      if (lastUserIdx >= 0 && lastUserIdx < alignment.length) {
        const expectedIdx = alignment[lastUserIdx];
        if (expectedIdx >= 0) {
          opts.callbacks.onLiveExpectedWordIdx?.(liveVerseNumber, expectedIdx);
        }
      }
    } catch {
      // Live transcription failures are non-fatal; just skip this round
    }
    liveTranscribing = false;
    schedulePoll();
  }

  function schedulePoll() {
    if (stopped || !opts.liveHighlights) return;
    livePollTimer = window.setTimeout(() => {
      void pollLive();
    }, LIVE_POLL_MS);
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
  if (opts.liveHighlights !== false) {
    schedulePoll();
  }

  return { stop, skipCurrent };
}
