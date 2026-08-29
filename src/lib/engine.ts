import type { Candle } from "./oanda";
import {
  PIP_SIZE,
  WATCHLIST,
  DEFAULT_CONFIG,
  type InstrumentConfig,
  type StrategyConfig,
  type NewsEvent,
} from "./config";
import {
  toSeries,
  ema,
  rsi,
  atr,
  adx,
  highest,
  lowest,
  type Series,
} from "./indicators";

export type Direction = "long" | "short";
export type StrategyKind = "continuation" | "breakout" | "bounce" | "reversal";
export type SessionLabel = "London" | "NY" | "Overlap" | "Closed";
export type RegimeKind = "trending" | "ranging";

export interface OpenPosition {
  symbol: string;
  direction: Direction;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  lots: number;
  openedAt: string;
  note?: string;
}

export interface LogEntry {
  time: string;
  symbol: string;
  kind: "signal" | "rejection";
  strategy?: StrategyKind;
  reason: string;
}

export interface EngineState {
  equity: number;
  signalsCount: number;
  consecutiveLosses: number;
  circuitBreaker: boolean;
  circuitBreakerDay: string | null;
  dailyLossHit: boolean;
  dayKey: string;
  openPositions: OpenPosition[];
  logs: LogEntry[];
}

export function dayKeyNow(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function initialState(equity = 10000): EngineState {
  return {
    equity,
    signalsCount: 0,
    consecutiveLosses: 0,
    circuitBreaker: false,
    circuitBreakerDay: null,
    dailyLossHit: false,
    dayKey: dayKeyNow(),
    openPositions: [],
    logs: [],
  };
}

export interface Signal {
  symbol: string;
  direction: Direction;
  strategy: StrategyKind;
  entry: number;
  sl: number;
  slPips: number;
  slAtr: number;
  tp1: number;
  tp2: number;
  tp1R: number;
  tp2R: number;
  session: Exclude<SessionLabel, "Closed">;
  regime: { kind: RegimeKind; adx: number };
  spreadPips: number;
  atr: number;
  lots: number;
  riskAmount: number;
  confidenceNotes: string;
  generatedAt: string;
}

export interface PairContext {
  symbol: string;
  display: string;
  type: InstrumentConfig["type"];
  price: number;
  pipSize: number;
  spreadPips: number;
  spreadOk: boolean;
  h1Ema200: number;
  h1Ema200SlopeFlat: boolean;
  chopZone: boolean;
  h1Adx: number;
  regime: RegimeKind;
  longBias: boolean;
  m15Ema50: number;
  m15Rsi: number;
  m5Rsi: number;
  m5Atr: number;
  m15Atr: number;
  m5Ema21: number;
  session: SessionLabel;
  canTradeSession: boolean;
  newsBlackout: boolean;
  signal: Signal | null;
  rejected: string[];
}

export interface RateMap {
  [oandaInstrument: string]: number; // current midpoint price used for conversion
}

const QUOTE_CURRENCY: Record<string, string> = {
  EUR_USD: "USD",
  GBP_USD: "USD",
  AUD_USD: "USD",
  NZD_USD: "USD",
  USD_JPY: "JPY",
  USD_CHF: "CHF",
  USD_CAD: "CAD",
  EUR_JPY: "JPY",
  GBP_JPY: "JPY",
  EUR_GBP: "GBP",
  XAU_USD: "USD",
  NAS100_USD: "USD",
  SPX500_USD: "USD",
  US30_USD: "USD",
};

const CURRENCIES: Record<string, string[]> = {
  EUR_USD: ["EUR", "USD"],
  GBP_USD: ["GBP", "USD"],
  AUD_USD: ["AUD", "USD"],
  NZD_USD: ["NZD", "USD"],
  USD_JPY: ["USD", "JPY"],
  USD_CHF: ["USD", "CHF"],
  USD_CAD: ["USD", "CAD"],
  EUR_JPY: ["EUR", "JPY"],
  GBP_JPY: ["GBP", "JPY"],
  EUR_GBP: ["EUR", "GBP"],
  XAU_USD: ["USD"],
  NAS100_USD: ["USD"], // index CFDs: USD-settled; news blackouts keyed on USD apply
  SPX500_USD: ["USD"],
  US30_USD: ["USD"],
};

export function pipValuePerLot(inst: InstrumentConfig, rate: RateMap): number {
  const quote = QUOTE_CURRENCY[inst.oandaInstrument];
  const pip = PIP_SIZE[inst.oandaInstrument] ?? 0.0001;
  const notionalMove = pip * 100000;
  if (inst.type === "gold") {
    // XAU/USD: 1 lot = 100 oz; pip (0.1) move => 0.1 * 100 = $10
    return (pip / 0.1) * 10;
  }
  if (inst.type === "index") {
    // Index CFDs: 1 contract = 1 index point at $1/pt (OANDA). PIP_SIZE = 1 point on all three.
    return (pip / 1.0) * 1; // => $1 per 1 index point per contract lot
  }
  switch (quote) {
    case "USD":
      return 10 * (pip / 0.0001);
    case "JPY": {
      const usdJpy = rate["USD_JPY"];
      return usdJpy ? notionalMove / usdJpy : NaN;
    }
    case "CHF": {
      const usdChf = rate["USD_CHF"];
      return usdChf ? notionalMove / usdChf : NaN;
    }
    case "CAD": {
      const usdCad = rate["USD_CAD"];
      return usdCad ? notionalMove / usdCad : NaN;
    }
    case "GBP": {
      const gbpUsd = rate["GBP_USD"];
      return gbpUsd ? notionalMove / gbpUsd : NaN;
    }
    default:
      return 10 * (pip / 0.0001);
  }
}

function currencyImpacts(symbol: string, direction: Direction): Record<string, number> {
  const s = direction === "long" ? 1 : -1;
  switch (symbol) {
    case "EUR/USD":
      return { EUR: s, USD: -s };
    case "GBP/USD":
      return { GBP: s, USD: -s };
    case "AUD/USD":
      return { AUD: s, USD: -s };
    case "NZD/USD":
      return { NZD: s, USD: -s };
    case "USD/JPY":
      return { USD: s, JPY: -s };
    case "USD/CHF":
      return { USD: s, CHF: -s };
    case "USD/CAD":
      return { USD: s, CAD: -s };
    case "EUR/JPY":
      return { EUR: s, JPY: -s };
    case "GBP/JPY":
      return { GBP: s, JPY: -s };
    case "EUR/GBP":
      return { EUR: s, GBP: -s };
    case "XAU/USD":
      return { USD: -s, XAU: s };
    default:
      return {};
  }
}

export interface SessionInfo {
  label: SessionLabel;
  canTrade: boolean;
}

export function sessionAt(date: Date): SessionInfo {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return { label: "Closed", canTrade: false };
  const mins = date.getUTCHours() * 60 + date.getUTCMinutes();
  // London 07:00-16:00 GMT, NY 12:00-21:00 GMT, overlap 12:00-16:00
  if (mins >= 12 * 60 && mins < 16 * 60) return { label: "Overlap", canTrade: true };
  if (mins >= 7 * 60 && mins < 12 * 60) return { label: "London", canTrade: true };
  if (mins >= 16 * 60 && mins < 20 * 60 + 30) return { label: "NY", canTrade: true };
  if (mins >= 20 * 60 + 30 && mins < 21 * 60)
    return { label: "NY", canTrade: false }; // last 30 min, no new entries
  return { label: "Closed", canTrade: false };
}

/** Day-trading rule: no overnight holds — true once the NY close cutoff is reached. */
export function eodCloseDue(now: Date, cfg: StrategyConfig): boolean {
  if (!cfg.risk.closeAtSessionEnd) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return mins >= cfg.risk.sessionCloseMinutes;
}

function reversalTradesToday(state: EngineState, now: Date): number {
  const dk = dayKeyNow(now);
  let n = 0;
  let i = 0;
  for (const l of state.logs) {
    if (i++ > 128) break; // logs are newest-first; only the current window matters
    if (l.kind === "signal" && l.strategy === "reversal" && l.time.slice(0, 10) === dk) n++;
  }
  return n;
}

export function newsBlackout(
  now: Date,
  newsEvents: NewsEvent[],
  inst: InstrumentConfig,
  cfg: StrategyConfig
): boolean {
  const involved = CURRENCIES[inst.oandaInstrument] ?? [];
  const nowMs = now.getTime();
  for (const ev of newsEvents) {
    const isFomc = /fomc/i.test(ev.label);
    const buffer =
      (isFomc ? 30 : cfg.risk.newsBlackoutBeforeMin) * 60000; // FOMC widened to 30 min
    const winStart = ev.start - cfg.risk.newsBlackoutBeforeMin * 60000;
    const winEnd = ev.end + (isFomc ? 30 : cfg.risk.newsBlackoutAfterMin) * 60000;
    if (nowMs >= winStart && nowMs <= winEnd) {
      const relevant = ev.currencies.length === 0 || ev.currencies.some((c) => involved.includes(c));
      if (relevant) return true;
    }
    void buffer;
  }
  return false;
}

function checkPositionLimits(
  state: EngineState,
  symbol: string,
  direction: Direction,
  cfg: StrategyConfig
): { ok: boolean; reason: string } {
  if (state.openPositions.some((p) => p.symbol === symbol)) {
    return { ok: false, reason: "already holding this pair (1 max per pair)" };
  }
  const cand: OpenPosition[] = [
    ...state.openPositions,
    { symbol, direction, entry: 0, sl: 0, tp1: 0, tp2: 0, lots: 0, openedAt: "" },
  ];
  if (cand.length > cfg.risk.maxPositions) {
    return { ok: false, reason: `max concurrent positions (${cfg.risk.maxPositions}) reached` };
  }
  const totals: Record<string, number> = {};
  for (const p of cand) {
    const imp = currencyImpacts(p.symbol, p.direction);
    for (const [c, v] of Object.entries(imp)) totals[c] = (totals[c] ?? 0) + v;
  }
  const doubled = Object.entries(totals).filter(([, v]) => Math.abs(v) >= 2);
  if (doubled.length > 0) {
    const goldCount = cand.filter((p) => p.symbol === "XAU/USD").length;
    const nonGoldUsdLinked = cand.filter(
      (p) => p.symbol !== "XAU/USD" && (currencyImpacts(p.symbol, p.direction)["USD"] ?? 0) !== 0
    ).length;
    const onlyUsdDoubled = doubled.every(([c]) => c === "USD" || c === "XAU");
    if (goldCount === 1 && nonGoldUsdLinked === 1 && onlyUsdDoubled) {
      // gold + one aligned USD-major counts as a single correlated bet — allowed
      return { ok: true, reason: "" };
    }
    return {
      ok: false,
      reason: `doubled correlated exposure (${doubled.map(([c, v]) => `${c}=${v}`).join(", ")}) — same bet twice`,
    };
  }
  return { ok: true, reason: "" };
}

interface CandleLike {
  open: number;
  high: number;
  low: number;
  close: number;
}

function isPin(c: CandleLike, dir: Direction): boolean {
  const body = Math.abs(c.close - c.open);
  const rng = c.high - c.low;
  if (rng === 0) return false;
  if (body / rng > 0.35) return false;
  if (dir === "long") {
    const lower = Math.min(c.open, c.close) - c.low;
    const upper = c.high - Math.max(c.open, c.close);
    return lower >= 2 * body && upper <= lower;
  }
  const upper = c.high - Math.max(c.open, c.close);
  const lower = Math.min(c.open, c.close) - c.low;
  return upper >= 2 * body && lower <= upper;
}

function isEngulf(prev: CandleLike, cur: CandleLike, dir: Direction): boolean {
  if (dir === "long") {
    return (
      cur.close > cur.open &&
      prev.close < prev.open &&
      cur.close >= prev.open &&
      cur.open <= prev.close &&
      cur.close - cur.open > prev.close - prev.open
    );
  }
  return (
    cur.close < cur.open &&
    prev.close > prev.open &&
    cur.close <= prev.open &&
    cur.open >= prev.close &&
    cur.open - cur.close > prev.open - prev.close
  );
}

function rsiTurnedBack(r: number[], from: number, to: number, dir: Direction, lo: number, hi: number): boolean {
  const window = Math.min(8, to - from);
  for (let k = to - window; k < to; k++) {
    if (dir === "long" && r[k] <= lo && r[to] > r[to - 1] && r[to] > lo) return true;
    if (dir === "short" && r[k] >= hi && r[to] < r[to - 1] && r[to] < hi) return true;
  }
  return false;
}

function crossed(closes: number[], line: number[], i: number, dir: Direction): boolean {
  const lo = Math.max(1, i - 2);
  for (let k = lo; k <= i; k++) {
    if (dir === "long" && closes[k] > line[k] && closes[k - 1] <= line[k - 1]) return true;
    if (dir === "short" && closes[k] < line[k] && closes[k - 1] >= line[k - 1]) return true;
  }
  return false;
}

interface SwingLevels {
  supports: number[]; // cluster of pivot lows with count >= 2
  resistances: number[]; // cluster of pivot highs with count >= 2
}

function swingLevels(series: Series, opt: { lookback: number; tolerancePct: number; maxBars: number }): SwingLevels {
  const { lookback, tolerancePct, maxBars } = opt;
  const n = series.close.length;
  const from = Math.max(lookback * 2, n - maxBars);
  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];
  for (let i = from; i < n - lookback; i++) {
    let isH = true;
    let isL = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (series.high[j] >= series.high[i]) isH = false;
      if (series.low[j] <= series.low[i]) isL = false;
    }
    const ref = series.close[i] || 1;
    const tol = ref * tolerancePct;
    if (isH) {
      // cluster near existing pivot highs within tolerance
      const idx = pivotHighs.findIndex((p) => Math.abs(p - series.high[i]) <= tol);
      if (idx >= 0) pivotHighs[idx] = (pivotHighs[idx] + series.high[i]) / 2;
      else pivotHighs.push(series.high[i]);
    }
    if (isL) {
      const idx = pivotLows.findIndex((p) => Math.abs(p - series.low[i]) <= tol);
      if (idx >= 0) pivotLows[idx] = (pivotLows[idx] + series.low[i]) / 2;
      else pivotLows.push(series.low[i]);
    }
  }
  return { supports: pivotLows, resistances: pivotHighs };
}

function clusterTouchCount(levels: number[], price: number, tolerance: number): number {
  return levels.filter((l) => Math.abs(l - price) <= tolerance).length;
}

interface StructuralPlan {
  sl?: number; // structural stop (absolute)
  slNote?: string;
  tp1?: number; // structural target 1 (absolute)
  tp2?: number; // structural target 2 (absolute)
}

interface Pivot {
  price: number;
  at: number; // bar index
  kind: "low" | "high";
}

function pivotMines(series: Series, from: number, lookback: number): Pivot[] {
  const out: Pivot[] = [];
  for (let i = from; i < series.low.length - lookback; i++) {
    let isLow = true;
    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (series.low[j] <= series.low[i]) isLow = false;
      if (series.high[j] >= series.high[i]) isHigh = false;
    }
    if (isLow) out.push({ price: series.low[i], at: i, kind: "low" });
    if (isHigh) out.push({ price: series.high[i], at: i, kind: "high" });
  }
  return out;
}

// touch count = how many separate pivot bars landed within `tol` of a price
function pivotTouchCount(pivs: Pivot[], kind: "low" | "high", price: number, tol: number): number {
  let n = 0;
  for (const p of pivs) if (p.kind === kind && Math.abs(p.price - price) <= tol) n++;
  return n;
}

function structurePlan(
  series: Series,
  m15atr: number,
  last: number,
  entry: number,
  dir: Direction,
  pip: number,
  opts: { lookback: number; maxBars: number; bufferAtr: number; slCapAtr: number }
): StructuralPlan {
  const n = series.low.length;
  const from = Math.max(opts.lookback, n - opts.maxBars);
  const pivs = pivotMines(series, from, opts.lookback);
  const lows = pivs.filter((p) => p.kind === "low").map((p) => p.price).sort((a, b) => a - b);
  const highs = pivs.filter((p) => p.kind === "high").map((p) => p.price).sort((a, b) => a - b);
  const bandTol = Math.max(0.6 * m15atr, pip * 4); // pivots within this of each other = same level
  const buf = opts.bufferAtr * m15atr;
  const atrStop = opts.slCapAtr * m15atr;

  // confirmed supports: touch points below entry visited by >= 2 pivot lows
  const supports = lows.filter((s) => s < entry && pivotTouchCount(pivs, "low", s, bandTol) >= 2);
  const resistances = highs.filter((r) => r > entry && pivotTouchCount(pivs, "high", r, bandTol) >= 2);

  let sl: number | undefined;
  let slNote: string | undefined;
  if (dir === "long") {
    const cand = [...supports].sort((a, b) => b - a).find((s) => entry - s >= buf && entry - s <= Math.max(atrStop, buf * 2));
    if (cand !== undefined) {
      sl = cand - buf;
      slNote = `SL under support ${cand.toFixed(5)} (${pivotTouchCount(pivs, "low", cand, bandTol)} pivots, ${(buf / Math.max(m15atr, 1e-9)).toFixed(1)} ATR buffer)`;
    }
  } else {
    const cand = [...resistances].sort((a, b) => a - b).find((r) => r - entry >= buf && r - entry <= Math.max(atrStop, buf * 2));
    if (cand !== undefined) {
      sl = cand + buf;
      slNote = `SL above resistance ${cand.toFixed(5)} (${pivotTouchCount(pivs, "high", cand, bandTol)} pivots, ${(buf / Math.max(m15atr, 1e-9)).toFixed(1)} ATR buffer)`;
    }
  }

  // structural targets: swing levels in the trade direction (touched by >= 1 pivot enough for a magnet)
  let tp1: number | undefined;
  let tp2: number | undefined;
  const lon = dir === "long";
  const advSide = lon ? highs.filter((r) => r - entry >= buf) : lows.filter((s) => entry - s >= buf);
  // collapse near-duplicates so tp1/tp2 are distinct shelves
  const shelves: number[] = [];
  for (const p of advSide) {
    const touched = pivotTouchCount(lon ? pivs : pivs, lon ? "high" : "low", p, bandTol);
    const dup = shelves.some((q) => Math.abs(q - p) <= bandTol);
    if (!dup && touched >= 1 && (lon ? p > entry : p < entry)) shelves.push(p);
  }
  shelves.sort((a, b) => (lon ? a - b : b - a));
  tp1 = shelves[0];
  tp2 = shelves[1];
  return { sl, slNote, tp1, tp2 };
}

function invalidStructureForLong(series: Series, atrArr: number[], end: number): number | null {
  const from = Math.max(0, end - 11);
  let minLow = Infinity;
  for (let i = from; i <= end; i++) if (series.low[i] < minLow) minLow = series.low[i];
  const a = atrArr[end] || 0;
  return minLow === Infinity ? null : minLow - 0.5 * a;
}

function invalidStructureForShort(series: Series, atrArr: number[], end: number): number | null {
  const from = Math.max(0, end - 11);
  let maxHigh = -Infinity;
  for (let i = from; i <= end; i++) if (series.high[i] > maxHigh) maxHigh = series.high[i];
  const a = atrArr[end] || 0;
  return maxHigh === Infinity ? null : maxHigh + 0.5 * a;
}

function computeSize(
  inst: InstrumentConfig,
  entry: number,
  sl: number,
  equity: number,
  cfg: StrategyConfig,
  rates: RateMap
): { lots: number; riskAmount: number } {
  const pip = PIP_SIZE[inst.oandaInstrument] ?? 0.0001;
  const stopPips = Math.abs(entry - sl) / pip;
  if (!stopPips || !isFinite(stopPips)) return { lots: 0, riskAmount: 0 };
  const riskAmount = equity * cfg.risk.riskPerTradePct;
  const pv = pipValuePerLot(inst, rates);
  if (!isFinite(pv) || pv <= 0) return { lots: 0, riskAmount };
  let lots = riskAmount / (stopPips * pv);
  // Broker-realistic sizing: round DOWN to step so risk never exceeds the 1% cap,
  // then enforce a per-market minimum lot (floor) for small accounts.
  const step = inst.type === "index" ? 1 : cfg.risk.minLots ?? 0.01;
  const floor = inst.type === "index" ? 1 : cfg.risk.minLots ?? 0.01;
  lots = Math.floor(lots / step) * step;
  if (lots < floor) lots = floor;
  return { lots, riskAmount };
}

export interface PairData {
  h1: Candle[];
  m15: Candle[];
  m5: Candle[];
  price: number;
  spreadPips: number;
  rates: RateMap;
}

export function analyzePair(
  inst: InstrumentConfig,
  data: PairData,
  cfg: StrategyConfig,
  now: Date,
  state: EngineState,
  newsEvents: NewsEvent[]
): PairContext {
  const sym = inst.oandaInstrument;
  const pip = PIP_SIZE[sym] ?? 0.0001;
  const rejected: string[] = [];
  const push = (gate: string, msg: string) => rejected.push(`[${gate}] ${msg}`);

  const h1 = toSeries(data.h1);
  const m15 = toSeries(data.m15);
  const m5 = toSeries(data.m5);

  const h1Ema200 = ema(h1.close, cfg.trend.ema200Period);
  const h1AdxArr = adx(h1, cfg.trend.adxPeriod).adx;
  const m15Ema50 = ema(m15.close, cfg.setup.ema50Period);
  const m15AtrArr = atr(m15, cfg.risk.atrPeriod);
  const m15RsiArr = rsi(m15.close, cfg.setup.rsiPeriod);
  const m5Ema21 = ema(m5.close, cfg.setup.ema21Period);
  const m5AtrArr = atr(m5, cfg.risk.atrPeriod);
  const m5RsiArr = rsi(m5.close, cfg.setup.rsiPeriod);

  const lastM15 = m15.close.length - 1;
  const lastM5 = m5.close.length - 1;
  const lastH1 = h1.close.length - 1;

  const price = data.price;
  const session: SessionInfo = sessionAt(now);
  const spreadPips = data.spreadPips;
  const sessionLabel = session.label;

  const h1Close = h1.close[lastH1];
  const emaNow = h1Ema200[lastH1];
  const decayOK =
    isFinite(h1Close) &&
    isFinite(emaNow) &&
    data.h1.length > cfg.trend.ema200Period + cfg.trend.ema200SlopeBars;
  const chopPct = decayOK ? Math.abs(h1Close - emaNow) / emaNow : 0;
  const chopZone = !decayOK || chopPct < cfg.trend.chopZonePct;

  const emaPrev = h1Ema200[lastH1 - cfg.trend.ema200SlopeBars] ?? NaN;
  const emaSlopeFlat = !decayOK || !isFinite(emaPrev) || Math.abs(emaNow - emaPrev) / emaNow < cfg.trend.ema200SlopeFlatPct;

  const h1AdxVal = h1AdxArr[lastH1] ?? 0;
  const regime: RegimeKind = isFinite(h1AdxVal) && h1AdxVal > cfg.trend.adxThreshold ? "trending" : "ranging";
  const longBias = h1Close >= emaNow;

  const m15RsiVal = m15RsiArr[lastM15] ?? 50;
  const m5RsiVal = m5RsiArr[lastM5] ?? 50;
  const m5AtrVal = m5AtrArr[lastM5] ?? 0;
  const m15AtrVal = m15AtrArr[lastM15] ?? 0;
  const m15Ema50Val = m15Ema50[lastM15] ?? NaN;
  const m5Ema21Val = m5Ema21[lastM5] ?? NaN;

  const ctx: PairContext = {
    symbol: inst.symbol,
    display: inst.display,
    type: inst.type,
    price,
    pipSize: pip,
    spreadPips,
    spreadOk: true,
    h1Ema200: emaNow,
    h1Ema200SlopeFlat: emaSlopeFlat,
    chopZone,
    h1Adx: h1AdxVal,
    regime,
    longBias,
    m15Ema50: m15Ema50Val,
    m15Rsi: m15RsiVal,
    m5Rsi: m5RsiVal,
    m5Atr: m5AtrVal,
    m15Atr: m15AtrVal,
    m5Ema21: m5Ema21Val,
    session: sessionLabel,
    canTradeSession: session.canTrade,
    newsBlackout: false,
    signal: null,
    rejected,
  };

  // ---- Global gates -----------------------------------------------------
  const noFriday = cfg.risk.noFridayEntries && now.getUTCDay() === 5;
  if (noFriday) push("friday", "no Friday entries — day-of-week gate");
  if (!session.canTrade) push("session", `outside London/NY (${sessionLabel})`);
  if (sessionLabel === "NY" && !session.canTrade) push("session", "last 30 min of NY — no new entries");

  const blackout = newsBlackout(now, newsEvents, inst, cfg);
  ctx.newsBlackout = blackout;
  if (blackout) push("news", "high-impact red-folder news blackout window");

  const spreadOk = data.spreadPips <= cfg.spread.maxSpreadMultiplier * inst.typicalSpreadPips;
  ctx.spreadOk = spreadOk;
  if (!spreadOk) push("spread", `spread ${spreadPips.toFixed(2)}p > 2x typical ${inst.typicalSpreadPips}p`);

  if (state.circuitBreaker) push("circuit", "2 consecutive stop-outs — paused until next session");
  if (state.dailyLossHit) push("daily-loss", "daily loss limit (-3%) hit — stopped for the day");
  if (state.signalsCount >= cfg.risk.maxSignalsPerDay) push("max-signals", `max signals/day (${cfg.risk.maxSignalsPerDay}) reached`);

  const gatesPassed =
    session.canTrade &&
    !noFriday &&
    !blackout &&
    spreadOk &&
    !state.circuitBreaker &&
    !state.dailyLossHit &&
    state.signalsCount < cfg.risk.maxSignalsPerDay;

  if (!gatesPassed) {
    return ctx;
  }

  // ---- Trend filter (H1) -------------------------------------------------
  if (chopZone) push("trend-filter", `price within ${(chopPct * 100).toFixed(2)}% of H1 EMA200 (chop zone)`);
  if (emaSlopeFlat) push("trend-filter", "H1 EMA200 slope flat over last 20 bars (no regime)");
  const trendFilterOk = !chopZone && !emaSlopeFlat;
  if (!trendFilterOk) return ctx;

  // ---- Entry strategies (top-down, first match fires) ----------------------
  let selected: Signal | null = null;
  const effStrategies = cfg.setup.symbolStrategies?.[inst.symbol] ?? cfg.setup.enabledStrategies;

  // 1) Trend Continuation / Pullback
  if (regime === "trending" && !selected && effStrategies.includes("continuation")) {
    const dir: Direction = longBias ? "long" : "short";
    const atrA = Math.max(m15AtrVal, 1e-9);
    // wick must reach EMA50, close may be just below it (reclaim tolerance),
    // and close not extended more than N ATRs past the line (pullback, not chase)
    const pullbackHit =
      dir === "long"
        ? m15.low[lastM15] <= m15Ema50Val &&
          m15.close[lastM15] > m15Ema50Val - cfg.setup.continuationReclaimAtr * atrA &&
          Math.abs(m15.close[lastM15] - m15Ema50Val) / atrA <= cfg.setup.continuationPullbackDist
        : m15.high[lastM15] >= m15Ema50Val &&
          m15.close[lastM15] < m15Ema50Val + cfg.setup.continuationReclaimAtr * atrA &&
          Math.abs(m15.close[lastM15] - m15Ema50Val) / atrA <= cfg.setup.continuationPullbackDist;

    if (pullbackHit) {
      const rsiTurn = rsiTurnedBack(m5RsiArr, 0, lastM5, dir, cfg.setup.continuationRsiFloor, cfg.setup.rsiOverbought);
      const reclaim = dir === "long" ? m5.close[lastM5] > m5Ema21Val : m5.close[lastM5] < m5Ema21Val;
      const rejection =
        isPin(data.m5[lastM5], dir) || isEngulf(data.m5[lastM5 - 1], data.m5[lastM5], dir) ||
        isPin(data.m15[lastM15], dir);
      if (rsiTurn && reclaim && rejection) {
        const entry = data.m5[lastM5].close;
        const invalid =
          dir === "long"
            ? invalidStructureForLong(m15, m15AtrArr, lastM15)
            : invalidStructureForShort(m15, m15AtrArr, lastM15);
        const atrDist = cfg.risk.atrMult * m5AtrVal;
        let sl;
        if (dir === "long") {
          sl = Math.min(entry - atrDist, invalid !== null && invalid < entry ? invalid : entry - atrDist);
        } else {
          sl = Math.max(entry + atrDist, invalid !== null && invalid > entry ? invalid : entry + atrDist);
        }
        selected = buildSignal(inst, cfg, "continuation", dir, entry, sl, state, ctx, data, now);
        selected.confidenceNotes += (selected.confidenceNotes ? " " : "") + `M15 pulled to EMA50 (${m15Ema50Val.toFixed(5)}) with H1 ${regime} bias; M5 RSI turned from ${
          dir === "long" ? "oversold" : "overbought"
        }, reclaimed M5 EMA21, ${isPin(data.m5[lastM5], dir) ? "pin" : isEngulf(data.m5[lastM5 - 1], data.m5[lastM5], dir) ? "engulfing" : "M15 pin"} rejection at zone. Invalidated if M5 close back below EMA21${dir === "long" ? "" : " (above)"}.`;
      } else {
        const missing: string[] = [];
        if (!rsiTurn) missing.push("M5 RSI not turning back from extreme");
        if (!reclaim) missing.push("price not reclaiming M5 EMA21");
        if (!rejection) missing.push("no rejection candle at pullback zone");
        push("continuation", `${missing.join("; ") || "pullback present but confirmation incomplete"}`);
      }
    } else {
      push("continuation", "M15 not at EMA50 pullback zone");
    }
  } else if (regime === "ranging" && effStrategies.includes("continuation")) {
    push("continuation", "skipped — ADX < 20, ranging (only Bounce allowed)");
  }

  // 2) Breakout (requires trending)
  if (regime === "trending" && !selected && effStrategies.includes("breakout")) {
    const lookback = cfg.setup.m15BreakoutBars;
    const hh = highest(m15.high, lookback, lastM15 - 1);
    const ll = lowest(m15.low, lookback, lastM15 - 1);
    const curRange = m15.high[lastM15] - m15.low[lastM15];
    const from = Math.max(0, lastM15 - lookback);
    let sumR = 0;
    for (let i = from; i < lastM15; i++) sumR += m15.high[i] - m15.low[i];
    const avgRange = sumR / (lastM15 - from);
    const expanded = avgRange > 0 && curRange > cfg.setup.breakoutRangeMult * avgRange;

    const breakHigh = m15.close[lastM15] > hh && expanded;
    const breakLow = m15.close[lastM15] < ll && expanded;
    if ((breakHigh || breakLow) && isFinite(hh) && isFinite(ll)) {
      const dir: Direction = breakHigh ? "long" : "short";
      const level = breakHigh ? hh : ll;
      // M5 must confirm with a close beyond the level (not a wick)
      const m5cl = m5.close;
      const confirm = dir === "long" ? m5cl[lastM5] > level : m5cl[lastM5] < level;
      if (confirm) {
        const entry = data.m5[lastM5].close;
        const atrDist = cfg.risk.atrMult * m5AtrVal;
        let sl;
        if (dir === "long") {
          const invalid = invalidStructureForLong(m15, m15AtrArr, lastM15);
          sl = Math.min(entry - atrDist, invalid !== null && invalid < entry ? invalid : entry - atrDist);
        } else {
          const invalid = invalidStructureForShort(m15, m15AtrArr, lastM15);
          sl = Math.max(entry + atrDist, invalid !== null && invalid > entry ? invalid : entry + atrDist);
        }
        selected = buildSignal(inst, cfg, "breakout", dir, entry, sl, state, ctx, data, now);
        selected.confidenceNotes += (selected.confidenceNotes ? " " : "") + `M15 closed beyond ${lookback}-bar ${dir === "long" ? "high" : "low"} (${level.toFixed(5)}) with range ${(curRange / avgRange).toFixed(2)}x avg — expanding range. M5 confirmed with a close beyond, not a wick. Invalidated if M15 closes back inside the ${
          dir === "long" ? "high" : "low"
        }.`;
      } else {
        push("breakout", "M5 not confirmed beyond level (need close, not wick / wait for next bar)");
      }
    } else {
      push("breakout", "no expanding-range breakout at M15 20-bar high/low");
    }
  } else {
    push("breakout", "skipped — ranging regime");
  }

  // 3) Bounce (allowed in both regimes)
  if (!selected && effStrategies.includes("bounce")) {
    const levels = swingLevels(m15, {
      lookback: 2,
      tolerancePct: Math.max(0.0012, pip * 15 / (m15.close[lastM15] || 1)),
      maxBars: 60,
    });
    const atrTol = 0.5 * Math.max(m15AtrVal, pip * 3);
    let bounceDir: Direction | null = null;
    let levelAt: number | null = null;

    for (const s of levels.supports) {
      if (Math.abs(s - m15.low[lastM15]) <= atrTol && m15.close[lastM15] > s) {
        // check prior touches
        const touches = clusterTouchCount(levels.supports, s, atrTol);
        if (touches >= 2) {
          bounceDir = "long";
          levelAt = s;
          break;
        }
      }
    }
    if (!bounceDir) {
      for (const r of levels.resistances) {
        if (Math.abs(r - m15.high[lastM15]) <= atrTol && m15.close[lastM15] < r) {
          const touches = clusterTouchCount(levels.resistances, r, atrTol);
          if (touches >= 2) {
            bounceDir = "short";
            levelAt = r;
            break;
          }
        }
      }
    }

    if (bounceDir === "short" && cfg.setup.bounceShortEnabled === false) bounceDir = null;

    if (bounceDir && levelAt !== null) {
      const last = data.m5[lastM5];
      const tick = pip / 10;
      const wickConfirmed =
        bounceDir === "long"
          ? last.low <= levelAt + tick && last.close > levelAt && isPin(last, "long")
          : last.high >= levelAt - tick && last.close < levelAt && isPin(last, "short");
      if (wickConfirmed) {
        const entry = last.close;
        const atrDist = cfg.risk.atrMult * m5AtrVal;
        let sl;
        if (bounceDir === "long") {
          sl = Math.min(entry - atrDist, levelAt - 0.5 * Math.max(m15AtrVal, pip * 3));
        } else {
          sl = Math.max(entry + atrDist, levelAt + 0.5 * Math.max(m15AtrVal, pip * 3));
        }
        selected = buildSignal(inst, cfg, "bounce", bounceDir, entry, sl, state, ctx, data, now);
        selected.confidenceNotes += (selected.confidenceNotes ? " " : "") + `M15 rejected off clean ${bounceDir === "long" ? "support" : "resistance"} ~${levelAt.toFixed(5)} (${
          bounceDir === "long"
            ? clusterTouchCount(levels.supports, levelAt, atrTol)
            : clusterTouchCount(levels.resistances, levelAt, atrTol)
        } prior touches); M5 pin wick + close back inside. Invalidated on M5 close beyond the level.`;
      } else {
        push("bounce", "M5 rejection wick not confirmed at S/R level");
      }
    } else {
      push("bounce", "no S/R level with ≥2 touches near price");
    }
  }

  // 4) Reversal (rare, tightly gated)
  if (!selected && regime === "trending" && effStrategies.includes("reversal")) {
    const r15 = m15RsiVal;
    const extreme =
      (r15 <= cfg.setup.reversalRsiOversold && longBias === false) ||
      (r15 >= cfg.setup.reversalRsiOverbought && longBias === true);
    // also allow at clear extremes regardless of micro bias: strict gate below
    const atEmaZone =
      (r15 <= cfg.setup.reversalRsiOversold && m15.close[lastM15] <= m15Ema50Val * 1.002) ||
      (r15 >= cfg.setup.reversalRsiOverbought && m15.close[lastM15] >= m15Ema50Val * 0.998);

    const levels = swingLevels(m15, {
      lookback: 2,
      tolerancePct: Math.max(0.0012, pip * 15 / (m15.close[lastM15] || 1)),
      maxBars: 60,
    });
    const nearStructure =
      levels.supports.some((s) => Math.abs(s - m15.low[lastM15]) <= m15AtrVal) ||
      levels.resistances.some((r) => Math.abs(r - m15.high[lastM15]) <= m15AtrVal);

    // replay of exhaustion only in a STRONG trend (ADX much higher than the
    // regime threshold) and capped at 1/day — it must stay rare
    const adxStrong = h1AdxVal >= cfg.trend.adxReversalThreshold;
    const rareOK = reversalTradesToday(state, now) < cfg.risk.maxReversalPerDay;

    if (extreme && atEmaZone && nearStructure && adxStrong && rareOK) {
      const dir: Direction = r15 <= cfg.setup.reversalRsiOversold ? "long" : "short";
      const shortBlocked = dir === "short" && cfg.setup.reversalShortEnabled === false;
      const rejection =
        isPin(data.m5[lastM5], dir) || isEngulf(data.m5[lastM5 - 1], data.m5[lastM5], dir) ||
        isPin(data.m15[lastM15], dir);
      if (!shortBlocked && rejection) {
        const entry = data.m5[lastM5].close;
        const atrDist = cfg.risk.atrMult * m5AtrVal;
        let sl;
        if (dir === "long") {
          const invalid = invalidStructureForLong(m15, m15AtrArr, lastM15);
          sl = Math.min(entry - atrDist, invalid !== null && invalid < entry ? invalid : entry - atrDist);
        } else {
          const invalid = invalidStructureForShort(m15, m15AtrArr, lastM15);
          sl = Math.max(entry + atrDist, invalid !== null && invalid > entry ? invalid : entry + atrDist);
        }
        selected = buildSignal(inst, cfg, "reversal", dir, entry, sl, state, ctx, data, now);
        selected.confidenceNotes += (selected.confidenceNotes ? " " : "") + `M15 RSI ${r15.toFixed(0)} at extreme with ${dir === "long" ? "support" : "resistance"} structure and rejection candle at EMA50-adjacent zone. Exhaustion trade — tightly gated. Invalidated if price breaks the reversal level.`;
      } else {
        push("reversal", shortBlocked ? "short reversals disabled" : "M15 RSI extreme but no pin/engulfing at structure");
      }
    } else {
      const why: string[] = [];
      if (!extreme) why.push("RSI not at extreme");
      if (!atEmaZone) why.push("price not at/through EMA50 zone");
      if (!nearStructure) why.push("no structure nearby");
      push("reversal", why.join("; "));
    }
  } else if (!selected) {
    push("reversal", "skipped — ranging regime");
  }

  if (!selected) {
    push("no-signal", "no entry strategy qualified after filters");
    return ctx;
  }

  // ---- position pre-checks before firing ----------------------------------
  const lim = checkPositionLimits(state, inst.symbol, selected.direction, cfg);
  if (!lim.ok) {
    push("position", lim.reason);
    ctx.signal = null;
    return ctx;
  }

  ctx.signal = selected;
  return ctx;
}

function buildSignal(
  inst: InstrumentConfig,
  cfg: StrategyConfig,
  strategy: StrategyKind,
  direction: Direction,
  entry: number,
  sl0: number,
  state: EngineState,
  ctx: PairContext,
  data: PairData,
  now: Date
): Signal {
  const pip = PIP_SIZE[inst.oandaInstrument] ?? 0.0001;
  const atrVal = ctx.m5Atr;
  let sl = sl0;
  let slNote: string | undefined;
  let tp1: number | undefined;
  let tp2: number | undefined;

  if (cfg.setup.useStructuralTargets) {
    const m15atrNow = ctx.m15Atr ?? 0;
    const m15Series = toSeries(data.m15);
    const lastM15 = m15Series.close.length - 1;
    if (m15atrNow > 0) {
      const plan = structurePlan(
        m15Series,
        m15atrNow,
        lastM15,
        entry,
        direction,
        pip,
        {
          lookback: 2,
          maxBars: 60,
          bufferAtr: cfg.setup.structuralSlBufferAtr,
          slCapAtr: cfg.setup.structuralSlCapAtr,
        }
      );
      if (plan.sl !== undefined) {
        sl = plan.sl;
        slNote = plan.slNote;
      }
      tp1 = plan.tp1;
      tp2 = plan.tp2;
    }
  }

  const stopDist = Math.abs(entry - sl);
  const slPips = stopDist / pip;
  const slAtr = atrVal > 0 ? stopDist / atrVal : 0;
  const minR = cfg.setup.structuralTpMinR;
  const maxR = cfg.setup.structuralTpMaxR;
  const scale = cfg.risk.tp2R / cfg.risk.tp1R; // keep the old TP2/TP1 ratio when extrapolating
  let rMult1 = cfg.risk.tp1R;
  let rMult2 = cfg.risk.tp2R;
  if (cfg.setup.useStructuralTargets && tp1 !== undefined && cfg.setup.structuralTpEnabled) {
    const r1 = (direction === "long" ? tp1 - entry : entry - tp1) / stopDist;
    if (r1 >= minR && r1 <= maxR) rMult1 = r1;
  }
  if (cfg.setup.useStructuralTargets && tp2 !== undefined && cfg.setup.structuralTpEnabled) {
    const r2 = (direction === "long" ? tp2 - entry : entry - tp2) / stopDist;
    if (r2 >= Math.max(minR, rMult1) && r2 <= maxR) rMult2 = r2;
    else if (r2 > maxR) rMult2 = maxR;
    else rMult2 = Math.min(maxR, rMult1 * scale); // no clean far level -> proportional extension
  } else {
    rMult2 = Math.min(maxR, rMult1 * scale); // even the fallback chain is anchored to the structural TP1
  }
  if (rMult1 > maxR) rMult1 = maxR;
  const tp1P = direction === "long" ? entry + stopDist * rMult1 : entry - stopDist * rMult1;
  const tp2P = direction === "long" ? entry + stopDist * rMult2 : entry - stopDist * rMult2;
  const sizing = computeSize(inst, entry, sl, state.equity, cfg, data.rates);

  return {
    symbol: inst.symbol,
    direction,
    strategy,
    entry,
    sl,
    slPips,
    slAtr,
    tp1: tp1P,
    tp2: tp2P,
    tp1R: rMult1,
    tp2R: rMult2,
    session: ctx.session === "Closed" ? "London" : (ctx.session as Exclude<SessionLabel, "Closed">),
    regime: { kind: ctx.regime, adx: ctx.h1Adx },
    spreadPips: ctx.spreadPips,
    atr: atrVal,
    lots: sizing.lots,
    riskAmount: sizing.riskAmount,
    confidenceNotes: slNote ? `${slNote}. TP1 ${rMult1.toFixed(2)}R / TP2 ${rMult2.toFixed(2)}R from structure.` : "",
    generatedAt: now.toISOString(),
  };
}

export async function runScanPipeline(
  client: import("./oanda").OandaClient,
  instruments: InstrumentConfig[],
  cfg: StrategyConfig,
  now: Date,
  state: EngineState,
  newsEvents: NewsEvent[],
  granularityCount = { H1: 260, M15: 150, M5: 150 }
): Promise<{ contexts: PairContext[]; state: EngineState }> {
  const active = instruments.filter((i) => i.enabled);
  const oandaNames = active.map((i) => i.oandaInstrument);

  const prices = await client.getPrices(oandaNames);
  const rates: RateMap = {};
  const spreads: Record<string, number> = {};
  for (const p of prices) {
    // top-of-book bid/ask (first level) — the realistic executable spread;
    // closeout prices include buffer and inflate the gate on demo feeds
    const bestBid = p.bids?.[0] ? parseFloat(p.bids[0].price) : parseFloat(p.closeoutBid || "0");
    const bestAsk = p.asks?.[0] ? parseFloat(p.asks[0].price) : parseFloat(p.closeoutAsk || "0");
    rates[p.instrument] = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : parseFloat(p.closeoutAsk || "0");
    const pip = PIP_SIZE[p.instrument] ?? 0.0001;
    spreads[p.instrument] = (bestAsk - bestBid) / pip;
  }

  const results: PairContext[] = [];
  // throttle: 3 concurrent fetches per instrument bundle
  const concurrency = 3;
  for (let start = 0; start < active.length; start += concurrency) {
    const chunk = active.slice(start, start + concurrency);
    const fetched = await Promise.all(
      chunk.map(async (inst) => {
        const [h1, m15, m5] = await Promise.all([
          client.getCandles(inst.oandaInstrument, "H1", granularityCount.H1, "M"),
          client.getCandles(inst.oandaInstrument, "M15", granularityCount.M15, "M"),
          client.getCandles(inst.oandaInstrument, "M5", granularityCount.M5, "M"),
        ]);
        // only reference completed candles — the in-progress bar is not a valid signal
        return {
          inst,
          h1: h1.filter((c) => c.complete),
          m15: m15.filter((c) => c.complete),
          m5: m5.filter((c) => c.complete),
        };
      })
    );
    for (const f of fetched) {
      const rate = rates[f.inst.oandaInstrument] ?? f.m15[f.m15.length - 1]?.close;
      const ctx = analyzePair(
        f.inst,
        {
          h1: f.h1,
          m15: f.m15,
          m5: f.m5,
          price: rate,
          spreadPips: spreads[f.inst.oandaInstrument] ?? 0,
          rates,
        },
        cfg,
        now,
        state,
        newsEvents
      );
      results.push(ctx);
    }
  }
  return { contexts: results, state };
}

export function applySignalToState(state: EngineState, signal: Signal): EngineState {
  return {
    ...state,
    signalsCount: state.signalsCount + 1,
    logs: [
      {
        time: signal.generatedAt,
        symbol: signal.symbol,
        kind: "signal",
        strategy: signal.strategy,
        reason: `${signal.direction.toUpperCase()} ${signal.symbol} ${signal.strategy} @ ${signal.entry} SL ${signal.sl}`,
      },
      ...state.logs,
    ],
  };
}

export { WATCHLIST };
