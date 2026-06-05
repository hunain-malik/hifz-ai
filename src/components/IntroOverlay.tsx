"use client";

import { useEffect, useRef, useState } from "react";

// First-visit intro: black overlay with بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
// in the same Amiri Quran face the ayahs use, rendered with an SVG
// turbulence filter to ripple slowly like fabric in wind. The
// recitation of 1:1 (Mishary, EveryAyah CDN) plays the moment the
// text appears, the overlay holds for the full audio length, then
// fades out quickly into the platform.

const AUDIO_URL = "https://everyayah.com/data/Alafasy_128kbps/001001.mp3";
const FADE_OUT_MS = 700;
// Safety net: if audio fails to load OR neither onended nor onerror
// fires for some reason, dismiss after this long anyway.
const SAFETY_MAX_MS = 7500;

export function IntroOverlay() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);
  const didDismissRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio(AUDIO_URL);
    audio.crossOrigin = "anonymous";
    audio.volume = 0.8;
    audio.preload = "auto";
    audioRef.current = audio;

    function dismiss() {
      if (didDismissRef.current) return;
      didDismissRef.current = true;
      setFading(true);
      hideTimer.current = window.setTimeout(() => {
        audio.pause();
        audio.src = "";
        setShow(false);
      }, FADE_OUT_MS);
    }

    audio.onended = dismiss;
    audio.onerror = () => {
      // Audio failed to load — fall back to a sensible 5s hold so the
      // visual still has presence before fading out.
      if (!didDismissRef.current) {
        fadeTimer.current = window.setTimeout(dismiss, 5000);
      }
    };

    void audio.play().catch(() => {
      // Autoplay blocked. Visual still proceeds; fade out after 5s.
      if (!didDismissRef.current) {
        fadeTimer.current = window.setTimeout(dismiss, 5000);
      }
    });

    safetyTimer.current = window.setTimeout(dismiss, SAFETY_MAX_MS);

    return () => {
      if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      if (safetyTimer.current !== null) clearTimeout(safetyTimer.current);
      audio.pause();
      audio.src = "";
    };
  }, []);

  function skip() {
    if (fading) return;
    setFading(true);
    if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    if (safetyTimer.current !== null) clearTimeout(safetyTimer.current);
    audioRef.current?.pause();
    hideTimer.current = window.setTimeout(() => setShow(false), FADE_OUT_MS);
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
      style={{ transitionDuration: `${FADE_OUT_MS}ms` }}
    >
      {/* SVG filter — lower base frequency = larger wave wavelength
          (a flag flowing in wind), slow 14s animation cycle so the
          ripple feels majestic, not buzzy. */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0 }}
      >
        <defs>
          <filter id="intro-flag-wave">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.006 0.010"
              numOctaves="1"
              seed="2"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="14s"
                values="0.006 0.010; 0.009 0.007; 0.006 0.010"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="24"
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
