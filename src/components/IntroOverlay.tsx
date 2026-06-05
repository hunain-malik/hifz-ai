"use client";

import { useEffect, useRef, useState } from "react";

// First-visit intro: black overlay with بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
// in the same Amiri Quran face the ayahs use, rendered with an SVG
// turbulence filter to ripple like cloth on a flag, plus Mishary
// Al-Afasy's recitation of 1:1 from EveryAyah's CDN. Plays on every
// fresh page load (no localStorage gate). Only the explicit skip
// button (or the timer) dismisses — taps on the rest of the overlay
// no longer auto-close.

const TOTAL_MS = 7000;
const FADE_MS = 1200;
const AUDIO_URL = "https://everyayah.com/data/Alafasy_128kbps/001001.mp3";

export function IntroOverlay() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio(AUDIO_URL);
    audio.crossOrigin = "anonymous";
    audio.volume = 0.8;
    audioRef.current = audio;
    void audio.play().catch(() => {
      // Autoplay blocked — visual still proceeds.
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
      aria-label="Bismillah"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity ease-out ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* SVG filter defs — feTurbulence + feDisplacementMap distorts the
          text pixels like a fluttering fabric. The baseFrequency animation
          shifts the noise pattern over time so the ripple flows. */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0 }}
      >
        <defs>
          <filter id="intro-flag-wave">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.012 0.022"
              numOctaves="2"
              seed="3"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="8s"
                values="0.012 0.022; 0.018 0.014; 0.012 0.022"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <span className="intro-bismillah" aria-hidden="true">
        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
      </span>
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
