/* =============================================================================
   ShareButton (share popover) + SettingsSidebar (language / spectrum model /
   theme). Ported 1:1 from project/settings.jsx.
   ============================================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Strings, Lang } from "../i18n";
import { StoryImage } from "../save-image";
import {
  IconShare,
  IconLink,
  IconCheck,
  IconClose,
  IconTwitter,
  IconFacebook,
  IconShareUp,
  IconImage,
  IconSpinner,
  SunGlyph,
  MoonGlyph,
} from "./icons";

export function ShareButton({ T }: { T: Strings }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "busy" | "done">("idle");
  const [shareState, setShareState] = useState<"idle" | "busy">("idle");
  const ref = useRef<HTMLDivElement | null>(null);

  const canShareImg = useMemo(
    () => !!(StoryImage && StoryImage.canShareImage && StoryImage.canShareImage()),
    []
  );

  async function shareImage() {
    if (shareState === "busy") return;
    setShareState("busy");
    try {
      await StoryImage.shareImage({
        lang: T.locale === "id-ID" ? "id" : "en",
        title: T.name,
        text: shareText(),
      });
    } catch {
      /* cancelled / unsupported — no-op */
    }
    setShareState("idle");
  }

  async function saveImage() {
    if (saveState === "busy") return;
    setSaveState("busy");
    try {
      await StoryImage.saveImage({ lang: T.locale === "id-ID" ? "id" : "en" });
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("idle");
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function copy() {
    const url = window.location.href;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
      done();
    }
  }

  function utcOffset() {
    const off = -new Date().getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const h = Math.floor(Math.abs(off) / 60),
      m = Math.abs(off) % 60;
    return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
  }

  function shareText(): string {
    const D = window.IHSG_DATA;
    const fmt = (n: number, dec = 2) =>
      Number(n).toLocaleString(T.locale, {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
    const value = D.latest.value;
    // day change vs the previous close (Google-Finance "Today"), with the
    // first 1D point as a fallback when stats are unavailable
    // Before the first quote arrives the 1D series is empty (emptyData()), so
    // every term can be absent — guard the point deref and the 0-divide so the
    // Share menu (shareText runs on every render) never crashes on cold load.
    const base =
      D.ranges["1D"].baseline ?? (D.stats.prevClose || D.ranges["1D"].points[0]?.v) ?? 0;
    const diff = value - base;
    const pct = base ? (diff / base) * 100 : 0;
    const up = diff >= 0;
    const arrow = up ? "▲" : "▼";
    const sign = up ? "+" : "−";
    const d = new Date(D.latest.ts);
    const mo = T.mon[d.getMonth()];
    const time = `${String(d.getHours()).padStart(2, "0")}${T.timeSep}${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
    const datePart =
      T.locale === "id-ID"
        ? `${d.getDate()} ${mo} ${d.getFullYear()}`
        : `${mo} ${d.getDate()}, ${d.getFullYear()}`;
    return [
      T.name,
      fmt(value),
      `${sign}${fmt(Math.abs(diff))} (${arrow}${fmt(Math.abs(pct))}%)`,
      `${datePart} | ${time} ${utcOffset()}`,
      "",
      `${T.sourceLabel}: ${window.location.href}`,
    ].join("\n");
  }

  const text = shareText();
  const url = window.location.href;
  const xHref = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
  const fbHref =
    "https://www.facebook.com/sharer/sharer.php?u=" +
    encodeURIComponent(url) +
    "&quote=" +
    encodeURIComponent(text);

  return (
    <div className="action-wrap" ref={ref}>
      <button
        className="icon-btn"
        aria-label={T.share}
        title={T.share}
        onClick={() => setOpen((o) => !o)}
      >
        <IconShare />
      </button>
      {open && (
        <div className="popover" role="menu">
          <button className="popover-item" onClick={copy}>
            <span className={"pop-icon" + (copied ? " ok" : "")}>
              {copied ? <IconCheck /> : <IconLink />}
            </span>
            <span>{copied ? T.copied : T.copyLink}</span>
          </button>
          <button className="popover-item" onClick={saveImage}>
            <span className={"pop-icon" + (saveState === "done" ? " ok" : "")}>
              {saveState === "busy" ? (
                <IconSpinner />
              ) : saveState === "done" ? (
                <IconCheck />
              ) : (
                <IconImage />
              )}
            </span>
            <span>
              {saveState === "busy" ? T.savingImage : saveState === "done" ? T.savedImage : T.saveImage}
            </span>
          </button>
          {canShareImg && (
            <button className="popover-item" onClick={shareImage}>
              <span className="pop-icon">
                {shareState === "busy" ? <IconSpinner /> : <IconShareUp />}
              </span>
              <span>{shareState === "busy" ? T.preparingImage : T.shareImage}</span>
            </button>
          )}
          <a
            className="popover-item"
            role="menuitem"
            target="_blank"
            rel="noopener noreferrer"
            href={xHref}
          >
            <span className="pop-icon">
              <IconTwitter />
            </span>
            <span>{T.shareTwitter}</span>
          </a>
          <a
            className="popover-item"
            role="menuitem"
            target="_blank"
            rel="noopener noreferrer"
            href={fbHref}
          >
            <span className="pop-icon">
              <IconFacebook />
            </span>
            <span>{T.shareFacebook}</span>
          </a>
        </div>
      )}
    </div>
  );
}

export function SettingsSidebar({
  open,
  onClose,
  T,
  lang,
  setLang,
  theme,
  setTheme,
  model,
  setModel,
}: {
  open: boolean;
  onClose: () => void;
  T: Strings;
  lang: Lang;
  setLang: (v: Lang) => void;
  theme: string;
  setTheme: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={"settings-root" + (open ? " open" : "")} aria-hidden={!open}>
      <div className="settings-scrim" onClick={onClose} />
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-label={T.settings}>
        <div className="settings-head">
          <h2>{T.settings}</h2>
          <button className="icon-btn ghost" aria-label={T.close} onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <div className="settings-body">
          <section className="set-section">
            <div className="set-label">{T.language}</div>
            <div className="opt-list">
              {([["id", "Indonesia"], ["en", "English"]] as [Lang, string][]).map(([code, name]) => (
                <button
                  key={code}
                  className={"opt-row" + (lang === code ? " active" : "")}
                  onClick={() => setLang(code)}
                >
                  <span>{name}</span>
                  {lang === code && (
                    <span className="opt-check">
                      <IconCheck />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="set-section">
            <div className="set-label">{T.spectrum}</div>
            <div className="model-grid">
              {["BASS", "MID", "FULL", "WAVE", "MAX"].map((m) => (
                <button
                  key={m}
                  className={"model-btn" + (model === m ? " active" : "")}
                  onClick={() => setModel(m)}
                >
                  {m[0] + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </section>

          <section className="set-section">
            <div className="set-label">{T.appearance}</div>
            <div className="seg">
              <button
                className={"seg-btn" + (theme === "light" ? " active" : "")}
                onClick={() => setTheme("light")}
              >
                <SunGlyph /> {T.light}
              </button>
              <button
                className={"seg-btn" + (theme === "dark" ? " active" : "")}
                onClick={() => setTheme("dark")}
              >
                <MoonGlyph /> {T.dark}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
