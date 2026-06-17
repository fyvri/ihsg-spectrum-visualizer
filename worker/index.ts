/* =============================================================================
   IHSG Spectrum Visualizer — Cloudflare Worker (single-Worker topology).

   - fetch():     /api/quote returns the normalized IhsgData JSON, served from
                  the optional KV cache when bound (refreshed on demand if
                  stale) or fetched live otherwise; every other path is served
                  from the Vite build through the ASSETS binding.
   - scheduled(): the Cron Trigger refreshes the KV snapshot (a no-op until a
                  KV namespace is bound — see Env.IHSG_KV below).

   The React app stays "dumb about data sources": the data provider here can be
   swapped without touching the UI, as long as it returns the IhsgData shape.
   Default provider: Yahoo Finance ^JKSE (server-side fetch — Google Finance is
   the canonical page the UI links to but is CORS-locked and brittle to scrape;
   the IhsgProvider interface below lets you swap in a Google scraper instead).
   News: Google News RSS for "IHSG".
   ============================================================================= */
import { emptyData } from "../shared/types";
import type { IhsgData, RangeKey, SeriesPoint, NewsItem } from "../shared/types";

export interface Env {
  ASSETS: Fetcher;
  // Optional: a KV namespace used as a short-TTL cache for the quote snapshot.
  // Unbound by default so the repo is fork-and-deploy with no setup — every
  // KV access below is guarded, so without it the Worker simply fetches the
  // upstream live on each request. Bind one in the dashboard (Workers → KV)
  // or via wrangler.jsonc to enable caching + the cron refresh. See README.
  IHSG_KV?: KVNamespace;
}

const KV_KEY = "ihsg:data:v1";
const FRESH_MS = 60_000; // serve cached for up to 60s before an on-demand refresh
const ORDER: RangeKey[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "Max"];
const TZ = "Asia/Jakarta";
const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Cached {
  ts: number;
  data: IhsgData;
}

/* ============================ HTTP entry points ============================ */
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/quote") {
      const data = await getData(env, ctx);
      return json(data);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not found" }, 404);
    }
    // everything else → static assets (Vite build)
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env));
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // live quote/news must never be cached by the browser or the SW
      "cache-control": "no-store",
    },
  });
}

/* ============================ cache + refresh ============================ */
async function getData(env: Env, ctx: ExecutionContext): Promise<IhsgData> {
  let cached: Cached | null = null;
  try {
    // env.IHSG_KV is optional — unbound forks skip the cache entirely.
    cached = (await env.IHSG_KV?.get<Cached>(KV_KEY, "json")) ?? null;
  } catch {
    cached = null;
  }
  const now = Date.now();
  if (cached && now - cached.ts < FRESH_MS) return cached.data;

  // stale or missing → refresh now; if that fails, fall back to whatever we had
  try {
    const data = await buildData();
    ctx.waitUntil(writeCache(env, data));
    return data;
  } catch {
    if (cached) return cached.data;
    return emptyData(); // cold start with no network → empty/zero dataset
  }
}

async function refresh(env: Env): Promise<void> {
  try {
    const data = await buildData();
    await writeCache(env, data);
  } catch {
    /* leave the previous snapshot in place */
  }
}

async function writeCache(env: Env, data: IhsgData): Promise<void> {
  const payload: Cached = { ts: Date.now(), data };
  try {
    // no-op when IHSG_KV is unbound (optional KV cache)
    await env.IHSG_KV?.put(KV_KEY, JSON.stringify(payload), { expirationTtl: 600 });
  } catch {
    /* ignore */
  }
}

/* ============================ provider interface ============================ */
interface IhsgProvider {
  /** Fetch quote + the 8 range series, normalized into IhsgData. */
  fetch(): Promise<IhsgData>;
}

async function buildData(): Promise<IhsgData> {
  const provider: IhsgProvider = new YahooProvider();
  const data = await provider.fetch();
  data.news = await fetchNews().catch(() => []);
  return data;
}

/* ============================ Yahoo provider ============================ */
const YAHOO_SYMBOL = "%5EJKSE"; // ^JKSE
const RANGE_PARAMS: Record<RangeKey, { range: string; interval: string }> = {
  // 1-minute bars: matches Google Finance's intraday granularity (the first
  // value is the true 09:00 open area, not a 5-minute bar close)
  "1D": { range: "1d", interval: "1m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  YTD: { range: "ytd", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  Max: { range: "max", interval: "1mo" },
};

interface ChartQuote {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
}

interface ChartResult {
  meta: {
    regularMarketPrice?: number;
    regularMarketTime?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  };
  timestamp?: number[];
  indicators: { quote: ChartQuote[] };
}

/* OHLC array helpers — bars can contain nulls (halts/lunch), skip them. */
function firstNum(a?: (number | null)[]): number | undefined {
  if (!a) return undefined;
  for (const v of a) if (v != null && isFinite(v)) return v;
  return undefined;
}
function maxNum(a?: (number | null)[]): number | undefined {
  if (!a) return undefined;
  let m: number | undefined;
  for (const v of a) if (v != null && isFinite(v) && (m === undefined || v > m)) m = v;
  return m;
}
function minNum(a?: (number | null)[]): number | undefined {
  if (!a) return undefined;
  let m: number | undefined;
  for (const v of a) if (v != null && isFinite(v) && (m === undefined || v < m)) m = v;
  return m;
}

async function fetchChart(range: RangeKey): Promise<ChartResult> {
  const { range: r, interval } = RANGE_PARAMS[range];
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO_SYMBOL}?range=${r}&interval=${interval}&includePrePost=false`;
  const res = await fetch(u, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; IHSGVisualizer/1.0)" },
    cf: { cacheTtl: 30, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`yahoo ${range} ${res.status}`);
  const data = (await res.json()) as { chart: { result?: ChartResult[]; error?: unknown } };
  const result = data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error(`yahoo ${range} empty`);
  return result;
}

/* Baseline a range's change is measured against, matching Google Finance.
   The rule is per-range because Yahoo and Google snap window boundaries
   differently (verified against COMPOSITE:IDX origin numbers):
   - 1D:        the previous close (chartPreviousClose).
   - 5D/1M/6M:  the first real close on/after (period end − range duration).
   - 1Y:        Yahoo prepends a fake leading bar that just duplicates
                chartPreviousClose; Google drops it and measures from the first
                *real* bar ~1 year ago. So drop the anchor, then days-offset.
   - 5Y:        Google measures from the weekly close *just before* the 5-year
                window, which is exactly Yahoo's chartPreviousClose.
   - YTD/Max:   the first point of the series (year start / inception).
   Falls back to the first point when a series is too short. */
const DAY_MS = 86400000;
const RANGE_DAYS: Partial<Record<RangeKey, number>> = {
  "5D": 5,
  "1M": 30,
  "6M": 182,
  "1Y": 365,
  "5Y": 1826,
};
function pickBaseline(k: RangeKey, pts: SeriesPoint[], meta: ChartResult["meta"]): number | undefined {
  const cpc = meta.chartPreviousClose ?? meta.previousClose;
  if (!pts.length) return cpc;
  if (k === "1D") return cpc ?? pts[0].v;
  if (k === "YTD" || k === "Max") return pts[0].v;
  if (k === "5Y") return cpc ?? pts[0].v;
  if (k === "1Y") {
    // drop Yahoo's prepended anchor (a leading bar equal to chartPreviousClose
    // is not a real session), then take the first real close ~1 year back
    const real =
      cpc != null && pts.length > 1 && Math.abs(pts[0].v - cpc) < 1e-6 ? pts.slice(1) : pts;
    const target = real[real.length - 1].t - 365 * DAY_MS;
    for (const p of real) if (p.t >= target) return p.v;
    return real[0].v;
  }
  // 5D / 1M / 6M — first real close on/after (period end − range duration)
  const days = RANGE_DAYS[k];
  if (!days) return pts[0].v;
  const target = pts[pts.length - 1].t - days * DAY_MS;
  for (const p of pts) if (p.t >= target) return p.v;
  return pts[0].v;
}

function seriesFromChart(c: ChartResult): SeriesPoint[] {
  const ts = c.timestamp || [];
  const closes = (c.indicators.quote[0] && c.indicators.quote[0].close) || [];
  const pts: SeriesPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const v = closes[i];
    if (v == null || !isFinite(v)) continue;
    pts.push({ t: ts[i] * 1000, v: +v.toFixed(2) });
  }
  return pts;
}

class YahooProvider implements IhsgProvider {
  async fetch(): Promise<IhsgData> {
    // fetch all 8 ranges in parallel
    const entries = await Promise.all(ORDER.map(async (k) => [k, await fetchChart(k)] as const));
    const charts = Object.fromEntries(entries) as Record<RangeKey, ChartResult>;

    const ranges = {} as IhsgData["ranges"];
    for (const k of ORDER) {
      const c = charts[k];
      const pts = seriesFromChart(c);
      const baseline = pickBaseline(k, pts, c.meta);
      ranges[k] = {
        points: pts,
        tickLabels: buildTickLabels(k, pts),
        ...(baseline != null ? { baseline: +baseline.toFixed(2) } : {}),
      };
    }

    const oneD = charts["1D"];
    const day = ranges["1D"].points;
    const oneY = ranges["1Y"];

    const latestValue = oneD.meta.regularMarketPrice ?? (day.length ? day[day.length - 1].v : 0);
    const latestTs = oneD.meta.regularMarketTime
      ? oneD.meta.regularMarketTime * 1000
      : day.length
      ? day[day.length - 1].t
      : Date.now();

    const dayVals = day.map((p) => p.v);
    const yVals = oneY.points.length ? oneY.points.map((p) => p.v) : dayVals;

    // Stats come from real OHLC, not bar closes: the session OPEN is the first
    // bar's open, the day HIGH/LOW are intrabar extremes, and the 52-week
    // band is the max/min of the 1Y daily highs/lows (closes alone understate
    // the extremes — that's why they diverged from Google Finance).
    const q1d: ChartQuote = (oneD.indicators.quote && oneD.indicators.quote[0]) || {};
    const q1y: ChartQuote = (charts["1Y"].indicators.quote && charts["1Y"].indicators.quote[0]) || {};

    const stats = {
      open: firstNum(q1d.open) ?? (day.length ? day[0].v : latestValue),
      high:
        oneD.meta.regularMarketDayHigh ??
        maxNum(q1d.high) ??
        (dayVals.length ? Math.max(...dayVals) : latestValue),
      low:
        oneD.meta.regularMarketDayLow ??
        minNum(q1d.low) ??
        (dayVals.length ? Math.min(...dayVals) : latestValue),
      prevClose:
        oneD.meta.chartPreviousClose ??
        oneD.meta.previousClose ??
        (day.length ? day[0].v : latestValue),
      week52High: maxNum(q1y.high) ?? oneD.meta.fiftyTwoWeekHigh ?? Math.max(...yVals),
      week52Low: minNum(q1y.low) ?? oneD.meta.fiftyTwoWeekLow ?? Math.min(...yVals),
    };

    return {
      name: "IDX Composite",
      symbol: "IDX: COMPOSITE",
      currency: "IDR",
      latest: { value: +latestValue.toFixed(2), ts: latestTs },
      stats: {
        open: +stats.open.toFixed(2),
        high: +stats.high.toFixed(2),
        low: +stats.low.toFixed(2),
        prevClose: +stats.prevClose.toFixed(2),
        week52High: +stats.week52High.toFixed(2),
        week52Low: +stats.week52Low.toFixed(2),
      },
      ranges,
      order: ORDER,
      news: [],
    };
  }
}

/* ============================ tick labels ============================ */
function fmtInTz(ts: number, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    ...opts,
  }).formatToParts(new Date(ts));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return m;
}

function tickLabel(range: RangeKey, ts: number): string {
  const p = fmtInTz(ts, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const mon = EN_MON[+p.month - 1];
  const day = +p.day;
  const hour = p.hour === "24" ? "00" : p.hour;
  switch (range) {
    case "1D":
      return `${hour}:${p.minute}`;
    case "5D":
    case "1M":
      return `${day} ${mon}`;
    case "6M":
    case "1Y":
      return mon;
    case "YTD":
      return `${mon} ${p.year}`;
    case "5Y":
    case "Max":
    default:
      return p.year;
  }
}

/** ~6 evenly spaced, de-duplicated labels across the series. */
function buildTickLabels(range: RangeKey, pts: SeriesPoint[]): string[] {
  if (!pts.length) return [];
  const target = 6;
  const out: string[] = [];
  const step = Math.max(1, Math.floor((pts.length - 1) / (target - 1)));
  for (let i = 0; i < pts.length; i += step) out.push(tickLabel(range, pts[i].t));
  const last = tickLabel(range, pts[pts.length - 1].t);
  if (out[out.length - 1] !== last) out.push(last);
  // collapse consecutive duplicates (e.g. same month/year)
  return out.filter((lab, i) => i === 0 || lab !== out[i - 1]);
}

/* ============================ news (Google News RSS) ============================ */
async function fetchNews(): Promise<NewsItem[]> {
  const u =
    "https://news.google.com/rss/search?q=IHSG%20OR%20%22IDX%20Composite%22&hl=id&gl=ID&ceid=ID:id";
  const res = await fetch(u, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; IHSGVisualizer/1.0)" },
    cf: { cacheTtl: 120, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`news ${res.status}`);
  const xml = await res.text();
  const now = Date.now();
  const items: NewsItem[] = [];
  const reItem = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = reItem.exec(xml)) && items.length < 12) {
    const block = m[1];
    let title = pick(block, /<title>([\s\S]*?)<\/title>/);
    const link = pick(block, /<link>([\s\S]*?)<\/link>/);
    const src = pick(block, /<source[^>]*>([\s\S]*?)<\/source>/) || "Google News";
    const pub = pick(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
    title = decodeEntities(title).replace(/\s+-\s+[^-]+$/, "").trim();
    if (!title) continue;
    const t = pub ? Date.parse(pub) : NaN;
    const mins = isFinite(t) ? Math.max(0, Math.round((now - t) / 60000)) : 0;
    // Only trust http(s) links from the feed. The client renders this as an
    // <a href>, and React does NOT sanitize href schemes — drop anything else
    // (javascript:/data:) so a poisoned feed item can't become a clickable XSS.
    const url = /^https?:\/\//i.test(link) ? link : undefined;
    items.push({ src: decodeEntities(src), mins, title, url });
  }
  return items;
}

function pick(s: string, re: RegExp): string {
  const m = s.match(re);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}

