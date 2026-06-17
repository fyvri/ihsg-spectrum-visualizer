/* Shared SVG icons, ported verbatim from the prototype's inline glyphs. */
import type { JSX } from "react";

export const IconPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
  </svg>
);
export const IconPause = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6.5" y="4.5" width="3.6" height="15" rx="1.1" fill="currentColor" />
    <rect x="13.9" y="4.5" width="3.6" height="15" rx="1.1" fill="currentColor" />
  </svg>
);
export const IconLoop = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M17 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconVol = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    <path d="M16.5 8.5a5 5 0 010 7M19 6a8 8 0 010 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
export const IconVolMute = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
export const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 16V4M12 4L7 9M12 4l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconNote = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
export const IconLibrary = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
export const IconDevice = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M2 21h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
export const IconYouTube = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2.5" y="6" width="19" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10.2 9.4l4.4 2.6-4.4 2.6V9.4z" fill="currentColor" />
  </svg>
);
export const IconCheckSm = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/* ---- share + settings ---- */
export const IconShare = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="18" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="18" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
export const IconLink = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9.5 13.5a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14.5 10.5a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconGear = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconCheck = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconTwitter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" fill="currentColor" />
  </svg>
);
export const IconFacebook = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" fill="currentColor" />
  </svg>
);
export const IconShareUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 15V4M12 4L8.5 7.5M12 4l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 10.5H5.8A1.8 1.8 0 004 12.3v6.4A1.8 1.8 0 005.8 20.5h12.4a1.8 1.8 0 001.8-1.8v-6.4a1.8 1.8 0 00-1.8-1.8H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconImage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="8.5" cy="9" r="1.7" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconSpinner = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 0.7s linear infinite" }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.25" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
export const SunGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19 5l-1.8 1.8M6.8 17.2L5 19M19 19l-1.8-1.8M6.8 6.8L5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
export const MoonGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export function ArrowGlyph({ up }: { up: boolean }): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: up ? "none" : "rotate(180deg)" }}>
      <path d="M12 4 L12 20 M12 4 L6 11 M12 4 L18 11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
