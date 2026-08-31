import type { Candle } from "./oanda";
import { toSeries, ema, rsi, atr, adx, highest, lowest } from "./indicators";
import type { InstrumentConfig } from "./config";

export interface SwingConfig {
  trend: {
    ema200Period: number;
    ema200SlopeBars: number;
    ema200SlopeFlatPct: number;
    adxPeriod: number;
    adxThreshold: number;
  };
  setup: {
    swingLookbackBars: number; // H4 bars used to locate the last swing high/low
    legMinAtr: number; // impulse leg must be >= this x ATR(H4) to qualify
    pullbackMinRetrace: number; // pullback depth floor (0.38 = 38%)
    pullbackMaxRetrace: number; // pullback depth ceiling (0.62)
    pullbackBarCount: number; // trigger bar must be within this many H4 bars of the swing high (fresh retrace)
    rsiResetHigh: number; // long: H4 RSI must have reset to <= this during the retrace
    rsiCrashLow: number; // long: H4 RSI below this = momentum crash, skip
    triggerEmaPeriod: number; // H4 EMA the trigger bar must reclaim
    triggerGbEmaPct: number; // close must exceed trigger EMA by this % for confirmation strength
    slBufferAtr: number; // SL = retrace low/high minus/plus buffer x ATR(H4)
    slMaxAtr: number; // cap initial SL width at this x ATR(H4)
    tp1MinR: number; // structural target must be >= this R or we use tp1MinR fallback
    tp1MaxR: number; // clamp structural target to at most this R
    tp2RMult: number; // TP2 = tp1R x tp2RMult
  };
  risk: {
    riskPerTradePct: number;
    maxPositions: number;
    maxConsecutiveLosses: number;
    dailyLossLimitPct: number;
    timeStopDays: number; // force-exit a trade that never hit TP1 after this many days
    cooldownDays: number; // block re-entry to a symbol/direction for this many days after exit
    maxSpreadPips: number; // skip when typical spread > this many pips
  };
}

export const SWING_DEFAULT_CONFIG: SwingConfig = {
  trend: {
    ema200Period: 200,
    ema200SlopeBars: 20,
    ema200SlopeFlatPct: 0.00005, // D1 EMA200 must not be flat over 20 days
    adxPeriod: 14,
    adxThreshold: 15,
  },
  setup: {
    swingLookbackBars: 60,
    legMinAtr: 1.2,
    pullbackMinRetrace: 0.38,
    pullbackMaxRetrace: 0.7,
    pullbackBarCount: 42,
    rsiResetHigh: 50,
    rsiCrashLow: 22,
    triggerEmaPeriod: 21,
    triggerGbEmaPct: 0.0000,
    slBufferAtr: 0.4,
    slMaxAtr: 5,
    tp1MinR: 1.8,
    tp1MaxR: 4,
    tp2RMult: 1.6,
  },
  risk: {
    riskPerTradePct: 0.02,
    maxPositions: 6,
    maxConsecutiveLosses: 3,
    dailyLossLimitPct: 0.08,
    timeStopDays: 8,
    cooldownDays: 4,
    maxSpreadPips: 6,
  },
};

export interface SwingSignal {
  symbol: string;
  direction: "long" | "short";
  strategy: "pullback";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  lots: number;
  riskAmount: number;
  note?: string;
}

export interface SwingState {
  equity: number;
  dailyLossHit: boolean;
  consecutiveLosses: number;
  circuitBreaker: boolean;
  dayKey: string;
  signalsToday: number;
  openPositions: SwingOpenPosition[];
  lastTradeDays: Map<string, number>; // d1 index of last closed trade per symbol (cooldown)
}

export interface SwingOpenPosition {
  id: number;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  lots: number;
  riskAmount: number;
  openedAtDay: number; // D1 series index of entry day
  openedDot: number; // D1 date key yyyy-mm-dd
  phase: "tp1" | "be";
  realizedSurplus: number; // locked R profit after tp1 half-close (unused for pnl math here)
  halfClosed: boolean;
}

export interface SwingContextInput {
  d1: Candle[];
  h4: Candle[];
  inst: InstrumentConfig;
  price?: number;
}

type SwingPoint = { index: number; price: number };

/** finds swing highs/lows on an H4 close array using a +/-k bar confirmation window */
function findSwings(
  high: number[],
  low: number[],
  k: number,
  end: number,
  lookback: number
): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const from = Math.max(0, end - lookback);
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  for (let i = from + k; i <= end - k; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (high[j] >= high[i]) isHigh = false;
      if (low[j] <= low[i]) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: high[i] });
    if (isLow) lows.push({ index: i, price: low[i] });
  }
  return { highs, lows };
}

export function swingRegime(d1: Candle[], cfg: SwingConfig): "bull" | "bear" | "flat" {
  if (d1.length < cfg.trend.ema200Period + cfg.trend.ema200SlopeBars + 5) return "flat";
  const c = toSeries(d1);
  const e = ema(c.close, cfg.trend.ema200Period);
  const last = d1.length - 1;
  const slopeBars = cfg.trend.ema200SlopeBars;
  const ema200now = e[last];
  const ema200prev = e[last - slopeBars];
  const slopePct = (ema200now - ema200prev) / (Math.abs(ema200prev) || 1);
  const pxNow = c.close[last];
  if (Math.abs(slopePct) < cfg.trend.ema200SlopeFlatPct) return "flat";
  if (pxNow >= ema200now && slopePct > 0) return "bull";
  if (pxNow < ema200now && slopePct < 0) return "bear";
  return "flat";
}

/**
 * Swing pullback setup on D1 trend + H4 structure.
 * Evaluated at H4 bar close (index = last fully-formed H4 bar).
 */
export function analyzeSwing(
  ctx: SwingContextInput,
  cfg: SwingConfig
): {
  regime: "bull" | "bear" | "flat";
  signal: SwingSignal | null;
  rejected: string[];
} {
  const { d1, h4, inst } = ctx;
  const rejected: string[] = [];
  const regime = swingRegime(d1, cfg);
  if (regime === "flat") {
    rejected.push("regime flat");
    return { regime, signal: null, rejected };
  }
  if (inst.typicalSpreadPips > cfg.risk.maxSpreadPips) {
    rejected.push("spread");
    return { regime, signal: null, rejected };
  }
  if (h4.length < cfg.setup.swingLookbackBars + 40) {
    rejected.push("short h4 history");
    return { regime, signal: null, rejected };
  }

  const S = toSeries(h4);
  const last = h4.length - 1;
  const atr4 = atr(S, 14);
  const atrNow = atr4[last];
  if (!isFinite(atrNow) || atrNow <= 0) {
    rejected.push("no atr");
    return { regime, signal: null, rejected };
  }
  const adxH4 = adx(S, cfg.trend.adxPeriod).adx[last];
  if (!isFinite(adxH4) || adxH4 < cfg.trend.adxThreshold) {
    rejected.push("adx");
    return { regime, signal: null, rejected };
  }

  const k = 3;
  const { highs, lows } = findSwings(
    S.high,
    S.low,
    k,
    last,
    cfg.setup.swingLookbackBars
  );
  const rsiH4 = rsi(S.close, 14)[last];
  const emaTrig = ema(S.close, cfg.setup.triggerEmaPeriod)[last];

  const long = regime === "bull";
  const sig = long
    ? buildPullback(S, highs, lows, last, atrNow, rsiH4, emaTrig, "long", cfg)
    : buildPullback(S, highs, lows, last, atrNow, rsiH4, emaTrig, "short", cfg);
  if (!sig) {
    rejected.push("no trigger");
    return { regime, signal: null, rejected };
  }
  return {
    regime,
    signal: sig,
    rejected,
  };
}

function buildPullback(
  S: ReturnType<typeof toSeries>,
  highs: SwingPoint[],
  lows: SwingPoint[],
  last: number,
  atrNow: number,
  rsiNow: number,
  emaTrig: number,
  dir: "long" | "short",
  cfg: SwingConfig
): SwingSignal | null {
  const L = cfg.setup.swingLookbackBars;
  // relevant swing points (fully confirmed, before the last bar and not using current forming bar)
  const hs = highs.filter((h) => h.index <= last - 3);
  const ls = lows.filter((l) => l.index <= last - 3);

  let swingHi: SwingPoint | undefined;
  let swingLo: SwingPoint | undefined;
  if (dir === "long") {
    swingHi = hs.length ? hs[hs.length - 1] : undefined;
    const lowsBeforeHi = ls.filter((l) => l.index <= (swingHi?.index ?? last));
    swingLo = lowsBeforeHi.length ? lowsBeforeHi[lowsBeforeHi.length - 1] : undefined;
  } else {
    swingLo = ls.length ? ls[ls.length - 1] : undefined;
    const highsBeforeLo = hs.filter((h) => h.index <= (swingLo?.index ?? last));
    swingHi = highsBeforeLo.length ? highsBeforeLo[highsBeforeLo.length - 1] : undefined;
  }
  if (!swingHi || !swingLo) return null;

  const leg = Math.abs(swingHi.price - swingLo.price);
  if (leg < cfg.setup.legMinAtr * atrNow) return null;

  const currentPrice = S.close[last];
  const long = dir === "long";
  const retrace = long
    ? (swingHi.price - currentPrice) / leg
    : (currentPrice - swingLo.price) / leg;
  if (retrace < cfg.setup.pullbackMinRetrace || retrace > cfg.setup.pullbackMaxRetrace) return null;

  const barsSinceSwingHi = last - (long ? swingHi.index : swingLo.index);
  if (barsSinceSwingHi > cfg.setup.pullbackBarCount) return null;

  // RSI reset check + crash filter
  if (long && rsiNow > cfg.setup.rsiResetHigh) return null;
  if (!long && rsiNow < 100 - cfg.setup.rsiResetHigh) return null;
  if (long && rsiNow < cfg.setup.rsiCrashLow) return null;
  if (!long && rsiNow > 100 - cfg.setup.rsiCrashLow) return null;

  // trigger: last H4 bar reclaimed the trigger EMA and closed in direction
  const bar = S.close[last];
  const gbPct = bar > emaTrig ? (bar - emaTrig) / emaTrig : 0;
  const triggerBar = S.close[last] > S.open[last];
  if (long && !(triggerBar && gbPct > cfg.setup.triggerGbEmaPct)) return null;
  if (!long && !(!triggerBar && -gbPct > cfg.setup.triggerGbEmaPct)) return null;

  // SL from the retrace extreme +/- ATR buffer, capped
  const mag = Math.min(cfg.setup.slBufferAtr, cfg.setup.slMaxAtr * 0.5);
  const sl = long ? swingLo.price - mag * atrNow : swingHi.price + mag * atrNow;
  const slWidth = Math.abs(currentPrice - sl);
  if (slWidth <= 0 || slWidth > cfg.setup.slMaxAtr * atrNow) return null;

  // structural TP1: nearest swing on the far side of the leg (resistance for longs),
  // falling back to a 1.8-4R band when no clean far-side level exists.
  const priorBar = long
    ? highest(S.high, cfg.setup.swingLookbackBars, (swingLo?.index ?? last) - 1)
    : lowest(S.low, cfg.setup.swingLookbackBars, (swingHi?.index ?? last) - 1);
  let tp1Now: number;
  const rMin = cfg.setup.tp1MinR;
  const rMax = cfg.setup.tp1MaxR;
  if (long) {
    const rPrior = (priorBar - currentPrice) / slWidth;
    tp1Now = rPrior >= rMin && rPrior <= rMax
      ? priorBar
      : currentPrice + Math.max(rMin, Math.min(2.5, rMax)) * slWidth;
  } else {
    const rPrior = (currentPrice - priorBar) / slWidth;
    tp1Now = rPrior >= rMin && rPrior <= rMax
      ? priorBar
      : currentPrice - Math.max(rMin, Math.min(2.5, rMax)) * slWidth;
  }
  const gap = Math.abs(tp1Now - currentPrice);
  const tp1 = long ? currentPrice + gap : currentPrice - gap;
  const tp2 = long ? tp1 + cfg.setup.tp2RMult * gap : tp1 - cfg.setup.tp2RMult * gap;

  return {
    symbol: "",
    direction: dir,
    strategy: "pullback",
    entry: currentPrice,
    sl,
    tp1,
    tp2,
    lots: 0,
    riskAmount: 0,
    note:
      `swing pullback ${dir} | retrace ${(100 * retrace).toFixed(0)}% | ` +
      `regime EMA200 ${long ? "up" : "down"} | H4 RSI ${rsiNow.toFixed(0)} | trigger reclaim | ` +
      `SL width ${(slWidth / atrNow).toFixed(1)} ATR | TP1 ${(absDiff(tp1, currentPrice) / slWidth).toFixed(1)}R`,
  };
}

function absDiff(a: number, b: number): number {
  return Math.abs(a - b);
}

/** risk-based lot sizing: lots such that risk = equity x pct at the given stop width */
export function swingLots(
  inst: InstrumentConfig,
  equity: number,
  entry: number,
  sl: number,
  riskPerTradePct: number
): { lots: number; riskAmount: number } {
  const riskAmount = equity * riskPerTradePct;
  const width = Math.abs(entry - sl);
  // USD value per 1.0 price move per 1 lot: majors $100k, gold $100 (100oz x $1/0.1), index $1/contract
  const perty = inst.type === "gold" ? 100 : inst.type === "index" ? 1 : 100000;
  const lots = width > 0 && perty > 0 ? riskAmount / (width * perty) : 0;
  return { lots, riskAmount };
}