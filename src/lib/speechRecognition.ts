type SpeechRecognitionEvent = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEvent = Event & { error: string };

type SpeechRecognition = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionAvailable(): boolean {
  return getSpeechRecognition() !== null;
}

export type Recognizer = {
  stop: () => void;
  abort: () => void;
};

export function startRecognition(opts: {
  lang?: string;
  onResult: (transcript: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): Recognizer | null {
  const Ctor = getSpeechRecognition();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang ?? "ar-SA";
  rec.continuous = false;
  rec.interimResults = false;

  let resolved = false;
  rec.onresult = (e) => {
    resolved = true;
    const transcript = Array.from(e.results)
      .map((r) => r[0]?.transcript ?? "")
      .join(" ")
      .trim();
    opts.onResult(transcript);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech") {
      opts.onError("No speech detected — try again, closer to the mic.");
    } else if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      opts.onError("Microphone permission denied.");
    } else {
      opts.onError(`Speech recognition failed: ${e.error}`);
    }
  };
  rec.onend = () => {
    if (!resolved) opts.onResult("");
    opts.onEnd();
  };
  rec.start();
  return {
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  };
}
