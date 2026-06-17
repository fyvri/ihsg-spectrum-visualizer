/* =============================================================================
   InfoSections — "Tentang/Profile" blurb + "Berita/News stories" grid with the
   "Show more" collapse. Ported 1:1 from project/sections.jsx. News items come
   from the Worker (IhsgData.news); when none are available yet we fall back to
   the bundled Indonesian headlines (only their relative times localize).
   ============================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Strings } from "../i18n";
import type { NewsItem } from "../../shared/types";

const FALLBACK_NEWS: NewsItem[] = [
  { src: "Tempo.co", mins: 22, title: "Bisakah Buyback Saham Menaikkan IHSG" },
  { src: "Bloomberg Technoz", mins: 42, title: "Masih Ada Peluang Kenaikan IHSG untuk Jangka Pendek" },
  { src: "Pasardana", mins: 60, title: "ANALIS MARKET (10/6/2026): IHSG Berpeluang Fluktuatif di Level 5500-5900" },
  { src: "detikFinance", mins: 120, title: "BI Rate Naik Bikin IHSG & Rupiah Bangkit, Semoga Nggak Loyo Lagi!" },
  { src: "Bisnis.com", mins: 180, title: "Rekomendasi Saham dan Pergerakan IHSG Hari Ini Rabu 10 Juni 2026" },
  { src: "IDNFinancials.com", mins: 1080, title: "Investor asing jual saham ini saat IHSG naik 4,8% di sesi I" },
  { src: "Liputan6.com", mins: 41, title: "IHSG Melonjak Usai BI Rate Naik, Kini Dibayangi Sentimen Geopolitik" },
  { src: "CNBC Indonesia", mins: 42, title: "IHSG Lompat 7,5%, Asing Masih Net Sell Jumbo di 10 Saham Ini" },
  { src: "KONTAN", mins: 120, title: "Simak Peluang Kenaikan IHSG Rabu (10/6) Usai Rebound" },
  { src: "investor.id", mins: 120, title: "IHSG Bakal Lanjut Menguat, Jangan Lewatkan Peluang Cuan 5 Saham" },
  { src: "CNN Indonesia", mins: 960, title: "Ekonomi RI Masih Tumbuh, Mengapa Rupiah dan IHSG Sempat Tertekan?" },
  { src: "ANTARA News Yogyakarta", mins: 1320, title: "IHSG menguat mengikuti bursa global" },
];

const AVA_COLORS = ["#5b9bd5", "#e0796b", "#56c98a", "#c79a4b", "#9b7ad6", "#4bb0c7", "#d76b9b", "#7c8a99"];
function avaColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVA_COLORS[h % AVA_COLORS.length];
}

function relTime(mins: number, T: Strings): string {
  if (mins < 60) return `${mins} ${T.minAgo}`;
  if (mins < 1440) return `${Math.round(mins / 60)} ${T.hourAgo}`;
  return `${Math.round(mins / 1440)} ${T.dayAgo}`;
}

function NewsItemView({ item, T, locked }: { item: NewsItem; T: Strings; locked: boolean }) {
  const href = item.url || "https://www.google.com/search?q=" + encodeURIComponent(item.title);
  return (
    <a
      className={"news-item" + (locked ? " locked" : "")}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={locked ? -1 : undefined}
      aria-hidden={locked ? "true" : undefined}
      onClick={locked ? (e) => e.preventDefault() : undefined}
    >
      <div className="news-meta">
        <span className="news-ava" style={{ background: avaColor(item.src) }}>
          {item.src[0].toUpperCase()}
        </span>
        <span className="news-src">{item.src}</span>
        <span className="news-dot">·</span>
        <span className="news-time">{relTime(item.mins, T)}</span>
      </div>
      <div className="news-title">{item.title}</div>
    </a>
  );
}

export function InfoSections({
  T,
  wikiHref,
  news,
}: {
  T: Strings;
  wikiHref: string;
  news?: NewsItem[];
}) {
  const items = news && news.length ? news : FALLBACK_NEWS;
  const [expanded, setExpanded] = useState(false);
  const [maxH, setMaxH] = useState<number | null>(null);
  const [fadeH, setFadeH] = useState(40);
  const [animate, setAnimate] = useState(false);
  const [clipIndex, setClipIndex] = useState(Infinity);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const recalc = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || grid.children.length === 0 || grid.scrollHeight === 0) return;
    const elems = grid.children;
    if (expanded) {
      setMaxH(grid.scrollHeight);
      setClipIndex(Infinity);
      return;
    }
    const top = grid.getBoundingClientRect().top;
    const row0Top = elems[0].getBoundingClientRect().top;
    let cols = 0;
    for (const it of elems) {
      if (Math.abs(it.getBoundingClientRect().top - row0Top) < 1) cols++;
      else break;
    }
    cols = Math.max(1, cols);
    const clip = cols * 2;
    setClipIndex(clip);
    if (elems.length <= clip) {
      setMaxH(grid.scrollHeight);
      return;
    }
    const item3 = elems[clip] as HTMLElement;
    const r3top = item3.getBoundingClientRect().top;
    const titleEl = item3.querySelector(".news-title") as HTMLElement | null;
    const metaEl = item3.querySelector(".news-meta") as HTMLElement | null;
    const lineH = titleEl ? parseFloat(getComputedStyle(titleEl).lineHeight) || 21 : 21;
    const titleTop = titleEl ? titleEl.getBoundingClientRect().top : r3top + 26;
    const metaBottom = metaEl ? metaEl.getBoundingClientRect().bottom : titleTop - 6;
    const peek = titleTop - r3top + lineH * 1.2;
    const cut = r3top - top + peek;
    setMaxH(Math.round(cut));
    setFadeH(Math.round(Math.max(lineH, cut - (metaBottom - top) + 4)));
  }, [expanded]);

  useLayoutEffect(() => {
    recalc();
  }, [recalc]);
  useEffect(() => {
    recalc();
    const id = requestAnimationFrame(() => setAnimate(true));
    const grid = gridRef.current;
    const ro = new ResizeObserver(recalc);
    if (grid) ro.observe(grid);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalc);
    window.addEventListener("resize", recalc);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  return (
    <div className="info">
      <section className="about">
        <h3 className="sect-title">{T.aboutTitle}</h3>
        <p className="about-text">
          {T.aboutText}{" "}
          <a href={wikiHref} target="_blank" rel="noopener noreferrer">
            {T.wikipedia}
          </a>
        </p>
      </section>

      <section className="news">
        <h3 className="sect-title">{T.newsTitle}</h3>
        <p className="sect-sub">{T.newsSubtitle}</p>
        <div
          className={"news-clip" + (expanded ? "" : " collapsed") + (animate ? " anim" : "")}
          style={{
            maxHeight: maxH == null ? "none" : maxH + "px",
            ["--fade-h" as string]: fadeH + "px",
          }}
        >
          <div className="news-grid" ref={gridRef}>
            {items.map((n, i) => (
              <NewsItemView key={i} item={n} T={T} locked={!expanded && i >= clipIndex} />
            ))}
          </div>
        </div>
        <button className="show-toggle" onClick={() => setExpanded((e) => !e)}>
          <span>{expanded ? T.showFewer : T.showMore}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>
    </div>
  );
}
