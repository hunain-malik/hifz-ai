"use client";

import { useEffect, useRef, useState } from "react";

// First-visit intro: black overlay, الله in the center with a gentle flag-like
// sway, and an attempt to play the opening of the adhan from /public/adhan.mp3.
//
// Browser autoplay policies block sound on a first-ever visit with no prior
// user gesture — the visual still runs; the audio is best-effort. Returning
// users won't see this again (localStorage flag).

const STORAGE_KEY = "hifz-ai.intro-shown";
const TOTAL_MS = 6000;
const FADE_MS = 1100;

export function IntroOverlay() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    setShow(true);
    window.localStorage.setItem(STORAGE_KEY, "1");

    const audio = new Audio("/adhan.mp3");
    audio.volume = 0.75;
    audioRef.current = audio;
    void audio.play().catch(() => {
      // Autoplay blocked or file missing — visual continues regardless.
    });

    fadeTimer.current = window.setTimeout(() => {
      setFading(true);
    }, TOTAL_MS - FADE_MS);

    hideTimer.current = window.setTimeout(() => {
      audio.pause();
      audio.src = "";
      setShow(false);
    }, TOTAL_MS);

    return () => {
      if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      audio.pause();
      audio.src = "";
    };
  }, []);

  function skip() {
    if (fading) return;
    setFading(true);
    if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    audioRef.current?.pause();
    window.setTimeout(() => setShow(false), FADE_MS);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      onClick={skip}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black cursor-pointer transition-opacity duration-[1100ms] ease-out ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <span
        className="arabic intro-allah select-none"
        aria-hidden="true"
        style={{
          color: "#f5f5f4",
          textShadow:
            "0 0 60px rgba(255,255,255,0.35), 0 0 120px rgba(255,255,255,0.15)",
          lineHeight: 1,
        }}
      >
        الله
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
        className="absolute bottom-6 right-6 text-[11px] uppercase tracking-wider text-white/50 hover:text-white/90 transition-colors"
        aria-label="Skip intro"
      >
        skip
      </button>
    </div>
  );
}
