/**
 * PAPER FORWARD-TRADER — real-market forward test (practice account only)
 *
 * Executes the exact engine (src/lib/engine.ts analyzePair) LIVE and places REAL
 * orders on the OANDA PRACTICE account so every fill is real: live spreads,
 * top-of-book latency, broker SL, partial TP1 close, BE, TP2, session-end flatten.
 *
 * Account model: VIRTUAL $500 (default). Sizing uses the virtual equity through the
 * engine's computeSize, so the stats match a real $500 account plan. Actual order
 * sizes are the engine lots (0.01-0.1) — tiny on a demo account, harmless.
 *
 * SAFETY: defaults to refuse running against a live OANDA_ENVIRONMENT.
 *          Only engine-enabled FX+gold watchlist pairs are traded. No take-profit
 *          is sent on fill — TP1/TP2 and break-even are managed by this loop; a
 *          hard SL is attached on fill as catastrophic protection.
 *
 * Usage:
 *   npx tsx scripts/paper-trader.ts                # loop, virtual $500
 *   npx tsx scripts/paper-trader.ts --equity=1000  # different starting virtual equity
 *   npx tsx scripts/paper-trader.ts --interval=90  # poll seconds (default 60)
 *   npx tsx scripts/paper-trader.ts --once         # single scan, no loop
 *   npx tsx scripts/paper-trader.ts --clean        # flatten all open broker positions at start
 *   npx tsx scripts/paper-trader.ts --allow-live   # UNSAFE: permits live env (not recommended)
 *   npx tsx scripts/paper-trader.ts --live --once  # LIVE-MONEY execution (see ARMING below)
 *   npx tsx scripts/paper-trader.ts --live --check # live read-only self-test (no orders)
 *
 * LIVE-MONEY MODE (--live):
 *   Requires OANDA_ENVIRONMENT=live AND OANDA_LIVE_ARM=true in .env.local (two independent
 *   switches: live endpoint + explicit arming). Without OANDA_LIVE_ARM the loop runs DRY
 *   (scans real live prices/account, prints every intended order, places nothing).
 *   - Equity = REAL account NAV (live), sized by the same risk %; day-stop uses real NAV.
 *   - TP1 closes half via market order, remainder gets broker SL→BE + take-profit at TP2.
 *   - Every loop-managed exit (TP2/BE/EOD/orb-flatten/time-stop) is hard-closed at the
 *     broker with a real order and real fill price; broker SLs are reconciled by trade id.
 *   - Data written under data/live/ (data/paper/ untouched for the practice harness).
 *
 * ARMING (each step is deliberate):
 *   1. Fund the live OANDA account with money you accept losing.
 *   2. Put OANDA_ENVIRONMENT=live + live OANDA_API_TOKEN + live OANDA_ACCOUNT_ID in .env.local.
 *   3. Run --live --check once and confirm the printed account is the RIGHT one.
 *   4. Set OANDA_LIVE_ARM=true, restart with --live. Confirmed by the LIVE banner on start.
 *
 * Output (all under data/paper/):
 *   state.json       engine state (gates, sizing equity)
 *   ledger.json      open trades managed by the loop
 *   account.json     virtual account (day start, realized, sl count)
 *   trades.jsonl     append-only closed-trade log (every real fill)
 *   curve.csv        virtual equity curve (t_ms,equity)
 */
import fs from "node:fs";
import path from "node:path";
import { OandaClient, unitsPerLot } from "../src/lib/oanda";
import { INSTRUMENTS, WATCHLIST, DEFAULT_CONFIG, type InstrumentConfig } from "../src/lib/config";
import { SYSTEMS, enabledSymbols, type SystemSpec } from "../src/lib/systems";
import {
  runScanPipeline,
  initialState,
  dayKeyNow,
  eodCloseDue,
  applySignalToState,
  pipValuePerLot,
  type EngineState,
  type PairContext,
} from "../src/lib/engine";
import { analyzeSwing, swingLots, type SwingContextInput } from "../src/lib/swing";
import { sendTelegramMessage } from "../src/lib/telegram";

// ---------------------------------------------------------------------------
// CLI / env
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const args = process.argv.slice(2);
const readNum = (flag: string, dflt: number) => {
  const a = args.find((x) => x.startsWith(`--${flag}=`));
  const v = a ? parseFloat(a.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : dflt;
};
const VIRTUAL_EQUITY = readNum("equity", 500);
const INTERVAL_SEC = Math.round(readNum("interval", 60));
const ONCE = args.includes("--once");
const ORB_ON = !args.includes("--no-orb"); // System 2 = ORB, independent strategy, separate 1% risk slice
const ALLOW_LIVE = args.includes("--allow-live");
const LIVE = args.includes("--live");
const CHECK_ONLY = args.includes("--check");

const env = (process.env.OANDA_ENVIRONMENT || "practice").toLowerCase();
const LIVE_ARM = LIVE && process.env.OANDA_LIVE_ARM === "true";
let DRY = LIVE && !LIVE_ARM; // live mode is dry until explicitly armed
if (LIVE) {
  if (env !== "live") {
    console.error(
      `Refusing --live: OANDA_ENVIRONMENT="${env}". Live money requires OANDA_ENVIRONMENT=live\n` +
        `(live API token + account id in .env.local). Practice creds never touch the live endpoint.`
    );
    process.exit(1);
  }
} else if (env !== "practice" && !ALLOW_LIVE) {
  console.error(
    `Refusing to run: OANDA_ENVIRONMENT="${env}". This script is for PRACTICE forward-testing only.\n` +
      `If you fully understand the risk, rerun with --allow-live.`
  );
  process.exit(1);
}
const MODE_TAG = LIVE ? "LIVE" : "PAPER";

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "..", "data", LIVE ? "live" : "paper");
fs.mkdirSync(DATA_DIR, { recursive: true });

const persist = (file: string, data: unknown) => {
  try {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
  } catch {
    /* disk/perm issue — best-effort */
  }
};
function load<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
  } catch {
    return undefined;
  }
}

interface PaperTrade {
  symbol: string;
  instrument: string;
  direction: "long" | "short";
  strategy: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  units: number;
  unitsOpen: number;
  state: "open" | "be";
  openedAt: string;
  exitedAt?: string;
  outcome?: "tp1-be" | "tp2" | "sl" | "be" | "eod" | "timeStop" | "manual";
  note?: string;
  holdDays?: number; // SYS3 swing time-stop (days); exempt from EOD flatten
  tradeId?: string; // OANDA trade id once identified (live-mode closing + reconcile)
}

interface VAccount {
  dayKey: string;
  dayStartEquity: number;
  realized: number;
  slCountToday: number;
}

const client = new OandaClient();
if (!client.isConfigured) {
  console.error("OANDA not configured — set OANDA_API_TOKEN + OANDA_ACCOUNT_ID in .env.local");
  process.exit(1);
}
let liveNav: number | null = null; // real account NAV, refreshed once per tick (live mode)
const minUnitsCache = new Map<string, number>();
async function minUnits(instrument: string): Promise<number> {
  const hit = minUnitsCache.get(instrument);
  if (hit !== undefined) return hit;
  try {
    const meta = await client.getInstrumentMeta(instrument);
    const lo = parseFloat(meta?.minimumTradeSize ?? "0");
    const v = isFinite(lo) && lo > 0 ? lo : 0;
    minUnitsCache.set(instrument, v);
    return v;
  } catch {
    return 0; // metadata fetch failed → do not gate on unit size
  }
}
const cfg = DEFAULT_CONFIG;
const watchlist = WATCHLIST.filter((i) => i.enabled && i.type !== "index");
const sysById = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
const intradaySystems = SYSTEMS.filter((s) => s.kind === "intraday");
const swingSystem = sysById["sys3"];
const MAX_TOTAL_OPEN = 8; // 5 systems share one account — cap concurrent positions for margin sanity

interface OrbDay {
  dayKey: string;
  ranges: Record<string, { hi: number; lo: number; n: number }>;
  entered: Record<string, boolean>;
}
interface OrbSessionSpec {
  rangeStart: number; // UTC minute of the ORB window open
  rangeEnd: number; // UTC minute the range closes
  tradeUntil: number; // UTC minute after which no new ORB entries
  flattenAt: number; // UTC minute ORB positions are force-flat
  rr: number; // reward:risk vs range width
  minRangeAtr: number; // skip day if range < this x M15-ATR(14)
}
// LOOSE (user mandate 2026-08): widened to the 3-FX pair set. Honest caveat in
// systems.ts evidence — multi-pair ORB backtest val is RED; single-pair was flat.
const ORB_SESSIONS: Record<string, OrbSessionSpec> = {
  "EUR/USD": { rangeStart: 13.5 * 60, rangeEnd: 14 * 60, tradeUntil: 17.5 * 60, flattenAt: 18 * 60, rr: 2, minRangeAtr: 0.3 },
  "GBP/USD": { rangeStart: 13.5 * 60, rangeEnd: 14 * 60, tradeUntil: 17.5 * 60, flattenAt: 18 * 60, rr: 2, minRangeAtr: 0.3 },
  "USD/JPY": { rangeStart: 13.5 * 60, rangeEnd: 14 * 60, tradeUntil: 17.5 * 60, flattenAt: 18 * 60, rr: 2, minRangeAtr: 0.3 },
};
const ORB_RISK_PCT = 0.01; // 1% risk slice at >= $1000 equity (min-position granularity kills it below ~$800)

// D1-EMA200 trend bias (recomputed once per UTC day per symbol, mirrored from backtest-orb)
const orbBiasCache = new Map<string, boolean>();
async function orbBiasOk(client: OandaClient, dayKey: string, symbol: string): Promise<boolean> {
  const key = `${dayKey}:${symbol}`;
  const hit = orbBiasCache.get(key);
  if (hit !== undefined) return hit;
  const inst = INSTRUMENTS.find((i) => i.symbol === symbol);
  let above = true;
  if (inst) {
    try {
      const candles = await client.getCandles(inst.oandaInstrument, "D", 230);
      const closes = candles.filter((c) => c.complete).map((c) => c.close);
      if (closes.length >= 201) {
        const end = closes.length - 1;
        const from = Math.max(0, end - 200 * 4);
        let e = closes[from];
        const k = 2 / (200 + 1);
        for (let i = from + 1; i <= end; i++) e = closes[i] * k + e * (1 - k);
        above = closes[end] > e;
      }
    } catch {
      /* network hiccup → allow */
    }
  }
  orbBiasCache.set(key, above);
  return above;
}

const orbPpu = (inst: InstrumentConfig, mid: number): number => {
  const pv = pipValuePerLot(inst, { [inst.oandaInstrument]: mid });
  const step = inst.type === "gold" ? 0.1 : 0.0001;
  return pv / step;
};

const dirSign = (t: PaperTrade) => (t.direction === "long" ? 1 : -1);
const tp1Hit = (t: PaperTrade, p: number) => (t.direction === "long" ? p >= t.tp1 : p <= t.tp1);
const tp2Hit = (t: PaperTrade, p: number) => (t.direction === "long" ? p >= t.tp2 : p <= t.tp2);
const beHit = (t: PaperTrade, p: number) => (t.direction === "long" ? p <= t.entry : p >= t.entry);
const pl = (t: PaperTrade, p: number, units: number) => (p - t.entry) * units * dirSign(t);

function virtualEquity(acc: VAccount): number {
  if (LIVE) return liveNav ?? VIRTUAL_EQUITY + acc.realized;
  return VIRTUAL_EQUITY + acc.realized;
}

async function notify(text: string) {
  try {
    await sendTelegramMessage(text);
  } catch {
    /* Telegram optional */
  }
}

// live-mode: close a managed trade with a REAL broker order (only the trade's own units).
// DRY returns null immediately (no order). Armed-failure returns null after logging.
async function hardClose(t: PaperTrade): Promise<string | null> {
  if (DRY) return null;
  try {
    if (t.tradeId) {
      const res = await client.closeTrade(t.tradeId);
      return res.orderFillTransaction?.price ?? null;
    }
    await client.closePosition(t.instrument);
    return null;
  } catch (err) {
    console.log(`[close-fail] ${t.symbol} #${t.tradeId || "?"}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// live-mode: identify the OANDA trade id of a fresh fill (direction + unit count match).
async function tagTrade(t: PaperTrade): Promise<void> {
  if (!LIVE || DRY) return;
  try {
    const trades = await client.getOpenTrades();
    const want = Math.abs(t.units);
    const cand = trades.find(
      (x) =>
        x.instrument === t.instrument &&
        (t.direction === "long" ? parseFloat(x.currentUnits) > 0 : parseFloat(x.currentUnits) < 0)
    );
    if (cand) t.tradeId = cand.id;
  } catch {
    /* reconcile branch will recover the mapping */
  }
}

// engine gate state, rolled to today, synced to the virtual account variables
function buildState(acc: VAccount): EngineState {
  const equity = virtualEquity(acc);
  const base: EngineState = load<EngineState>("state.json") ?? initialState(equity);
  base.equity = equity;
  const dk = dayKeyNow();
  if (base.dayKey !== dk) {
    base.dayKey = dk;
    base.signalsCount = 0;
    base.consecutiveLosses = 0;
    base.circuitBreaker = false;
    base.dailyLossHit = false;
    acc.dayKey = dk;
    acc.dayStartEquity = equity;
    acc.slCountToday = 0;
  }
  // mirror the engine's circuit-breaker + daily-loss gates on the virtual account
  if (acc.slCountToday >= cfg.risk.maxConsecutiveLosses) base.circuitBreaker = true;
  if (equity < acc.dayStartEquity * (1 - cfg.risk.dailyLossLimitPct)) base.dailyLossHit = true;
  persist("state.json", base);
  return base;
}

// per-system engine state (own circuit/day-loss/signal-count gates so the 5 systems run independently)
function buildSysState(spec: SystemSpec, acc: VAccount): EngineState {
  const equity = virtualEquity(acc);
  const file = `state-${spec.id}.json`;
  const base: EngineState = load<EngineState>(file) ?? initialState(equity);
  base.equity = equity;
  const dk = dayKeyNow();
  if (base.dayKey !== dk) {
    base.dayKey = dk;
    base.signalsCount = 0;
    base.consecutiveLosses = 0;
    base.circuitBreaker = false;
    base.dailyLossHit = false;
  }
  const rc = spec.config!.risk;
  if (base.consecutiveLosses >= rc.maxConsecutiveLosses) base.circuitBreaker = true;
  if (equity < acc.dayStartEquity * (1 - rc.dailyLossLimitPct)) base.dailyLossHit = true;
  persist(file, base);
  return base;
}

interface Candidate {
  spec: SystemSpec;
  symbol: string;
  instrument: string;
  direction: "long" | "short";
  strategyLabel: string; // "continuation" | "orb" | "pullback" ...
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  units: number;
  holdDays?: number; // swing time-stop in days (SYS3)
}

// swing signals are evaluated every SWING_INTERVAL_SEC; they hold for days (no EOD flatten)
let lastSwing = 0;
const SWING_INTERVAL_SEC = 300;
function isSwing(t: PaperTrade): boolean {
  return t.strategy.startsWith("sys3");
}

async function tick(acc: VAccount): Promise<void> {
  const now = new Date();
  if (LIVE) {
    try {
      const sum = await client.getAccountSummary();
      const navVal = parseFloat(sum.NAV);
      liveNav = isFinite(navVal) && navVal > 0 ? navVal : liveNav;
    } catch (err) {
      console.log(`[nav-fail] ${err instanceof Error ? err.message : err}`);
    }
  }
  const state = buildState(acc);
  let ledger: PaperTrade[] = load<PaperTrade[]>("ledger.json") ?? [];

  // ---- SYSTEM entry flow: 5 independent strategies share one account ---------
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const openSymbols = new Set(ledger.map((t) => t.symbol));
  const candidates: Candidate[] = [];
  const accountClosed = state.circuitBreaker || state.dailyLossHit;

  if (!accountClosed) {
    // intraday systems (sys1/4/5): per-system engine gates + risk config
    const sysContexts: Record<string, PairContext[]> = {};
    for (const spec of intradaySystems) {
      const cfgSys = spec.config!;
      const s = buildSysState(spec, acc);
      if (s.circuitBreaker || s.dailyLossHit) {
        console.log(`[${spec.id}-gate] circuit=${s.circuitBreaker} dayloss=${s.dailyLossHit} — paused`);
        continue;
      }
      const insts = enabledSymbols(spec)
        .map((sym) => INSTRUMENTS.find((i) => i.symbol === sym))
        .filter((x): x is InstrumentConfig => !!x);
      let contexts: PairContext[] = [];
      try {
        const r = await runScanPipeline(client, insts, cfgSys, now, s, []);
        contexts = r.contexts;
      } catch (err) {
        console.log(`[${spec.id}-fail] ${err instanceof Error ? err.message : err}`);
        continue;
      }
      sysContexts[spec.id] = contexts;
      for (const ctx of contexts) {
        const sig = ctx.signal;
        if (!sig || openSymbols.has(sig.symbol)) continue;
        const inst = INSTRUMENTS.find((i) => i.symbol === sig.symbol);
        if (!inst) continue;
        const units = sig.lots > 0 ? Math.round(sig.lots * (inst.type === "gold" ? 100 : 100000)) : 0;
        if (units === 0) continue;
        candidates.push({
          spec, symbol: sig.symbol, instrument: inst.oandaInstrument,
          direction: sig.direction, strategyLabel: sig.strategy,
          entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, units,
        });
        applySignalToState(s, sig);
      }
    }

    // ORB (sys2): 30-min NY range break, USD/JPY only, D1-bias gate
    const orbSpec = sysById["sys2"];
    const orb = load<OrbDay>("orb.json") ?? { dayKey: "", ranges: {}, entered: {} };
    if (orb.dayKey !== state.dayKey) {
      orb.dayKey = state.dayKey;
      orb.ranges = {};
      orb.entered = {};
      orbBiasCache.clear();
    }
    if (ORB_ON) {
      for (const sym of Object.keys(ORB_SESSIONS)) {
        const ctx = sysContexts["sys1"]?.find((c) => c.symbol === sym);
        if (ctx) {
          const spec = ORB_SESSIONS[ctx.symbol];
          if (spec && !orb.entered[ctx.symbol] && !openSymbols.has(ctx.symbol)) {
            if (utcMin >= spec.rangeStart && utcMin < spec.rangeEnd) {
              const r = orb.ranges[ctx.symbol] ?? { hi: -Infinity, lo: Infinity, n: 0 };
              r.hi = Math.max(r.hi, ctx.price);
              r.lo = Math.min(r.lo, ctx.price);
              r.n += 1;
              orb.ranges[ctx.symbol] = r;
            } else if (utcMin >= spec.rangeEnd && utcMin < spec.tradeUntil) {
              const r = orb.ranges[ctx.symbol];
              if (r && r.n >= 2) {
                const width = r.hi - r.lo;
                const passFilter = width > 0 && !(ctx.m15Atr > 0 && width < spec.minRangeAtr * ctx.m15Atr);
                if (passFilter) {
                  const long = ctx.price > r.hi;
                  const short = ctx.price < r.lo;
                  if (long || short) {
                    const above = await orbBiasOk(client, state.dayKey, ctx.symbol);
                    if ((long && above) || (short && !above)) {
                      const entry = ctx.price;
                      const sl = long ? r.lo : r.hi;
                      const tp = entry + (long ? 1 : -1) * spec.rr * width;
                      const inst = INSTRUMENTS.find((i) => i.symbol === ctx.symbol);
                      if (inst) {
                        const ppu = orbPpu(inst, entry);
                        if (isFinite(ppu) && ppu > 0) {
                          const units = Math.max(0, Math.round((virtualEquity(acc) * ORB_RISK_PCT / (Math.abs(entry - sl) * ppu)) * unitsPerLot(inst.type) / 100) * 100);
                          if (units >= 100) candidates.push({ spec: orbSpec, symbol: ctx.symbol, instrument: inst.oandaInstrument, direction: long ? "long" : "short", strategyLabel: "orb", entry, sl, tp1: tp, tp2: tp, units });
                        }
                      }
                    }
                  }
                }
                orb.entered[ctx.symbol] = true;
              }
            }
          }
        }
      }
    }
    persist("orb.json", orb);

    // swing (sys3): H4/D1 trend pullback, evaluated every 5 min, holds days
    if (now.getTime() - lastSwing >= SWING_INTERVAL_SEC * 1000) {
      lastSwing = now.getTime();
      for (const sym of enabledSymbols(swingSystem)) {
        const inst = INSTRUMENTS.find((i) => i.symbol === sym);
        if (!inst || openSymbols.has(sym)) continue;
        try {
          const [d1, h4] = await Promise.all([
            client.getCandles(inst.oandaInstrument, "D", 300),
            client.getCandles(inst.oandaInstrument, "H4", 300),
          ]);
          const sctx: SwingContextInput = { d1: d1.filter((c) => c.complete), h4: h4.filter((c) => c.complete), inst };
          const { signal } = analyzeSwing(sctx, swingSystem.swingConfig!);
          if (!signal) continue;
          const { lots } = swingLots(inst, virtualEquity(acc), signal.entry, signal.sl, swingSystem.riskPct);
          const units = lots > 0 ? Math.round(lots * (inst.type === "gold" ? 100 : 100000)) : 0;
          if (units === 0) continue;
          candidates.push({ spec: swingSystem, symbol: sym, instrument: inst.oandaInstrument, direction: signal.direction, strategyLabel: "pullback", entry: signal.entry, sl: signal.sl, tp1: signal.tp1, tp2: signal.tp2, units, holdDays: swingSystem.swingConfig!.risk.timeStopDays });
        } catch (err) {
          console.log(`[sys3-fail] ${sym} ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  // ---- unified entry executor ----------------------------------------------
  for (const c of candidates) {
    if (ledger.length >= MAX_TOTAL_OPEN) {
      console.log(`[skip] ${c.symbol}: max ${MAX_TOTAL_OPEN} concurrent positions`);
      continue;
    }
    const inst = INSTRUMENTS.find((i) => i.oandaInstrument === c.instrument);
    if (!inst) continue;
    if (LIVE) {
      const mu = await minUnits(c.instrument);
      if (mu > 0 && Math.abs(c.units) < mu) {
        console.log(`[skip-min] ${c.symbol}: units ${c.units} < broker minimum ${mu} — sizing too small for live`);
        continue;
      }
    }
    if (DRY) {
      console.log(`[DRY-${c.spec.id}-entry] ${c.symbol} ${c.direction.toUpperCase()} ${c.strategyLabel} units=${c.units} @ ${c.entry} | SL ${c.sl} TP1 ${c.tp1}`);
      const t: PaperTrade = {
        symbol: c.symbol,
        instrument: c.instrument,
        direction: c.direction,
        strategy: `${c.spec.id}:${c.strategyLabel}`,
        entry: c.entry,
        sl: c.sl,
        tp1: c.tp1,
        tp2: c.tp2,
        units: c.units,
        unitsOpen: c.units,
        state: "open",
        openedAt: now.toISOString(),
        holdDays: c.holdDays,
      };
      ledger.push(t);
      continue;
    }
    try {
      await client.placeMarketOrder(c.instrument, c.direction === "long" ? c.units : -c.units, c.sl);
    } catch (err) {
      console.log(`[${c.spec.id}-order-fail] ${c.symbol}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const t: PaperTrade = {
      symbol: c.symbol,
      instrument: c.instrument,
      direction: c.direction,
      strategy: `${c.spec.id}:${c.strategyLabel}`,
      entry: c.entry,
      sl: c.sl,
      tp1: c.tp1,
      tp2: c.tp2,
      units: c.units,
      unitsOpen: c.units,
      state: "open",
      openedAt: now.toISOString(),
      holdDays: c.holdDays,
    };
    await tagTrade(t);
    ledger.push(t);
    persist("ledger.json", ledger);
    console.log(`[${c.spec.id}-entry] ${c.symbol} ${c.direction.toUpperCase()} ${c.strategyLabel} units=${c.units} @ ${c.entry} | SL ${c.sl} TP1 ${c.tp1}`);
    await notify(`LIVE ENTRY ${c.spec.id.toUpperCase()} · ${c.spec.name} ${c.symbol} ${c.direction.toUpperCase()} ${c.strategyLabel} units=${c.units} @ ${c.entry}\nSL ${c.sl} | TP1 ${c.tp1} | TP2 ${c.tp2}`);
  }

  // ---- 2) exit management ---------------------------------------------------
  const prices: Record<string, number> = {};
  try {
    const need = [...new Set(ledger.map((t) => t.instrument))];
    if (need.length) {
      const px = await client.getPrices(need);
      for (const p of px) {
        const bid = p.bids?.[0] ? parseFloat(p.bids[0].price) : 0;
        const ask = p.asks?.[0] ? parseFloat(p.asks[0].price) : 0;
        prices[p.instrument] = bid && ask ? (bid + ask) / 2 : 0;
      }
    }
  } catch {
    /* exit management best-effort */
  }
  const record = (t: PaperTrade, outcome: NonNullable<PaperTrade["outcome"]>, at: string, exitPrice: number, note: string) => {
    t.outcome = outcome;
    t.exitedAt = at;
    t.note = note;
    const realized = pl(t, exitPrice, t.unitsOpen);
    acc.realized += realized;
    if (outcome === "sl") acc.slCountToday += 1;
    else acc.slCountToday = 0;
    const sysId = t.strategy.split(":")[0];
    const spec = sysById[sysId];
    if (spec && spec.config) {
      const s = load<EngineState>(`state-${sysId}.json`);
      if (s) {
        s.equity = virtualEquity(acc);
        s.consecutiveLosses = outcome === "sl" ? s.consecutiveLosses + 1 : 0;
        persist(`state-${sysId}.json`, s);
      }
    }
    fs.appendFileSync(
      path.join(DATA_DIR, "trades.jsonl"),
      JSON.stringify({ ...t, exitPrice, realized, exitTime: at }) + "\n"
    );
    console.log(`[exit] ${t.symbol} ${outcome.toUpperCase()} @ ${exitPrice} | P&L ${realized.toFixed(2)} | virt ${virtualEquity(acc).toFixed(2)}`);
    void notify(`${MODE_TAG} ${t.symbol} ${outcome.toUpperCase()} exit @ ${exitPrice} | P&L ${realized.toFixed(2)} | virt ${virtualEquity(acc).toFixed(2)}`);
  };

  // loop-managed exit: hard-close at broker first (armed), then record on the REAL fill
  // price when reported. Returns false if the close failed → trade stays open & managed.
  const recordManaged = async (
    t: PaperTrade,
    outcome: NonNullable<PaperTrade["outcome"]>,
    at: string,
    p: number,
    note: string
  ): Promise<boolean> => {
    let price = p;
    let via = "@mid";
    if (!DRY) {
      const fill = await hardClose(t);
      if (fill === null) {
        console.log(`[keep-open] ${t.symbol} ${outcome} close failed — still managed`);
        return false;
      }
      price = Math.abs(parseFloat(fill)) > 0 ? parseFloat(fill) : p;
      via = "fill";
    }
    record(t, outcome, at, price, `${note}-${via}`);
    return true;
  };

  const closed: PaperTrade[] = [];
  for (const t of ledger) {
    const p = prices[t.instrument];
    if (!p || !isFinite(p)) continue;
    if (isSwing(t) && t.holdDays && (now.getTime() - new Date(t.openedAt).getTime()) / 86400000 >= t.holdDays) {
      if (await recordManaged(t, "timeStop", now.toISOString(), p, "swing-time-stop")) closed.push(t);
      continue;
    }
    if (t.strategy.endsWith("orb")) {
      if (t.direction === "long" ? p >= t.tp2 : p <= t.tp2) {
        if (await recordManaged(t, "tp2", now.toISOString(), p, "orb-target")) closed.push(t);
      } else if (slHit(t, p)) {
        closed.push(t);
        record(t, "sl", now.toISOString(), t.sl, "orb-SL");
      }
      continue;
    }
    if (t.state === "open") {
      if (tp1Hit(t, p)) {
        const half = Math.floor(t.unitsOpen / 2);
        try {
          if (!DRY) await client.placeMarketOrder(t.instrument, t.direction === "long" ? -half : half);
          // armed: park the remainder under broker SL→BE + TP2 so exits are gap-proof
          if (!DRY && LIVE && t.tradeId) {
            try {
              await client.modifyTrade(t.tradeId, t.entry, t.tp2);
            } catch (err) {
              console.log(`[be-park-fail] ${t.symbol}: ${err instanceof Error ? err.message : err}`);
            }
          }
        } catch (err) {
          console.log(`[tp1-fail] ${t.symbol}: ${err instanceof Error ? err.message : err}`);
          continue;
        }
        const filledPnl = pl(t, p, half);
        acc.realized += filledPnl;
        t.state = "be";
        t.unitsOpen -= half;
        t.note = "tp1-half";
        fs.appendFileSync(
          path.join(DATA_DIR, "trades.jsonl"),
          JSON.stringify({ ...t, exitPrice: p, realized: filledPnl, exitTime: now.toISOString(), outcome: "tp1-be", note: "tp1-half-fill" }) + "\n"
        );
        console.log(`[tp1] ${t.symbol} closed half @ ${p} (+${filledPnl.toFixed(2)}), BE ${t.entry} on ${t.unitsOpen}u`);
      } else if (slHit(t, p)) {
        closed.push(t);
        record(t, "sl", now.toISOString(), t.sl, "broker-SL");
      }
    } else if (t.state === "be") {
      if (tp2Hit(t, p)) {
        if (await recordManaged(t, "tp2", now.toISOString(), p, "tp2")) closed.push(t);
      } else if (beHit(t, p)) {
        if (await recordManaged(t, "be", now.toISOString(), p, "breakeven")) closed.push(t);
      }
    }
  }
  for (const c of closed) ledger.splice(ledger.indexOf(c), 1);

  // ---- 3) broker reconciliation (SL/TP fired earlier than our poll) --------------
  try {
    if (LIVE) {
      const openTrades = await client.getOpenTrades();
      const byId = new Map(openTrades.map((o) => [o.id, o]));
      const byInst = new Map(openTrades.map((o) => [o.instrument, o]));
      for (const t of [...ledger]) {
        if (t.tradeId && byId.has(t.tradeId)) continue;
        if (!t.tradeId) {
          const b = byInst.get(t.instrument);
          if (b) {
            const dirOk = t.direction === "long" ? parseFloat(b.currentUnits) > 0 : parseFloat(b.currentUnits) < 0;
            if (dirOk) {
              t.tradeId = b.id; // adopt the broker's trade id so future closes are precise
              continue;
            }
          }
        }
        closed.push(t);
        record(t, "manual", now.toISOString(), prices[t.instrument] ?? t.sl, "reconcile-broker-closed");
      }
    } else {
      const pos = await client.getOpenPositions();
      const keep = new Set(pos.filter((p) => p.long || p.short).map((p) => p.instrument));
      for (const t of [...ledger]) {
        if (keep.has(t.instrument)) continue;
        closed.push(t);
        record(t, "sl", now.toISOString(), t.sl, "reconcile-broker-SL");
      }
    }
  } catch {
    /* account query failed — skip reconcile */
  }
  for (const c of closed) {
    const i = ledger.indexOf(c);
    if (i >= 0) ledger.splice(i, 1);
  }

  // ---- 4) ORB time-flatten (18:00 GMT) + session-end flatten -----------------
  if (utcMin >= 18 * 60) {
    for (const t of [...ledger]) {
      if (!t.strategy.endsWith("orb")) continue;
      const p = prices[t.instrument];
      if (!p || !isFinite(p)) continue;
      if (await recordManaged(t, "eod", now.toISOString(), p, "orb-18z-flatten")) {
        ledger.splice(ledger.indexOf(t), 1);
      }
    }
  }
  if (cfg.risk.closeAtSessionEnd && eodCloseDue(now, cfg)) {
    for (const t of [...ledger]) {
      if (isSwing(t)) continue; // SYS3 holds days — never flattened at session end
      const p = prices[t.instrument];
      if (!p || !isFinite(p)) continue;
      if (await recordManaged(t, "eod", now.toISOString(), p, "session-close")) {
        ledger.splice(ledger.indexOf(t), 1);
      }
    }
  }

  // ---- 5) LIVE day-stop: flatten EVERYTHING, not just gate new entries ---------
  if (LIVE && !DRY && state.dailyLossHit && ledger.length > 0) {
    const n = ledger.length;
    for (const t of [...ledger]) {
      const p = prices[t.instrument];
      if (await recordManaged(t, "eod", now.toISOString(), isFinite(p) ? p : t.sl, "day-stop-flatten")) {
        ledger.splice(ledger.indexOf(t), 1);
      }
    }
    await notify(`LIVE DAY STOP HIT — flattened ${n} position(s). Trading halted for the day.`);
  }

  persist("ledger.json", ledger);
  persist("account.json", acc);
  fs.appendFileSync(path.join(DATA_DIR, "curve.csv"), `${now.getTime()},${virtualEquity(acc).toFixed(2)}\n`);

  const open = ledger.length;
  const label = open ? ledger.map((t) => `${t.symbol}(${t.state})`).join(",") : "—";
  console.log(
    `[${now.toISOString()}] virt ${virtualEquity(acc).toFixed(2)} | ${cfg.risk.dailyLossLimitPct * 100}% day stop ${(100 * (virtualEquity(acc) - acc.dayStartEquity) / acc.dayStartEquity).toFixed(2)}% | open [${label}] | slToday ${acc.slCountToday}`
  );
}

function slHit(t: PaperTrade, p: number): boolean {
  return t.direction === "long" ? p <= t.sl : p >= t.sl;
}

async function main() {
  const mode = LIVE ? (LIVE_ARM ? `LIVE-MONEY** ARMED **` : `LIVE-MONEY (DRY — not armed, no orders)`) : `practice`;
  console.log(`=== ${MODE_TAG} FORWARD-TRADER | ${mode} | virtual $${VIRTUAL_EQUITY} | poll ${INTERVAL_SEC}s ===`);
  if (LIVE && !LIVE_ARM) {
    console.log(`NOT ARMED: set OANDA_LIVE_ARM=true in .env.local to authorize live orders.`);
  }
  if (CHECK_ONLY) {
    try {
      const sum = await client.getAccountSummary();
      console.log(`--- account self-check (read-only) ---`);
      console.log(`account ${sum.id} | ${sum.currency}`);
      console.log(`balance ${sum.balance} | NAV ${sum.NAV} | open positions ${sum.openPositionCount}`);
      console.log(`marginUsed ${sum.marginUsed} | marginCall ${sum.marginCallPercent}% | closeout ${sum.marginCloseoutPercent}%`);
      const trades = await client.getOpenTrades();
      console.log(`open trades: ${trades.length}`);
      for (const t of trades.slice(0, 20)) {
        console.log(`  #${t.id} ${t.instrument} ${t.currentUnits} @ ${t.averagePrice} | SL ${t.stopLossOrder?.price ?? "—"} TP ${t.takeProfitOrder?.price ?? "—"} | uPL ${t.unrealizedPL}`);
      }
      console.log(`mode: ${LIVE ? (LIVE_ARM ? "ARMED (orders WILL execute)" : "DRY (no orders)") : "practice"}`);
      console.log(`data: ${DATA_DIR}`);
    } catch (err) {
      console.error(`self-check failed: ${err instanceof Error ? err.message : err}`);
      if (LIVE && env === "live" && !LIVE_ARM) {
        console.error(`Live endpoint reached — if the account above is wrong, STOP here and fix creds.`);
      }
      process.exit(1);
    }
    process.exit(0);
  }
  const acc: VAccount =
    load<VAccount>("account.json") ?? {
      dayKey: "",
      dayStartEquity: VIRTUAL_EQUITY,
      realized: 0,
      slCountToday: 0,
    };
  console.log(`resuming virtual equity $${virtualEquity(acc).toFixed(2)} (${acc.realized >= 0 ? "+" : ""}${acc.realized.toFixed(2)} realized)`);
  do {
    try {
      await tick(acc);
    } catch (err) {
      console.error(`[tick-error] ${err instanceof Error ? err.stack || err.message : err}`);
    }
    if (ONCE) break;
    await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
  } while (true);
}

void main().catch((e) => {
  console.error("paper-trader crashed:", e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});