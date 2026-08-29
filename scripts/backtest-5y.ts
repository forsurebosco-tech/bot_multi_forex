/**
 * 5-YEAR BACKTEST — $10,000 prop-firm account
 *
 * Replays the EXACT ruleset engine (src/lib/engine.ts analyzePair) over the
 * last N years of OANDA candles for the whole watchlist, sharing ONE engine
 * state: 1 position per pair, max 3 concurrent, gold counts in the USD bucket,
 * -3% engine day stop, 2-consecutive-loss breaker, plus prop-firm hard rules:
 *   - 1% fixed-dollar risk ($100 at $10k)
 *   - daily loss limit -5% of day-start balance  -> account blown
 *   - max drawdown -10% from initial $10,000     -> account blown
 *
 * TP modeling: TP1 (1.5R) closes half at +1.5R and moves SL to breakeven
 * (remaining half risks 0.5R and targets TP2 3R). Full TP2 = +2.25R, BE = +0.75R,
 * full SL = -1R. Conservative fills: if a bar touches both SL and a target,
 * the SL is assumed. Round-trip spread cost (typicalSpreadPips x pip value x
 * lots) is deducted from every closed trade.
 *
 * Usage:
 *   npx tsx scripts/backtest-5y.ts            # 5 years, cached data
 *   npx tsx scripts/backtest-5y.ts --years=3  # shorter window
 *   npx tsx scripts/backtest-5y.ts --fresh    # refetch all data from OANDA
 *
 * Output:
 *   data/backtest/backtest-<timestamp>.md     human report
 *   data/backtest/backtest-<timestamp>.csv    equity curve (t_ms, equity)
 *   data/backtest/backtest-<timestamp>.json   every closed trade
 */
import fs from "node:fs";
import path from "node:path";
import { OandaClient, type Candle } from "../src/lib/oanda";
import {
  WATCHLIST,
  PIP_SIZE,
  DEFAULT_CONFIG,
  type InstrumentConfig,
  type StrategyConfig,
} from "../src/lib/config";
import {
  analyzePair,
  initialState,
  pipValuePerLot,
  eodCloseDue,
  type StrategyKind,
  type EngineState,
  type OpenPosition,
  type PairData,
  type RateMap,
} from "../src/lib/engine";

// ----------------------------------------------------------------------------
// Account / prop-firm parameters
// ----------------------------------------------------------------------------
let INITIAL_EQUITY = 10000;
const PROP_DAILY_LOSS_PCT = 0.05; // hard: daily P&L <= -5% of day-start balance
const PROP_MAX_DD_PCT = 0.10; // hard: equity <= 90% of initial $10k
const PROP_PASS_MULT = 2.0; // soft: double the account (reported)
const WARMUP_DAYS = 55; // prior bars for EMA200 + M15/M5 indicators + swings

const APP_ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(APP_ROOT, "data", "cache");
const OUT_DIR = path.join(APP_ROOT, "data", "backtest");

interface FSet {
  t: Float64Array;
  o: Float64Array;
  h: Float64Array;
  l: Float64Array;
  c: Float64Array;
  n: number;
}

// windows big enough for every indicator + lookback used in analyzePair
const WIN = { H1: 320, M15: 350, M5: 250 };

// ----------------------------------------------------------------------------
// tiny .env.local loader (token / account id / environment)
// ----------------------------------------------------------------------------
function loadEnvLocal() {
  const p = path.join(APP_ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ----------------------------------------------------------------------------
// data cache (binary Float64Array files)
// ----------------------------------------------------------------------------
function candlesToFSet(cs: Candle[]): FSet {
  const n = cs.length;
  const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    t[i] = parseFloat(cs[i].time) * 1000; // OANDA unix-seconds -> ms
    o[i] = cs[i].open; h[i] = cs[i].high; l[i] = cs[i].low; c[i] = cs[i].close;
  }
  return { t, o, h, l, c, n };
}

function saveFSet(f: FSet, file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const total = 5 * f.n;
  const buf = new Float64Array(total);
  buf.set(f.t); buf.set(f.o, f.n); buf.set(f.h, 2 * f.n); buf.set(f.l, 3 * f.n); buf.set(f.c, 4 * f.n);
  fs.writeFileSync(file, Buffer.from(buf.buffer));
}

function loadFSet(file: string): FSet {
  const ab = fs.readFileSync(file).buffer;
  const all = new Float64Array(ab);
  const n = Math.floor(all.length / 5);
  return {
    t: all.subarray(0, n),
    o: all.subarray(n, 2 * n),
    h: all.subarray(2 * n, 3 * n),
    l: all.subarray(3 * n, 4 * n),
    c: all.subarray(4 * n, 5 * n),
    n,
  };
}

async function fetchSeries(
  client: OandaClient,
  instrument: string,
  tf: string,
  fromMs: number,
  toMs: number,
  fresh: boolean
): Promise<FSet> {
  const file = path.join(CACHE_DIR, `${instrument}_${tf}_${new Date(fromMs).toISOString().slice(0, 10)}.bin`);
  if (!fresh && fs.existsSync(file)) {
    const f = loadFSet(file);
    const freshEnough = f.n > 5000 && f.t[f.n - 1] >= toMs - 2 * 24 * 3600 * 1000;
    if (freshEnough) return f;
  }
  const all: Candle[] = [];
  let from = Math.floor(fromMs / 1000);
  for (let attempt = 0; ; ) {
    try {
      const seg = await client.getCandles(instrument, tf as never, 5000, "M", from);
      for (const c of seg) if (c.complete) all.push(c);
      if (seg.length === 0 || seg.length < 5000) break;
      const lastT = parseFloat(seg[seg.length - 1].time) * 1000;
      if (lastT >= toMs) break;
      from = Math.floor(lastT / 1000) + 1;
    } catch (err) {
      attempt++;
      if (attempt > 4) throw err;
      await sleep(1000 * attempt);
    }
  }
  const f = candlesToFSet(all);
  saveFSet(f, file);
  return f;
}

// ----------------------------------------------------------------------------
// windows
// ----------------------------------------------------------------------------
function fillWindow(buf: Candle[], f: FSet, endIdx: number, cnt: number): Candle[] {
  const from = Math.max(0, endIdx - cnt + 1);
  let len = 0;
  for (let i = from; i <= endIdx; i++, len++) {
    buf[len].time = String(f.t[i]);
    buf[len].complete = true;
    buf[len].open = f.o[i];
    buf[len].high = f.h[i];
    buf[len].low = f.l[i];
    buf[len].close = f.c[i];
    buf[len].volume = 0;
  }
  return buf.slice(0, len);
}

function emptyCandle(): Candle {
  return { time: "", complete: true, open: 0, high: 0, low: 0, close: 0, volume: 0 };
}

// ----------------------------------------------------------------------------
// trade / position bookkeeping
// ----------------------------------------------------------------------------
interface Book {
  riskAmount: number;
  riskHalf: number;
  fullLots: number;
  lots: number; // remaining position size
  phase: "tp1" | "be";
  realizedA: number;
  strategy: string;
  r1: number; // per-trade TP1 multiple (structural or default)
  r2: number; // per-trade TP2 multiple (structural or default)
}

interface TradeRec {
  symbol: string;
  direction: string;
  strategy: string;
  note?: string;
  openedAt: string;
  exitTime: string;
  entry: number;
  exit: number;
  stopPips: number;
  tp1Pips: number;
  tp2Pips: number;
  realizedPips: number;
  outcome: string;
  lots: number;
  riskAmount: number;
  grossPnl: number;
  spreadCost: number;
  netPnl: number;
  resultR: number;
  holdHours: number;
}

function uid(pos: OpenPosition) {
  return `${pos.symbol}|${pos.openedAt}`;
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
function setPath(obj: unknown, dotted: string, raw: string) {
  const parts = dotted.split(".");
  let o = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] as Record<string, unknown>;
  const last = parts[parts.length - 1];
  const v: unknown =
    /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw)
    : raw === "true" ? true
    : raw === "false" ? false
    : raw.includes(",") ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : raw;
  o[last] = v;
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const fresh = args.includes("--fresh");
  const yearsArg = args.find((a) => a.startsWith("--years="));
  const years = yearsArg ? Math.max(1, Math.min(10, parseInt(yearsArg.split("=")[1], 10) || 5)) : 5;
  const pairsArg = args.find((a) => a.startsWith("--pairs="));
  const wanted = pairsArg
    ? new Set(pairsArg.split("=")[1].split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))
    : null;
  const watchlist = wanted ? WATCHLIST.filter((w) => wanted.has(w.symbol)) : WATCHLIST;
  const endArg = args.find((a) => a.startsWith("--end="));
  const startArg = args.find((a) => a.startsWith("--start="));
  const equityArg = args.find((a) => a.startsWith("--equity="));
  if (equityArg) INITIAL_EQUITY = Math.max(10, parseInt(equityArg.split("=")[1], 10) || INITIAL_EQUITY);
  const endMs = endArg ? Date.parse(endArg.split("=")[1] + "T00:00:00Z") : Date.now();
  const startMs = startArg
    ? Date.parse(startArg.split("=")[1] + "T00:00:00Z")
    : endMs - years * 365.2425 * 24 * 3600 * 1000;
  const tagArg = args.find((a) => a.startsWith("--tag="));
  const TAG = tagArg ? tagArg.split("=")[1].replace(/[^\w.-]/g, "_") : null;
  const SUMMARY = args.includes("--summary");

  const client = new OandaClient();
  if (!client.isConfigured) {
    console.error("OANDA not configured — set OANDA_API_TOKEN + OANDA_ACCOUNT_ID (see .env.local / README).");
    process.exit(1);
  }

  const cfg = DEFAULT_CONFIG as StrategyConfig;
  for (const a of args) {
    if (a.startsWith("--k.")) {
      const eq = a.indexOf("=");
      const p = a.slice(4, eq > 0 ? eq : a.length);
      const v = eq > 0 ? a.slice(eq + 1) : "";
      setPath(cfg, p, v);
    }
  }
  const stratArg = args.find((a) => a.startsWith("--strategies="));
  if (stratArg) {
    const allow = new Set(["continuation", "breakout", "bounce", "reversal"]);
    const sel = stratArg.split("=")[1].split(",").map((s) => s.trim().toLowerCase()).filter((s) => allow.has(s));
    cfg.setup.enabledStrategies = sel.length ? (sel as StrategyKind[]) : cfg.setup.enabledStrategies;
  }
  const fetchFrom = startMs - WARMUP_DAYS * 24 * 3600 * 1000;

  console.log(`\n=== ${years}Y BACKTEST | $${INITIAL_EQUITY} prop account | ${new Date(startMs).toISOString().slice(0, 10)} → ${new Date(endMs).toISOString().slice(0, 10)} ===`);
  console.log(`watchlist: ${watchlist.map((w) => w.symbol).join(", ")}`);

  // ---- 1) fetch + cache all candle history --------------------------------
  const datas: Array<{
    inst: InstrumentConfig;
    h1: FSet; m15: FSet; m5: FSet;
    pH1: number; pM15: number; pM5: number;
    bufH1: Candle[]; bufM15: Candle[]; bufM5: Candle[];
  }> = [];
  for (const inst of watchlist) {
    process.stdout.write(`  fetching ${inst.oandaInstrument} ...`);
    const [h1, m15, m5] = await Promise.all([
      fetchSeries(client, inst.oandaInstrument, "H1", fetchFrom, endMs, fresh),
      fetchSeries(client, inst.oandaInstrument, "M15", fetchFrom, endMs, fresh),
      fetchSeries(client, inst.oandaInstrument, "M5", fetchFrom, endMs, fresh),
    ]);
    console.log(` H1=${h1.n} M15=${m15.n} M5=${m5.n}`);
    if (h1.n < 260 || m15.n < 100 || m5.n < 100) {
      console.warn(`   insufficient history (${inst.oandaInstrument}) — skipping pair`);
      continue;
    }
    datas.push({
      inst, h1, m15, m5,
      pH1: -1, pM15: -1, pM5: -1,
      bufH1: Array.from({ length: WIN.H1 }, emptyCandle),
      bufM15: Array.from({ length: WIN.M15 }, emptyCandle),
      bufM5: Array.from({ length: WIN.M5 }, emptyCandle),
    });
  }
  if (datas.length === 0) {
    console.error("no instruments with usable history");
    process.exit(1);
  }

  // ---- 2) global M5 timeline ----------------------------------------------
  // entries evaluate at M15 closes; exits resolve on the finer M5 grid so
  // single-bar range doesn't dominate SL vs TP outcomes
  const gridSet = new Set<number>();
  for (const d of datas) {
    const n = d.m5.n;
    for (let i = 0; i < n; i++) {
      const tt = d.m5.t[i];
      if (tt >= startMs && tt <= endMs) gridSet.add(tt);
    }
  }
  const grid = Array.from(gridSet).sort((a, b) => a - b);
  console.log(`  M5 bars in window: ${grid.length}; instruments: ${datas.length}`);

  // ---- 3) state -----------------------------------------------------------
  const state: EngineState = initialState(INITIAL_EQUITY);
  const books = new Map<string, Book>();
  const trades: TradeRec[] = [];
  const rejectionCounts = new Map<string, number>();
  const curve: Array<[number, number]> = [];
  const instBySymbol = new Map(datas.map((d) => [d.inst.symbol, d]));

  let curDayKey = "";
  let dayStartBal = INITIAL_EQUITY;
  let runActive = true;
  let blown = false;
  let blownAt = 0;
  let blownReason = "";
  let peakEquity = INITIAL_EQUITY;
  let passed = false;

  let ratesCache: RateMap = {};
  function buildRates() {
    const rates: RateMap = {};
    for (const d of datas) {
      const idx = d.pM15 >= 0 ? d.pM15 : 0;
      rates[d.inst.oandaInstrument] = d.m15.c[idx];
    }
    return rates;
  }

  function pipValueFor(symbol: string): number {
    const d = instBySymbol.get(symbol);
    if (!d) return 10;
    const pv = pipValuePerLot(d.inst, ratesCache);
    return isFinite(pv) && pv > 0 ? pv : 10;
  }

  function settle(pos: OpenPosition, b: Book, gross: number, outcome: string, t: number, barClose: number) {
    const pv = pipValueFor(pos.symbol);
    const spreadPips = instBySymbol.get(pos.symbol)?.inst.typicalSpreadPips ?? 1;
    const cost = spreadPips * pv * b.lots;
    const net = gross - cost;
    const exitIso = new Date(t).toISOString();
    const openedMs = new Date(pos.openedAt).getTime();

    state.equity += net;
    if (state.equity > peakEquity) peakEquity = state.equity;

    // engine -3% daily stop
    if (state.equity <= dayStartBal * (1 - cfg.risk.dailyLossLimitPct)) {
      state.dailyLossHit = true;
    }
    if (net < 0) {
      state.consecutiveLosses += 1;
      if (state.consecutiveLosses >= cfg.risk.maxConsecutiveLosses) state.circuitBreaker = true;
    } else {
      state.consecutiveLosses = 0;
    }

    const pip = PIP_SIZE[pos.symbol.replace("/", "_")] ?? 0.0001;
    const stopPips = Math.abs(pos.entry - pos.sl) / pip;
    const long = pos.direction === "long";
    trades.push({
      symbol: pos.symbol,
      direction: pos.direction,
      strategy: b.strategy,
      note: pos.note,
      openedAt: pos.openedAt,
      exitTime: exitIso,
      entry: pos.entry,
      exit: barClose,
      stopPips: +stopPips.toFixed(1),
      tp1Pips: +((long ? pos.tp1 - pos.entry : pos.entry - pos.tp1) / pip).toFixed(1),
      tp2Pips: +((long ? pos.tp2 - pos.entry : pos.entry - pos.tp2) / pip).toFixed(1),
      realizedPips: +(net / b.riskAmount * stopPips).toFixed(1),
      outcome,
      lots: b.lots,
      riskAmount: b.riskAmount,
      grossPnl: gross,
      spreadCost: cost,
      netPnl: net,
      resultR: net / b.riskAmount,
      holdHours: (t - openedMs) / 3600000,
    });
    state.openPositions = state.openPositions.filter((p) => p !== pos);
    books.delete(uid(pos));

    // prop hard stops
    const dayPnl = state.equity - dayStartBal;
    if (dayPnl <= -PROP_DAILY_LOSS_PCT * dayStartBal) {
      blown = true; blownAt = t;
      blownReason = `daily loss ${dayPnl.toFixed(0)} = ${(100 * dayPnl / dayStartBal).toFixed(2)}% ≤ -${PROP_DAILY_LOSS_PCT * 100}% of day-start $${dayStartBal.toFixed(0)}`;
    } else if (state.equity <= INITIAL_EQUITY * (1 - PROP_MAX_DD_PCT)) {
      blown = true; blownAt = t;
      blownReason = `equity $${state.equity.toFixed(0)} ≤ -${PROP_MAX_DD_PCT * 100}% from initial $${INITIAL_EQUITY}`;
    } else if (state.equity >= INITIAL_EQUITY * PROP_PASS_MULT) {
      passed = true;
    }
    if (blown) runActive = false;
  }

  function handleExits(d: (typeof datas)[number], t: number) {
    const pos = state.openPositions.find((p) => p.symbol === d.inst.symbol);
    if (!pos) return;
    if (new Date(pos.openedAt).getTime() >= t) return; // never exit on the entry bar itself
    const b = books.get(uid(pos));
    if (!b) return;
    const H = d.m5.h[d.pM5];
    const L = d.m5.l[d.pM5];
    const barClose = d.m5.c[d.pM5];
    const long = pos.direction === "long";

    if (b.phase === "tp1") {
      const slHit = long ? L <= pos.sl : H >= pos.sl;
      const tp1Hit = long ? H >= pos.tp1 : L <= pos.tp1;
      if (slHit) {
        settle(pos, b, -b.riskAmount, "sl", t, barClose);
      } else if (tp1Hit) {
        b.phase = "be";
        b.realizedA = b.riskHalf * b.r1;
        b.lots = b.fullLots / 2;
      }
    } else {
      const beHit = long ? L <= pos.entry : H >= pos.entry;
      const tp2Hit = long ? H >= pos.tp2 : L <= pos.tp2;
      if (beHit) {
        settle(pos, b, b.realizedA, "tp1-be", t, barClose);
      } else if (tp2Hit) {
        settle(pos, b, b.realizedA + b.riskHalf * b.r2, "tp2", t, barClose);
      }
    }
  }

  function handleEntry(d: (typeof datas)[number], t: number) {
    const data: PairData = {
      h1: fillWindow(d.bufH1, d.h1, d.pH1, WIN.H1),
      m15: fillWindow(d.bufM15, d.m15, d.pM15, WIN.M15),
      m5: fillWindow(d.bufM5, d.m5, d.pM5, WIN.M5),
      price: d.m15.c[d.pM15],
      spreadPips: d.inst.typicalSpreadPips,
      rates: ratesCache,
    };
    const ctx = analyzePair(d.inst, data, cfg, new Date(t), state, []);
    for (const r of ctx.rejected) {
      const gate = r.startsWith("[") ? r.slice(1, r.indexOf("]")) : r;
      rejectionCounts.set(gate, (rejectionCounts.get(gate) ?? 0) + 1);
    }
    if (!ctx.signal) return;
    const sig = ctx.signal;
    const pos: OpenPosition = {
      symbol: d.inst.symbol,
      direction: sig.direction,
      entry: sig.entry,
      sl: sig.sl,
      tp1: sig.tp1,
      tp2: sig.tp2,
      lots: sig.lots,
      openedAt: new Date(t).toISOString(),
      note: sig.confidenceNotes || undefined,
    };
    state.openPositions.push(pos);
    state.signalsCount += 1;
    // mirror applySignalToState so engine-internal caps (e.g. reversal/day) see the signal
    state.logs = [
      {
        time: new Date(t).toISOString(),
        symbol: d.inst.symbol,
        kind: "signal" as const,
        strategy: sig.strategy,
        reason: `${sig.direction.toUpperCase()} ${sig.symbol} ${sig.strategy} @ ${sig.entry} SL ${sig.sl}`,
      },
      ...state.logs,
    ].slice(0, 2000);
    books.set(uid(pos), {
      riskAmount: sig.riskAmount,
      riskHalf: sig.riskAmount / 2,
      fullLots: sig.lots,
      lots: sig.lots,
      phase: "tp1",
      realizedA: 0,
      strategy: sig.strategy,
      r1: sig.tp1R ?? cfg.risk.tp1R,
      r2: sig.tp2R ?? cfg.risk.tp2R,
    });
  }

  // ---- 4) run the timeline ------------------------------------------------
  let lastLog = 0;
  for (let k = 0; k < grid.length && runActive; k++) {
    const t = grid[k];
    // day rollover -> reset daily engine state
    const dk = new Date(t).toISOString().slice(0, 10);
    if (dk !== curDayKey) {
      curDayKey = dk;
      dayStartBal = state.equity;
      state.dailyLossHit = false;
      state.signalsCount = 0;
      // breaker pauses until next session — approximated by reset at next day
      state.consecutiveLosses = 0;
      state.circuitBreaker = false;
    }
    // advance pointers
    for (const d of datas) {
      while (d.pH1 + 1 < d.h1.n && d.h1.t[d.pH1 + 1] <= t) d.pH1++;
      while (d.pM15 + 1 < d.m15.n && d.m15.t[d.pM15 + 1] <= t) d.pM15++;
      while (d.pM5 + 1 < d.m5.n && d.m5.t[d.pM5 + 1] <= t) d.pM5++;
    }
    ratesCache = buildRates();
    // exits resolve on M5 closes; entries evaluate on M15 closes
    for (const d of datas) if (d.pM5 >= 0 && d.m5.t[d.pM5] === t) handleExits(d, t);
    for (const d of datas) if (d.pM15 >= 0 && d.m15.t[d.pM15] === t) handleEntry(d, t);

    // day-trading rule: force-flat once the NY-close cutoff is reached (21:00 GMT)
    if (eodCloseDue(new Date(t), cfg)) {
      for (const pos of [...state.openPositions]) {
        const d = instBySymbol.get(pos.symbol);
        const b = d && books.get(uid(pos));
        if (!d || !b) continue;
        const closePx = d.m5.c[d.pM5];
        const stopDist = Math.abs(pos.entry - pos.sl);
        if (stopDist === 0) { settle(pos, b, b.realizedA, "eod", t, closePx); continue; }
        const move = pos.direction === "long" ? closePx - pos.entry : pos.entry - closePx;
        const basis = b.phase === "be" ? b.riskHalf : b.riskAmount;
        settle(pos, b, b.realizedA + (move / stopDist) * basis, "eod", t, closePx);
      }
    }
    curve.push([t, state.equity]);

    if (k - lastLog >= 25000) {
      lastLog = k;
      console.log(`  [${(100 * k / grid.length).toFixed(1).padStart(5)}%] bar ${k}/${grid.length}  open=${state.openPositions.length} closed=${trades.length} equity=$${state.equity.toFixed(0)}`);
    }
  }

  const stillOpen = state.openPositions.map((pos) => `${pos.symbol}@${pos.openedAt.slice(0, 16)}`);

  // ---- 5) report ----------------------------------------------------------
  const pickup = trades;
  const net = state.equity - INITIAL_EQUITY;
  const winners = pickup.filter((t) => t.resultR > 0);
  const losers = pickup.filter((t) => t.resultR < 0);
  const winRate = pickup.length ? winners.length / pickup.length : 0;
  const avgR = pickup.length ? pickup.reduce((a, t) => a + t.resultR, 0) / pickup.length : 0;
  const totalR = pickup.reduce((a, t) => a + t.resultR, 0);
  const grossWin = winners.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + t.netPnl, 0));

  let peak = INITIAL_EQUITY;
  let maxDD = 0;
  for (const [, e] of curve) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  let lowWater = INITIAL_EQUITY;
  for (const [, e] of curve) if (e < lowWater) lowWater = e;

  const dayPnlMap = new Map<string, number>();
  for (const tr of pickup) {
    const dk = tr.exitTime.slice(0, 10);
    dayPnlMap.set(dk, (dayPnlMap.get(dk) ?? 0) + tr.netPnl);
  }
  const dayPnls = [...dayPnlMap.values()];
  const worstDay = dayPnls.length ? Math.min(...dayPnls) : 0;
  const bestDay = dayPnls.length ? Math.max(...dayPnls) : 0;

  const agg = (key: (tr: TradeRec) => string) => {
    const m = new Map<string, { n: number; r: number; pnl: number }>();
    for (const tr of pickup) {
      const e = m.get(key(tr)) ?? { n: 0, r: 0, pnl: 0 };
      e.n++; e.r += tr.resultR; e.pnl += tr.netPnl;
      m.set(key(tr), e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => {
      const sub = pickup.filter((tr) => key(tr) === k);
      const w = sub.filter((tr) => tr.resultR > 0).length;
      return { k, n: v.n, r: v.r, pnl: v.pnl, winpct: sub.length ? (100 * w / sub.length) : 0 };
    });
  };
  const table = (title: string, rows: Array<{ k: string; n: number; r: number; pnl: number; winpct: number }>) => {
    const body = rows.map((x) => `| ${x.k} | ${x.n} | ${x.r.toFixed(1)} | ${x.pnl >= 0 ? "+" : ""}$${x.pnl.toFixed(0)} | ${(x.n ? x.r / x.n : 0).toFixed(2)} | ${x.winpct.toFixed(0)}% |`).join("\n");
    return `## ${title}\n\n| group | # | net R | net \$ | R/trade | win% |\n| --- | --- | --- | --- | --- | --- |\n${body}\n`;
  };

  const md = [
    `# Backtest report - ${startArg || endArg ? `${new Date(startMs).toISOString().slice(0, 10)} → ${new Date(endMs).toISOString().slice(0, 10)}` : `${years}Y`} | $${INITIAL_EQUITY} prop account`,
    ``,
    `- **Window:** ${new Date(curve[0]?.[0] ?? startMs).toISOString().slice(0, 10)} → ${new Date(curve[curve.length - 1]?.[0] ?? endMs).toISOString().slice(0, 10)} (${years} years, ${grid.length} M5 bars)`,
    `- **Instruments:** ${datas.map((d) => d.inst.symbol).join(", ")}`,
    `- **Initial equity:** $${INITIAL_EQUITY} | risk 1% = $${(INITIAL_EQUITY * cfg.risk.riskPerTradePct).toFixed(0)}/trade`,
    `- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, ${cfg.risk.maxSignalsPerDay} signals/day, -${cfg.risk.dailyLossLimitPct * 100}% engine day stop, 2-SL breaker, 1 pos/pair, max ${cfg.risk.maxPositions} concurrent, correlation (gold = USD bucket).`,
    `- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.`,
    `- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.`,
    `- **Day-trading rule:** ${cfg.risk.closeAtSessionEnd ? `positions force-flat at ${(cfg.risk.sessionCloseMinutes / 60).toFixed(0)}:00 GMT (end of NY) — no overnight/weekend holds` : "positions may be held overnight"}`,
    ``,
    blown ? `## ⛔ ACCOUNT BLOWN` : passed ? `## ✅ ACCOUNT DOUBLED (${PROP_PASS_MULT * 100}% target)` : `## ✅ SURVIVED FULL WINDOW`,
    blown ? `- **Date:** ${new Date(blownAt).toISOString()}\n- **Reason:** ${blownReason}` : ``,
    ``,
    `## Headline`,
    ``,
    `| metric | value |`,
    `| --- | --- |`,
    `| final equity | $${state.equity.toFixed(2)} |`,
    `| net P&L | ${net >= 0 ? "+" : ""}$${net.toFixed(2)} (${(100 * net / INITIAL_EQUITY).toFixed(2)}%) |`,
    `| closed trades | ${pickup.length} |`,
    `| open at end | ${stillOpen.length === 0 ? "-" : stillOpen.join(", ")} |`,
    `| win rate | ${(100 * winRate).toFixed(2)}% (${winners.length}W/${losers.length}L) |`,
    `| avg R | ${avgR.toFixed(2)} |`,
    `| total R | ${totalR.toFixed(2)} |`,
    `| profit factor | ${grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "∞"} |`,
    `| expectancy / trade | $${(pickup.length ? net / pickup.length : 0).toFixed(2)} |`,
    `| max drawdown (peak) | ${(100 * maxDD).toFixed(2)}% |`,
    `| max drawdown vs initial | ${(100 * (INITIAL_EQUITY - lowWater) / INITIAL_EQUITY).toFixed(2)}% |`,
    `| best day | ${bestDay >= 0 ? "+" : ""}$${bestDay.toFixed(0)} |`,
    `| worst day | ${worstDay >= 0 ? "+" : ""}$${worstDay.toFixed(0)} |`,
    `| avg hold | ${(pickup.length ? pickup.reduce((a, t) => a + t.holdHours, 0) / pickup.length : 0).toFixed(1)}h |`,
    ``,
    table("By symbol", agg((tr) => tr.symbol)),
    table("By outcome", agg((tr) => tr.outcome)),
    table("By strategy", agg((tr) => tr.strategy)),
    table("By year", agg((tr) => tr.exitTime.slice(0, 4))),
    `## Gate hit counts`,
    ``,
    `| gate | rejections |`,
    `| --- | --- |`,
    ...[...rejectionCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `*Generated ${new Date().toISOString()} — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*`,
    ``,
  ].join("\n");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = (TAG ? TAG + "~" : "") + new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(OUT_DIR, `backtest-${stamp}.md`), md);
  fs.writeFileSync(path.join(OUT_DIR, `backtest-${stamp}.csv`), "t_ms,equity\n" + curve.map(([t, e]) => `${t},${e.toFixed(2)}`).join("\n"));
  fs.writeFileSync(path.join(OUT_DIR, `backtest-${stamp}.json`), JSON.stringify(pickup, null, 2));

  if (SUMMARY) {
    const net = state.equity - INITIAL_EQUITY;
    const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
    console.log(
      `RESULT ${TAG ?? "run"} | equity=$${state.equity.toFixed(0)} netPct=${(100 * net / INITIAL_EQUITY).toFixed(1)} trades=${trades.length} win=${(100 * winRate).toFixed(1)} totalR=${totalR.toFixed(1)} pf=${pf.toFixed(2)} ddInit=${(100 * (INITIAL_EQUITY - lowWater) / INITIAL_EQUITY).toFixed(2)} ddPeak=${(100 * maxDD).toFixed(2)}`,
    );
  }

  if (TAG || SUMMARY) {
    console.log(`report : data/backtest/backtest-${stamp}.md`);
    return;
  }

  console.log(md.split("\n").filter((l) => l.startsWith("##") || l.startsWith("|")).join("\n"));
  console.log(`\nreport : data/backtest/backtest-${stamp}.md`);
  console.log(`equity  : data/backtest/backtest-${stamp}.csv`);
}

void main().catch((e) => {
  console.error("backtest failed:", e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});