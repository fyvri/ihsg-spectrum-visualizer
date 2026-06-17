/* =============================================================================
   Shared spectrum drawing helpers — color math, rounded-top rect, and the
   synthetic idle frequency curve. Reused by SpectrumChart so the same routines
   drive the live animation loop and the static "still" snapshot.
   ============================================================================= */
type Ctx = CanvasRenderingContext2D;

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function withAlpha(h: string, a: number): string {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}

export function lerpColor(h1: string, h2: string, t: number): string {
  const a = hexToRgb(h1),
    b = hexToRgb(h2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Alpha helper that works for both #hex and rgb() strings. */
export function toAlpha(col: string, a: number): string {
  if (col.startsWith("#")) return withAlpha(col, a);
  return col.replace("rgb(", "rgba(").replace(")", `,${a})`);
}

export function roundTopRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/** Synthetic "playing" frequency curve used when there is no analyser
   (cross-origin YouTube audio can't be tapped). It mimics a real music
   spectrum so the chart pulses to a beat instead of gently wobbling: a bass
   kick on each beat, a snare on the off-beat, and a high shimmer, over a
   bass-weighted shape. Frozen when animT is constant (i.e. when not playing). */
export function idleFreq(n: number, tms: number): Float32Array {
  const arr = new Float32Array(n);
  const t = tms / 1000;
  // beat envelope (~118 BPM): bass kick on the beat, snare on the off-beat
  const beat = t * (118 / 60);
  const kick = Math.exp(-(beat - Math.floor(beat)) * 6);
  const off = beat + 0.5 - Math.floor(beat + 0.5);
  const snare = Math.exp(-off * 9);
  // smooth value-noise: each bin flickers fast and independently like a real
  // analyser readout, interpolated between time steps so it stays fluid
  const hash = (x: number) => {
    const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const vnoise = (x: number, ts: number) => {
    const ti = Math.floor(ts);
    const fr = ts - ti;
    const u = fr * fr * (3 - 2 * fr); // smoothstep
    const a = hash(x + ti * 57.0);
    const b = hash(x + (ti + 1) * 57.0);
    return a + (b - a) * u;
  };
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const bass = Math.exp(-f * 3.0); // low-end weighting
    const mid = Math.exp(-Math.pow((f - 0.3) / 0.22, 2)); // mid bump (snare/vocal)
    // fast spiky detail (~10 updates/sec) gated by a slower envelope
    const detail = vnoise(i * 0.6, t * 10) * (0.4 + 0.6 * vnoise(i * 0.17, t * 3));
    let v =
      0.04 +
      kick * (0.45 * bass + 0.05) +
      snare * 0.18 * mid +
      detail * (0.18 + 0.5 * bass);
    v *= 1 - f * 0.35; // gentle high-frequency rolloff
    arr[i] = Math.max(0.02, v);
  }
  return arr;
}
