/**
 * FIVE-SYSTEM LIVE SCANNER — scans OANDA every 60 seconds with 5 different
 * strategies (each a distinct, validated family) and pushes every high-quality
 * setup to Telegram, tagged by system:
 *
 *   SYS1 TREND-MOMENTUM  intraday continuation+breakout on the 7 set (1y PF 2.21)
 *   SYS2 ORB             30-min NY opening-range break, USD/JPY, D1-bias (5y PF 1.33)
 *   SYS3 SWING           H4/D1 trend pullback, holds days (2y PF 1.52)
 *   SYS4 SCALP           tight-TP momentum scalp, XAU+GBP (1y PF 2.95, WR 67%)
 *   SYS5 MR-FADE         long-only S/R bounce + RSI exhaustion (2y PF 1.32)
 *
 * Usage:
 *   npx tsx scripts/system-scanner.ts                 # loop, every 60s
 *   npx tsx scripts/system-scanner.ts --interval=30
 *   npx tsx scripts/system-scanner.ts --once          # single scan
 *   Requires OANDA_API_TOKEN/OANDA_ACCOUNT_ID + TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID in .env.local
 */
import fs from "node:fs";
import path from "node:path";
import { OandaClient } from "../src/lib/oanda";
import { INSTRUMENTS, type InstrumentConfig } from "../src/lib/config";
import { SYSTEMS, enabledSymbols, type SystemSpec } from "../src/lib/systems";
import { runScanPipeline, initialState, type PairContext } from "../src/lib/engine";
import { analyzeSwing, type SwingContextInput } from "../src/lib/swing";
import { sendTelegramMessage } from "../src/lib/telegram";

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
const INTERVAL_SEC = Math.round(readNum("interval", 60));
const SWING_INTERVAL_SEC = Math.round(readNum("swing-interval", 300));
const ONCE = args.includes("--once");

const byId = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
const intraday = SYSTEMS.filter((s) => s.kind === "intraday");
const swingSpec = byId["sys3"];

const px = (sym: string, p: number) => p.toFixed(sym === "XAU/USD" ? 2 : sym === "NAS100" || sym === "US30" ? 1 : 5);
const instOf = (sym: string): InstrumentConfig | undefined => INSTRUMENTS.find((i) => i.symbol === sym);

// dedupe: intraday one push per (system, symbol, strategy) per minute; swing once per day
const sentIntraday = new Set<string>();
const sentSwing = new Set<string>();
const intradayKey = (sys: SystemSpec, s: { symbol: string; strategy: string }, now: Date) =>
  `${sys.id}|${s.symbol}|${s.strategy}|${now.toISOString().slice(0, 16)}`;

// --- SYS2 ORB day state (LOOSE: 3 FX pairs, user mandate 2026-08) ---
const ORB_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY"];
const ORB_SPEC = { rangeStart: 13.5 * 60, rangeEnd: 14 * 60, tradeUntil: 17.5 * 60, rr: 2, minRangeAtr: 0.3 };
interface OrbDay {
  dayKey: string;
  ranges: Record<string, { hi: number; lo: number; n: number }>;
  sent: Record<string, boolean>;
}
const SCAN_DIR = path.join(__dirname, "..", "data", "scanner");
fs.mkdirSync(SCAN_DIR, { recursive: true });
const orbStatePath = path.join(SCAN_DIR, "orb.json");
function loadOrb(): OrbDay {
  try {
    return JSON.parse(fs.readFileSync(orbStatePath, "utf8")) as OrbDay;
  } catch {
    return { dayKey: "", ranges: {}, sent: {} };
  }
}

const orbBiasCache = new Map<string, boolean>();
async function orbBiasOk(client: OandaClient, dayKey: string, symbol: string): Promise<boolean> {
  const key = `${dayKey}:${symbol}`;
  const hit = orbBiasCache.get(key);
  if (hit !== undefined) return hit;
  const inst = instOf(symbol);
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
      /* allow */
    }
  }
  orbBiasCache.set(key, above);
  return above;
}

function fmtSignal(ctx: PairContext): string {
  const sig = ctx.signal!;
  return [
    `DIRECTION: ${sig.direction.toUpperCase()} · ${sig.strategy.toUpperCase()} · SESSION ${ctx.session}`,
    `ENTRY: ${px(sig.symbol, sig.entry)}   SL: ${px(sig.symbol, sig.sl)}`,
    `TP1: ${px(sig.symbol, sig.tp1)}   TP2: ${px(sig.symbol, sig.tp2)}`,
    `CONTEXT: H1-ADX ${ctx.h1Adx.toFixed(0)} ${ctx.longBias ? "bull" : "bear"} · M15 RSI ${ctx.m15Rsi.toFixed(0)} · spread ${ctx.spreadPips.toFixed(1)}p`,
    `SIZE: ${sig.lots.toFixed(2)} lots · risk $${sig.riskAmount.toFixed(0)}`,
  ].join("\n");
}

async function runIntraday(client: OandaClient, now: Date): Promise<void> {
  for (const spec of intraday) {
    const cfg = spec.config!;
    let contexts: PairContext[] = [];
    try {
      const r = await runScanPipeline(client, enabledSymbols(spec).map((s) => instOf(s)!).filter(Boolean), cfg, now, initialState(10000), []);
      contexts = r.contexts;
    } catch (err) {
      console.log(`[${spec.id}-fail] ${err instanceof Error ? err.message : err}`);
      continue;
    }
    for (const ctx of contexts) {
      const sig = ctx.signal;
      if (!sig) continue;
      const key = intradayKey(spec, sig, now);
      if (sentIntraday.has(key)) continue;
      sentIntraday.add(key);
      const msg = `SYS${spec.id.slice(3)} · ${spec.name} · ${sig.symbol}\n${"─".repeat(28)}\n${fmtSignal(ctx)}`;
      const res = await sendTelegramMessage(msg);
      console.log(`[${spec.id}] ${sig.symbol} ${sig.direction.toUpperCase()} ${sig.strategy} ${res.ok ? "sent" : `tg-fail:${res.error}`}`);
    }
  }
}

async function runOrb(client: OandaClient, now: Date, ctxMap: Record<string, PairContext>): Promise<void> {
  const dk = now.toISOString().slice(0, 10);
  const orb = loadOrb();
  if (orb.dayKey !== dk) {
    orb.dayKey = dk;
    orb.ranges = {};
    orb.sent = {};
    orbBiasCache.clear();
  }
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const pair of ORB_PAIRS) {
    const ctx = ctxMap[pair];
    if (!ctx) continue;
    if (utcMin >= ORB_SPEC.rangeStart && utcMin < ORB_SPEC.rangeEnd) {
      const r = orb.ranges[pair] ?? { hi: -Infinity, lo: Infinity, n: 0 };
      r.hi = Math.max(r.hi, ctx.price);
      r.lo = Math.min(r.lo, ctx.price);
      r.n += 1;
      orb.ranges[pair] = r;
    } else if (utcMin >= ORB_SPEC.rangeEnd && utcMin < ORB_SPEC.tradeUntil && !orb.sent[pair]) {
      const r = orb.ranges[pair];
      if (r && r.n >= 2) {
        const width = r.hi - r.lo;
        if (width > 0 && !(ctx.m15Atr > 0 && width < ORB_SPEC.minRangeAtr * ctx.m15Atr)) {
          const long = ctx.price > r.hi;
          const short = ctx.price < r.lo;
          if (long || short) {
            const above = await orbBiasOk(client, dk, pair);
            if ((long && above && !orb.sent[pair]) || (short && !above && !orb.sent[pair])) {
              orb.sent[pair] = true;
              const entry = ctx.price;
              const sl = long ? r.lo : r.hi;
              const tp = entry + (long ? 1 : -1) * ORB_SPEC.rr * width;
              const msg = [
                `SYS2 · ORB · ${pair}`,
                "─".repeat(28),
                `DIRECTION: ${long ? "LONG" : "SHORT"} (D1-EMA200 ${long ? "above" : "below"} — bias aligned)`,
                `RANGE 13:30-14:00Z: ${px(pair, r.lo)} - ${px(pair, r.hi)}`,
                `ENTRY: ${px(pair, entry)}   SL: ${px(pair, sl)} (opposite edge)`,
                `TP: ${px(pair, tp)} (${ORB_SPEC.rr}R of range)   FLAT 18:00Z if untargeted`,
              ].join("\n");
              const res = await sendTelegramMessage(msg);
              console.log(`[sys2] ${pair} ${long ? "LONG" : "SHORT"} ${res.ok ? "sent" : `tg-fail:${res.error}`}`);
            }
          }
        }
      }
    }
  }
  try {
    fs.writeFileSync(orbStatePath, JSON.stringify(orb, null, 2));
  } catch {
    /* best-effort */
  }
}

let lastSwingCheck = 0;
async function runSwing(client: OandaClient, now: Date): Promise<void> {
  if (ONCE || now.getTime() - lastSwingCheck >= SWING_INTERVAL_SEC * 1000) {
    lastSwingCheck = now.getTime();
    const cfg = swingSpec.swingConfig!;
    const dk = now.toISOString().slice(0, 10);
    for (const sym of enabledSymbols(swingSpec)) {
      const inst = instOf(sym);
      if (!inst) continue;
      try {
        const [d1, h4] = await Promise.all([
          client.getCandles(inst.oandaInstrument, "D", 300),
          client.getCandles(inst.oandaInstrument, "H4", 300),
        ]);
        const ctx: SwingContextInput = {
          d1: d1.filter((c) => c.complete),
          h4: h4.filter((c) => c.complete),
          inst,
        };
        const { signal } = analyzeSwing(ctx, cfg);
        if (!signal) continue;
        const key = `${swingSpec.id}|${sym}|${dk}`;
        if (sentSwing.has(key)) continue;
        sentSwing.add(key);
        const msg = [
          `SYS3 · SWING · ${sym}`,
          "─".repeat(28),
          `DIRECTION: ${signal.direction.toUpperCase()} · H4 PULLBACK in D1-EMA200 trend`,
          `ENTRY: ${px(sym, signal.entry)}`,
          `SL: ${px(sym, signal.sl)}   TP1: ${px(sym, signal.tp1)}   TP2: ${px(sym, signal.tp2)}`,
          signal.note ? `NOTE: ${signal.note}` : "",
        ].filter(Boolean).join("\n");
        const res = await sendTelegramMessage(msg);
        console.log(`[sys3] ${sym} ${signal.direction.toUpperCase()} ${res.ok ? "sent" : `tg-fail:${res.error}`}`);
      } catch (err) {
        console.log(`[sys3-fail] ${sym} ${err instanceof Error ? err.message : err}`);
      }
    }
  }
}

async function tick(now: Date): Promise<void> {
  const client = new OandaClient();
  await runIntraday(client, now);
  const ctxMap: Record<string, PairContext> = {};
  if (intraday.length) {
    try {
      const r = await runScanPipeline(client, ORB_PAIRS.map((p) => instOf(p)!).filter(Boolean), byId["sys1"].config!, now, initialState(10000), []);
      for (const c of r.contexts) if (ORB_PAIRS.includes(c.symbol)) ctxMap[c.symbol] = c;
    } catch {
      /* ctx fallback below */
    }
  }
  await runOrb(client, now, ctxMap);
  await runSwing(client, now);
  console.log(`[${now.toISOString()}] scan complete`);
}

async function main() {
  const client = new OandaClient();
  if (!client.isConfigured) {
    console.error("OANDA not configured — set OANDA_API_TOKEN + OANDA_ACCOUNT_ID in .env.local");
    process.exit(1);
  }
  console.log(`=== FIVE-SYSTEM SCANNER | every ${INTERVAL_SEC}s | ${SYSTEMS.map((s) => `${s.id}-${s.name}`).join(" + ")} ===`);
  do {
    try {
      await tick(new Date());
    } catch (err) {
      console.error(`[tick-error] ${err instanceof Error ? err.stack || err.message : err}`);
    }
    if (ONCE) break;
    await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
  } while (true);
}

void main().catch((e) => {
  console.error("scanner crashed:", e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});