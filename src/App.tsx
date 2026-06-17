/* =============================================================================
   App — IDX Composite (IHSG) view. Ported from project/app.jsx. The dev-only
   Tweaks panel is intentionally dropped; its values (defaultRange, spectrum
   intensity) live on as persisted prefs. Settings expose language / spectrum
   model / theme, exactly like the prototype.
   ============================================================================= */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { I18N, type Lang, type Strings } from "./i18n";
import { useIhsgData } from "./data";
import { useAudioEngine, type AudioEngine } from "./audio/useAudioEngine";
import { SpectrumChart } from "./components/SpectrumChart";
import { PlayerBar } from "./components/Player";
import { InfoSections } from "./components/Sections";
import { ShareButton, SettingsSidebar } from "./components/Settings";
import { ArrowGlyph, IconGear } from "./components/icons";
import type { RangeKey } from "../shared/types";
import { BRAND_NAME, BRAND_URL } from "./config";

interface Prefs {
  theme: string;
  lang: Lang;
  model: string;
  defaultRange: RangeKey;
  spectrumIntensity: number;
  range?: RangeKey;
}

const DEFAULTS: Prefs = {
  theme: "light",
  lang: "id",
  model: "FULL",
  defaultRange: "1D",
  spectrumIntensity: 2.0,
};

const VALID_MODELS = ["BASS", "MID", "FULL", "WAVE", "MAX"];
const LS_KEY = "ihsg.prefs.v1";

/** Device color scheme — used only on the very first render when the user has
   no saved theme yet. Falls back to the light default if unsupported. */
function deviceTheme(): string {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return DEFAULTS.theme;
  }
}

function loadPrefs(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "") || {};
  } catch {
    return {};
  }
}
function savePrefs(patch: Partial<Prefs>) {
  try {
    const next = { ...loadPrefs(), ...patch };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function makeFmt(locale: string) {
  return (n: number, dec = 2) =>
    Number(n).toLocaleString(locale, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
}

function localUtcOffset(): string {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(off) / 60);
  const m = Math.abs(off) % 60;
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

function fmtStamp(ms: number, T: Strings): string {
  const d = new Date(ms);
  const mo = T.mon[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mo} ${d.getDate()}, ${hh}:${mm} ${localUtcOffset()}`;
}

function StatRow({ label, labelShort, value }: { label: string; labelShort?: string; value: string }) {
  const short = labelShort || label;
  const full = label || short;
  return (
    <div className="stat-row">
      <span className="stat-label">
        <span className="lbl-full">{full}</span>
        <span className="lbl-short">{short}</span>
      </span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Render `newStr` as a row of cells: every DIGIT is a vertical reel (a 0-9 strip
   that translateY's to show one digit) and separators/signs are plain text. When
   a digit differs from the previous string the reel SLIDES from the old digit to
   the new one, rolling through the digits in between — the exact per-digit
   odometer the reference video shows. Unchanged leading digits don't move.
   Cells are owned imperatively (React never renders children of the host). */
const ROLL_DUR_IDLE = 900;
const ROLL_DUR_PLAY = 170;
function buildReels(
  host: HTMLElement,
  oldStr: string,
  newStr: string,
  instant: boolean,
  playing: boolean
) {
  const oldChars = [...oldStr];
  const newChars = [...newStr];
  const oldLen = oldChars.length;
  const newLen = newChars.length;
  const dur = playing ? ROLL_DUR_PLAY : ROLL_DUR_IDLE;
  // ease-out so the reels decelerate into place, like the video
  const ease = playing ? "cubic-bezier(0.33,1,0.68,1)" : "cubic-bezier(0.22,1,0.36,1)";
  const frag = document.createDocumentFragment();
  const animate: { strip: HTMLElement; to: number }[] = [];

  for (let i = 0; i < newLen; i++) {
    const ch = newChars[i];
    const r = newLen - 1 - i; // align with the previous string from the RIGHT
    const oldCh = oldChars[oldLen - 1 - r];
    if (ch >= "0" && ch <= "9") {
      const cell = document.createElement("span");
      cell.className = "rdigit";
      const strip = document.createElement("span");
      strip.className = "rstrip";
      for (let d = 0; d <= 9; d++) {
        const ds = document.createElement("span");
        ds.textContent = String(d);
        strip.appendChild(ds);
      }
      const target = +ch;
      const startD = !instant && oldCh >= "0" && oldCh <= "9" ? +oldCh : target;
      strip.style.transition = "none";
      strip.style.transform = `translateY(-${startD}em)`;
      cell.appendChild(strip);
      frag.appendChild(cell);
      if (!instant && startD !== target) animate.push({ strip, to: target });
    } else {
      const sep = document.createElement("span");
      sep.className = "rsep";
      sep.textContent = ch;
      frag.appendChild(sep);
    }
  }
  host.replaceChildren(frag);
  // next frame: enable the transition and move each changed reel to its target
  if (animate.length) {
    requestAnimationFrame(() => {
      for (const a of animate) {
        a.strip.style.transition = `transform ${dur}ms ${ease}`;
        a.strip.style.transform = `translateY(-${a.to}em)`;
      }
    });
  }
}

/* A figure whose value changes ANIMATE as a per-digit vertical odometer.
     - IDLE (playing=false): a calm ~0.9s ease-out reel slide. With `flash`, the
       whole figure also flashes the up/down accent, fading back to the text
       color — exactly like the live tick in the reference video.
     - PLAYING: a fast ~0.17s slide with no flash and no pulsing/pop.
   `resetKey` SNAPS (no animation) whenever it changes — used so switching the
   range tab re-baselines the %/change figures without a misleading roll. */
function RollingNumber({
  value,
  decimals,
  fmt,
  playing,
  flash = false,
  resetKey,
  freezeWhenPlaying = false,
  animateOnMount = false,
  mountFrom,
  className = "",
}: {
  value: number;
  decimals: number;
  fmt: (n: number, dec?: number) => string;
  playing: boolean;
  flash?: boolean;
  resetKey?: unknown;
  /** While music plays, SNAP this figure (no roll/flash/pop) — used for the
      ±change and % values, which should stay calm while the headline dances. */
  freezeWhenPlaying?: boolean;
  /** On the very first paint, ROLL UP from `mountFrom` to `value` instead of
      snapping — the count-up-on-load effect for the headline figure. */
  animateOnMount?: boolean;
  mountFrom?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const prevStr = useRef(fmt(value, decimals));
  const prevVal = useRef(value);
  const prevKey = useRef(resetKey);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const newStr = fmt(value, decimals);
    const first = !mounted.current;
    mounted.current = true;
    const keyChanged = resetKey !== prevKey.current;
    prevKey.current = resetKey;
    // On the very first paint, optionally ROLL UP from a baseline value
    // (mountFrom) instead of snapping — the count-up-on-load effect.
    const mountRoll =
      first && animateOnMount && !PREFERS_REDUCED_MOTION && mountFrom != null;
    const oldStr = mountRoll ? fmt(mountFrom, decimals) : prevStr.current;
    // a range switch (resetKey), reduced-motion, a frozen figure while music
    // plays, or a plain first paint → just snap (no slide/flash/pop)
    const instant =
      (first && !mountRoll) ||
      keyChanged ||
      PREFERS_REDUCED_MOTION ||
      (freezeWhenPlaying && playing);

    buildReels(host, oldStr, newStr, instant, playing);

    if (!instant && !first && newStr !== oldStr && flash && !playing) {
      const up = value >= prevVal.current;
      host.classList.remove("flash-up", "flash-down");
      void host.offsetWidth; // reflow → restart the keyframe
      host.classList.add(up ? "flash-up" : "flash-down");
    }
    prevStr.current = newStr;
    prevVal.current = value;
  }, [value, decimals, fmt, resetKey, playing, flash, freezeWhenPlaying, animateOnMount, mountFrom]);

  return <span ref={ref} className={("rnum anum " + className).trim()} />;
}

interface LiveDisplay {
  value: number;
  ts: number;
  seq: number;
  up: boolean;
}

/* Headline value SINGS THE MELODY via spectral-flux onset detection over the
   melodic band; each onset snaps the number to that note's pitch (centroid). */
function useLiveTicker(engine: AudioEngine): LiveDisplay | null {
  const [disp, setDisp] = useState<LiveDisplay | null>(null);
  useEffect(() => {
    if (!engine.playing) {
      setDisp(null);
      return;
    }
    const D = window.IHSG_DATA;
    const pts = D.ranges["1D"].points;
    // No live series yet (empty/zero initial data) → nothing to sing.
    if (!pts.length) {
      setDisp(null);
      return;
    }
    const vals = pts.map((p) => p.v);
    const loV = Math.min(...vals),
      hiV = Math.max(...vals);
    const t0 = pts[0].t,
      t1 = pts[pts.length - 1].t;

    let prev: Float32Array | null = null;
    let fluxAvg = 0,
      fluxVar = 0;
    let lastHit = -1e9;
    let armed = true;
    let pMin = 0.3,
      pMax = 0.7;
    let buf: Uint8Array | null = null,
      raf = 0;
    let seq = 0;
    let lastVal = loV + 0.5 * (hiV - loV);
    let started = false;
    let lastNote = -1;

    const LO = 4;
    const MIN_GAP = 105;
    const FLOOR = 0.012;

    const loop = (tms: number) => {
      const yt = engine.sourceRef.current === "youtube";
      const an = engine.analyserRef.current;
      if (yt) {
        // YouTube audio is cross-origin (no analyser) → sing a synthetic melody
        // locked to the same 118 BPM beat the spectrum pulses on, firing on 8th
        // notes so the IDX value dances to the beat instead of sitting still.
        const noteHz = (118 / 60) * 2;
        const k = Math.floor((tms / 1000) * noteHz);
        if (k !== lastNote) {
          lastNote = k;
          const a =
            Math.sin(k * 1.7) * 0.5 + Math.sin(k * 0.5 + 1.3) * 0.3 + Math.sin(k * 3.1) * 0.2;
          const level = Math.min(1, Math.max(0, 0.5 + 0.45 * a));
          const value = loV + level * (hiV - loV);
          setDisp({ value, ts: t0 + level * (t1 - t0), seq: ++seq, up: value >= lastVal });
          lastVal = value;
        }
      } else if (an) {
        const bins = an.frequencyBinCount;
        if (!buf || buf.length !== bins) buf = new Uint8Array(bins);
        an.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>);
        const HI = Math.floor(bins * 0.72);

        let flux = 0,
          present = 0;
        for (let i = LO; i < HI; i++) {
          const c = buf[i] / 255;
          if (prev) {
            const d = c - prev[i];
            if (d > 0) flux += d;
          }
          present += c;
        }
        flux /= HI - LO;
        present /= HI - LO;
        if (!prev || prev.length !== bins) prev = new Float32Array(bins);
        for (let i = 0; i < bins; i++) prev[i] = buf[i] / 255;

        const dev = flux - fluxAvg;
        fluxAvg += dev * 0.1;
        fluxVar += (dev * dev - fluxVar) * 0.1;
        const thresh = fluxAvg + 1.25 * Math.sqrt(fluxVar) + FLOOR;

        const onset = started && flux > thresh && present > 0.02;
        let fire = false;
        if (onset && armed && tms - lastHit > MIN_GAP) {
          fire = true;
          armed = false;
        }
        if (flux < fluxAvg + 0.4 * Math.sqrt(fluxVar)) armed = true;
        started = true;

        if (fire) {
          lastHit = tms;
          let num = 0,
            den = 0;
          for (let i = LO; i < HI; i++) {
            const m = buf[i];
            num += i * m;
            den += m;
          }
          if (den > 0) {
            const centroid = num / den;
            const norm = Math.min(1, Math.max(0, (centroid - LO) / (HI - LO)));
            pMin += (norm < pMin ? 0.2 : 0.008) * (norm - pMin);
            pMax += (norm > pMax ? 0.2 : 0.008) * (norm - pMax);
            const span = Math.max(0.08, pMax - pMin);
            let level = Math.min(1, Math.max(0, (norm - pMin) / span));
            level =
              level < 0.5
                ? 0.5 * Math.pow(level * 2, 1.3)
                : 1 - 0.5 * Math.pow((1 - level) * 2, 1.3);
            level = Math.min(1, Math.max(0, level));
            const value = loV + level * (hiV - loV);
            setDisp({ value, ts: t0 + level * (t1 - t0), seq: ++seq, up: value >= lastVal });
            lastVal = value;
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine.playing, engine.analyserRef]);
  return disp;
}

export default function App() {
  const saved = useMemo(loadPrefs, []);
  // First render with no saved theme → follow the device color scheme; once the
  // user picks a theme it persists and wins. Light is the base default.
  const [prefs, setPrefs] = useState<Prefs>(() => ({
    ...DEFAULTS,
    ...saved,
    theme: saved.theme ?? deviceTheme(),
  }));
  const setPref = useCallback(<K extends keyof Prefs>(key: K, val: Prefs[K]) => {
    savePrefs({ [key]: val } as Partial<Prefs>);
    setPrefs((p) => ({ ...p, [key]: val }));
  }, []);

  const D = useIhsgData();
  const [range, setRangeState] = useState<RangeKey>(saved.range || prefs.defaultRange || "1D");
  const setRange = useCallback((r: RangeKey) => {
    setRangeState(r);
    savePrefs({ range: r });
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const engine = useAudioEngine();

  const lang: Lang = prefs.lang === "id" ? "id" : "en";
  const T = I18N[lang];
  const fmt = useMemo(() => makeFmt(T.locale), [T.locale]);
  const model = VALID_MODELS.includes(prefs.model) ? prefs.model : "FULL";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", prefs.theme);
  }, [prefs.theme]);

  const rngData = D.ranges[range];
  const pts = rngData.points;
  // Every range measures against the close immediately BEFORE the period
  // (Google-Finance style; the Worker supplies it as ranges[k].baseline) —
  // for 1D that's the previous close. First point is the offline fallback.
  // Before any data arrives the series is empty → fall back to 0.
  const firstV = pts.length ? pts[0].v : 0;
  const startV =
    rngData.baseline ?? (range === "1D" ? D.stats.prevClose || firstV : firstV);
  const curV = D.latest.value;
  const rangeUp = curV - startV >= 0;

  const live = useLiveTicker(engine);
  const priceRef = useRef<HTMLDivElement | null>(null);
  const dispV = live ? live.value : curV;
  const dispTime = fmtStamp(live ? live.ts : D.latest.ts, T);
  const baseStart = live
    ? D.ranges["1D"].baseline ?? D.stats.prevClose ?? D.ranges["1D"].points[0]?.v ?? 0
    : startV;
  const diff = dispV - baseStart;
  const pct = baseStart ? (diff / baseStart) * 100 : 0;
  const isUp = diff >= 0;
  const dispLabel = live ? T.ranges["1D"] : T.ranges[range];
  const changeColorClass = isUp ? "pos" : "neg";

  useEffect(() => {
    const ticker = (D.symbol.split(":").pop() || D.symbol).trim();
    const arrow = isUp ? "▲" : "▼";
    document.title = `${ticker} ${fmt(dispV, 2)} (${arrow} ${fmt(Math.abs(pct), 2)}%) ${D.name} | IHSG Spectrum Visualizer | ${BRAND_NAME}`;
  }, [dispV, pct, isUp, fmt, D.symbol, D.name]);

  // Publish the ORIGINAL (no-music) headline values for Save Image.
  useEffect(() => {
    const sDiff = curV - startV;
    const sPct = startV ? (sDiff / startV) * 100 : 0;
    const sUp = sDiff >= 0;
    const sg = (n: number) => fmt(Math.abs(n), 2);
    window.IHSG_still = {
      price: fmt(curV, 2),
      changeMain: `${sUp ? "+" : "-"}${sg(sDiff)} (${sUp ? "+" : "-"}${sg(sPct)}%)`,
      changeLabel: T.ranges[range],
      up: sUp,
      stamp: fmtStamp(D.latest.ts, T),
    };
  }, [curV, startV, range, T, fmt, D.latest.ts]);

  return (
    <div className="page">
      <main className="card">
        <header className="head">
          <div className="head-left">
            <h1 className="title">{T.name}</h1>
            <div className="sub">
              <span>{D.symbol}</span>
            </div>
          </div>
          <div className="head-actions">
            <ShareButton T={T} />
            <button
              className="icon-btn"
              aria-label={T.settings}
              title={T.settings}
              onClick={() => setSettingsOpen(true)}
            >
              <IconGear />
            </button>
          </div>
        </header>

        <div className="price-row">
          <div className="price" ref={priceRef}>
            <RollingNumber
              value={dispV}
              decimals={2}
              fmt={fmt}
              playing={engine.playing}
              flash
              freezeWhenPlaying
              animateOnMount
              mountFrom={startV}
            />
          </div>
          <div className={"change-badge " + changeColorClass}>
            <ArrowGlyph up={isUp} />
            <span>{fmt(Math.abs(pct), 2)}%</span>
          </div>
          <div className={"change-abs " + changeColorClass}>
            {isUp ? "+" : "-"}
            {fmt(Math.abs(diff), 2)} {dispLabel}
          </div>
          <div className={"change-line " + changeColorClass}>
            <span>
              {isUp ? "+" : "-"}
              {fmt(Math.abs(diff), 2)} ({isUp ? "+" : "-"}
              {fmt(Math.abs(pct), 2)}%)
            </span>
            <ArrowGlyph up={isUp} />
            <span>{dispLabel}</span>
          </div>
        </div>

        <div className="timestamp">
          {dispTime}
          <span className="dot-sep">•</span>
          <a
            href="https://www.google.com/intl/en_id/googlefinance/disclaimer/"
            className="disclaimer"
            target="_blank"
            rel="noopener noreferrer"
          >
            {T.disclaimer}
          </a>
        </div>

        <nav className="tabs" role="tablist">
          {D.order.map((r, i) => (
            <span key={r} style={{ display: "contents" }}>
              {i > 0 && <span className="tab-sep" aria-hidden="true"></span>}
              <button
                role="tab"
                aria-selected={r === range}
                className={"tab" + (r === range ? " active" : "")}
                onClick={() => setRange(r)}
              >
                <span className="tab-label">{T.tabs[r]}</span>
              </button>
            </span>
          ))}
        </nav>

        <div className="viz-area">
          <SpectrumChart
            points={pts}
            tickLabels={rngData.tickLabels}
            model={model}
            theme={prefs.theme}
            engine={engine}
            fmt={fmt}
            up={rangeUp}
            range={range}
            T={T}
            intensity={prefs.spectrumIntensity}
            prevClose={range === "1D" ? D.stats.prevClose : undefined}
          />
        </div>

        <div className="stats">
          <StatRow label={T.open} value={fmt(D.stats.open)} />
          <StatRow label={T.high} value={fmt(D.stats.high)} />
          <StatRow label={T.low} value={fmt(D.stats.low)} />
          <StatRow label={T.prevCloseFull} labelShort={T.prevClose} value={fmt(D.stats.prevClose)} />
          <StatRow label={T.week52HighFull} labelShort={T.week52High} value={fmt(D.stats.week52High)} />
          <StatRow label={T.week52LowFull} labelShort={T.week52Low} value={fmt(D.stats.week52Low)} />
        </div>

        <PlayerBar engine={engine} T={T} />

        <div className="detail-row">
          <span className="detail-line"></span>
          <a
            className="detail-btn"
            href="https://www.google.com/finance/quote/COMPOSITE:IDX"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{T.moreDetail}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <span className="detail-line"></span>
        </div>

        <InfoSections
          T={T}
          news={D.news}
          wikiHref={
            lang === "id"
              ? "https://id.wikipedia.org/wiki/Indeks_Harga_Saham_Gabungan"
              : "https://en.wikipedia.org/wiki/IDX_Composite"
          }
        />
      </main>

      <footer className="site-footer">
        {"© Crafted in a Broken Nation by "}
        <a href={BRAND_URL} target="_blank" rel="noopener noreferrer">
          {BRAND_NAME}
        </a>
        {" " + new Date().getFullYear()}
      </footer>

      <SettingsSidebar
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        T={T}
        lang={lang}
        setLang={(v) => setPref("lang", v)}
        theme={prefs.theme}
        setTheme={(v) => setPref("theme", v)}
        model={model}
        setModel={(v) => setPref("model", v)}
      />
    </div>
  );
}
