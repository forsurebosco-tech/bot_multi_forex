/**
 * REALTIME RESULTS REPORT — grades the live forward-run against the backtest benchmark.
 *
 * Reads the forward-trader's data/ (paper by default, --live for the live-money run) and
 * prints each system's REAL-TIME results (real live prices, real forward time) side by side
 * with the historical backtest benchmark it is expected to match. This is the honest "is the
 * backtest model real?" readout — the live forward track replaces backtest trust over time.
 *
 * Usage:
 *   npx tsx scripts/realtime-report.ts            # one summary for data/paper
 *   npx tsx scripts/realtime-report.ts --live     # the LIVE-MONEY run (data/live)
 *   npx tsx scripts/realtime-report.ts --interval=30 --live   # repeat every 30 min
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const readNum = (flag: string, dflt: number) => {
  const a = args.find((x) => x.startsWith(`--${flag}=`));
  const v = a ? parseFloat(a.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : dflt;
};
const INTERVAL_MIN = Math.round(readNum("interval", 0));
const LIVE_REPORT = args.includes("--live");
const DIR = LIVE_REPORT ? path.join(__dirname, "..", "data", "live") : path.join(__dirname, "..", "data", "paper");

// Backtest benchmark per system (final 5y numbers from the optimization sweeps; R/trade and
// win-rate are scale-free, dollars/NAV are not). Weighted expected for the portfolio.
const BENCHMARK: Record<string, { rPerTr: number; wr: number; pf: number; tpd: number }> = {
  sys1: { rPerTr: 0.218, wr: 0.56, pf: 1.81, tpd: 1.4 },
  sys4: { rPerTr: 0.196, wr: 0.625, pf: 1.83, tpd: 1.1 },
  sys5: { rPerTr: 0.218, wr: 0.56, pf: 1.81, tpd: 1.4 },
  sys2: { rPerTr: 0, wr: 0.49, pf: 1.06, tpd: 1.5 }, // ORB: flat backtest, shape only
  sys3: { rPerTr: 0.246, wr: 0.31, pf: 1.31, tpd: 0.2 },
};
const SYSTEM_LABEL: Record<string, string> = {
  sys1: "MOMENTUM",
  sys4: "SCALP",
  sys5: "MOMENTUM-1%",
  sys2: "ORB",
  sys3: "SWING",
};

interface LogTrade {
  symbol: string;
  strategy: string;
  entry: number;
  sl: number;
  units?: number;
  unitsOpen?: number;
  realized: number;
  outcome: string;
  exitTime: string;
}

interface VAccount {
  dayKey: string;
  dayStartEquity: number;
  realized: number;
  slCountToday: number;
}

const sysIdOf = (t: LogTrade) => t.strategy.split(":")[0];
const rFullOf = (t: LogTrade) => Math.abs((t.units ?? 0) * (t.entry - (t.sl || 0)));

function maxDdPct(points: Array<{ t: number; e: number }>): number {
  // ignore equity-scale resets (e.g. $1000 harness restarted to $400): split the
  // curve wherever equity dropped >50% and only measure inside the final segment.
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].e;
    if (prev > 0 && points[i].e / prev < 0.5) start = i;
  }
  let peak = -Infinity;
  let dd = 0;
  for (let i = start; i < points.length; i++) {
    const p = points[i].e;
    if (p > peak) peak = p;
    if (peak > 0 && p < peak) dd = Math.max(dd, (peak - p) / peak);
  }
  return dd * 100;
}

function report(): void {
  const readMaybe = (file: string): string => {
  try {
    return fs.readFileSync(path.join(DIR, file), "utf8");
  } catch {
    return "";
  }
};
const ledger: LogTrade[] = (() => {
  try {
    return JSON.parse(readMaybe("ledger.json") || "[]") as LogTrade[];
  } catch {
    return [];
  }
})();
const acc: VAccount = (() => {
  try {
    return JSON.parse(readMaybe("account.json")) as VAccount;
  } catch {
    return { dayKey: "", dayStartEquity: 0, realized: 0, slCountToday: 0 };
  }
})();
const trades: LogTrade[] = readMaybe("trades.jsonl")
  .split(/\r?\n/)
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as LogTrade);

  const curve = readMaybe("curve.csv")
  .split(/\r?\n/)
  .filter((l) => l.trim().length > 0)
  .map((l) => {
    const [t, e] = l.split(",");
    return { t: parseInt(t, 10), e: parseFloat(e) };
  });

  const ndays = Math.max(1, Math.ceil((curve.length ? curve[curve.length - 1].t - (curve[0]?.t ?? 0) : 0) / 86400000));
  const equity = curve.length ? curve[curve.length - 1].e : acc.dayStartEquity;
  const dayPct = acc.dayStartEquity > 0 ? (100 * (equity - acc.dayStartEquity)) / acc.dayStartEquity : 0;
  const closed = trades.filter((t) => t.outcome !== "tp1-be");
  const wins = trades.filter((t) => t.realized > 0);
  const losses = trades.filter((t) => t.realized < 0);
  const grossW = wins.reduce((s, t) => s + t.realized, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.realized, 0));
  const totalR = trades.reduce((s, t) => s + (rFullOf(t) > 0 ? t.realized / rFullOf(t) : 0), 0);

  console.log(`=== REALTIME RESULTS | ${LIVE_REPORT ? "LIVE-MONEY" : "practice-forward"} | ${DIR} | ${new Date().toISOString()} ===`);
  console.log(`closed trades ${closed.length} (${trades.length} log lines incl. tp1-halves) | real-time days ${ndays} | trades/day ${(trades.length / ndays).toFixed(2)}`);
  console.log(`equity $${equity.toFixed(2)} | day ${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(2)}% | realized $${acc.realized.toFixed(2)} | maxDD ${maxDdPct(curve).toFixed(2)}%`);
  if (totalR !== 0 || trades.length) {
    console.log(`REALTIME | equity=$${equity.toFixed(2)} totalR=${totalR ? totalR.toFixed(1) : 0} pf=${grossL > 0 ? (grossW / grossL).toFixed(2) : "∞"} win=${trades.length ? ((100 * wins.length) / trades.length).toFixed(1) : "0.0"} trades=${trades.length} dayRet=${dayPct.toFixed(1)}`);
  }

  console.log(`\nsystem        trades  win%    R/tr    PF      vs-backtest (R/tr  win%  PF  tpd)`);
  for (const [id, b] of Object.entries(BENCHMARK)) {
    const sys = trades.filter((t) => sysIdOf(t) === id);
    const sw = sys.filter((t) => t.realized > 0);
    const sl = sys.filter((t) => t.realized < 0);
    const gw = sw.reduce((s, t) => s + t.realized, 0);
    const gl = Math.abs(sl.reduce((s, t) => s + t.realized, 0));
    const sr = sys.reduce((s, t) => s + (rFullOf(t) > 0 ? t.realized / rFullOf(t) : 0), 0);
    const rtr = sys.length ? sr / sys.length : 0;
    const wr = sys.length ? (100 * sw.length) / sys.length : 0;
    const pf = gl > 0 ? gw / gl : Infinity;
    const open = ledger.filter((l) => l.strategy.startsWith(id)).length;
    const got = `t=${sys.length} wr=${wr.toFixed(1)} rtr=${rtr.toFixed(2)} pf=${pf.toFixed(2)}`;
    const want = `(${b.rPerTr || "—"} ${(b.wr * 100).toFixed(0)}% ${b.pf} ${b.tpd}/d)`;
    const ok = sys.length >= 20 ? (Math.abs(rtr - b.rPerTr) <= 0.12 && Math.abs(wr - b.wr * 100) <= 10 ? "ON-PACE" : "BELOW") : "—";
    console.log(`${id}-${SYSTEM_LABEL[id].padEnd(12)} ${String(sys.length).padStart(5)}  ${wr.toString().padStart(5)}%  ${rtr.toFixed(2).padStart(5)}  ${(pf === Infinity ? "  ∞" : pf.toFixed(2)).padStart(5)}  ${ok.padEnd(6)} vs ${want}  open:${open}`);
  }
  console.log(`\nNotes: R/tr & win% are scale-free and directly comparable to the backtest. PF/dollars scale with size.`);
  console.log(`Grading is meaningful only once a system has ~20+ trades in real time — until then it is noise.`);
}

function main() {
  try {
    report();
  } catch (err) {
    console.error(`realtime-report failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  if (INTERVAL_MIN > 0) {
    console.log(`\nrepeating every ${INTERVAL_MIN} min`);
    const t = setInterval(() => {
      try {
        report();
      } catch (err) {
        console.error(`realtime-report failed: ${err instanceof Error ? err.message : err}`);
      }
    }, INTERVAL_MIN * 60000);
    t.unref();
  }
}

main();