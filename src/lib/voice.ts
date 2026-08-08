// SANAD · voice interface ("Hey Sanad").
//
// Wake-word + command capture over the browser's Web Speech API, and spoken
// responses over speechSynthesis. Chromium-only (same constraint as the
// app's original recite mode). The recognizer runs continuously in wake
// mode; when a wake phrase is heard it either takes the rest of the same
// utterance as the command ("hey sanad recite surah al-mulk") or waits,
// briefly, for the next utterance.

export type VoiceState =
  | "off"
  | "listening" // waiting for the wake word
  | "awaiting-command" // wake word heard, waiting for the request
  | "unsupported"
  | "error";

export type VoiceCallbacks = {
  onState: (state: VoiceState, detail?: string) => void;
  onWake: () => void;
  onCommand: (text: string) => void;
};

export type VoiceController = {
  stop: () => void;
};

// The en-US recognizer mangles "Sanad" freely — accept its usual guesses.
const WAKE_RE =
  /\b(?:hey|hi|ok|okay|yo)?[\s,]*(?:sanad|sannad|sunad|sanaad|samad|summad|sanid|senad|snad)\b/i;

const COMMAND_TIMEOUT_MS = 9000;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function startVoice(callbacks: VoiceCallbacks): VoiceController {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    callbacks.onState("unsupported");
    return { stop: () => {} };
  }

  let stopped = false;
  let mode: "wake" | "command" = "wake";
  let commandTimer: ReturnType<typeof setTimeout> | null = null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  function enterWakeMode() {
    mode = "wake";
    if (commandTimer) clearTimeout(commandTimer);
    commandTimer = null;
    if (!stopped) callbacks.onState("listening");
  }

  function enterCommandMode() {
    mode = "command";
    callbacks.onWake();
    callbacks.onState("awaiting-command");
    if (commandTimer) clearTimeout(commandTimer);
    commandTimer = setTimeout(enterWakeMode, COMMAND_TIMEOUT_MS);
  }

  function handleCommand(raw: string) {
    const text = raw.trim();
    if (!text) return;
    if (commandTimer) clearTimeout(commandTimer);
    commandTimer = null;
    mode = "wake";
    callbacks.onCommand(text);
    if (!stopped) callbacks.onState("listening");
  }

  rec.onresult = (event) => {
    if (stopped) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const transcript = res[0]?.transcript ?? "";
      if (mode === "wake") {
        const m = transcript.match(WAKE_RE);
        if (!m) continue;
        const after = transcript
          .slice((m.index ?? 0) + m[0].length)
          .replace(/^[\s,.!?]+/, "");
        // Same utterance carries the request: "hey sanad recite al-mulk"
        if (res.isFinal && after.split(/\s+/).filter(Boolean).length >= 2) {
          callbacks.onWake();
          handleCommand(after);
        } else if (res.isFinal) {
          enterCommandMode();
        }
        // Interim wake matches wait for the final result to decide.
      } else if (mode === "command" && res.isFinal) {
        // Strip a repeated wake phrase if the user says it again.
        const cleaned = transcript.replace(WAKE_RE, "").replace(/^[\s,.!?]+/, "");
        handleCommand(cleaned);
      }
    }
  };

  rec.onerror = (event) => {
    if (stopped) return;
    const err = event.error ?? "";
    // no-speech / aborted are routine in continuous mode; onend restarts.
    if (err === "not-allowed" || err === "service-not-allowed") {
      stopped = true;
      callbacks.onState(
        "error",
        "Microphone permission denied — allow mic access and toggle voice back on."
      );
    } else if (err === "network") {
      callbacks.onState(
        "error",
        "Speech service unreachable — voice needs an online Chromium browser."
      );
    }
  };

  // Chromium ends continuous sessions at will; restart until told to stop.
  rec.onend = () => {
    if (stopped) return;
    try {
      rec.start();
    } catch {
      // start() throws if a session is already pending — ignore.
    }
  };

  try {
    rec.start();
    callbacks.onState("listening");
  } catch {
    callbacks.onState("error", "Could not start speech recognition.");
  }

  return {
    stop: () => {
      stopped = true;
      if (commandTimer) clearTimeout(commandTimer);
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        // already stopped
      }
      callbacks.onState("off");
    },
  };
}

// ── Spoken responses ───────────────────────────────────────────────────

/** Speak a short English response, Jarvis-style. Cancels anything queued. */
export function speak(text: string, opts?: { rate?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = opts?.rate ?? 1.02;
  u.pitch = 1;
  synth.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
