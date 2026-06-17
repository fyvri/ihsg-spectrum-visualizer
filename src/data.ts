/* =============================================================================
   Data layer.

   In production the React app stays "dumb about data sources": it polls the
   Cloudflare Worker at /api/quote (which fetches + normalizes the Yahoo Finance
   v8 chart API into the IhsgData shape) every ~10s and republishes
   window.IHSG_DATA.

   On a cold first load there is no seed data: the app paints an empty/zero
   dataset (value 0, blank chart, no news) and fills in as soon as the first
   /api/quote poll succeeds. When offline after a successful poll we show the
   last good quote from localStorage — we never fabricate *live* prices.
   ============================================================================= */
import { useEffect, useState } from "react";
import { emptyData, type IhsgData, type RangeKey } from "../shared/types";

export type { IhsgData, RangeKey, SeriesPoint } from "../shared/types";

declare global {
  interface Window {
    IHSG_DATA: IhsgData;
  }
}

/* ---------- last-good cache (offline tolerance) ---------------------------- */
const CACHE_KEY = "ihsg.data.cache.v1";
const ORDER: RangeKey[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "Max"];

function isValid(d: unknown): d is IhsgData {
  const x = d as IhsgData | null;
  return !!(
    x &&
    x.latest &&
    typeof x.latest.value === "number" &&
    x.ranges &&
    ORDER.every(
      (k) => x.ranges[k] && Array.isArray(x.ranges[k].points) && x.ranges[k].points.length > 1
    )
  );
}

function loadCache(): IhsgData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveCache(d: IhsgData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(d));
  } catch {
    /* quota / private mode — ignore */
  }
}

export async function fetchIhsgData(signal?: AbortSignal): Promise<IhsgData> {
  const res = await fetch("/api/quote", { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`/api/quote ${res.status}`);
  const json = await res.json();
  if (!isValid(json)) throw new Error("malformed /api/quote payload");
  return json as IhsgData;
}

/** Initial dataset available synchronously for the very first render: the last
   good cached quote if we have one, otherwise an empty/zero dataset (no
   fabricated prices) that the first successful poll replaces. */
export function initialData(): IhsgData {
  const data = loadCache() || emptyData();
  window.IHSG_DATA = data;
  return data;
}

const POLL_MS = 10000;

/**
 * Keep window.IHSG_DATA and React state in sync with the Worker. Polls every
 * ~10s; on failure (offline) it keeps the last good value and never fabricates.
 */
export function useIhsgData(): IhsgData {
  const [data, setData] = useState<IhsgData>(initialData);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const next = await fetchIhsgData(controller.signal);
        if (!alive) return;
        window.IHSG_DATA = next;
        saveCache(next);
        setData(next);
      } catch {
        /* offline / API down → keep the last good snapshot */
      } finally {
        if (alive) timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return data;
}
