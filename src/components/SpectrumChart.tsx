/* =============================================================================
   SpectrumChart — the IDX Composite price data rendered AS a live spectrum,
   while keeping the price Y-axis, date X-axis and the hover crosshair tooltip.
   The bars/line/wave are anchored to the real price values and pulse with the
   live audio. Ported 1:1 from project/spectrum-chart.jsx.

   1D session mode: the IDX trades in two sessions with a lunch break between
   them (like Google Finance shows). When the 1D series contains a large time
   gap, the x-axis switches from index-spacing to TIME-spacing, nothing is
   drawn inside the gap, a localized "Lunch break" label marks it, and hour
   ticks position by time. Other ranges keep index spacing (overnight/weekend
   gaps stay compressed, as on Google Finance).
   ============================================================================= */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { idleFreq, lerpColor, roundTopRect, toAlpha } from "../audio/spectrum";
import type { AudioEngine } from "../audio/useAudioEngine";
import type { Strings } from "../i18n";
import type { RangeKey, SeriesPoint } from "../../shared/types";

const AXIS_COLORS = {
  dark: { grid: "rgba(255,255,255,0.07)", label: "#7c8186", crosshair: "rgba(255,255,255,0.34)" },
  light: { grid: "rgba(0,0,0,0.07)", label: "#80868b", crosshair: "rgba(0,0,0,0.34)" },
};

const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function localizeTick(lab: string, T: Strings | undefined): string {
  if (!T || !T.mon) return lab;
  return lab.replace(/[A-Za-z]+/g, (w) => {
    const i = EN_MON.indexOf(w);
    return i >= 0 ? T.mon[i] : w;
  });
}

/** Wrap text so each line is at most maxW wide (greedy, word-based). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    const next = cur ? cur + " " + wd : wd;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = wd;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Force a multi-word label to break (e.g. a two-word label → two lines) by
    capping each line at the widest single word's width. */
function wrapTight(ctx: CanvasRenderingContext2D, text: string): string[] {
  const words = text.split(" ");
  let maxW = 0;
  for (const wd of words) maxW = Math.max(maxW, ctx.measureText(wd).width);
  return wrapText(ctx, text, maxW);
}

interface Pal {
  green: string;
  greenHi: string;
  blue: string;
  soft: string;
}
const SPEC_PAL: Record<"dark" | "light", { up: Pal; down: Pal }> = {
  dark: {
    up: { green: "#56c98a", greenHi: "#8ee9b1", blue: "#5b9bd5", soft: "rgba(86,201,138,0.20)" },
    down: { green: "#e0796b", greenHi: "#f0a99b", blue: "#d98a4b", soft: "rgba(224,121,107,0.20)" },
  },
  light: {
    up: { green: "#1f9d57", greenHi: "#36c97d", blue: "#2a6fdb", soft: "rgba(31,157,87,0.16)" },
    down: { green: "#d33a2c", greenHi: "#e0796b", blue: "#e08a3c", soft: "rgba(211,58,44,0.14)" },
  },
};

interface SpecStyle {
  kind: "bars" | "area" | "line" | "wave";
  n?: number;
  grad?: "green" | "greenblue";
  gap?: number;
  react: number;
  smooth?: boolean;
  jag?: boolean;
}
const SPEC_STYLE: Record<string, SpecStyle> = {
  BASS: { kind: "bars", n: 46, grad: "green", gap: 3, react: 0.2 },
  MID: { kind: "area", n: 90, smooth: true, react: 0.16 },
  FULL: { kind: "line", n: 150, react: 0.18, jag: true },
  WAVE: { kind: "wave", react: 1.0 },
  MAX: { kind: "bars", n: 118, grad: "greenblue", gap: 1.4, react: 0.18 },
};

function niceYTicks(min: number, max: number): number[] {
  const rawStep = (max - min) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = niceNorm * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max; v += step) ticks.push(v);
  return ticks;
}

const TIP_FMT: Record<RangeKey, string> = {
  "1D": "time",
  "5D": "wdaytime",
  "1M": "wday",
  "6M": "dateyear",
  YTD: "wday",
  "1Y": "dateyear",
  "5Y": "dateyear",
  Max: "dateyear",
};

const SPEC_H = 300;
const SPEC_PAD = { L: 52, R: 10, T: 16, B: 34 };
const MIN_GAP_MS = 45 * 60000; // a session break is at least this long

/** WIB (Asia/Jakarta) is UTC+7 with no DST, ever. */
const WIB_OFFSET_MS = 7 * 3600000;
/** The Jakarta trading-day bounds — 09:00 open … 16:00 close as epoch ms,
    derived from the first 1D point's WIB calendar date. While the market is
    live this lets the 1D x-axis span the WHOLE day, so the price fills only up
    to "now" and the rest of the axis stays empty (with a leading dot) — exactly
    like Google Finance — instead of stretching the partial day to full width. */
function wibDayBounds(firstT: number): { start: number; end: number } {
  const wib = new Date(firstT + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear(),
    mo = wib.getUTCMonth(),
    d = wib.getUTCDate();
  return {
    start: Date.UTC(y, mo, d, 9, 0, 0) - WIB_OFFSET_MS,
    end: Date.UTC(y, mo, d, 16, 0, 0) - WIB_OFFSET_MS,
  };
}

interface Scale {
  min: number;
  max: number;
  yTicks: number[];
  vals: number[];
}

function specGeom(w: number, h: number, scale: Scale) {
  const hh = h || SPEC_H;
  const plotW = Math.max(10, w - SPEC_PAD.L - SPEC_PAD.R);
  const plotH = hh - SPEC_PAD.T - SPEC_PAD.B;
  const xAt = (i: number, n: number) => SPEC_PAD.L + (i / (n - 1)) * plotW;
  const yAt = (v: number) => SPEC_PAD.T + (1 - (v - scale.min) / (scale.max - scale.min)) * plotH;
  return { plotW, plotH, xAt, yAt, bottom: SPEC_PAD.T + plotH };
}

function specPriceAt(scale: Scale, f: number): number {
  const v = scale.vals;
  const x = f * (v.length - 1);
  const i = Math.floor(x),
    frac = x - i;
  if (i >= v.length - 1) return v[v.length - 1];
  return v[i] + (v[i + 1] - v[i]) * frac;
}

/** Split a series into trading sessions wherever the time step jumps (lunch). */
function computeSegments(points: SeriesPoint[]): [number, number][] {
  if (points.length < 2) return [[0, Math.max(0, points.length - 1)]];
  const dts: number[] = [];
  for (let i = 1; i < points.length; i++) dts.push(points[i].t - points[i - 1].t);
  const sorted = [...dts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const thresh = Math.max(MIN_GAP_MS, median * 4);
  const segs: [number, number][] = [];
  let a = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].t - points[i - 1].t > thresh) {
      segs.push([a, i - 1]);
      a = i;
    }
  }
  segs.push([a, points.length - 1]);
  return segs;
}

interface PaintParams {
  w: number;
  h: number;
  scale: Scale;
  points: SeriesPoint[];
  tickLabels: string[];
  fmt: (n: number, dec?: number) => string;
  theme: string;
  up: boolean;
  model: string;
  intensity?: number;
  T: Strings;
  range: RangeKey;
  prevClose?: number;
  freq: Uint8Array | null;
  wave: Uint8Array | null;
  animT: number;
  hover: number | null;
}

/* The current-price marker: a plain solid color dot — no glow/neon/halo, no
   ring. Just a clean filled circle. Used for both the leading and hover dots. */
function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/* Paint ONE spectrum frame. With freq/wave null and animT 0 the result is the
   at-rest chart — exactly what shows when no music plays. */
function paintSpectrumFrame(ctx: CanvasRenderingContext2D, P: PaintParams) {
  const { w, h, scale, points, tickLabels, fmt } = P;
  // Empty/zero initial data → leave the chart blank (no axes, line, or
  // spectrum) until the first live quote arrives. The caller already cleared
  // the canvas this frame.
  if (!points.length) return;
  const th = P.theme === "light" ? "light" : "dark";
  const ax = AXIS_COLORS[th];
  const cols = SPEC_PAL[th][P.up ? "up" : "down"];
  const mKey = SPEC_STYLE[P.model] ? P.model : "FULL";
  const st = SPEC_STYLE[mKey];
  const g = specGeom(w, h, scale);
  // narrow canvas (mobile) → shrink overlay text so labels fit the small plot
  const narrow = w < 480;
  const intensity = P.intensity != null ? P.intensity : 2.2;
  const priceAt = (f: number) => specPriceAt(scale, f);

  const animT = P.animT || 0;
  const freq = P.freq || null,
    wave = P.wave || null;
  // At rest (no analyser data, animT 0) the amplitude is ZERO so every model
  // sits exactly on the price curve and the hover dot matches the y-axis.
  // The synthetic idleFreq path only animates while playing without an
  // analyser (YouTube).
  const idleF = !freq && animT !== 0 ? idleFreq(512, animT) : null;
  const ampAt = (frac: number) => {
    if (freq) {
      const bin = Math.floor(frac * 0.62 * freq.length);
      return freq[Math.min(bin, freq.length - 1)] / 255;
    }
    if (!idleF) return 0;
    return idleF[Math.floor(frac * (idleF.length - 1))];
  };

  const PAD_L = SPEC_PAD.L,
    PAD_R = SPEC_PAD.R,
    PAD_T = SPEC_PAD.T;

  // ---- 1D time-scaled x (a live session spans the WHOLE trading day) ----
  // For 1D the x-axis always maps by TIME across the full Jakarta session
  // (09:00–16:00). While the market is live the price only fills up to "now" and
  // the rest of the axis stays empty (with a leading dot) — exactly like Google
  // Finance. A lunch-break gap (when present) is still skipped via `hasGap`.
  const timeMode = P.range === "1D" && points.length > 1;
  const segs: [number, number][] = timeMode
    ? computeSegments(points)
    : [[0, Math.max(0, points.length - 1)]];
  const hasGap = segs.length > 1;
  const dataT0 = points.length ? points[0].t : 0;
  const dataTN = points.length ? points[points.length - 1].t : 1;
  const bounds = timeMode ? wibDayBounds(dataT0) : null;
  const t0 = bounds ? Math.min(bounds.start, dataT0) : dataT0;
  const tN = bounds ? Math.max(bounds.end, dataTN) : dataTN;
  const spanT = Math.max(1, tN - t0);
  const xOfT = (t: number) => PAD_L + ((t - t0) / spanT) * g.plotW;
  const gaps: [number, number][] = [];
  for (let s = 1; s < segs.length; s++) gaps.push([points[segs[s - 1][1]].t, points[segs[s][0]].t]);
  const inGap = (t: number) => gaps.some(([ga, gb]) => t > ga && t < gb);
  const priceAtTime = (t: number): number | null => {
    if (t <= dataT0) return points[0].v;
    // past the last real bar = future minutes not yet traded → no data (empty)
    if (t >= dataTN) return t > dataTN ? null : points[points.length - 1].v;
    if (inGap(t)) return null;
    let lo = 0,
      hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const p0 = points[lo],
      p1 = points[hi];
    const f = (t - p0.t) / Math.max(1, p1.t - p0.t);
    return p0.v + (p1.v - p0.v) * f;
  };
  // base price for a fractional x position, or null inside the lunch gap / the
  // part of the day that has not traded yet
  const baseAt = (frac: number): number | null =>
    timeMode ? priceAtTime(t0 + frac * spanT) : priceAt(frac);

  // ---- axes (always) ----
  ctx.font = "12px 'IBM Plex Sans', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ax.label;
  ctx.strokeStyle = ax.grid;
  ctx.lineWidth = 1;
  ctx.textAlign = "end";
  scale.yTicks.forEach((v) => {
    const y = g.yAt(v);
    ctx.beginPath();
    ctx.moveTo(PAD_L, y + 0.5);
    ctx.lineTo(w - PAD_R, y + 0.5);
    ctx.stroke();
    ctx.fillText(fmt(v, 0), PAD_L - 10, y);
  });
  ctx.textBaseline = "alphabetic";
  const Tloc = P.T;
  if (timeMode) {
    // hour ticks positioned by TIME, spanning the whole 09:00–16:00 session (the
    // lunch gap, when present, keeps its real width)
    const HOUR = 3600000;
    const sep = Tloc && Tloc.timeSep ? Tloc.timeSep : ":";
    const z = (n: number) => String(n).padStart(2, "0");
    const ticks: { x: number; lab: string }[] = [];
    for (let t = Math.ceil(t0 / HOUR) * HOUR; t <= tN; t += HOUR) {
      // WIB wall-clock label (UTC+7, no DST) — correct for any viewer timezone
      const d = new Date(t + WIB_OFFSET_MS);
      ticks.push({ x: xOfT(t), lab: `${z(d.getUTCHours())}${sep}${z(d.getUTCMinutes())}` });
    }
    let maxLabW = 0;
    for (const tk of ticks) maxLabW = Math.max(maxLabW, ctx.measureText(tk.lab).width);
    const minSlot = maxLabW + 24;
    const halfW = maxLabW / 2;
    // Anchor on the LAST hour tick (market close, e.g. 16.00) and select
    // right-to-left so the closing time is ALWAYS shown. A left-to-right greedy
    // pass drops it on a narrow mobile plot, where the hours pack close enough
    // that 16.00 lands within minSlot of the previously drawn tick. Draw in
    // chronological order afterwards.
    const chosen: { x: number; lab: string }[] = [];
    let prevX = Infinity;
    for (let i = ticks.length - 1; i >= 0; i--) {
      const tk = ticks[i];
      if (prevX - tk.x < minSlot) continue;
      chosen.push(tk);
      prevX = tk.x;
    }
    chosen.reverse();
    for (const tk of chosen) {
      // edge-align so the first/last labels never clip past the plot bounds
      if (tk.x - halfW < PAD_L) ctx.textAlign = "left";
      else if (tk.x + halfW > w - PAD_R) ctx.textAlign = "right";
      else ctx.textAlign = "center";
      ctx.fillText(tk.lab, tk.x, h - 12);
    }
  } else {
    const nT = tickLabels.length;
    const locLabels = tickLabels.map((lab) => localizeTick(lab, Tloc));
    // Place labels by their REAL drawn bounding box so none can overlap,
    // regardless of label width or edge alignment. First label is left-aligned,
    // last is right-aligned, the rest centered. Always show first + last, then
    // greedily fit interior labels that clear both their left neighbour and the
    // final label.
    const xOf = (idx: number) => PAD_L + (nT === 1 ? 0.5 : idx / (nT - 1)) * g.plotW;
    const alignOf = (idx: number): CanvasTextAlign =>
      idx === 0 ? "left" : idx === nT - 1 ? "right" : "center";
    const boxOf = (idx: number): [number, number] => {
      const x = xOf(idx);
      const lw = ctx.measureText(locLabels[idx]).width;
      const a = alignOf(idx);
      if (a === "left") return [x, x + lw];
      if (a === "right") return [x - lw, x];
      return [x - lw / 2, x + lw / 2];
    };
    const PAD_GAP = 12; // minimum px between two labels
    const showIdx: number[] = [];
    if (nT <= 1) {
      showIdx.push(0);
    } else {
      showIdx.push(0);
      const lastBox = boxOf(nT - 1);
      let prevRight = boxOf(0)[1];
      for (let i = 1; i < nT - 1; i++) {
        const b = boxOf(i);
        if (b[0] < prevRight + PAD_GAP) continue; // crowds the previous label
        if (b[1] > lastBox[0] - PAD_GAP) continue; // would collide with the last
        showIdx.push(i);
        prevRight = b[1];
      }
      showIdx.push(nT - 1);
    }
    showIdx.forEach((idx) => {
      ctx.textAlign = alignOf(idx);
      ctx.fillText(locLabels[idx], xOf(idx), h - 12);
    });
  }

  // ---- previous-close dotted reference line (1D, Google-Finance style) ----
  if (P.prevClose != null) {
    const py = g.yAt(P.prevClose);
    if (py > PAD_T && py < g.bottom) {
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = ax.label;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_L, py + 0.5);
      ctx.lineTo(w - PAD_R, py + 0.5);
      ctx.stroke();
      ctx.restore();
      // desktop shows the full label ("Penutupan sebelumnya"), mobile the short
      // one ("Tutup sblmnya"); the label always wraps to two lines, value last
      const prevLabel = narrow ? Tloc.prevClose : Tloc.prevCloseFull;
      if (Tloc && prevLabel) {
        ctx.fillStyle = th === "light" ? "#5f6368" : "#9aa0a6";
        const fontPx = narrow ? 11 : 12;
        ctx.font = `${fontPx}px 'IBM Plex Sans', sans-serif`;
        ctx.textAlign = "right";
        const lx = w - PAD_R - 2;
        const lines = wrapTight(ctx, prevLabel);
        lines.push(fmt(P.prevClose, 2));
        // stack the lines so the block ends just above the dotted line; flip
        // below when it would collide with the top of the plot
        const lh = fontPx + 3;
        const gap = 6;
        let top = py - gap - (lines.length - 1) * lh;
        if (top - fontPx < PAD_T) top = py + gap + fontPx;
        lines.forEach((ln, i) => ctx.fillText(ln, lx, top + i * lh));
      }
    }
  }

  // ---- price rendered as spectrum ----
  if (st.kind === "bars") {
    const n = st.n!,
      gap = st.gap!;
    const bw = (g.plotW - gap * (n - 1)) / n;
    for (let b = 0; b < n; b++) {
      const frac = n === 1 ? 0 : b / (n - 1);
      const price = baseAt(frac);
      if (price == null) continue; // lunch break — nothing trades, nothing draws
      const baseY = g.yAt(price);
      const amp = ampAt(frac);
      const top = Math.max(PAD_T, baseY - amp * g.plotH * st.react * intensity);
      const x = PAD_L + b * (bw + gap);
      const col = st.grad === "greenblue" ? lerpColor(cols.green, cols.blue, frac) : cols.green;
      const grad = ctx.createLinearGradient(0, g.bottom, 0, top);
      grad.addColorStop(0, toAlpha(col, 0.5));
      grad.addColorStop(1, col);
      ctx.fillStyle = grad;
      roundTopRect(ctx, x, top, bw, g.bottom - top, Math.min(bw / 2, 3));
      ctx.fill();
    }
  } else if (st.kind === "wave") {
    const n = points.length;
    const X = (i: number) => (timeMode ? xOfT(points[i].t) : g.xAt(i, n));
    const baseY = (i: number) => g.yAt(points[i].v);
    const wv = (i: number) => {
      if (wave) {
        const wi = Math.floor((i / (n - 1)) * (wave.length - 1));
        return (wave[wi] - 128) / 128;
      }
      if (animT === 0) return 0; // at rest: the wave lies exactly on the price
      return Math.sin(animT / 200 + i * 0.5) * 0.4;
    };
    const amp = 26 * intensity;
    // clamp the upward wave excursion to the plot top so it never draws above
    const yAt = (i: number) => Math.max(PAD_T, baseY(i) + wv(i) * amp);
    for (const [a, b] of segs) {
      if (b - a < 1) continue;
      ctx.beginPath();
      ctx.moveTo(X(a), yAt(a));
      for (let i = a + 1; i <= b; i++) ctx.lineTo(X(i), yAt(i));
      ctx.lineTo(X(b), g.bottom);
      ctx.lineTo(X(a), g.bottom);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, PAD_T, 0, g.bottom);
      fill.addColorStop(0, cols.soft);
      fill.addColorStop(1, toAlpha(cols.green, 0.02));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const y = yAt(i);
        if (i === a) ctx.moveTo(X(i), y);
        else ctx.lineTo(X(i), y);
      }
      ctx.strokeStyle = toAlpha(cols.green, 0.3);
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const y = yAt(i);
        if (i === a) ctx.moveTo(X(i), y);
        else ctx.lineTo(X(i), y);
      }
      ctx.strokeStyle = cols.greenHi;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else {
    // area / line following the price, drawn per contiguous run (gap-aware)
    type Pt = { x: number; y: number };
    const runs: Pt[][] = [];
    if (timeMode) {
      // 1D session mode: draw along the REAL per-segment data points (same
      // xOfT the hover crosshair uses) so each run ends exactly on the
      // segment-boundary point — otherwise the uniform resample below stops a
      // few px short of the lunch-gap edge and the hover dot floats off it.
      for (const [a, b] of segs) {
        if (b - a < 1) continue;
        const run: Pt[] = [];
        for (let i = a; i <= b; i++) {
          const frac = (points[i].t - t0) / spanT;
          run.push({
            x: xOfT(points[i].t),
            // clamp the audio lift to the plot top so loud frames never draw
            // above the chart (matches the bars model's Math.max(PAD_T, …))
            y: Math.max(PAD_T, g.yAt(points[i].v) - ampAt(frac) * g.plotH * st.react * intensity),
          });
        }
        if (run.length > 1) runs.push(run);
      }
    } else {
      const n = st.n!;
      let cur: Pt[] = [];
      for (let b = 0; b < n; b++) {
        const frac = b / (n - 1);
        const base = baseAt(frac);
        if (base == null) {
          if (cur.length > 1) runs.push(cur);
          cur = [];
          continue;
        }
        cur.push({
          x: PAD_L + frac * g.plotW,
          // clamp the audio lift to the plot top so loud frames never draw above
          // the chart (matches the bars model's Math.max(PAD_T, …))
          y: Math.max(PAD_T, g.yAt(base) - ampAt(frac) * g.plotH * st.react * intensity),
        });
      }
      if (cur.length > 1) runs.push(cur);
    }
    const trace = (run: Pt[]) => {
      ctx.moveTo(run[0].x, run[0].y);
      if (st.smooth) {
        for (let i = 1; i < run.length; i++) {
          const xc = (run[i - 1].x + run[i].x) / 2,
            yc = (run[i - 1].y + run[i].y) / 2;
          ctx.quadraticCurveTo(run[i - 1].x, run[i - 1].y, xc, yc);
        }
        ctx.lineTo(run[run.length - 1].x, run[run.length - 1].y);
      } else {
        for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
      }
    };
    for (const run of runs) {
      ctx.beginPath();
      trace(run);
      ctx.lineTo(run[run.length - 1].x, g.bottom);
      ctx.lineTo(run[0].x, g.bottom);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, PAD_T, 0, g.bottom);
      fill.addColorStop(0, cols.soft);
      fill.addColorStop(1, toAlpha(cols.green, 0.02));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.beginPath();
      trace(run);
      ctx.strokeStyle = cols.greenHi;
      ctx.lineWidth = st.smooth ? 2.2 : 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }

  // ---- lunch-break label centered in the gap (Google-Finance style) ----
  if (hasGap && Tloc && Tloc.lunchBreak) {
    // secondary text color (not the dim axis color); smaller on mobile so it
    // fits the narrow lunch gap without crowding the curve
    ctx.fillStyle = th === "light" ? "#5f6368" : "#9aa0a6";
    const lunchPx = narrow ? 11 : 14;
    ctx.font = `500 ${lunchPx}px 'IBM Plex Sans', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lunchLH = lunchPx + 4;
    for (const [ga, gb] of gaps) {
      if (gb - ga < MIN_GAP_MS) continue;
      const cx = xOfT((ga + gb) / 2);
      // mobile (narrow): break onto two lines to fit the tight gap, like
      // Google's "Lunch / break". desktop: keep it on a single line (no wrap).
      const lines = narrow ? wrapTight(ctx, Tloc.lunchBreak) : [Tloc.lunchBreak];
      lines.forEach((ln, i) => ctx.fillText(ln, cx, PAD_T + 30 + i * lunchLH));
    }
    ctx.textBaseline = "alphabetic";
  }

  // ---- live current-price dot at the leading edge (1D, Google-Finance style) ----
  // Marks the latest traded value at "now"; the empty axis to its right is the
  // not-yet-traded remainder of the session. Hidden while hovering so only the
  // hover dot (which tracks the mouse) shows — exactly like Google Finance.
  if (timeMode && P.hover == null) {
    const li = points.length - 1;
    const lx = xOfT(points[li].t);
    const fracL = (points[li].t - t0) / spanT;
    let ly: number;
    if (st.kind === "wave") {
      const amp = 26 * intensity;
      const wvi = wave
        ? (wave[wave.length - 1] - 128) / 128
        : animT === 0
        ? 0
        : Math.sin(animT / 200 + li * 0.5) * 0.4;
      ly = Math.max(PAD_T, g.yAt(points[li].v) + wvi * amp);
    } else if (st.kind === "bars") {
      ly = g.yAt(points[li].v);
    } else {
      ly = Math.max(PAD_T, g.yAt(points[li].v) - ampAt(fracL) * g.plotH * st.react * intensity);
    }
    // plain solid green dot — no glow/halo/ring (see drawDot)
    drawDot(ctx, lx, ly, cols.greenHi);
  }

  // ---- hover crosshair + dot (sits ON the rendered spectrum curve) ----
  const hv = P.hover;
  if (hv != null && hv < points.length) {
    const n = points.length;
    const hx = timeMode ? xOfT(points[hv].t) : g.xAt(hv, n);
    const frac = timeMode ? (points[hv].t - t0) / spanT : n === 1 ? 0 : hv / (n - 1);
    let hy: number;
    if (st.kind === "wave") {
      const amp = 26 * intensity;
      const wvi = wave
        ? (wave[Math.floor((hv / (n - 1)) * (wave.length - 1))] - 128) / 128
        : animT === 0
        ? 0
        : Math.sin(animT / 200 + hv * 0.5) * 0.4;
      hy = Math.max(PAD_T, g.yAt(points[hv].v) + wvi * amp);
    } else if (st.kind === "bars") {
      hy = g.yAt(points[hv].v);
    } else {
      hy = Math.max(PAD_T, g.yAt(points[hv].v) - ampAt(frac) * g.plotH * st.react * intensity);
    }
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = ax.crosshair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, PAD_T);
    ctx.lineTo(hx, g.bottom);
    ctx.stroke();
    ctx.restore();
    // same style as the leading dot: plain solid green dot, no glow/ring
    drawDot(ctx, hx, hy, cols.greenHi);
  }
}

interface LiveRef {
  model: string;
  theme: string;
  hover: number | null;
  up: boolean;
  T: Strings;
  intensity?: number;
  range: RangeKey;
  prevClose?: number;
  scale?: Scale;
  points?: SeriesPoint[];
  tickLabels?: string[];
  fmt?: (n: number, dec?: number) => string;
}

interface CanvasWithDims extends HTMLCanvasElement {
  _dpr?: number;
  _w?: number;
  _h?: number;
}

export function SpectrumChart({
  points,
  tickLabels,
  model,
  theme,
  engine,
  fmt,
  up,
  range,
  T,
  intensity,
  prevClose,
}: {
  points: SeriesPoint[];
  tickLabels: string[];
  model: string;
  theme: string;
  engine: AudioEngine;
  fmt: (n: number, dec?: number) => string;
  up: boolean;
  range: RangeKey;
  T: Strings;
  intensity?: number;
  prevClose?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<CanvasWithDims | null>(null);
  const [W, setW] = useState(680);
  const [hover, setHover] = useState<number | null>(null);

  const live = useRef<LiveRef>({ model, theme, hover: null, up, T, intensity, range });
  useEffect(() => {
    live.current.model = model;
  }, [model]);
  useEffect(() => {
    live.current.theme = theme;
  }, [theme]);
  useEffect(() => {
    live.current.intensity = intensity;
  }, [intensity]);
  useEffect(() => {
    live.current.up = up;
  }, [up]);
  useEffect(() => {
    live.current.T = T;
  }, [T]);
  useEffect(() => {
    live.current.hover = hover;
  }, [hover]);
  useEffect(() => {
    setHover(null);
  }, [points]);

  const H = SPEC_H,
    PAD_L = SPEC_PAD.L;

  const scale = useMemo<Scale>(() => {
    const vals = points.map((p) => p.v);
    // empty/zero initial data → harmless 0..1 scale (the chart paints blank)
    let min = vals.length ? Math.min(...vals) : 0,
      max = vals.length ? Math.max(...vals) : 1;
    // the previous-close reference line must fit inside the 1D plot
    if (prevClose != null) {
      min = Math.min(min, prevClose);
      max = Math.max(max, prevClose);
    }
    const span = max - min || 1;
    // extra headroom on top so the peak (and its audio lift) isn't flush
    // against the chart's top edge
    min -= span * 0.12;
    max += span * 0.18;
    return { min, max, yTicks: niceYTicks(min, max), vals };
  }, [points, prevClose]);

  // 1D time-scaled axis mirror for hover/tooltip x-positioning — must match the
  // [t0, tN] domain paintSpectrumFrame uses (the whole Jakarta trading day).
  const oneD = range === "1D" && points.length > 1;
  const dayBounds = oneD ? wibDayBounds(points[0].t) : null;
  const t0c = dayBounds
    ? Math.min(dayBounds.start, points[0].t)
    : points.length
    ? points[0].t
    : 0;
  const tNc = dayBounds
    ? Math.max(dayBounds.end, points[points.length - 1].t)
    : points.length
    ? points[points.length - 1].t
    : 1;

  live.current.scale = scale;
  live.current.points = points;
  live.current.tickLabels = tickLabels;
  live.current.fmt = fmt;
  live.current.range = range;
  live.current.prevClose = prevClose;

  const freqRef = useRef<Uint8Array | null>(null);
  const waveRef = useRef<Uint8Array | null>(null);

  useLayoutEffect(() => {
    const cvs = canvasRef.current!;
    function fit() {
      const rect = cvs.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.round(rect.width * dpr);
      cvs.height = Math.round(rect.height * dpr);
      cvs._dpr = dpr;
      cvs._w = rect.width;
      cvs._h = rect.height;
      setW(rect.width);
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cvs);
    return () => ro.disconnect();
  }, []);

  function geom(w: number, h?: number) {
    const hh = h || H;
    const plotW = Math.max(10, w - SPEC_PAD.L - SPEC_PAD.R);
    const plotH = hh - SPEC_PAD.T - SPEC_PAD.B;
    const xAt = (i: number, n: number) => SPEC_PAD.L + (i / (n - 1)) * plotW;
    const yAt = (v: number) =>
      SPEC_PAD.T + (1 - (v - scale.min) / (scale.max - scale.min)) * plotH;
    return { plotW, plotH, xAt, yAt, bottom: SPEC_PAD.T + plotH };
  }

  useEffect(() => {
    let raf = 0;
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;

    function frame(tms: number) {
      const dpr = cvs._dpr || 1,
        w = cvs._w || W,
        h = cvs._h || H;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const playing = engine.playingRef.current;
      // YouTube audio is cross-origin → the analyser (if one was created by an
      // earlier file/library track) is fed by the now-silent <audio> element
      // and would return all-zero bins, flattening the chart. Ignore it for
      // YouTube so the synthetic idleFreq animation drives the spectrum.
      const analyser = engine.sourceRef.current === "youtube" ? null : engine.analyserRef.current;
      const st = SPEC_STYLE[SPEC_STYLE[live.current.model] ? live.current.model : "FULL"];
      const animT = playing ? tms : 0;
      let freq: Uint8Array | null = null,
        wave: Uint8Array | null = null;
      if (analyser && playing) {
        const bins = analyser.frequencyBinCount;
        if (!freqRef.current || freqRef.current.length !== bins)
          freqRef.current = new Uint8Array(bins);
        if (!waveRef.current || waveRef.current.length !== analyser.fftSize)
          waveRef.current = new Uint8Array(analyser.fftSize);
        analyser.getByteFrequencyData(freqRef.current as Uint8Array<ArrayBuffer>);
        freq = freqRef.current;
        if (st.kind === "wave") {
          analyser.getByteTimeDomainData(waveRef.current as Uint8Array<ArrayBuffer>);
          wave = waveRef.current;
        }
      }

      paintSpectrumFrame(ctx, {
        w,
        h,
        scale,
        points,
        tickLabels,
        fmt,
        theme: live.current.theme,
        up: live.current.up,
        model: live.current.model,
        intensity: live.current.intensity,
        T: live.current.T,
        range: live.current.range,
        prevClose: live.current.prevClose,
        freq,
        wave,
        animT,
        hover: live.current.hover,
      });

      raf = requestAnimationFrame(frame);
    }
    frame(performance.now());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, points, tickLabels, fmt]);

  // ---- static "no-music" snapshot for Save Image ----------------------------
  useEffect(() => {
    window.IHSG_drawChartStill = (opts) => {
      const src = canvasRef.current;
      if (!src || !src.width || !src.height) return null;
      // With target dims (Save Image) render at that CSS size so the axis/overlay
      // fonts stay at their natural px against a wide canvas — the export looks
      // crisp and unstretched instead of scaling up the narrow on-screen still.
      const dpr = opts && (opts.w || opts.h) ? 2 : src._dpr || 1;
      const w = (opts && opts.w) || src._w || W,
        h = (opts && opts.h) || src._h || H;
      const out = document.createElement("canvas");
      out.width = Math.round(w * dpr);
      out.height = Math.round(h * dpr);
      const octx = out.getContext("2d")!;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);
      const L = live.current;
      paintSpectrumFrame(octx, {
        w,
        h,
        theme: L.theme,
        up: L.up,
        model: L.model,
        intensity: L.intensity,
        scale: L.scale!,
        points: L.points!,
        tickLabels: L.tickLabels!,
        fmt: L.fmt!,
        T: L.T,
        range: L.range,
        prevClose: L.prevClose,
        freq: null,
        wave: null,
        animT: 0,
        hover: null,
      });
      return out;
    };
    return () => {
      if (window.IHSG_drawChartStill) delete window.IHSG_drawChartStill;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const g = geom(rect.width);
    const ratio = Math.min(1, Math.max(0, (x - PAD_L) / Math.max(1, g.plotW)));
    let idx: number;
    if (oneD) {
      // time-scaled axis → snap to the point nearest in TIME (the lunch gap
      // maps to a session edge, so the dot never floats inside the break)
      const t = t0c + ratio * (tNc - t0c);
      idx = 0;
      let best = Infinity;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs(points[i].t - t);
        if (d < best) {
          best = d;
          idx = i;
        }
      }
    } else {
      idx = Math.round(ratio * (points.length - 1));
      idx = Math.max(0, Math.min(points.length - 1, idx));
    }
    setHover(idx);
  }

  function fmtTip(ms: number): string {
    const d = new Date(ms);
    const day = d.getDate();
    const mo = T.mon[d.getMonth()];
    const wd = T.wday[d.getDay()];
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const time = `${hh}${T.timeSep}${mm}`;
    switch (TIP_FMT[range] || "dateyear") {
      case "time":
        return time;
      case "wdaytime":
        return `${wd} ${day} ${mo} ${time}`;
      case "wday":
        return `${wd} ${day} ${mo}`;
      default:
        return `${day} ${mo} ${d.getFullYear()}`;
    }
  }

  const g = geom(W);
  const hp = hover != null && hover < points.length ? points[hover] : null;
  const hx =
    hp != null
      ? oneD
        ? SPEC_PAD.L + ((hp.t - t0c) / Math.max(1, tNc - t0c)) * g.plotW
        : g.xAt(hover!, points.length)
      : 0;
  const tipLeft = hover != null ? Math.min(Math.max(hx, 60), W - 60) : 0;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <canvas
        className="spec-chart-canvas"
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      />
      {hp && (
        <div className="tooltip" style={{ left: tipLeft }}>
          <span className="tooltip-val">{fmt(hp.v, 2)}</span>
          <span className="tooltip-date">{fmtTip(hp.t)}</span>
        </div>
      )}
    </div>
  );
}
