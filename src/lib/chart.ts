import { toSeries, ema, atr } from "./indicators";
import type { Candle } from "./oanda";

export interface ChartBar {
  t: number; // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface StructLevel {
  price: number;
  kind: "support" | "resistance";
  touches: number; // pivot bars that visited the band
  confirmed: boolean; // >= 2 touches = traded level
}

export interface SwingEvent {
  t: number; // bar time start (sec)
  bar: number; // index into bars
  side: "buy" | "sell"; // reclaim direction after the sweep
  price: number; // sweep extreme (the wick)
  level: number; // the level that got swept
  levelTouches: number;
  confirmed: boolean;
  kind: "sweep" | "break"; // break = close beyond a prior swing (no reclaim)
}

export interface ChartAnalysis {
  instrument: string;
  bars: ChartBar[];
  ema21: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  atr14: number; // last value
  supports: StructLevel[];
  resistances: StructLevel[];
  events: SwingEvent[];
}

interface PivotPt {
  at: number;
  price: number;
  kind: "low" | "high";
}

function pivotScan(closeLen: number, getLow: (i: number) => number, getHigh: (i: number) => number, lookback: number, from: number): PivotPt[] {
  const out: PivotPt[] = [];
  for (let i = from; i < closeLen - lookback; i++) {
    let isLow = true;
    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (getLow(j) <= getLow(i)) isLow = false;
      if (getHigh(j) >= getHigh(i)) isHigh = false;
    }
    if (isLow) out.push({ at: i, price: getLow(i), kind: "low" });
    if (isHigh) out.push({ at: i, price: getHigh(i), kind: "high" });
  }
  return out;
}

function bandLevels(
  pivots: PivotPt[],
  kind: "low" | "high",
  bandTol: number
): StructLevel[] {
  const pts = pivots.filter((p) => p.kind === kind);
  const bands: Array<{ price: number; count: number }> = [];
  for (const p of pts) {
    const hit = bands.find((b) => Math.abs(b.price - p.price) <= bandTol);
    if (hit) {
      hit.count += 1;
      hit.price = (hit.price + p.price) / 2;
    } else {
      bands.push({ price: p.price, count: 1 });
    }
  }
  return bands.map((b) => ({
    price: b.price,
    kind: kind === "low" ? "support" : "resistance",
    touches: b.count,
    confirmed: b.count >= 2,
  }));
}

export function computeChartAnalysis(
  instrument: string,
  candles: Candle[],
  pipSize: number,
  opts: { maxLevelBars?: number; pivotLookback?: number } = {}
): ChartAnalysis {
  const maxLevelBars = opts.maxLevelBars ?? 120;
  const pivotLookback = opts.pivotLookback ?? 2;
  const bars: ChartBar[] = candles.map((c) => ({
    t: Math.round(parseFloat(c.time)),
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
  }));
  const n = candles.length;
  const series = toSeries(candles);
  const e21 = ema(series.close, 21);
  const e50 = ema(series.close, 50);
  const e200 = ema(series.close, 200);
  const atrArr = atr(series, 14);
  const atr14 = atrArr[n - 1] ?? 0;

  const low = (i: number) => candles[i].low;
  const high = (i: number) => candles[i].high;
  const fromScan = Math.max(pivotLookback * 2, n - maxLevelBars * 2);
  const pivots = pivotScan(n, low, high, pivotLookback, fromScan);

  const bandTol = Math.max(0.6 * atr14, pipSize * 4);
  let supports = bandLevels(pivots, "low", bandTol);
  let resistances = bandLevels(pivots, "high", bandTol);
  const both = [...supports, ...resistances].sort((a, b) => b.price - a.price);

  // events: sweep of the nearest prior pivot low/high (reclaim), then structure breaks
  const events: SwingEvent[] = [];
  const start = pivotLookback * 2;
  let prevLow: PivotPt | null = null;
  let prevHigh: PivotPt | null = null;
  for (let i = 0; i < pivots.length; i++) {
    const p = pivots[i];
    if (p.at <= start) {
      if (p.kind === "low") prevLow = p;
      else prevHigh = p;
      continue;
    }

    if (p.kind === "low") {
      const pl = prevLow;
      // bullish reclaim: took the old low out (wick) then the CLOSE came back above it
      if (pl && low(p.at) < pl.price && candles[p.at].close > pl.price) {
        const lvl = both.find((b) => b.kind === "support" && Math.abs(b.price - pl.price) <= bandTol) ?? {
          price: pl.price,
          kind: "support" as const,
          touches: 1,
          confirmed: false,
        };
        events.push({
          t: bars[p.at].t,
          bar: p.at,
          side: "buy",
          price: low(p.at),
          level: lvl.price,
          levelTouches: lvl.touches,
          confirmed: lvl.confirmed,
          kind: "sweep",
        });
      }
      // structure break: a close below the old low (no reclaim) = bearish structure
      if (pl && candles[p.at].close < pl.price) {
        events.push({
          t: bars[p.at].t,
          bar: p.at,
          side: "sell",
          price: low(p.at),
          level: pl.price,
          levelTouches: 1,
          confirmed: false,
          kind: "break",
        });
      }
      prevLow = p;
    } else {
      const ph = prevHigh;
      if (ph && high(p.at) > ph.price && candles[p.at].close < ph.price) {
        const lvl = both.find((b) => b.kind === "resistance" && Math.abs(b.price - ph.price) <= bandTol) ?? {
          price: ph.price,
          kind: "resistance" as const,
          touches: 1,
          confirmed: false,
        };
        events.push({
          t: bars[p.at].t,
          bar: p.at,
          side: "sell",
          price: high(p.at),
          level: lvl.price,
          levelTouches: lvl.touches,
          confirmed: lvl.confirmed,
          kind: "sweep",
        });
      }
      if (ph && candles[p.at].close > ph.price) {
        events.push({
          t: bars[p.at].t,
          bar: p.at,
          side: "buy",
          price: high(p.at),
          level: ph.price,
          levelTouches: 1,
          confirmed: false,
          kind: "break",
        });
      }
      prevHigh = p;
    }
  }

  // restrict rendered levels to the visible window
  const fromVis = Math.max(0, n - maxLevelBars);
  supports = supports.filter((s) => s.price >= candles[fromVis].low);
  resistances = resistances.filter((r) => r.price <= candles[fromVis].high);

  return {
    instrument,
    bars,
    ema21: e21.map((v) => (Number.isFinite(v) ? v : null)),
    ema50: e50.map((v) => (Number.isFinite(v) ? v : null)),
    ema200: e200.map((v) => (Number.isFinite(v) ? v : null)),
    atr14,
    supports,
    resistances,
    events: events.slice(-40),
  };
}