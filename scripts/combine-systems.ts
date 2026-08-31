/* Combine two independent systems' trade logs into one account equity/success-rate readout.
   Usage: npx tsx scripts/combine-systems.ts <sysA.json> <sysB.json> [equity]
   Both files are arrays of closed trades; both are sorted by exit timestamp at merge time.
   Caveat: overlap risk lives under each system's own gates; this merge is the serialized view. */
import fs from "node:fs";
import path from "node:path";

const [a, b, eqArg] = process.argv.slice(2);
const equity = eqArg ? parseFloat(eqArg) : 200;

interface Tr {
  symbol: string;
  direction: string;
  exitTime: string;
  openedAt?: string;
  open?: string;
  outcome: string;
  net?: number;
  netPnl?: number;
  holdHours?: number;
}

const load = (p: string, tag: string): { tag: string; trades: Tr[] } => ({ tag, trades: JSON.parse(fs.readFileSync(path.resolve(p), "utf8")) as Tr[] });

const sysA = load(a, "A-intraday");
const sysB = load(b, "B-ORB");

const all: Array<{ tag: string; t: Tr }> = [
  ...sysA.trades.map((t) => ({ tag: sysA.tag, t })),
  ...sysB.trades.map((t) => ({ tag: sysB.tag, t })),
].sort((x, y) => new Date(x.t.exitTime).getTime() - new Date(y.t.exitTime).getTime());

const start = equity;
let bal = start;
const curve: Array<[number, number]> = [[new Date(all[0].t.exitTime).getTime(), bal]];
let wins = 0;
let losses = 0;
let grossWin = 0;
let grossLoss = 0;
const peak = new Map<number, number>();
const days = new Map<string, number>();
let lastPeak = bal;
let maxDdPeak = 0;

for (const { tag, t } of all) {
  const net = t.netPnl ?? t.net ?? 0;
  bal += net;
  if (net > 0) { wins++; grossWin += net; } else { losses++; grossLoss += -net; }
  const dk = t.exitTime.slice(0, 10);
  days.set(dk, (days.get(dk) ?? 0) + net);
  lastPeak = Math.max(lastPeak, bal);
  maxDdPeak = Math.max(maxDdPeak, (lastPeak - bal) / lastPeak);
  const ts = new Date(t.exitTime).getTime();
  if (curve[curve.length - 1][0] !== ts) curve.push([ts, bal]); else curve[curve.length - 1][1] = bal;
}

const profitableDays = [...days.values()].filter((v) => v > 0).length;
const ddVsInit = (start - Math.min(...curve.map(([, e]) => e))) / start;

console.log(`\n=== COMBINED (serialized $${start} account) ===`);
console.log(`trades : ${all.length}  (sysA ${sysA.trades.length} + sysB ${sysB.trades.length})`);
console.log(`final  : $${bal.toFixed(2)}  net ${(bal - start).toFixed(2)} (${(100 * (bal - start) / start).toFixed(1)}%)`);
console.log(`winrate: ${(100 * wins / (wins + losses)).toFixed(1)}%  (${wins}W/${losses}L)`);
console.log(`profit factor: ${(grossWin / grossLoss).toFixed(2)}   (gross win $${grossWin.toFixed(0)} / gross loss $${grossLoss.toFixed(0)})`);
console.log(`max DD (peak): ${(100 * maxDdPeak).toFixed(1)}%   |   max DD vs initial: ${(100 * ddVsInit).toFixed(1)}%`);
console.log(`profitable days: ${profitableDays}/${days.size} = ${(100 * profitableDays / days.size).toFixed(1)}%`);

console.log(`\n--- per system contribution ---`);
for (const sys of [sysA, sysB]) {
  let n = 0; let g = 0; let w = 0; let l = 0;
  for (const t of sys.trades) { const v = t.netPnl ?? t.net ?? 0; n += v; if (v > 0) { w++; g += v; } else { l++; g += 0; } }
  const gl = sys.trades.reduce((s, t) => s + Math.max(0, -(t.netPnl ?? t.net ?? 0)), 0);
  console.log(`${sys.tag}: trades=${sys.trades.length} net=$${n.toFixed(0)} WR=${(100 * w / (w + l)).toFixed(1)}% PF=${(g / gl).toFixed(2)}`);
}

console.log(`\n--- combined month-by-month (net $ by exit month) ---`);
const byMonth = new Map<string, number>();
for (const { t } of all) { const m = t.exitTime.slice(0, 7); byMonth.set(m, (byMonth.get(m) ?? 0) + (t.netPnl ?? t.net ?? 0)); }
for (const m of [...byMonth.keys()].sort()) console.log(`  ${m}: ${byMonth.get(m)!.toFixed(0)}`);