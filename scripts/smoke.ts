import { ema, rsi, atr, adx, toSeries } from "../src/lib/indicators";
import { analyzePair, initialState, sessionAt } from "../src/lib/engine";
import { runBacktest } from "../src/lib/backtest";
import { DEFAULT_CONFIG } from "../src/lib/config";
import type { Candle } from "../src/lib/oanda";

function synthCandles(n: number, seed: number, drift: number, vol: number, tfMs: number): Candle[] {
  const out: Candle[] = [];
  let price = 1.08;
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const open = price;
    const change = drift + (rng() - 0.5) * vol;
    const close = open + change;
    const high = Math.max(open, close) + Math.abs(rng()) * vol * 0.5;
    const low = Math.min(open, close) - Math.abs(rng()) * vol * 0.5;
    out.push({
      time: String(1700000000000 - (n - 1 - i) * tfMs),
      complete: true,
      open,
      high,
      low,
      close,
      volume: 100 + Math.floor(rng() * 900),
    });
    price = close;
  }
  return out;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertFinite(name: string, v: number) {
  if (!Number.isFinite(v)) throw new Error(`FAIL ${name}: ${v}`);
  console.log(`ok   ${name} = ${v.toFixed ? v.toFixed(6) : v}`);
}

console.log("== indicator sanity ==");
const walk = synthCandles(300, 7, 0.0004, 0.0012, 3600000).map((c) => c.close);
const emaArr = ema(walk, 200);
assertFinite("EMA200 last", emaArr[emaArr.length - 1]);
const rsiArr = rsi(walk, 14);
assertFinite("RSI last", rsiArr[rsiArr.length - 1]);
const s = toSeries(synthCandles(300, 7, 0.0004, 0.0012, 3600000));
const atrArr = atr(s, 14);
assertFinite("ATR last", atrArr[atrArr.length - 1]);
const adxRes = adx(s, 14);
assertFinite("ADX last", adxRes.adx[adxRes.adx.length - 1]);
assertFinite("+DI last", adxRes.plusDi[adxRes.plusDi.length - 1]);
assertFinite("-DI last", adxRes.minusDi[adxRes.minusDi.length - 1]);

console.log("== session ==");
console.log("  Monday 08:00 GMT:", JSON.stringify(sessionAt(new Date("2026-08-31T08:00:00Z"))));
console.log("  Monday 13:00 GMT:", JSON.stringify(sessionAt(new Date("2026-08-31T13:00:00Z"))));
console.log("  Monday 20:45 GMT:", JSON.stringify(sessionAt(new Date("2026-08-31T20:45:00Z"))));
console.log("  Saturday:", JSON.stringify(sessionAt(new Date("2026-08-29T10:00:00Z"))));

console.log("== analyzePair smoke ==");
const h1 = synthCandles(260, 11, 0.0012, 0.004, 3600000);
const m15 = synthCandles(220, 12, 0.0004, 0.0016, 900000);
const m5 = synthCandles(220, 13, 0.0002, 0.0008, 300000);
const inst = {
  symbol: "EUR/USD",
  oandaInstrument: "EUR_USD",
  display: "EUR/USD",
  type: "major" as const,
  typicalSpreadPips: 1.0,
  enabled: true,
  marginRate: 0.0333,
};
const rates = { EUR_USD: h1[h1.length - 1].close, USD_JPY: 150.0, GBP_USD: 1.27 };
const now = new Date("2026-08-31T13:00:00Z"); // Monday overlap, trend filter likely passes on drifting series
const ctx = analyzePair(
  inst,
  { h1, m15, m5, price: h1[h1.length - 1].close, spreadPips: 0.8, rates },
  DEFAULT_CONFIG,
  now,
  initialState(10000),
  []
);
console.log(`  context: regime=${ctx.regime} adx=${ctx.h1Adx.toFixed(1)} chop=${ctx.chopZone} slopeFlat=${ctx.h1Ema200SlopeFlat}`);
console.log(`  rejected=${ctx.rejected.length}`);
console.log(`  signal=${ctx.signal ? `${ctx.signal.direction} ${ctx.signal.strategy} lots=${ctx.signal.lots} risk=$${ctx.signal.riskAmount}` : "none"}`);
if (ctx.signal) {
  assertFinite("signal.sl", ctx.signal.sl);
  assertFinite("signal.tp1", ctx.signal.tp1);
  assertFinite("signal.riskAmount", ctx.signal.riskAmount);
}

// ranging regime — should force skip continuation/breakout
const flatH1 = synthCandles(260, 21, 0.0, 0.0009, 3600000);
const ctx2 = analyzePair(
  inst,
  { h1: flatH1, m15, m5, price: flatH1[flatH1.length - 1].close, spreadPips: 0.8, rates },
  DEFAULT_CONFIG,
  now,
  initialState(10000),
  []
);
console.log(`  flat regime test: regime=${ctx2.regime} adx=${ctx2.h1Adx.toFixed(1)} chop=${ctx2.chopZone}`);

console.log("== backtest smoke ==");
const btH1 = synthCandles(500, 31, 0.0012, 0.004, 3600000);
const btM15 = synthCandles(600, 32, 0.0004, 0.0016, 900000);
const btM5 = synthCandles(1500, 33, 0.0002, 0.0008, 300000);
const btRes = runBacktest("EUR/USD", btH1, btM15, btM5, DEFAULT_CONFIG, Date.now() - 3 * 86400000, Date.now(), 10000);
console.log(
  `  trades=${btRes.summary.totalTrades} winrate=${(btRes.summary.winRate * 100).toFixed(1)}% avgR=${btRes.summary.avgR.toFixed(2)} maxDD=${(btRes.summary.maxDrawdownPct * 100).toFixed(1)}%`
);

console.log("SMOKE OK");