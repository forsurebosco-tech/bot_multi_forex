/* Swing pullback system — backtest driver (D1 regime + H4 pullback)
   Usage:
     npx tsx scripts/backtest-swing.ts --equity=400 --start=2024-08-29 --end=2026-08-29 [OPTIONS]
   Options:
     --pairs=EUR/USD,GBP/USD,...   (default: all enabled instruments)
     --risk=0.01                   risk % of equity per trade
     --k.<dottedPath>=<num>        override any SwingConfig value
     --tag=x  --summary            output tag
     --fresh                       refetch candles, ignore cache
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OandaClient, unitsPerLot, type Candle } from "../src/lib/oanda";
import { INSTRUMENTS, type InstrumentConfig } from "../src/lib/config";
import { analyzeSwing, swingLots, swingRegime, SWING_DEFAULT_CONFIG, type SwingConfig, type SwingSignal } from "../src/lib/swing";
import { pipValuePerLot } from "../src/lib/engine";

const APP_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.join(APP_ROOT, "data", "backtest");
const CACHE_DIR = path.join(DATA_DIR, "swingbin");
fs.mkdirSync(CACHE_DIR, { recursive: true });

function loadEnv() {
  const p = path.join(APP_ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnv();

interface FSet { t: Float64Array; o: Float64Array; h: Float64Array; l: Float64Array; c: Float64Array; n: number }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function candlesToFSet(cs: Candle[]): FSet {
  const n = cs.length;
  const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    t[i] = parseFloat(cs[i].time) * 1000;
    o[i] = cs[i].open; h[i] = cs[i].high; l[i] = cs[i].low; c[i] = cs[i].close;
  }
  return { t, o, h, l, c, n };
}
function saveFSet(f: FSet, file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = new Float64Array(5 * f.n);
  buf.set(f.t); buf.set(f.o, f.n); buf.set(f.h, 2 * f.n); buf.set(f.l, 3 * f.n); buf.set(f.c, 4 * f.n);
  fs.writeFileSync(file, Buffer.from(buf.buffer));
}
function loadFSet(file: string): FSet {
  const all = new Float64Array(fs.readFileSync(file).buffer);
  const n = Math.floor(all.length / 5);
  return {
    t: all.subarray(0, n), o: all.subarray(n, 2 * n), h: all.subarray(2 * n, 3 * n),
    l: all.subarray(3 * n, 4 * n), c: all.subarray(4 * n, 5 * n), n,
  };
}
async function fetchSeries(client: OandaClient, inst: string, tf: string, fromMs: number, toMs: number, fresh: boolean): Promise<FSet> {
  const file = path.join(CACHE_DIR, `${inst}_${tf}_${new Date(fromMs).toISOString().slice(0, 10)}.bin`);
  if (!fresh && fs.existsSync(file)) {
    const f = loadFSet(file);
    if (f.n > 800 && f.t[f.n - 1] >= toMs - 3 * 24 * 3600 * 1000) return f;
  }
  const all: Candle[] = [];
  let from = Math.floor(fromMs / 1000);
  for (let attempt = 0; ; ) {
    try {
      const seg = await client.getCandles(inst, tf as never, 5000, "M", from);
      for (const c of seg) if (c.complete) all.push(c);
      if (seg.length === 0 || seg.length < 5000) break;
      const lastT = parseFloat(seg[seg.length - 1].time) * 1000;
      if (lastT >= toMs) break;
      from = Math.floor(lastT / 1000) + 1;
    } catch (e) {
      attempt++;
      if (attempt > 4) throw e;
      await sleep(1000 * attempt);
    }
  }
  const f = candlesToFSet(all);
  saveFSet(f, file);
  return f;
}

function setPath(obj: unknown, dotted: string, raw: string) {
  const parts = dotted.split(".");
  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur?.[parts[i]];
  if (cur && typeof cur === "object") cur[parts[parts.length - 1]] = parseFloat(raw);
}

async function main() {
  const args = process.argv.slice(2);
  const eqArg = args.find((a) => a.startsWith("--equity="));
  const startArg = args.find((a) => a.startsWith("--start="));
  const endArg = args.find((a) => a.startsWith("--end="));
  const pairsArg = args.find((a) => a.startsWith("--pairs="));
  const riskArg = args.find((a) => a.startsWith("--risk="));
  const tagArg = args.find((a) => a.startsWith("--tag="));
  const fresh = args.includes("--fresh");

  const INITIAL_EQUITY = parseFloat(eqArg?.split("=")[1] ?? "10000");
  const endMs = endArg ? new Date(endArg.split("=")[1] + "T00:00:00Z").getTime() : Date.now();
  const startMs = startArg
    ? new Date(startArg.split("=")[1] + "T00:00:00Z").getTime()
    : endMs - 730 * 24 * 3600 * 1000;

  const cfg: SwingConfig = JSON.parse(JSON.stringify(SWING_DEFAULT_CONFIG));
  const wanted = new Set(pairsArg?.split("=")[1].split(",").map((s) => s.trim()) ?? []);
  const baseUniverse = wanted.size ? INSTRUMENTS.filter((w) => wanted.has(w.symbol)) : INSTRUMENTS.filter((w) => w.enabled);
  // AUD/USD needed as a currency converter for AU200_AUD P&L (and adds FX breadth)
  if (!baseUniverse.some((w) => w.symbol === "AUD/USD")) {
    const au = INSTRUMENTS.find((w) => w.symbol === "AUD/USD");
    if (au) baseUniverse.push(au);
  }
  const watchlist = baseUniverse.slice().sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (riskArg) cfg.risk.riskPerTradePct = Math.max(0.001, parseFloat(riskArg.split("=")[1]));
  for (const a of args) if (a.startsWith("--k.")) {
    const eq = a.indexOf("=");
    setPath(cfg, a.slice(4, eq > 0 ? eq : a.length), eq > 0 ? a.slice(eq + 1) : "");
  }

  console.log(`\n=== SWING BACKTEST | $${INITIAL_EQUITY} | risk ${(100 * cfg.risk.riskPerTradePct).toFixed(1)}%/trade | ${new Date(startMs).toISOString().slice(0, 10)} -> ${new Date(endMs).toISOString().slice(0, 10)} ===`);
  console.log(`watchlist: ${watchlist.map((w) => w.symbol).join(", ")}`);
  const client = new OandaClient();

  const WARMUP = 420 * 24 * 3600 * 1000;
  const datas: Array<{ inst: InstrumentConfig; d1: FSet; h4: FSet; pd1: number; ph4: number }> = [];
  for (const inst of watchlist) {
    try {
      const [d1, h4] = await Promise.all([
        fetchSeries(client, inst.oandaInstrument, "D", startMs - WARMUP, endMs, fresh),
        fetchSeries(client, inst.oandaInstrument, "H4", startMs - WARMUP, endMs, fresh),
      ]);
      if (d1.n < 260 || h4.n < 1200) { console.warn(`  ${inst.oandaInstrument}: insufficient history — skipped`); continue; }
      datas.push({ inst, d1, h4, pd1: 0, ph4: 0 });
      console.log(`  ${inst.oandaInstrument}: D1=${d1.n} H4=${h4.n}`);
    } catch (e) {
      console.warn(`  ${inst.oandaInstrument}: unsupported/error (${e instanceof Error ? e.message : "?"}) — skipped`);
    }
  }
  if (!datas.length) { console.error("no instruments"); process.exit(1); }

  const gridSet = new Set<number>();
  for (const d of datas) for (let i = 0; i < d.h4.n; i++) { const tt = d.h4.t[i]; if (tt >= startMs && tt <= endMs) gridSet.add(tt); }
  const grid = Array.from(gridSet).sort((a, b) => a - b);
  console.log(`H4 bars in window: ${grid.length}`);

  interface OpenPos {
    id: number; symbol: string; instrument: string; dir: 1 | -1; entry: number; sl: number; tp1: number; tp2: number;
    lots: number; riskAmount: number; phase: "tp1" | "be"; realizedSurplus: number; openDayIdx: number; openD1Display: string;
  }
  const open: OpenPos[] = [];
  const trades: any[] = [];
  const curve: Array<[number, number]> = [];
  let equity = INITIAL_EQUITY;
  let peakEquity = INITIAL_EQUITY;
  let nextId = 1;
  const lastExitDay = new Map<string, number>();
  const rejection = new Map<string, number>();
  function rj(gate: string) { rejection.set(gate, (rejection.get(gate) ?? 0) + 1); }
  const ratesCache: { [k: string]: number } = {};

  let dayStartBal = INITIAL_EQUITY;
  let dailyLossHit = false;
  let consecutiveLosses = 0;
  let curDayKey = "";

  function buildRates(t: number) {
    for (const d of datas) {
      let idx = d.h4.n - 1;
      while (idx > 0 && d.h4.t[idx] > t) idx--;
      ratesCache[d.inst.oandaInstrument] = d.h4.c[idx];
    }
  }
  function windowToCandles(f: FSet, end: number, len: number): Candle[] {
    const from = Math.max(0, end - len + 1);
    const out: Candle[] = new Array(end - from + 1);
    for (let i = from; i <= end; i++) {
      out[i - from] = {
        time: String(f.t[i] / 1000), complete: true,
        open: f.o[i], high: f.h[i], low: f.l[i], close: f.c[i], volume: 0,
      };
    }
    return out;
  }
  function d1IndexFor(instrument: string, t: number, hint?: number): number {
    const d = datas.find((x) => x.inst.oandaInstrument === instrument)!;
    let i = hint ?? d.pd1;
    while (i + 1 < d.d1.n && d.d1.t[i + 1] <= t) i++;
    return i;
  }
  function ppuFor(symbol: string): number {
    const d = datas.find((x) => x.inst.symbol === symbol)!;
    const pv = pipValuePerLot(d.inst, ratesCache);
    const step = d.inst.type === "gold" ? 0.1 : d.inst.type === "index" ? 1 : 0.0001;
    return pv / step;
  }

  function closePos(pos: OpenPos, exitPx: number, outcome: string, t: number) {
    const ppu = ppuFor(pos.symbol);
    const gross = pos.dir * (exitPx - pos.entry) * ppu * pos.lots;
    const inst = datas.find((x) => x.inst.symbol === pos.symbol)!.inst;
    const cost = inst.typicalSpreadPips * pipValuePerLot(inst, ratesCache) * pos.lots;
    const net = gross - cost + (outcome === "be" ? pos.realizedSurplus : 0);
    equity += net;
    if (equity > peakEquity) peakEquity = equity;
    const dk = new Date(t).toISOString().slice(0, 10);
    if (equity <= dayStartBal * (1 - cfg.risk.dailyLossLimitPct)) dailyLossHit = true;
    if (net < 0) consecutiveLosses++;
    else consecutiveLosses = 0;
    const dIdx = d1IndexFor(pos.instrument, t);
    if (dIdx >= 0) lastExitDay.set(pos.symbol, dIdx);
    const dir = pos.dir > 0 ? "long" : "short";
    trades.push({
      symbol: pos.symbol, direction: dir, strategy: "pullback",
      openedAt: pos.openD1Display, exitTime: new Date(t).toISOString(),
      entry: +pos.entry.toFixed(5), exit: +exitPx.toFixed(5),
      lots: +pos.lots.toFixed(4), riskAmount: +pos.riskAmount.toFixed(2),
      net: +net.toFixed(2), resultR: +(net / pos.riskAmount).toFixed(3),
      holdDays: +((dIdx >= 0 ? dIdx - pos.openDayIdx : 0)).toFixed(1),
      outcome,
    });
    const i = open.indexOf(pos);
    if (i >= 0) open.splice(i, 1);
  }

  for (let k = 0; k < grid.length; k++) {
    const t = grid[k];
    const dk = new Date(t).toISOString().slice(0, 10);
    if (dk !== curDayKey) {
      curDayKey = dk;
      dayStartBal = equity;
      dailyLossHit = false;
      consecutiveLosses = 0;
    }
    for (const d of datas) {
      while (d.pd1 + 1 < d.d1.n && d.d1.t[d.pd1 + 1] <= t) d.pd1++;
      while (d.ph4 + 1 < d.h4.n && d.h4.t[d.ph4 + 1] <= t) d.ph4++;
    }
    buildRates(t);

    // ---- exits at H4 closes ------------------------------------------------
    for (const pos of [...open]) {
      const d = datas.find((x) => x.inst.oandaInstrument === pos.instrument)!;
      const L = d.h4.l[d.ph4]; const H = d.h4.h[d.ph4]; const C = d.h4.c[d.ph4];
      const long = pos.dir > 0;
      if (pos.phase === "tp1") {
        const slHit = long ? L <= pos.sl : H >= pos.sl;
        const tp1Hit = long ? H >= pos.tp1 : L <= pos.tp1;
        if (slHit) { closePos(pos, pos.sl, "sl", t); continue; }
        if (tp1Hit) {
          pos.phase = "be";
          const d1 = datas.find((x) => x.inst.oandaInstrument === pos.instrument)!;
          const r1 = Math.abs(pos.tp1 - pos.entry) / Math.abs(pos.entry - pos.sl);
          pos.realizedSurplus = pos.riskAmount * 0.5 * r1;
          pos.sl = pos.entry;
        }
      } else {
        const beHit = long ? L <= pos.entry : H >= pos.entry;
        const tp2Hit = long ? H >= pos.tp2 : L <= pos.tp2;
        if (beHit) { closePos(pos, pos.entry, "be", t); continue; }
        if (tp2Hit) { closePos(pos, pos.tp2, "tp2", t); continue; }
      }
      // trend-stop: D1 regime flipped to bear on long / bull on short
      const rd = datas.find((x) => x.inst.oandaInstrument === pos.instrument)!;
      const d1w = windowToCandles(rd.d1, rd.pd1, 260);
      const reg = swingRegime(d1w, cfg);
      if (long && reg === "bear") { closePos(pos, C, "trend-stop", t); continue; }
      if (!long && reg === "bull") { closePos(pos, C, "trend-stop", t); continue; }
      // time-stop: still in tp1 phase after N days
      const dIdxNow = d1IndexFor(pos.instrument, t);
      if (pos.phase === "tp1" && dIdxNow >= 0 && dIdxNow - pos.openDayIdx >= cfg.risk.timeStopDays) {
        closePos(pos, C, "time", t);
        continue;
      }
    }

    // ---- entries at H4 closes ------------------------------------------------
    for (const d of datas) {
      if (d.h4.t[d.ph4] !== t) continue;
      if (dailyLossHit || consecutiveLosses >= cfg.risk.maxConsecutiveLosses) break;
      if (open.length >= cfg.risk.maxPositions) break;
      const d1w = windowToCandles(d.d1, d.pd1, 260);
      const h4w = windowToCandles(d.h4, d.ph4, 130);
      const res = analyzeSwing({ d1: d1w, h4: h4w, inst: d.inst }, cfg);
      for (const g of res.rejected) if (!["no trigger"].includes(g)) rj(g);
      const sig: SwingSignal | null = res.signal;
      if (!sig) continue;
      if (open.some((p) => p.symbol === d.inst.symbol)) { rj("unit-open"); continue; }
      const curDIdx = d1IndexFor(d.inst.oandaInstrument, t);
      const sinceExit = lastExitDay.has(d.inst.symbol) && curDIdx >= 0
        ? curDIdx - (lastExitDay.get(d.inst.symbol) ?? -1e9)
        : 1e9;
      if (sinceExit < cfg.risk.cooldownDays) { rj("cooldown"); continue; }
      const { lots, riskAmount } = swingLots(d.inst, equity, sig.entry, sig.sl, cfg.risk.riskPerTradePct);
      if (!isFinite(lots) || lots <= 0) { rj("size-0"); continue; }
      const thisMargin = lots * unitsPerLot(d.inst.type) * sig.entry * (d.inst.marginRate ?? 0.05);
      let marginUsed = 0;
      for (const p of open) {
        const pi = datas.find((x) => x.inst.symbol === p.symbol)!.inst;
        marginUsed += p.lots * unitsPerLot(pi.type) * p.entry * (pi.marginRate ?? 0.05);
      }
      if (marginUsed + thisMargin > equity * 0.99) { rj("margin"); continue; }
      open.push({
        id: nextId++, symbol: d.inst.symbol, instrument: d.inst.oandaInstrument,
        dir: sig.direction === "long" ? 1 : -1,
        entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2,
        lots, riskAmount, phase: "tp1", realizedSurplus: 0,
        openDayIdx: curDIdx, openD1Display: new Date(t).toISOString().slice(0, 10),
      });
    }
    curve.push([t, equity]);
  }

  const nTrades = trades.length;
  const wins = trades.filter((t) => t.net > 0).length;
  const totR = trades.reduce((s, t) => s + t.resultR, 0);
  const grossWin = trades.filter((t) => t.net > 0).reduce((s, t) => s + t.net, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.net < 0).reduce((s, t) => s + t.net, 0));
  const netPct = (100 * (equity - INITIAL_EQUITY) / INITIAL_EQUITY).toFixed(1);

  let ddInit = 0;
  let curMid = INITIAL_EQUITY;
  for (const [, e] of curve) {
    curMid = Math.min(curMid, e === undefined ? curMid : e);
    ddInit = Math.max(ddInit, (INITIAL_EQUITY - curMid) / INITIAL_EQUITY);
  }
  let peak = INITIAL_EQUITY; let maxDD = 0;
  for (const [, e] of curve) { if (e > peak) peak = e; const dd = (peak - e) / peak; if (dd > maxDD) maxDD = dd; }

  const instByOutcome = new Map<string, number>();
  for (const t of trades) instByOutcome.set(t.outcome, (instByOutcome.get(t.outcome) ?? 0) + 1);
  const outcomes = [...instByOutcome.entries()].map(([o, n]) => `${o}:${n}`).join(" ");

  console.log(`\nRESULT swing | equity=${equity.toFixed(0)} netPct=${netPct} trades=${nTrades} win=${(100 * wins / Math.max(1, nTrades)).toFixed(1)} totR=${totR.toFixed(1)} pf=${(grossWin / Math.max(1e-9, grossLoss)).toFixed(2)} ddInit=${(100 * ddInit).toFixed(2)} ddPeak=${(100 * maxDD).toFixed(2)}`);
  console.log(`outcomes: ${outcomes}`);
  console.log(`rejections: ${[...rejection.entries()].map(([g, n]) => `${g}:${n}`).join(" ") || "none"}`);

  const tag = tagArg?.split("=")[1] ?? "swing";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const md = [
    `# Swing backtest ${tag}`,
    ``,
    `| equity | net % | trades | win rate | total R | profit factor | max DD |`,
    `|---|---|---|---|---|---|---|`,
    `| $${equity.toFixed(0)} | ${netPct}% | ${nTrades} | ${(100 * wins / Math.max(1, nTrades)).toFixed(1)}% | ${totR.toFixed(1)}R | ${(grossWin / Math.max(1e-9, grossLoss)).toFixed(2)} | ${(100 * maxDD).toFixed(1)}% |`,
  ].join("\n");
  fs.writeFileSync(path.join(DATA_DIR, `swing-${tag}~${ts}.md`), md);
  fs.writeFileSync(path.join(DATA_DIR, `swing-${tag}~${ts}.json`), JSON.stringify(trades, null, 1));
  fs.writeFileSync(path.join(DATA_DIR, `swing-${tag}~${ts}.csv`), "t,e\n" + curve.map(([t, e]) => `${t},${e.toFixed(2)}`).join("\n"));
  console.log(`saved swing-${tag}~${ts}.{md,json,csv}`);
}

main().catch((e) => { console.error(e); process.exit(1); });