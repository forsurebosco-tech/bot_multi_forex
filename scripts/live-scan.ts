/**
 * Live watchlist scan against OANDA practice/live.
 * Usage: set OANDA_API_TOKEN / OANDA_ACCOUNT_ID / OANDA_ENVIRONMENT then:
 *   npx tsx scripts/live-scan.ts
 */
import { OandaClient } from "../src/lib/oanda";
import { WATCHLIST, DEFAULT_CONFIG } from "../src/lib/config";
import { runScanPipeline, initialState, sessionAt } from "../src/lib/engine";

async function main() {
  const client = new OandaClient();
  if (!client.isConfigured) {
    console.error("OANDA not configured. Set OANDA_API_TOKEN + OANDA_ACCOUNT_ID (+ OANDA_ENVIRONMENT).");
    process.exit(1);
  }
  const now = new Date();
  console.log(`session: ${JSON.stringify(sessionAt(now))} @ ${now.toISOString()}`);
  const { contexts } = await runScanPipeline(client, WATCHLIST, DEFAULT_CONFIG, now, initialState(10000), []);
  for (const x of contexts) {
    const line = [
      x.display.padEnd(8),
      `px=`.padEnd(0) + x.price.toFixed(x.pipSize <= 0.0001 ? 5 : 2).padEnd(11),
      `regime=${x.regime}`.padEnd(15),
      `adx=${x.h1Adx.toFixed(1)}`.padEnd(6),
      `bias=${x.longBias ? "LONG" : "SHORT"}`.padEnd(5),
      `chop=${x.chopZone}`,
      `slopeFlat=${x.h1Ema200SlopeFlat}`,
      `sess=${x.session}`.padEnd(7),
      `spread=${x.spreadPips.toFixed(1)}p`,
    ].join(" ");
    if (x.signal) {
      console.log(`${line}  >>> SIGNAL ${x.signal.direction.toUpperCase()} ${x.signal.strategy} lots=${x.signal.lots} risk=$${x.signal.riskAmount} SL=${x.signal.sl}`);
    } else {
      console.log(`${line}  rejected: ${x.rejected[0] ?? "-"}`);
    }
  }
}

main().catch((e) => {
  console.error("scan failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});