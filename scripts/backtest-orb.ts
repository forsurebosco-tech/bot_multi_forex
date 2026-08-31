/* Opening-Range Breakout (ORB) backtest driver.
   Evidence-based design (FXVPS 14y DAX study; Lightwave NY-ORB FX study):
     - range = high/low over a fixed UTC window (overnight/native open)
     - entry = M15 close breaks range edge (close-outside confirmation), direction filtered by min-range + D1 EMA200 trend bias
     - SL = opposite side of range (~1R), TP = RR x range width from entry, time-flatten at fixed hour
     - all trades filled M15-close prices; round-trip spread + slippage charged; per-instrument margin gate

   Usage:
     npx tsx scripts/backtest-orb.ts --equity=400 --start=2021-08-29 --end=2026-08-29 [OPTIONS]
   Options:
     --pairs=EUR/USD,USD/JPY,JP225,DE30   default = evidence universe (EUR/USD,GBP/USD,USD/JPY,JP225,DE30)
     --risk=0.01 --rr=1.5                 risk per trade, reward:risk
     --bias=1|0                           D1 EMA200 trend bias filter (default 1)
     --minrange=0.3                       min range as fraction of ATR(14, M15) else skip day
     --slip=1.0                           added slippage pips per side (default 0)
     --slbuffer=0.05                      breaker buffer as fraction of range width (default 0)
     --start..end --tag=x --fresh
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OandaClient, unitsPerLot, type Candle } from "../src/lib/oanda";
import { INSTRUMENTS, type InstrumentConfig } from "../src/lib/config";
import { pipValuePerLot } from "../src/lib/engine";

const APP_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.join(APP_ROOT, "data", "backtest");
const CACHE_DIR = path.join(DATA_DIR, "orbbin");
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
const H = 3600e3, D = 24 * H;
const timeOfDay = (t: number) => t % D;

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
  return { t: all.subarray(0, n), o: all.subarray(n, 2 * n), h: all.subarray(2 * n, 3 * n), l: all.subarray(3 * n, 4 * n), c: all.subarray(4 * n, 5 * n), n };
}
async function fetchSeries(client: OandaClient, inst: string, tf: string, fromMs: number, toMs: number, fresh: boolean): Promise<FSet> {
  const file = path.join(CACHE_DIR, `${inst}_${tf}_${new Date(fromMs).toISOString().slice(0, 10)}.bin`);
  if (!fresh && fs.existsSync(file)) {
    const f = loadFSet(file);
    if (f.n > 500 && f.t[f.n - 1] >= toMs - 24 * 3600e3) return f;
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

function ema(values: Float64Array, n: number, end: number): number {
  const from = Math.max(0, end - n * 4);
  let k = 2 / (n + 1);
  let e = values[from];
  for (let i = from + 1; i <= end; i++) e = values[i] * k + e * (1 - k);
  return e;
}
function atr(f: FSet, period: number, end: number): number {
  const from = Math.max(1, end - period * 2);
  let s = 0, cnt = 0;
  for (let i = from; i <= end; i++) {
    const tr = Math.max(f.h[i] - f.l[i], Math.abs(f.h[i] - f.c[i - 1]), Math.abs(f.l[i] - f.c[i - 1]));
    s += tr; cnt++;
  }
  return s / Math.max(1, cnt);
}

interface SessionSpec { rangeStart: number; rangeEnd: number; tradeUntil: number; flattenAt: number; rr: number; minrange: number }
// all times in UTC (epoch-millis of today)
const SESSIONS: Record<string, SessionSpec> = {
  "EUR/USD": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  "GBP/USD": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  "USD/JPY": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  "USD/CHF": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  "AUD/USD": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  "USD/CAD": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  "EUR/JPY": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  "GBP/JPY": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
  // DAX cash open 08:00 winter / 07:00 summer CET — overnight range, trade after cash-approximate open
  "DE30": { rangeStart: 0 * H, rangeEnd: 7.5 * H, tradeUntil: 11.5 * H, flattenAt: 12.0 * H, rr: 2.0, minrange: 0.3 },
  // Nikkei cash 00:00-06:30 UTC (JST fixed)
  "JP225": { rangeStart: 0 * H, rangeEnd: 0.5 * H, tradeUntil: 5.0 * H, flattenAt: 5.5 * H, rr: 2.0, minrange: 0.3 },
  "XAU/USD": { rangeStart: 13.5 * H, rangeEnd: 14.0 * H, tradeUntil: 17.5 * H, flattenAt: 18.0 * H, rr: 2.0, minrange: 0.3 },
};

async function main() {
  const args = process.argv.slice(2);
  const get = (k: string) => args.find((a) => a.startsWith(k + "="))?.split("=")[1];
  const eq = parseFloat(get("--equity") ?? "400");
  const endMs = get("--end") ? new Date(get("--end")! + "T00:00:00Z").getTime() : Date.now();
  const startMs = get("--start") ? new Date(get("--start")! + "T00:00:00Z").getTime() : endMs - 1825 * D;
  const wanted = new Set((get("--pairs") ?? "EUR/USD,GBP/USD,USD/JPY,JP225,DE30").split(",").map((s) => s.trim()));
  const riskPct = parseFloat(get("--risk") ?? "0.01");
  const rrOverride = get("--rr") ? parseFloat(get("--rr")!) : NaN;
  const biasOn = (get("--bias") ?? "1") === "1";
  const minrangeAx = get("--minrange") ? parseFloat(get("--minrange")!) : NaN;
  const slipPips = parseFloat(get("--slip") ?? "0");
  const slBufFrac = get("--slbuffer") ? parseFloat(get("--slbuffer")!) : 0;
  const beAtR = get("--be") ? parseFloat(get("--be")!) : 0;
  const trailAtR = get("--trail") ? parseFloat(get("--trail")!) : 0;
  const tag = get("--tag") ?? "orb";
  const fresh = args.includes("--fresh");
  const rs = get("--rs") ? parseFloat(get("--rs")!) : NaN;
  const re = get("--re") ? parseFloat(get("--re")!) : NaN;
  const tu = get("--tu") ? parseFloat(get("--tu")!) : NaN;
  const fa = get("--fa") ? parseFloat(get("--fa")!) : NaN;
  for (const k of Object.keys(SESSIONS)) {
    const s = SESSIONS[k];
    if (s.rangeStart !== 13.5 * H) continue; // retime only the FX/gold NY sessions
    if (Number.isFinite(rs)) s.rangeStart = rs * H;
    if (Number.isFinite(re)) s.rangeEnd = re * H;
    if (Number.isFinite(tu)) s.tradeUntil = tu * H;
    if (Number.isFinite(fa)) s.flattenAt = fa * H;
  }

  let symbols = wanted.size
    ? INSTRUMENTS.filter((w) => wanted.has(w.symbol) && SESSIONS[w.symbol])
    : Object.keys(SESSIONS).map((k) => INSTRUMENTS.find((w) => w.symbol === k)!);
  symbols = symbols.filter(Boolean).sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (!symbols.length) { console.error("no symbols with sessions"); process.exit(1); }

  console.log(`\n=== ORB BACKTEST | $${eq} | risk ${(100 * riskPct).toFixed(1)}% | bias=${biasOn ? "D1-EMA200" : "off"} | slip ${slipPips}p/side | ${new Date(startMs).toISOString().slice(0, 10)} -> ${new Date(endMs).toISOString().slice(0, 10)} ===`);
  console.log(`symbols: ${symbols.map((s) => s.symbol).join(", ")}`);
  const client = new OandaClient();

  const warm = 500 * D;
  interface Data { inst: InstrumentConfig; m15: FSet; d1: FSet; pm: number; pd: number; rates: number }
  const datas: Data[] = [];
  for (const inst of symbols) {
    try {
      const [m15, d1] = await Promise.all([
        fetchSeries(client, inst.oandaInstrument, "M15", startMs - 3 * D, endMs, fresh),
        fetchSeries(client, inst.oandaInstrument, "D", startMs - warm, endMs, fresh),
      ]);
      if (m15.n < 500 || d1.n < 260) { console.warn(`  ${inst.oandaInstrument}: insufficient history — skipped`); continue; }
      datas.push({ inst, m15, d1, pm: 0, pd: 0, rates: 0 });
      console.log(`  ${inst.oandaInstrument}: M15=${m15.n} D1=${d1.n}`);
    } catch (e) {
      console.warn(`  ${inst.oandaInstrument}: unsupported/error (${e instanceof Error ? e.message : "?"}) — skipped`);
    }
  }
  if (!datas.length) { console.error("no instruments"); process.exit(1); }

  const rates: Record<string, number> = {};
  const buildRates = (t: number) => {
    for (const d of datas) {
      let i = d.pm;
      while (i >= 0 && d.m15.t[i] > t) i--;
      rates[d.inst.oandaInstrument] = d.m15.c[Math.max(0, i)];
    }
  };
  const ppu = (d: { inst: InstrumentConfig }): number => {
    const pv = pipValuePerLot(d.inst, rates);
    const step = d.inst.type === "gold" ? 0.1 : d.inst.type === "index" ? 1 : 0.0001;
    return pv / step;
  };
  const pipsPerUnit = (d: { inst: InstrumentConfig }): number => d.inst.type === "index" ? 1 : 0.0001;
  const typicalPips = (d: { inst: InstrumentConfig }) => d.inst.typicalSpreadPips;

  // day-state per symbol
  type Day = {
    date: string; rangeH: number; rangeL: number; rangeN: number; dayStartT: number;
    broke: boolean; dir: 1 | -1 | 0; entry: number; sl: number; tp: number; lots: number; riskAmount: number; rangeWidth: number;
  };
  const dayState = new Map<string, Day>();

  interface OpenPos {
    id: number; symbol: string; instrument: string; dir: 1 | -1; entry: number; sl: number; tp: number; lots: number;
    riskAmount: number; dayKey: string; enteredAt: number; beArmed: boolean;
    trailArmed: boolean; trailExt: number; rangeWidth: number;
  }
  const open: OpenPos[] = [];
  const trades: any[] = [];
  const curve: Array<[number, number]> = [];
  let equity = eq, peak = eq, nextId = 1;
  const rejection = new Map<string, number>();
  const rj = (g: string) => rejection.set(g, (rejection.get(g) ?? 0) + 1);

  let dayStartBal = eq, dailyLossHit = false, consecutiveLosses = 0, curDay = "";

  const closePos = (pos: OpenPos, px: number, outcome: string, t: number) => {
    const d = datas.find((x) => x.inst.symbol === pos.symbol)!;
    const pvlot = pipValuePerLot(d.inst, rates);
    const gross = pos.dir * (px - pos.entry) * ppu(d) * pos.lots;
    const cost = (typicalPips(d) + 2 * slipPips) * pvlot * pos.lots;
    const net = gross - cost;
    equity += net;
    if (equity > peak) peak = equity;
    if (net < 0) consecutiveLosses++; else consecutiveLosses = 0;
    const dk = new Date(t).toISOString().slice(0, 10);
    if (equity <= dayStartBal * (1 - 0.08)) dailyLossHit = true;
    trades.push({
      symbol: pos.symbol, open: pos.dayKey, exitTime: new Date(t).toISOString(),
      direction: pos.dir > 0 ? "long" : "short", entry: +pos.entry.toFixed(5), exit: +px.toFixed(5),
      lots: +pos.lots.toFixed(4), net: +net.toFixed(2), rr: +((px - pos.entry) * pos.dir / (pos.dir > 0 ? pos.entry - pos.sl : pos.sl - pos.entry)).toFixed(2),
      outcome,
    });
    open.splice(open.indexOf(pos), 1);
  };

  // iterate M15 grid across all symbols (union)
  const gridSet = new Set<number>();
  for (const d of datas) for (let i = 0; i < d.m15.n; i++) { const tt = d.m15.t[i]; if (tt >= startMs && tt <= endMs) gridSet.add(tt); }
  const grid = Array.from(gridSet).sort((a, b) => a - b);
  console.log(`M15 bars in window: ${grid.length}`);

  for (let k = 0; k < grid.length; k++) {
    const t = grid[k];
    const dk = new Date(t).toISOString().slice(0, 10);
    if (dk !== curDay) { curDay = dk; dayStartBal = equity; dailyLossHit = false; consecutiveLosses = 0; }
    for (const d of datas) {
      while (d.pm + 1 < d.m15.n && d.m15.t[d.pm + 1] <= t) d.pm++;
      while (d.pd + 1 < d.d1.n && d.d1.t[d.pd + 1] <= t) d.pd++;
    }
    buildRates(t);

    // ---- exits first (through any open pos over bar range) ----
    if (open.length) {
      for (const pos of [...open]) {
        const d = datas.find((x) => x.inst.symbol === pos.symbol)!;
        const hi = d.m15.h[d.pm]; const lo = d.m15.l[d.pm]; const cc = d.m15.c[d.pm];
        const long = pos.dir > 0;
        const slHit = long ? lo <= pos.sl : hi >= pos.sl;
        const tpHit = long ? hi >= pos.tp : lo <= pos.tp;
        const spec = SESSIONS[pos.symbol];
        const nowTime = timeOfDay(t);
        if (slHit) { closePos(pos, pos.sl, "sl", t); continue; }
        if (pos.tp > 0 && tpHit) { closePos(pos, long ? pos.tp : pos.tp, "tp", t); continue; }
        // breakeven arm once price reaches beFrac x range toward TP
        const width = pos.rangeWidth;
        const reached = long ? cc >= pos.entry + beAtR * width : cc <= pos.entry - beAtR * width;
        if (beAtR > 0 && reached && !pos.beArmed) {
          pos.beArmed = true;
          pos.sl = pos.entry;
        }
        if (pos.beArmed) {
          const beHit2 = long ? lo <= pos.entry : hi >= pos.entry;
          if (beHit2) { closePos(pos, pos.entry, "be", t); continue; }
        }
        // trailing: after trailAtR reached, keep SL = extreme - width*k
        if (trailAtR > 0) {
          if (long) pos.trailExt = Math.max(pos.trailExt, hi);
          else pos.trailExt = Math.min(pos.trailExt, lo);
          const profNow = long ? cc - pos.entry : pos.entry - cc;
          if (profNow >= trailAtR * width) {
            const newSl = long ? pos.trailExt - 0.85 * width : pos.trailExt + 0.85 * width;
            if (long ? newSl > pos.sl : newSl < pos.sl) pos.sl = newSl;
            pos.trailArmed = true;
          }
        }
        if (nowTime >= spec.flattenAt - 15 * 60e3) {
          // flatten on the first bars at/after flatten window on M15 close
          if (nowTime >= spec.flattenAt) { closePos(pos, cc, "time", t); continue; }
        }
      }
    }
    if (dailyLossHit || consecutiveLosses >= 3) {
      for (const d of datas) { const nn = d.inst.symbol; rj("gate"); }
      curve.push([t, equity]);
      continue;
    }

    // ---- per-symbol: build range / trigger breakout ----
    for (const d of datas) {
      if (d.m15.t[d.pm] !== t) continue;
      const spec = SESSIONS[d.inst.symbol];
      const tod = timeOfDay(t);
      if (tod >= spec.rangeStart && tod < spec.rangeEnd) {
        let ds = dayState.get(d.inst.symbol);
        if (!ds || ds.date !== dk) {
          ds = { date: dk, rangeH: -Infinity, rangeL: Infinity, rangeN: 0, dayStartT: t, broke: false, dir: 0, entry: 0, sl: 0, tp: 0, lots: 0, riskAmount: 0, rangeWidth: 0 };
          dayState.set(d.inst.symbol, ds);
        }
        ds.rangeH = Math.max(ds.rangeH, d.m15.h[d.pm]);
        ds.rangeL = Math.min(ds.rangeL, d.m15.l[d.pm]);
        ds.rangeN++;
        continue;
      }
      const ds = dayState.get(d.inst.symbol);
      if (!ds || ds.date !== dk || ds.broke) continue;
      if (tod < spec.rangeEnd) continue; // still before trigger window
      if (tod > spec.tradeUntil + 15 * 60e3) continue;
      if (ds.rangeN < 1) continue;
      const width = ds.rangeH - ds.rangeL;
      if (width <= 0) { ds.broke = true; continue; }
      const minR = isFinite(minrangeAx) ? minrangeAx : spec.minrange;
      const atrAt = d.pm >= 14 ? atr(d.m15, 14, d.pm) : width;
      if (width < minR * atrAt) { ds.broke = true; rj("min-range"); continue; }

      // D1 EMA200 bias at previous completed D1 bar
      if (biasOn && d.pd >= 200) {
        const e200 = ema(d.d1.c, 200, d.pd);
        const above = d.d1.c[d.pd] > e200;
        if (ds.dir === 0) {
          // both directions allowed: only long if above, only short if below
          const closeAbove = d.m15.c[d.pm] > ds.rangeH;
          const closeBelow = d.m15.c[d.pm] < ds.rangeL;
          if (closeAbove && !above) { rj("bias-short"); ds.broke = true; continue; }
          if (closeBelow && above) { rj("bias-long"); ds.broke = true; continue; }
        }
      }

      const closeAbove = d.m15.c[d.pm] > ds.rangeH;
      const closeBelow = d.m15.c[d.pm] < ds.rangeL;
      if (!closeAbove && !closeBelow) continue;
      const long = closeAbove;
      const rr = isFinite(rrOverride) ? rrOverride : spec.rr;
      const entryPrice = d.m15.c[d.pm];
      const stopDist = width * (1 + slBufFrac);
      const sl = long ? ds.rangeL - slBufFrac * width : ds.rangeH + slBufFrac * width;
      const tp = trailAtR > 0 ? 0 : (long ? entryPrice + rr * width : entryPrice - rr * width);
      // sizing (unit-based like the live engine; index CFDs trade in whole units, FX/gold in 100-unit steps)
      const riskAmt = equity * riskPct;
      const ppuval = ppu(d);
      const rawLots = riskAmt / (stopDist * ppuval);
      const step = d.inst.type === "index" ? 1 : 100;
      const units = Math.max(0, Math.round(rawLots * unitsPerLot(d.inst.type) / step) * step);
      const lots = units / unitsPerLot(d.inst.type);
      if (!(units >= step)) { rj("size-0"); ds.broke = true; continue; }
      const thisMargin = lots * unitsPerLot(d.inst.type) * entryPrice * (d.inst.marginRate ?? 0.05);
      let marginUsed = 0;
      for (const p of open) {
        const pi = datas.find((x) => x.inst.symbol === p.symbol)!.inst;
        marginUsed += p.lots * unitsPerLot(pi.type) * p.entry * (pi.marginRate ?? 0.05);
      }
      if (marginUsed + thisMargin > equity * 0.99) { rj("margin"); ds.broke = true; continue; }
      ds.broke = true;
      ds.dir = long ? 1 : -1; ds.entry = entryPrice; ds.sl = sl; ds.tp = tp; ds.lots = lots; ds.riskAmount = riskAmt; ds.rangeWidth = width;
      if (open.length >= 4) { rj("max-open"); continue; }
      open.push({ id: nextId++, symbol: d.inst.symbol, instrument: d.inst.oandaInstrument, dir: long ? 1 : -1, entry: entryPrice, sl, tp, lots, riskAmount: riskAmt, dayKey: dk, enteredAt: t, beArmed: false, trailArmed: false, trailExt: entryPrice, rangeWidth: width });
    }
    curve.push([t, equity]);
  }

  const n = trades.length;
  const wins = trades.filter((tt) => tt.net > 0).length;
  const grossW = trades.filter((tt) => tt.net > 0).reduce((s, tt) => s + tt.net, 0);
  const grossL = Math.abs(trades.filter((tt) => tt.net < 0).reduce((s, tt) => s + tt.net, 0));
  let p = eq, mdd = 0;
  for (const [, e] of curve) { if (e > p) p = e; const dd = (p - e) / p; if (dd > mdd) mdd = dd; }
  const out = new Map<string, number>();
  for (const tt of trades) out.set(tt.outcome, (out.get(tt.outcome) ?? 0) + 1);

  console.log(`\nRESULT orb | equity=${equity.toFixed(0)} netPct=${(100 * (equity - eq) / eq).toFixed(1)} trades=${n} win=${(100 * wins / Math.max(1, n)).toFixed(1)} pf=${(grossW / Math.max(1e-9, grossL)).toFixed(2)} maxDD=${(100 * mdd).toFixed(1)}`);
  console.log(`outcomes: ${[...out.entries()].map(([o, nn]) => `${o}:${nn}`).join(" ")}`);
  console.log(`rejections: ${[...rejection.entries()].map(([g, nn]) => `${g}:${nn}`).join(" ") || "none"}`);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const perSym = (g: (tt: any) => boolean) => {
    const sub = trades.filter(g);
    const w = sub.filter((tt) => tt.net > 0).length;
    const gW = sub.filter((tt) => tt.net > 0).reduce((s, tt) => s + tt.net, 0);
    const gL = Math.abs(sub.filter((tt) => tt.net < 0).reduce((s, tt) => s + tt.net, 0));
    return `${sub.length} trades, WR ${(100 * w / Math.max(1, sub.length)).toFixed(0)}%, PF ${(gW / Math.max(1e-9, gL)).toFixed(2)}`;
  };
  for (const s of symbols) {
    if (trades.some((tt) => tt.symbol === s.symbol)) console.log(`  ${s.symbol}: ${perSym((tt) => tt.symbol === s.symbol)}`);
  }
  const md = [
    `# ORB backtest ${tag}`,
    ``,
    `| equity | net % | trades | win rate | profit factor | max DD |`,
    `|---|---|---|---|---|---|`,
    `| $${equity.toFixed(0)} | ${(100 * (equity - eq) / eq).toFixed(1)}% | ${n} | ${(100 * wins / Math.max(1, n)).toFixed(1)}% | ${(grossW / Math.max(1e-9, grossL)).toFixed(2)} | ${(100 * mdd).toFixed(1)}% |`,
  ].join("\n");
  fs.writeFileSync(path.join(DATA_DIR, `orb-${tag}~${ts}.md`), md);
  fs.writeFileSync(path.join(DATA_DIR, `orb-${tag}~${ts}.csv`), "t,e\n" + curve.map(([t, e]) => `${t},${e.toFixed(2)}`).join("\n"));
  fs.writeFileSync(path.join(DATA_DIR, `orb-${tag}~${ts}.json`), JSON.stringify(trades, null, 1));
  console.log(`saved orb-${tag}~${ts}.{md,json,csv}`);
}
main().catch((e) => { console.error(e); process.exit(1); });