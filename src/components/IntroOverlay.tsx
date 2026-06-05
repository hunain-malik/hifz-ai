"use client";

import { useEffect, useRef, useState } from "react";

// First-load intro: black overlay with بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
// in Amiri Quran, sway-animated like a flag carried by wind (CSS 3D
// transforms — not water-ripple SVG turbulence). Mishary's recitation
// of 1:1 from the EveryAyah CDN. Text only appears when audio is
// actually playing; on dismiss, ONLY the text fades — the black
// background stays solid through the fade, and the platform appears
// instantly once the overlay unmounts.

const AUDIO_URL = "https://everyayah.com/data/Alafasy_128kbps/001001.mp3";
const TEXT_FADE_MS = 700;
const BLACK_HOLD_MS = 250;
const AUDIO_SYNC_SAFETY_MS = 2500;
const AUDIO_FALLBACK_HOLD_MS = 5000;

export function IntroOverlay() {
  const [show, setShow] = useState(true);
  const [textVisible, setTextVisible] = useState(false);
  const [textFading, setTextFading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const syncSafetyTimer = useRef<number | null>(null);
  const startedRef = useRef(false);
  const didDismissRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio(AUDIO_URL);
    audio.crossOrigin = "anonymous";
    audio.volume = 0.8;
    audio.preload = "auto";
    audioRef.current = audio;

    function startVisual() {
      if (startedRef.current) return;
      startedRef.current = true;
      setTextVisible(true);
    }

    function dismiss() {
      if (didDismissRef.current) return;
      didDismissRef.current = true;
      setTextFading(true);
      // After the text has fully faded AND a short all-black hold, drop
      // the overlay — the platform underneath then appears immediately.
      hideTimer.current = window.setTimeout(() => {
        audio.pause();
        audio.src = "";
        setShow(false);
      }, TEXT_FADE_MS + BLACK_HOLD_MS);
    }

    // Reveal the text the moment audio is actually playing — closes the
    // "text on screen but audio silent" gap the user was hitting.
    audio.addEventListener("playing", startVisual, { once: true });
    audio.onended = dismiss;
    audio.onerror = () => {
      startVisual();
      if (!didDismissRef.current && fallbackTimer.current === null) {
        fallbackTimer.current = window.setTimeout(
          dismiss,
          AUDIO_FALLBACK_HOLD_MS
        );
      }
    };

    void audio.play().catch(() => {
      // Autoplay blocked — show the text anyway after a beat and use the
      // fallback hold so the visual still has presence.
      startVisual();
      if (!didDismissRef.current && fallbackTimer.current === null) {
        fallbackTimer.current = window.setTimeout(
          dismiss,
          AUDIO_FALLBACK_HOLD_MS
        );
      }
    });

    // Safety net: if 'playing' hasn't fired within ~2.5s (slow network),
    // reveal the text so the user isn't staring at black forever.
    syncSafetyTimer.current = window.setTimeout(() => {
      startVisual();
      if (!didDismissRef.current && fallbackTimer.current === null) {
        fallbackTimer.current = window.setTimeout(
          dismiss,
          AUDIO_FALLBACK_HOLD_MS
        );
      }
    }, AUDIO_SYNC_SAFETY_MS);

    return () => {
      if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      if (syncSafetyTimer.current !== null)
        clearTimeout(syncSafetyTimer.current);
      audio.pause();
      audio.src = "";
    };
  }, []);

  function skip() {
    if (textFading) return;
    setTextFading(true);
    if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current);
    if (syncSafetyTimer.current !== null)
      clearTimeout(syncSafetyTimer.current);
    audioRef.current?.pause();
    hideTimer.current = window.setTimeout(
      () => setShow(false),
      TEXT_FADE_MS + BLACK_HOLD_MS
    );
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bismillah"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      {textVisible && (
        <span
          className="intro-bismillah"
          aria-hidden="true"
          style={{
            opacity: textFading ? 0 : 1,
            transition: `opacity ${TEXT_FADE_MS}ms ease-out`,
          }}
        >
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </span>
      )}
      <button
        type="button"
        onClick={skip}
        className="absolute bottom-6 right-6 text-[11px] uppercase tracking-wider text-white/55 hover:text-white/90 transition-colors px-2 py-1"
        aria-label="Skip intro"
      >
        skip
      </button>
    </div>
  );
}
