/* =============================================================================
   Save-image generator — renders the CURRENT view into a 1080×1920
   Instagram-Story PNG that mirrors the app's MOBILE layout 1:1. Ported from
   project/save-image.js.

   Value source is ALWAYS the real quote: headline numbers come from
   window.IHSG_still and the chart from window.IHSG_drawChartStill() (an at-rest
   render), so the export never captures the "singing" values. Per the brief it
   OMITS the "More details" button and the entire News section.
   ============================================================================= */
import type { IhsgData } from "../shared/types";
import { BRAND_NAME, SITE_URL } from "./config";

export interface StillQuote {
  price: string;
  changeMain: string;
  changeLabel: string;
  up: boolean;
  stamp: string;
}

export interface StoryImageApi {
  buildStoryCanvas(): Promise<HTMLCanvasElement>;
  saveImage(opts?: { lang?: "id" | "en" }): Promise<void>;
  shareImage(opts?: {
    lang?: "id" | "en";
    title?: string;
    text?: string;
  }): Promise<"shared" | "cancelled" | "unsupported" | "error">;
  canShareImage(): boolean;
}

declare global {
  interface Window {
    IHSG_still?: StillQuote;
    IHSG_drawChartStill?: (opts?: { w?: number; h?: number }) => HTMLCanvasElement | null;
    StoryImage: StoryImageApi;
  }
}

type Ctx = CanvasRenderingContext2D;

function cssVar(name: string, fb: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fb;
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: Ctx, text: string, maxW: number): string[] {
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function txt(sel: string): string {
  const el = document.querySelector(sel);
  return el ? (el.textContent || "").trim() : "";
}

function truncate(ctx: Ctx, text: string, maxW: number): string {
  text = String(text || "");
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

function drawCardBase(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, stroke: string) {
  rrect(ctx, x, y, w, h, 22);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function strokeSetup(ctx: Ctx, color: string, lw: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function drawTrendArrow(ctx: Ctx, cx: number, cy: number, s: number, color: string, up: boolean) {
  const f = s / 24;
  ctx.save();
  ctx.translate(cx, cy);
  if (!up) ctx.rotate(Math.PI);
  strokeSetup(ctx, color, 2.6 * f);
  ctx.beginPath();
  ctx.moveTo(0, -8 * f);
  ctx.lineTo(0, 8 * f);
  ctx.moveTo(0, -8 * f);
  ctx.lineTo(-6 * f, -1 * f);
  ctx.moveTo(0, -8 * f);
  ctx.lineTo(6 * f, -1 * f);
  ctx.stroke();
  ctx.restore();
}

function drawNote(ctx: Ctx, cx: number, cy: number, s: number, color: string) {
  const f = s / 24,
    ox = cx - s / 2,
    oy = cy - s / 2;
  const X = (n: number) => ox + n * f,
    Y = (n: number) => oy + n * f;
  strokeSetup(ctx, color, 1.8 * f);
  ctx.beginPath();
  ctx.moveTo(X(9), Y(18));
  ctx.lineTo(X(9), Y(5));
  ctx.lineTo(X(19), Y(3));
  ctx.lineTo(X(19), Y(16));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(6), Y(18), 3 * f, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(16), Y(16), 3 * f, 0, Math.PI * 2);
  ctx.stroke();
}

async function buildStoryCanvas(): Promise<HTMLCanvasElement> {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const W = 1080;
  const PAD = 48;
  const innerW = W - PAD * 2;
  const FONT = "'IBM Plex Sans', system-ui, sans-serif";

  const MAXH = 4400;
  const cvs = document.createElement("canvas");
  cvs.width = W;
  cvs.height = MAXH;
  const ctx = cvs.getContext("2d")!;

  const bg = cssVar("--bg", "#131314");
  const text = cssVar("--text", "#e6e6e7");
  const text2 = cssVar("--text-2", "#9aa0a6");
  const text3 = cssVar("--text-3", "#7c8186");
  const hair = cssVar("--hairline", "rgba(255,255,255,0.10)");
  const up = cssVar("--up", "#7fc998");
  const down = cssVar("--down", "#ec7f6f");
  const accent = cssVar("--accent", "#7ca7f5");
  const cardBg = cssVar("--player-bg", "#1a1a1c");
  const segTrack = cssVar("--seg-track", "rgba(255,255,255,0.06)");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, MAXH);

  const D: Partial<IhsgData> = window.IHSG_DATA || {};
  const symbol = txt(".sub") || D.symbol || "IDX:COMPOSITE";
  const title = txt(".title") || D.name || "IDX Composite";

  const still = window.IHSG_still || null;
  const price = (still && still.price) || txt(".price");

  const clEl = document.querySelector(".change-line");
  const clDirect = clEl
    ? ([...clEl.children].filter((n) => n.tagName === "SPAN") as HTMLElement[])
    : [];
  const clUp = still ? !!still.up : clEl ? clEl.classList.contains("pos") : true;
  const changeMain = still ? still.changeMain : clDirect[0] ? clDirect[0].textContent!.trim() : "";
  const changeLabel = still
    ? still.changeLabel
    : clDirect.length
    ? clDirect[clDirect.length - 1].textContent!.trim()
    : "";
  const chColor = clUp ? up : down;

  const tsEl = document.querySelector(".timestamp");
  const stamp = still
    ? still.stamp
    : tsEl && tsEl.childNodes[0]
    ? tsEl.childNodes[0].textContent!.trim()
    : "";
  const disclaimer = txt(".disclaimer");

  const tabs = [...document.querySelectorAll(".tabs .tab")].map((t) => ({
    label: (t.querySelector(".tab-label") || t).textContent!.trim(),
    active: t.classList.contains("active"),
  }));

  // The story mirrors the app's MOBILE layout, so render the chart still at a
  // mobile logical size (narrow → short labels like "Tutup sblmnya", lunch break
  // on two lines) with the mobile aspect, then scale it up into the wider story
  // slot below. Drawing a 12px-axis still rendered at ~470px into the 984px slot
  // yields ~25px axis labels — matching the on-screen scale (price 44px→90px,
  // i.e. ≈2.05×) instead of the tiny full-width render or the stretched canvas.
  const CHART_W = 470;
  const CHART_H = 235;
  const chart =
    (window.IHSG_drawChartStill &&
      window.IHSG_drawChartStill({ w: CHART_W, h: CHART_H })) ||
    (document.querySelector(".spec-chart-canvas") as HTMLCanvasElement | null);

  const stats = [...document.querySelectorAll(".stats .stat-row")].map((r) => ({
    label: (r.querySelector(".lbl-full") || r.querySelector(".stat-label"))!.textContent!.trim(),
    value: (r.querySelector(".stat-value")?.textContent || "").trim(),
  }));

  const trackEl = document.querySelector(".track-name");
  const hasTrack = !!(trackEl && trackEl.classList.contains("on"));
  const titleElq = trackEl ? trackEl.querySelector(".track-title") : null;
  const artistEl = trackEl ? trackEl.querySelector(".track-artist") : null;
  const trackName = titleElq
    ? titleElq.textContent!.trim()
    : trackEl
    ? trackEl.textContent!.trim()
    : "";
  const trackArtist = artistEl ? artistEl.textContent!.trim() : "";
  const seekFill = document.querySelector(".seek-fill") as HTMLElement | null;
  const playPct = seekFill ? parseFloat(seekFill.style.width) || 0 : 0;
  const timeEls = [...document.querySelectorAll(".player .time")];
  const curTime = timeEls[0] ? timeEls[0].textContent!.trim() : "0:00";
  const durTime = timeEls[1] ? timeEls[1].textContent!.trim() : "0:00";

  const aboutEl = document.querySelector(".about-text");
  const aboutTitle = txt(".about .sect-title") || "Tentang";
  const aboutBody = aboutEl && aboutEl.childNodes[0] ? aboutEl.childNodes[0].textContent!.trim() : "";
  const wikiText = txt(".about-text a") || "Wikipedia";

  // env-driven (VITE_SITE_URL); trailing slashes trimmed for a clean caption
  const siteUrl = SITE_URL.trim().replace(/\/+$/, "");

  let y = 200;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.font = "500 60px " + FONT;
  const titleLines = wrapLines(ctx, title, Math.max(360, innerW));
  const titleLH = 70;
  ctx.fillStyle = text;
  titleLines.forEach((ln, i) => ctx.fillText(ln, PAD, y + 54 + i * titleLH));
  y += titleLines.length * titleLH + 6;

  ctx.font = "500 30px " + FONT;
  ctx.fillStyle = text2;
  ctx.fillText(symbol, PAD, y + 26);
  y += 26 + 40;

  ctx.font = "500 90px " + FONT;
  ctx.fillStyle = text;
  ctx.fillText(price, PAD, y + 78);
  y += 78 + 22;

  ctx.textBaseline = "middle";
  ctx.font = "600 40px " + FONT;
  ctx.fillStyle = chColor;
  let cxp = PAD;
  ctx.fillText(changeMain, cxp, y + 20);
  cxp += ctx.measureText(changeMain).width + 18;
  drawTrendArrow(ctx, cxp + 13, y + 20, 30, chColor, clUp);
  cxp += 30 + 14;
  ctx.fillText(changeLabel, cxp, y + 20);
  ctx.textBaseline = "alphabetic";
  y += 40 + 22;

  ctx.font = "400 30px " + FONT;
  let tx = PAD;
  ctx.fillStyle = text3;
  ctx.fillText(stamp, tx, y + 26);
  tx += ctx.measureText(stamp).width + 16;
  ctx.fillText("•", tx, y + 26);
  tx += ctx.measureText("•").width + 16;
  ctx.fillStyle = text2;
  ctx.fillText(disclaimer, tx, y + 26);
  const dw = ctx.measureText(disclaimer).width;
  ctx.strokeStyle = text2;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(tx, y + 33);
  ctx.lineTo(tx + dw, y + 33);
  ctx.stroke();
  y += 30 + 46;

  ctx.font = "500 32px " + FONT;
  const tabW = tabs.map((t) => ctx.measureText(t.label).width);
  const sumW = tabW.reduce((a, b) => a + b, 0);
  const gap = tabs.length > 1 ? (innerW - sumW) / (tabs.length - 1) : 0;
  const tabBaseY = y + 30;
  let tabX = PAD;
  tabs.forEach((t, i) => {
    if (i > 0) {
      const sepX = tabX - gap / 2;
      ctx.strokeStyle = hair;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sepX, tabBaseY - 23);
      ctx.lineTo(sepX, tabBaseY - 1);
      ctx.stroke();
    }
    ctx.font = (t.active ? "600 " : "500 ") + "32px " + FONT;
    ctx.fillStyle = t.active ? accent : text2;
    ctx.fillText(t.label, tabX, tabBaseY);
    if (t.active) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tabX, tabBaseY + 16);
      ctx.lineTo(tabX + tabW[i], tabBaseY + 16);
      ctx.stroke();
    }
    tabX += tabW[i] + gap;
  });
  y = tabBaseY + 16 + 36;

  if (chart && chart.width && chart.height) {
    // Draw the still at its own aspect (scaled up to innerW) so nothing is
    // squished — no height clamp, which would distort the mobile aspect.
    const ratio = chart.height / chart.width;
    const chartH = Math.round(innerW * ratio);
    ctx.save();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(chart, PAD, y, innerW, chartH);
    ctx.restore();
    y += chartH + 48;
  }

  if (stats.length) {
    const rows = Math.ceil(stats.length / 2);
    // larger, readable detail rows with comfortable line spacing between them
    const rowH = 50;
    const statPx = 26;
    const colGap = 48;
    const colW = (innerW - colGap) / 2;
    const col1 = stats.slice(0, rows);
    const col2 = stats.slice(rows);
    ctx.textBaseline = "middle";
    const drawCol = (arr: typeof stats, x0: number) => {
      arr.forEach((s, i) => {
        const ry = y + i * rowH + rowH / 2;
        ctx.font = `400 ${statPx}px ` + FONT;
        ctx.fillStyle = text2;
        ctx.textAlign = "left";
        ctx.fillText(s.label, x0, ry);
        ctx.font = `600 ${statPx}px ` + FONT;
        ctx.fillStyle = text;
        ctx.textAlign = "right";
        ctx.fillText(s.value, x0 + colW, ry);
      });
    };
    drawCol(col1, PAD);
    drawCol(col2, PAD + colW + colGap);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    y += rows * rowH + 46;
  }

  const cardH = 200;
  drawCardBase(ctx, PAD, y, innerW, cardH, cardBg, hair);
  const cx0 = PAD + 38;
  const cxR = PAD + innerW - 38;
  ctx.textBaseline = "middle";

  const r1y = y + 62;
  const showArtist = hasTrack && !!trackArtist;
  drawNote(ctx, cx0 + 14, r1y, 30, text3);
  const tnx = cx0 + 48;
  const titleY = showArtist ? r1y - 16 : r1y;
  ctx.font = "500 32px " + FONT;
  ctx.fillStyle = hasTrack ? text2 : text3;
  ctx.textAlign = "left";
  ctx.fillText(
    truncate(ctx, hasTrack ? trackName : trackName || "Belum ada lagu — unggah audio", cxR - tnx),
    tnx,
    titleY
  );
  if (showArtist) {
    ctx.font = "400 26px " + FONT;
    ctx.fillStyle = text3;
    ctx.fillText(truncate(ctx, trackArtist, cxR - tnx), tnx, r1y + 22);
  }

  const r2y = y + 140;
  ctx.font = "500 27px " + FONT;
  ctx.fillStyle = text2;
  ctx.textAlign = "left";
  ctx.fillText(curTime, cx0, r2y);
  ctx.textAlign = "right";
  ctx.fillText(durTime, cxR, r2y);
  const sideW = 86;
  const barX = cx0 + sideW,
    barX2 = cxR - sideW;
  const barW = barX2 - barX,
    barH = 8;
  const pf = Math.max(0, Math.min(1, playPct / 100));
  rrect(ctx, barX, r2y - barH / 2, barW, barH, 4);
  ctx.fillStyle = segTrack;
  ctx.fill();
  if (pf > 0) {
    rrect(ctx, barX, r2y - barH / 2, Math.max(barH, barW * pf), barH, 4);
    ctx.fillStyle = up;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(barX + barW * pf, r2y, 11, 0, Math.PI * 2);
  ctx.fillStyle = up;
  ctx.fill();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  y += cardH + 62;

  ctx.font = "500 46px " + FONT;
  ctx.fillStyle = text;
  ctx.fillText(aboutTitle, PAD, y + 40);
  y += 40 + 24;

  ctx.font = "400 32px " + FONT;
  const bodyLines = wrapLines(ctx, aboutBody, innerW);
  const lineH = 47;
  ctx.fillStyle = text2;
  bodyLines.forEach((ln, i) => ctx.fillText(ln, PAD, y + 32 + i * lineH));
  const lastLine = bodyLines.length ? bodyLines[bodyLines.length - 1] : "";
  const lastW = ctx.measureText(lastLine + " ").width;
  const wikiW = ctx.measureText(wikiText).width;
  let wikiX: number, wikiY: number;
  if (lastW + wikiW <= innerW) {
    wikiX = PAD + lastW;
    wikiY = y + 32 + (bodyLines.length - 1) * lineH;
    y += bodyLines.length * lineH;
  } else {
    wikiX = PAD;
    wikiY = y + 32 + bodyLines.length * lineH;
    y += (bodyLines.length + 1) * lineH;
  }
  ctx.fillStyle = accent;
  ctx.fillText(wikiText, wikiX, wikiY);
  y += 64;

  const contentH = Math.round(y);

  const outW = 1080,
    outH = 1920;
  const footerH = 168;
  const availH = outH - footerH;
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d")!;
  octx.fillStyle = bg;
  octx.fillRect(0, 0, outW, outH);

  if (contentH <= availH) {
    const offY = Math.round((availH - contentH) / 2);
    octx.drawImage(cvs, 0, 0, W, contentH, 0, offY, W, contentH);
  } else {
    const scale = availH / contentH;
    const dw2 = Math.round(W * scale);
    const offX = Math.round((outW - dw2) / 2);
    octx.drawImage(cvs, 0, 0, W, contentH, offX, 0, dw2, availH);
  }

  const footTop = outH - footerH;
  octx.strokeStyle = hair;
  octx.lineWidth = 1.5;
  octx.beginPath();
  octx.moveTo(PAD, footTop);
  octx.lineTo(outW - PAD, footTop);
  octx.stroke();
  octx.textAlign = "center";
  octx.textBaseline = "alphabetic";
  octx.font = "400 27px " + FONT;
  octx.fillStyle = text3;
  octx.fillText(
    "© Crafted in a Broken Nation by " + BRAND_NAME + " " + new Date().getFullYear(),
    outW / 2,
    footTop + 64
  );
  octx.font = "400 26px " + FONT;
  octx.fillStyle = accent;
  octx.fillText(siteUrl, outW / 2, footTop + 110);
  return out;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res) => {
    if (canvas.toBlob) canvas.toBlob((b) => res(b as Blob), "image/png");
    else {
      const data = canvas.toDataURL("image/png");
      const bin = atob(data.split(",")[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      res(new Blob([arr], { type: "image/png" }));
    }
  });
}

function storyFileName(opts?: { lang?: "id" | "en" }): string {
  const lang = opts && opts.lang === "en" ? "en" : "id";
  const tz = "Asia/Jakarta";
  const D = window.IHSG_DATA;
  const ts = (D && D.latest && D.latest.ts) || Date.now();

  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const m: Record<string, string> = {};
  dtf.formatToParts(new Date(ts)).forEach((p) => {
    m[p.type] = p.value;
  });
  const hh = m.hour === "24" ? "00" : m.hour;
  const yyyymmdd = `${m.year}${m.month}${m.day}`;
  const hhii = `${hh}${m.minute}`;

  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +hh, +m.minute, +m.second);
  const off = Math.round((asUTC - ts) / 60000);
  const sign = off >= 0 ? "plus" : "minus";
  const oh = Math.floor(Math.abs(off) / 60);
  const om = Math.abs(off) % 60;
  const numberUTC = om ? `${oh}.${String(om).padStart(2, "0")}` : `${oh}`;

  const z = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const savedAt =
    `${now.getFullYear()}${z(now.getMonth() + 1)}${z(now.getDate())}` +
    `${z(now.getHours())}${z(now.getMinutes())}${z(now.getSeconds())}`;

  return `ihsg-${yyyymmdd}-${hhii}-utc-${sign}-${numberUTC}-${lang}-${savedAt}.png`;
}

async function saveImage(opts?: { lang?: "id" | "en" }): Promise<void> {
  const canvas = await buildStoryCanvas();
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, storyFileName(opts));
}

function canShareImage(): boolean {
  try {
    if (!navigator.share || !navigator.canShare) return false;
    const probe = new File([new Uint8Array([137, 80, 78, 71])], "p.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

async function shareImage(opts?: {
  lang?: "id" | "en";
  title?: string;
  text?: string;
}): Promise<"shared" | "cancelled" | "unsupported" | "error"> {
  opts = opts || {};
  if (!canShareImage()) return "unsupported";

  const canvas = await buildStoryCanvas();
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], storyFileName(opts), { type: "image/png" });

  let payload: ShareData = { files: [file] };
  if (opts.title) payload.title = opts.title;
  if (opts.text) payload.text = opts.text;
  if (navigator.canShare && !navigator.canShare(payload)) {
    payload = { files: [file] };
  }
  try {
    await navigator.share(payload);
    return "shared";
  } catch (e) {
    return e && (e as Error).name === "AbortError" ? "cancelled" : "error";
  }
}

export const StoryImage: StoryImageApi = {
  buildStoryCanvas,
  saveImage,
  shareImage,
  canShareImage,
};

// Keep a window handle for parity with the prototype / any external callers.
window.StoryImage = StoryImage;
