import type { Candle } from "./oanda";
import { DEFAULT_CONFIG, PIP_SIZE, type StrategyConfig, type NewsEvent } from "./config";
import {
  analyzePair,
  initialState,
  sessionAt,
  type EngineState,
  type PairData,
  type Signal,
} from "./engine";

export interface BacktestTrade {
  signal: Signal;
  entryTime: string;
  exitTime: string;
  exitPrice: number;
  resultR: number; // in R multiples
  resultPips: number;
  outcome: "tp2" | "tp1" | "sl" | "open" | "timeout";
}

export interface BacktestResult {
  symbol: string;
  trades: BacktestTrade[];
  summary: {
    totalTrades: number;
    winners: number;
    losers: number;
    winRate: number;
    avgR: number;
    totalR: number;
    maxDrawdownPct: number;
  };
  equityCurve: number[];
}

function candlesUpTo(candles: Candle[], untilMs: number): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    if (parseFloat(c.time) <= untilMs) out.push(c);
  }
  return out;
}

export function runBacktest(
  symbol: string,
  h1All: Candle[],
  m15All: Candle[],
  m5All: Candle[],
  cfg: StrategyConfig = DEFAULT_CONFIG,
  startMs: number,
  endMs: number,
  initialEquity = 10000
): BacktestResult {
  // step through each closed M15 bar whose time is in [startMs, endMs]
  const bars = m15All.filter((c) => {
    const t = parseFloat(c.time);
    return t >= startMs && t <= endMs && c.complete;
  });

  // warmup skip: need enough prior bars for EMA200 H1 etc.
  const h1AllNum = h1All.map((c) => parseFloat(c.time));
  const m15AllNum = m15All.map((c) => parseFloat(c.time));
  const m5AllNum = m5All.map((c) => parseFloat(c.time));

  const trades: BacktestTrade[] = [];
  const regimeLog: { time: string; reason: string }[] = [];
  let equity = initialEquity;
  const curve: number[] = [initialEquity];
  const state: EngineState = initialState(initialEquity);

  for (let i = 0; i < bars.length; i++) {
    const barTimeMs = parseFloat(bars[i].time);

    // roll equity / close trades on M5 bars later; for simplicity close on M15 bar closes
    // First close any open trade using this M15 bar
    for (const pos of [...state.openPositions]) {
      const bar = bars[i];
      const long = pos.direction === "long";
      const hitTp = long ? bar.high >= pos.tp2 : bar.low <= pos.tp2; // tp2 first (best-case fill)
      const hitSl = long ? bar.low <= pos.sl : bar.high >= pos.sl;
      const hitTp1 = long ? bar.high >= pos.tp1 : bar.low <= pos.tp1;
      let exitPrice = bar.close;
      let outcome: BacktestTrade["outcome"] = "timeout";
      if (hitTp) {
        exitPrice = pos.tp2;
        outcome = "tp2";
      } else if (hitSl) {
        exitPrice = pos.sl;
        outcome = "sl";
      } else if (hitTp1) {
        exitPrice = pos.tp1;
        outcome = "tp1";
      }
      const r = long ? (exitPrice - pos.entry) / (pos.entry - pos.sl) : (pos.entry - exitPrice) / (pos.sl - pos.entry);
      const pip = PIP_SIZE[symbol.replace("/", "_")] ?? 0.0001;
      const pips = long ? (exitPrice - pos.entry) / pip : (pos.entry - exitPrice) / pip;
      equity += r * equity * cfg.risk.riskPerTradePct; // simplified equity update
      curve.push(equity);
      // circuit breaker / consecutive losses
      if (outcome === "sl") {
        state.consecutiveLosses += 1;
        if (state.consecutiveLosses >= cfg.risk.maxConsecutiveLosses) {
          state.circuitBreaker = true;
          regimeLog.push({ time: new Date(barTimeMs).toISOString(), reason: "circuit breaker (2 consecutive SL)" });
        }
        if (equity < initialEquity * (1 - cfg.risk.dailyLossLimitPct)) state.dailyLossHit = true;
      } else {
        state.consecutiveLosses = 0;
      }
      trades.push({
        signal: {
          ...pos as unknown as Signal,
          slPips: 0,
          slAtr: 0,
          tp1: pos.tp1,
          tp2: pos.tp2,
          confidenceNotes: "",
          generatedAt: pos.openedAt,
        },
        entryTime: pos.openedAt,
        exitTime: new Date(barTimeMs).toISOString(),
        exitPrice,
        resultR: r,
        resultPips: pips,
        outcome,
      });
    }
    state.openPositions = [];

    const t = barTimeMs;
    const idxH1 = indexOfLastAtOrBefore(h1AllNum, t);
    const idxM15 = indexOfLastAtOrBefore(m15AllNum, t);
    const idxM5 = indexOfLastAtOrBefore(m5AllNum, t);
    if (idxH1 < cfg.trend.ema200Period + 5 || idxM15 < 60 || idxM5 < 40) continue;

    const h1 = h1All.slice(0, idxH1 + 1);
    const m15 = m15All.slice(0, idxM15 + 1);
    const m5 = m5All.slice(0, idxM5 + 1);
    const price = m15[m15.length - 1].close;

    const sess = sessionAt(new Date(t));
    if (!sess.canTrade) continue;

    const data: PairData = {
      h1,
      m15,
      m5,
      price,
      spreadPips: 1,
      rates: {},
    };

    const ctx = analyzePair(
      { symbol, oandaInstrument: symbol.replace("/", "_"), display: symbol, type: symbol === "XAU/USD" ? "gold" : "major", typicalSpreadPips: 1, enabled: true },
      data,
      cfg,
      new Date(t),
      state,
      [] as NewsEvent[]
    );

    if (ctx.signal) {
      const sig = ctx.signal;
      const openedAt = new Date(t).toISOString();
      state.openPositions.push({
        symbol: sig.symbol,
        direction: sig.direction,
        entry: sig.entry,
        sl: sig.sl,
        tp1: sig.tp1,
        tp2: sig.tp2,
        lots: sig.lots,
        openedAt,
      });
      state.signalsCount += 1;
    }
  }

  // any leftover open position marked open
  for (const pos of state.openPositions) {
    trades.push({
      signal: { ...(pos as unknown as Signal), slPips: 0, slAtr: 0, tp1: pos.tp1, tp2: pos.tp2, confidenceNotes: "", generatedAt: pos.openedAt } as Signal,
      entryTime: pos.openedAt,
      exitTime: new Date(endMs).toISOString(),
      exitPrice: m15All[m15All.length - 1]?.close ?? pos.entry,
      resultR: 0,
      resultPips: 0,
      outcome: "open",
    });
  }

  const closed = trades.filter((t) => t.outcome !== "open");
  const winners = closed.filter((t) => t.resultR > 0).length;
  const losers = closed.filter((t) => t.resultR < 0).length;
  const avgR = closed.length ? closed.reduce((a, t) => a + t.resultR, 0) / closed.length : 0;
  const totalR = closed.reduce((a, t) => a + t.resultR, 0);
  let peak = initialEquity;
  let maxDD = 0;
  for (const e of curve) {
    if (e > peak) peak = e;
    const dd = peak > 0 ? (peak - e) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    symbol,
    trades,
    summary: {
      totalTrades: closed.length,
      winners,
      losers,
      winRate: closed.length ? winners / closed.length : 0,
      avgR,
      totalR,
      maxDrawdownPct: maxDD,
    },
    equityCurve: curve,
  };
}

function indexOfLastAtOrBefore(sortedTimes: number[], t: number): number {
  let lo = 0;
  let hi = sortedTimes.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTimes[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}