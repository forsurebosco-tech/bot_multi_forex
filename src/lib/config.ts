import type { Granularity } from "./oanda";

export interface InstrumentConfig {
  symbol: string;
  oandaInstrument: string;
  display: string;
  type: "major" | "cross" | "gold" | "index";
  typicalSpreadPips: number;
  enabled: boolean;
}

// Pip = 4th decimal for most pairs, 2nd decimal for JPY pairs, 2nd for gold? Gold is often quoted in "points".
// Default pip size for XAU/USD treated as 0.1 to keep 'pips' readable; adjusted in engine.

export const PIP_SIZE: Record<string, number> = {
  EUR_USD: 0.0001,
  GBP_USD: 0.0001,
  AUD_USD: 0.0001,
  NZD_USD: 0.0001,
  USD_CHF: 0.0001,
  USD_CAD: 0.0001,
  EUR_JPY: 0.01,
  GBP_JPY: 0.01,
  EUR_GBP: 0.0001,
  USD_JPY: 0.01,
  XAU_USD: 0.1,
  NAS100_USD: 1, // index CFD: 1 "pip" = 1 NASDAQ-100 point
  SPX500_USD: 1, // 1 pip = 1 S&P500 point
  US30_USD: 1, // 1 pip = 1 Dow Jones point
};

export const INSTRUMENTS: InstrumentConfig[] = [
  { symbol: "EUR/USD", oandaInstrument: "EUR_USD", display: "EUR/USD", type: "major", typicalSpreadPips: 1.0, enabled: true },
  { symbol: "GBP/USD", oandaInstrument: "GBP_USD", display: "GBP/USD", type: "major", typicalSpreadPips: 1.3, enabled: true },
  { symbol: "USD/JPY", oandaInstrument: "USD_JPY", display: "USD/JPY", type: "major", typicalSpreadPips: 1.0, enabled: true },
  { symbol: "USD/CHF", oandaInstrument: "USD_CHF", display: "USD/CHF", type: "major", typicalSpreadPips: 1.5, enabled: true },
  { symbol: "USD/CAD", oandaInstrument: "USD_CAD", display: "USD/CAD", type: "major", typicalSpreadPips: 1.5, enabled: false },
  { symbol: "AUD/USD", oandaInstrument: "AUD_USD", display: "AUD/USD", type: "major", typicalSpreadPips: 1.2, enabled: false },
  { symbol: "NZD/USD", oandaInstrument: "NZD_USD", display: "NZD/USD", type: "major", typicalSpreadPips: 1.8, enabled: false },
  { symbol: "EUR/JPY", oandaInstrument: "EUR_JPY", display: "EUR/JPY", type: "cross", typicalSpreadPips: 2.0, enabled: false },
  { symbol: "GBP/JPY", oandaInstrument: "GBP_JPY", display: "GBP/JPY", type: "cross", typicalSpreadPips: 3.0, enabled: false },
  { symbol: "EUR/GBP", oandaInstrument: "EUR_GBP", display: "EUR/GBP", type: "cross", typicalSpreadPips: 1.2, enabled: false },
  { symbol: "XAU/USD", oandaInstrument: "XAU_USD", display: "XAU/USD", type: "gold", typicalSpreadPips: 5.0, enabled: true },
  { symbol: "NAS100", oandaInstrument: "NAS100_USD", display: "NAS100", type: "index", typicalSpreadPips: 1.5, enabled: true },
  { symbol: "SPX500", oandaInstrument: "SPX500_USD", display: "SPX500", type: "index", typicalSpreadPips: 1.0, enabled: false },
  { symbol: "US30", oandaInstrument: "US30_USD", display: "US30", type: "index", typicalSpreadPips: 2.5, enabled: true },
];

export const WATCHLIST = INSTRUMENTS.filter((i) => i.enabled);

export function resolveInstrument(input: string): InstrumentConfig | undefined {
  const u = input.trim().toUpperCase().replace("/", "_");
  return INSTRUMENTS.find(
    (i) =>
      i.oandaInstrument.toUpperCase() === u ||
      i.symbol.toUpperCase().replace("/", "_") === u ||
      i.display.toUpperCase().replace("/", "_") === u
  );
}

export interface StrategyConfig {
trend: {
    ema200Period: 200;
    ema200SlopeBars: 20;
    ema200SlopeFlatPct: number; // EMA200 change over 20 bars below this % of price => flat (no regime)
    chopZonePct: number; // 0.003 = 0.3%
    adxPeriod: number;
    adxThreshold: number;
    adxReversalThreshold: number; // reversal needs a strong trend (much rarer)
  };
  setup: {
    ema50Period: number;
    m15BreakoutBars: number;
    breakoutRangeMult: number; // range > this x 20-bar avg
    rsiPeriod: number;
    rsiOversold: number;
    rsiOverbought: number;
    continuationRsiFloor: number; // RSI must have been below this for a valid pullback turn
    continuationPullbackDist: number; // max ATRs close may be from EMA50 after the pullback turn
    continuationReclaimAtr: number; // close may be up to xATR below EMA50 after reclaim
    reversalRsiOversold: number;
    reversalRsiOverbought: number;
    reversalShortEnabled: boolean; // false = only long reversals (short leg had 25% win / -0.49R)
    bounceShortEnabled: boolean; // false = only long bounces (short leg 42% win / +0.06R)
    useStructuralTargets: boolean; // SL/TP anchored to M15 swing levels, not blind R multiples
    structuralTpEnabled: boolean; // structural SL + structural TPs; false = structural SL only (TP fallback)
    structuralSlBufferAtr: number; // buffer past a structural level for the SL (in M15 ATR units)
    structuralSlCapAtr: number; // max structural SL width vs the normal ATR stop (fallback above this)
    structuralTpMinR: number; // structural TP1 must be at least this many R away or we fall back
    structuralTpMaxR: number; // structural TPs clamped to at most this many R from entry
    ema21Period: number;
    enabledStrategies: ("continuation" | "breakout" | "bounce" | "reversal")[];
    symbolStrategies?: Partial<Record<string, ("continuation" | "breakout" | "bounce" | "reversal")[]>>;
  };
  risk: {
    atrPeriod: number;
    atrMult: number; // SL = 1.5-2x ATR
    riskPerTradePct: number; // 0.01 = 1%
    tp1R: number;
    tp2R: number;
    maxPositions: number;
    maxConsecutiveLosses: number;
    dailyLossLimitPct: number; // -3%
    minLots?: number; // optional fixed lot step/floor for FX+gold; indices always 1 contract
    maxSignalsPerDay: number;
    maxReversalPerDay: number; // exhaustion trades are rare — cap hard
    closeAtSessionEnd: boolean; // day-trading: force-flat at the NY close, no overnight/weekend holds
    sessionCloseMinutes: number; // GMT minutes into the day when positions must be closed (21:00 = 21*60)
    noFridayEntries: boolean; // Friday is the only losing weekday (-134R/5y): gate entries off
    newsBlackoutBeforeMin: number;
    newsBlackoutAfterMin: number;
  };
  sessions: {
    londonStart: number; // GMT hours
    nyStart: number;
    nyCloseBlockMins: number; // no new entries last 30 min of NY
  };
  spread: {
    maxSpreadMultiplier: number; // skip if spread > 2x typical
  };
}

export const DEFAULT_CONFIG: StrategyConfig = {
  trend: {
    ema200Period: 200,
    ema200SlopeBars: 20,
    ema200SlopeFlatPct: 0.0003, // EMA200 change over 20 bars < 0.03% of price -> flat (no regime)
    chopZonePct: 0.003,
    adxPeriod: 14,
    adxThreshold: 20,
    adxReversalThreshold: 25,
  },
  setup: {
    ema50Period: 50,
    m15BreakoutBars: 20,
    breakoutRangeMult: 1.6,
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    continuationRsiFloor: 35,
    continuationPullbackDist: 2.0,
    continuationReclaimAtr: 0.5,
    reversalRsiOversold: 20,
    reversalRsiOverbought: 80,
    reversalShortEnabled: false, // data: short reversal leg 25% win / -0.49R (toxic) -> long-only
    bounceShortEnabled: false, // data: short bounce leg 42% win / +0.06R -> long-only
    useStructuralTargets: true, // 2026-08: SL/TP on M15 swing highs/lows (buffer past level), ATR fallback when no clean level
    structuralTpEnabled: false, // OOS decided: SL-only (+256R/PF 1.66 OOS) beat SL+TP; TP magnets won on fit only
    structuralSlBufferAtr: 0.5,
    structuralSlCapAtr: 3,
    structuralTpMinR: 1,
    structuralTpMaxR: 3,
    ema21Period: 21,
    enabledStrategies: ["continuation", "breakout", "bounce", "reversal"],
    symbolStrategies: {}, // uniform all-4 across every pair (no per-pair routing)
  },
  risk: {
    atrPeriod: 14,
    atrMult: 2.3,
    riskPerTradePct: 0.04, // small-account turbo mode: 4% per trade on $500 (was 1%)
    tp1R: 1.5,
    tp2R: 3,
    maxPositions: 2, // margin-bound on $500 (0.04 risk ~ 0.10 lots ≈ $300+ margin each on majors)
    maxConsecutiveLosses: 3,
    dailyLossLimitPct: 0.08, // -8% engine day stop (was 3%)
    minLots: undefined, // optional fixed lot step/floor for FX+gold (e.g. 0.1); indices always 1 contract
    maxSignalsPerDay: 6,
    maxReversalPerDay: 1,
    closeAtSessionEnd: true,
    sessionCloseMinutes: 21 * 60, // force-flat 21:00 GMT (end of NY)
    noFridayEntries: true,
    newsBlackoutBeforeMin: 15,
    newsBlackoutAfterMin: 15,
  },
  sessions: {
    londonStart: 7,
    nyStart: 12,
    nyCloseBlockMins: 30,
  },
  spread: {
    maxSpreadMultiplier: 2,
  },
};

// Accoun config: fill in before going live
export const ACCOUNT_RULES = {
  equity: 500, // starting equity — small turbo account
  leverage: 30, // typical per broker
  maxPositionsPerPair: 1,
};

// High-impact red-folder news events covered by the blackout. Feeds typically identify the release time; the
// engine applies the blackout if the scan time is within the window of a tracked event for currencies involved.
export interface NewsEvent {
  start: number; // epoch ms
  end: number; // epoch ms
  currencies: string[]; // involved currencies e.g. ["USD"]
  label: string;
}