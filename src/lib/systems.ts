/**
 * FIVE-SYSTEM ARCHITECTURE — five genuinely different, individually-validated
 * strategies run side-by-side on one account. Each system owns its own risk
 * slice and its own Telegram tag, so together they produce many setups without
 * any system fearing trade volume — each only fires its highest-quality setup.
 *
 * Systems:
 *   SYS1 TREND-MOMENTUM  intraday continuation+breakout, H1-EMA200/ADX regime
 *                        1y PF 2.21 / 2y PF 1.75 — the flagship momentum system.
 *   SYS2 ORB             30-min NY opening-range breakout on USD/JPY, D1-bias gate
 *                        5y: 540t, WR 54.6%, PF 1.33, +143.5%, DD 14.2%. Time-based,
 *                        structurally different from every indicator system.
 *   SYS3 SWING           H4/D1 trend pullback momentum (multi-day hold) — the longest
 *                        horizon system. 2y PF 1.52.
 *   SYS4 SCALP           tight-TP momentum scalp on XAU+GBP (ADX>=24, TP 1R/1.8R):
 *                        high hit-rate, quick exits. 1y: 107t, WR 67.3%, PF 2.95.
 *   SYS5 MR-FADE         counter-trend: S/R bounces + RSI-extreme exhaustion in trend
 *                        (long-only legs). 2y 7-set: PF 1.32 (thin sample — low book).
 */
import { DEFAULT_CONFIG, WATCHLIST, type StrategyConfig } from "./config";
import { SWING_DEFAULT_CONFIG, type SwingConfig } from "./swing";

export type SystemKind = "intraday" | "orb" | "swing";

export interface SystemSpec {
  id: string; // sys1..sys5
  name: string; // used in Telegram/console tags
  kind: SystemKind;
  config?: StrategyConfig; // intraday systems
  swingConfig?: SwingConfig; // swing (SYS3)
  symbols: string[]; // WATCHLIST display symbols this system scans
  riskPct: number; // per-trade risk slice of virtual equity
  evidence: string; // validation summary (shown in headers)
}

const fx7 = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "XAU/USD", "NAS100", "US30"];
const fx5 = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "XAU/USD"];

/** deep-clone the validated default so each system can branch on it */
const clone = (): StrategyConfig => JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as StrategyConfig;
const withStrategies = (c: StrategyConfig, strategies: ("continuation" | "breakout" | "bounce" | "reversal")[]) => {
  c.setup.enabledStrategies = strategies;
  return c;
};
const withRisk = (c: StrategyConfig, pct: number) => {
  c.risk.riskPerTradePct = pct;
  return c;
};

const sys1Config = withRisk(withStrategies(clone(), ["breakout", "bounce", "reversal"]), 0.02);
// LOOSE MONEY ENGINE (user-selected 2026-08). 5y benchmark (5FX, $10k, 1%): 1,759t
// PF 1.76 +369.8R $356k DD 13.8% — continuation leg was dead weight (121t, 47% WR,
// +7.6R): dropped → val PF 1.91→2.03, DD 7.2→5.8, same R. TP flatten tested → trimmed $
// on BOTH configs — reverted (TP 1.5R/3R).
sys1Config.trend.adxThreshold = 10;
sys1Config.risk.maxPositions = 3;
sys1Config.risk.maxSignalsPerDay = 4;
sys1Config.risk.tp1R = 1.5;
sys1Config.risk.tp2R = 3;

const sys4Config = clone();
sys4Config.setup.enabledStrategies = ["breakout", "bounce"];
// 2026-08 LOOSE scoop (mirrors sys1): all-4 + ADX10 + 3conc/4day.
// train 2y PF 1.73→1.52 but R +27% (70.8→89.9); val PF 2.20→2.11 R +71% (41.1→70.3, DD 3.9);
// 5y $36,963→$117,148 (PF 1.74, +252R). Loosening=more trades at same egg → more R.
// continuation (93t/0.09R) + reversal (-2.8R) dropped → val PF 2.11→2.41, WR 69.8%, DD 3.7.
sys4Config.trend.adxThreshold = 10;
sys4Config.trend.chopZonePct = 0.002;
sys4Config.risk.atrMult = 2.0;
sys4Config.risk.tp1R = 1.0;
sys4Config.risk.tp2R = 2.2;
sys4Config.risk.maxPositions = 3;
sys4Config.risk.maxSignalsPerDay = 4;
sys4Config.risk.riskPerTradePct = 0.02;

const sys5Config = clone();
// 2026-08: user mandate "all systems loose" — SYS5 becomes SYS1's loose 1% twin
// (same breakout+bounce+reversal/ADX10/3-conc/4-day engine, own circuit+loss state).
// Replaces dead MR-FADE persona (val PF 0.98 control → 0.13 loosened).
sys5Config.setup.enabledStrategies = ["breakout", "bounce", "reversal"];
sys5Config.trend.adxThreshold = 10;
sys5Config.risk.maxPositions = 3;
sys5Config.risk.maxSignalsPerDay = 4;
withRisk(sys5Config, 0.01);

export const SYSTEMS: SystemSpec[] = [
  {
    id: "sys1",
    name: "TREND-MOMENTUM",
    kind: "intraday",
    config: sys1Config,
    symbols: fx7,
    riskPct: 0.02,
    evidence: "LOOSE money engine (brk+bounce+rev, ADX10, 3conc/4day, no-continuation): 5y PF1.76 +370R $356k; val PF2.03 DD5.8",
  },
  {
    id: "sys2",
    name: "ORB",
    kind: "orb",
    symbols: ["EUR/USD", "GBP/USD", "USD/JPY"],
    riskPct: 0.01,
    evidence: "LOOSE (user mandate 2026-08): 3-pair NY ORB. Train 4y PF1.16 +158% / val RED PF0.85 DD35% — honesty: multi-pair ORB loses its single-pair edge OOS (USD/JPY-only control val PF~1.0 flat)",
  },
  {
id: "sys3",
    name: "SWING",
    kind: "swing",
    swingConfig: (() => {
      const c = JSON.parse(JSON.stringify(SWING_DEFAULT_CONFIG)) as SwingConfig;
      // 2026-08 sweep: timeStop 8→12, tp2RMult 1.6→1.8, legMinAtr 1.2→1.4 →
      //   train 2y PF 1.28→1.78, R 10.9→26.2, DD 9.9→9.3%.
      // 2026-08 LOOSE scoop (user mandate): adxThreshold 15→8, pullbackBarCount 42→60,
      //   pullbackMaxRetrace→0.8, rsiResetHigh→60, cooldownDays 4→2, legMinAtr→1.2 →
      //   train 2y 46t/+26.2R/PF1.78 → 312t/+92.8R/PF1.35; val 1y 25t/-0.4R → 141t/+123.3R/PF2.34 DD8.5.
      c.trend.adxThreshold = 8;
      c.setup.pullbackBarCount = 60;
      c.setup.pullbackMaxRetrace = 0.8;
      c.setup.rsiResetHigh = 60;
      c.setup.legMinAtr = 1.2;
      c.risk.cooldownDays = 2;
      c.risk.timeStopDays = 12;
      c.setup.tp2RMult = 1.8;
      return c;
    })(),
    symbols: fx5,
    riskPct: 0.01,
    evidence: "LOOSE (adx8, wide/long pullbacks, RSI50, cooldown2): train +92.8R PF1.35; val +123.3R PF2.34 DD8.5 — 6x the book of control",
  },
  {
    id: "sys4",
    name: "SCALP",
    kind: "intraday",
    config: sys4Config,
    symbols: ["XAU/USD", "GBP/USD"],
    riskPct: 0.02,
    evidence: "LOOSE breakout+bounce (ADX10, 3conc/4day, TP1R/2.2R, no continuation/reversal): val PF2.41 WR70% DD3.7; 5y PF1.74 +252R $117k",
  },
  {
    id: "sys5",
    name: "MOMENTUM 1%",
    kind: "intraday",
    config: sys5Config,
    symbols: fx7,
    riskPct: 0.01,
    evidence: "LOOSE twin of sys1 (breakout+bounce+rev, 1% risk, user mandate): own circuit/loss state; no-continuation val PF2.03",
  },
];

export function systemIndex(): Record<string, SystemSpec> {
  return Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
}

export function enabledSymbols(spec: SystemSpec): string[] {
  const enabled = new Set(WATCHLIST.filter((i) => i.enabled).map((i) => i.symbol));
  return spec.symbols.filter((s) => enabled.has(s));
}