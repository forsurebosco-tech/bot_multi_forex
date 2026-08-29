export interface TrendSeg {
  t1: number;
  p1: number;
  t2: number;
  p2: number;
}

/** Classic trend line from the two most recent ascending swing lows (higher low), or null. */
export function buildTrendLineUp(bars: { t: number; h: number; l: number }[], w = 5): TrendSeg | null {
  const n = bars.length;
  if (n < 2 * w + 3) return null;
  const lows: { t: number; p: number }[] = [];
  for (let i = w; i < n - w; i++) {
    const bar = bars[i];
    let ok = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (bars[j].l <= bar.l) {
        ok = false;
        break;
      }
    }
    if (ok) lows.push({ t: bar.t, p: bar.l });
  }
  for (let i = lows.length - 1; i >= 1; i--) {
    for (let j = i - 1; j >= 0; j--) {
      if (lows[i].p > lows[j].p) return { t1: lows[j].t, p1: lows[j].p, t2: lows[i].t, p2: lows[i].p };
    }
  }
  return null;
}

/** Classic trend line from the two most recent descending swing highs (lower high), or null. */
export function buildTrendLineDown(bars: { t: number; h: number; l: number }[], w = 5): TrendSeg | null {
  const n = bars.length;
  if (n < 2 * w + 3) return null;
  const highs: { t: number; p: number }[] = [];
  for (let i = w; i < n - w; i++) {
    const bar = bars[i];
    let ok = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (bars[j].h >= bar.h) {
        ok = false;
        break;
      }
    }
    if (ok) highs.push({ t: bar.t, p: bar.h });
  }
  for (let i = highs.length - 1; i >= 1; i--) {
    for (let j = i - 1; j >= 0; j--) {
      if (highs[i].p < highs[j].p) return { t1: highs[j].t, p1: highs[j].p, t2: highs[i].t, p2: highs[i].p };
    }
  }
  return null;
}