/* =============================================================================
   Shared IHSG_DATA contract — the exact shape the React app consumes and the
   Worker produces. Imported by src/data.ts (publishes window.IHSG_DATA) and by
   worker/index.ts (normalizes scraped data into this shape).
   ============================================================================= */

export type RangeKey = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "Max";

export interface SeriesPoint {
  t: number; // epoch ms
  v: number; // index value
}

export interface RangeSeries {
  points: SeriesPoint[];
  tickLabels: string[]; // EN month names — localized in the view
  /** Close immediately BEFORE the period (Yahoo chartPreviousClose) — the
      baseline Google Finance measures the range change against. Falls back
      to the first point when absent. */
  baseline?: number;
}

export interface NewsItem {
  src: string; // outlet name
  mins: number; // integer minutes-ago
  title: string;
  url?: string;
}

export interface IhsgData {
  name: string; // "IDX Composite"
  symbol: string; // "IDX: COMPOSITE" (display)
  currency: string; // "IDR"
  latest: { value: number; ts: number; time?: string };
  stats: {
    open: number;
    high: number;
    low: number;
    prevClose: number;
    week52High: number;
    week52Low: number;
  };
  ranges: Record<RangeKey, RangeSeries>;
  order: RangeKey[];
  news?: NewsItem[];
}

/** Canonical range order, shared by the app and the Worker. */
export const RANGE_ORDER: RangeKey[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "Max"];

/**
 * A zeroed/empty dataset: value 0, every range empty (no points/labels), zero
 * stats, no news. This is the very first paint before any live quote arrives —
 * the app shows zeros and a blank chart rather than fabricated seed prices.
 * Both the app (synchronous first render) and the Worker (cold-start fallback)
 * build the identical shape from here.
 */
export function emptyData(): IhsgData {
  const ranges = {} as Record<RangeKey, RangeSeries>;
  for (const k of RANGE_ORDER) ranges[k] = { points: [], tickLabels: [] };
  return {
    name: "IDX Composite",
    symbol: "IDX: COMPOSITE",
    currency: "IDR",
    latest: { value: 0, ts: Date.now() },
    stats: { open: 0, high: 0, low: 0, prevClose: 0, week52High: 0, week52Low: 0 },
    ranges,
    order: [...RANGE_ORDER],
    news: [],
  };
}
