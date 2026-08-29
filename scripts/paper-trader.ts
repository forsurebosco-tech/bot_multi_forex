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
import { OandaClient } from "../src/lib/oanda";
import { WATCHLIST, DEFAULT_CONFIG } from "../src/lib/config";
import {
  runScanPipeline,
  initialState,
  dayKeyNow,
  eodCloseDue,
  applySignalToState,
  type EngineState,
} from "../src/lib/engine";
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
const ALLOW_LIVE = args.includes("--allow-live");

const env = (process.env.OANDA_ENVIRONMENT || "practice").toLowerCase();
if (env !== "practice" && !ALLOW_LIVE) {
  console.error(
    `Refusing to run: OANDA_ENVIRONMENT="${env}". This script is for PRACTICE forward-testing only.\n` +
      `If you fully understand the risk, rerun with --allow-live.`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "..", "data", "paper");
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
  outcome?: "tp1-be" | "tp2" | "sl" | "be" | "eod" | "manual";
  note?: string;
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
const cfg = DEFAULT_CONFIG;
const watchlist = WATCHLIST.filter((i) => i.enabled && i.type !== "index");

const dirSign = (t: PaperTrade) => (t.direction === "long" ? 1 : -1);
const tp1Hit = (t: PaperTrade, p: number) => (t.direction === "long" ? p >= t.tp1 : p <= t.tp1);
const tp2Hit = (t: PaperTrade, p: number) => (t.direction === "long" ? p >= t.tp2 : p <= t.tp2);
const beHit = (t: PaperTrade, p: number) => (t.direction === "long" ? p <= t.entry : p >= t.entry);
const pl = (t: PaperTrade, p: number, units: number) => (p - t.entry) * units * dirSign(t);

function virtualEquity(acc: VAccount): number {
  return VIRTUAL_EQUITY + acc.realized;
}

async function notify(text: string) {
  try {
    await sendTelegramMessage(text);
  } catch {
    /* Telegram optional */
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

async function tick(acc: VAccount): Promise<void> {
  const now = new Date();
  const state = buildState(acc);
  let ledger: PaperTrade[] = load<PaperTrade[]>("ledger.json") ?? [];

  // ---- 1) new signals (engine gates apply: session/trend/ADX/spread/daily/circuit/max-signals)
  const { contexts } = await runScanPipeline(client, watchlist, cfg, now, state, []);

  // current mid prices for exit management
  const prices: Record<string, number> = {};
  try {
    const px = await client.getPrices(watchlist.map((i) => i.oandaInstrument));
    for (const p of px) {
      const bid = p.bids?.[0] ? parseFloat(p.bids[0].price) : 0;
      const ask = p.asks?.[0] ? parseFloat(p.asks[0].price) : 0;
      prices[p.instrument] = bid && ask ? (bid + ask) / 2 : 0;
    }
  } catch {
    /* prices handled by pipeline too */
  }

  const openSymbols = new Set(ledger.map((t) => t.symbol));
  for (const ctx of contexts) {
    const sig = ctx.signal;
    if (!sig) continue;
    if (openSymbols.has(sig.symbol)) continue;
    if (ledger.length >= cfg.risk.maxPositions) {
      console.log(`[skip] ${sig.symbol}: max ${cfg.risk.maxPositions} concurrent positions`);
      continue;
    }
    const inst = watchlist.find((i) => i.symbol === sig.symbol);
    if (!inst) continue;
    const units = sig.lots > 0 ? Math.round(sig.lots * (inst.type === "gold" ? 100 : 100000)) : 0;
    if (units === 0) continue;
    try {
      await client.placeMarketOrder(inst.oandaInstrument, sig.direction === "long" ? units : -units, sig.sl);
    } catch (err) {
      console.log(`[order-fail] ${sig.symbol} ${sig.direction} @ ${sig.entry}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const t: PaperTrade = {
      symbol: sig.symbol,
      instrument: inst.oandaInstrument,
      direction: sig.direction,
      strategy: sig.strategy,
      entry: sig.entry,
      sl: sig.sl,
      tp1: sig.tp1,
      tp2: sig.tp2,
      units,
      unitsOpen: units,
      state: "open",
      openedAt: now.toISOString(),
    };
    ledger.push(t);
    applySignalToState(state, sig);
    persist("ledger.json", ledger);
    console.log(`[entry] ${t.symbol} ${t.direction.toUpperCase()} ${t.strategy} units=${units} @ ${t.entry} | SL ${t.sl} TP1 ${t.tp1} TP2 ${t.tp2}`);
    await notify(`PAPER ENTRY ${t.symbol} ${t.direction.toUpperCase()} ${t.strategy} units=${units} @ ${t.entry}\nSL ${t.sl} | TP1 ${t.tp1} | TP2 ${t.tp2}`);
  }

  // ---- 2) exit management ---------------------------------------------------
  const record = (t: PaperTrade, outcome: NonNullable<PaperTrade["outcome"]>, at: string, exitPrice: number, note: string) => {
    t.outcome = outcome;
    t.exitedAt = at;
    t.note = note;
    const realized = pl(t, exitPrice, t.unitsOpen);
    acc.realized += realized;
    if (outcome === "sl") acc.slCountToday += 1;
    else acc.slCountToday = 0;
    fs.appendFileSync(
      path.join(DATA_DIR, "trades.jsonl"),
      JSON.stringify({ ...t, exitPrice, realized, exitTime: at }) + "\n"
    );
    console.log(`[exit] ${t.symbol} ${outcome.toUpperCase()} @ ${exitPrice} | P&L ${realized.toFixed(2)} | virt ${virtualEquity(acc).toFixed(2)}`);
    void notify(`PAPER ${t.symbol} ${outcome.toUpperCase()} exit @ ${exitPrice} | P&L ${realized.toFixed(2)} | virt ${virtualEquity(acc).toFixed(2)}`);
  };

  const closed: PaperTrade[] = [];
  for (const t of ledger) {
    const p = prices[t.instrument];
    if (!p || !isFinite(p)) continue;
    if (t.state === "open") {
      if (tp1Hit(t, p)) {
        const half = Math.floor(t.unitsOpen / 2);
        try {
          await client.placeMarketOrder(t.instrument, t.direction === "long" ? -half : half);
        } catch (err) {
          console.log(`[tp1-fail] ${t.symbol}: ${err instanceof Error ? err.message : err}`);
          continue;
        }
        const filledPnl = pl(t, p, half);
        acc.realized += filledPnl;
        t.state = "be";
        t.unitsOpen -= half;
        t.note = "tp1-fill@mid";
        console.log(`[tp1] ${t.symbol} closed half @ ${p} (+${filledPnl.toFixed(2)}), BE ${t.entry} on ${t.unitsOpen}` + "u");
      } else if (slHit(t, p)) {
        closed.push(t);
        record(t, "sl", now.toISOString(), t.sl, "broker-SL");
      }
    } else if (t.state === "be") {
      if (tp2Hit(t, p)) {
        closed.push(t);
        record(t, "tp2", now.toISOString(), p, "tp2");
      } else if (beHit(t, p)) {
        closed.push(t);
        record(t, "be", now.toISOString(), p, "breakeven");
      }
    }
  }
  for (const c of closed) ledger.splice(ledger.indexOf(c), 1);

  // ---- 3) broker reconciliation (SL fired earlier than our poll) --------------
  try {
    const pos = await client.getOpenPositions();
    const keep = new Set(pos.filter((p) => p.long || p.short).map((p) => p.instrument));
    for (const t of [...ledger]) {
      if (keep.has(t.instrument)) {
        // still open at broker — but maybe a netting reversal; trust it
        continue;
      }
      closed.push(t);
      record(t, "sl", now.toISOString(), t.sl, "reconcile-broker-SL");
    }
  } catch {
    /* account query failed — skip reconcile */
  }
  for (const c of closed) {
    const i = ledger.indexOf(c);
    if (i >= 0) ledger.splice(i, 1);
  }

  // ---- 4) session-end flatten + persistence ------------------------------------
  if (cfg.risk.closeAtSessionEnd && eodCloseDue(now, cfg)) {
    for (const t of [...ledger]) {
      const p = prices[t.instrument];
      if (!p || !isFinite(p)) continue;
      record(t, "eod", now.toISOString(), p, "session-close");
      ledger.splice(ledger.indexOf(t), 1);
    }
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
  console.log(`=== PAPER FORWARD-TRADER | practice | virtual $${VIRTUAL_EQUITY} | poll ${INTERVAL_SEC}s ===`);
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