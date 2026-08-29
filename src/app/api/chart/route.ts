import { NextRequest, NextResponse } from "next/server";
import { OandaClient, type Granularity } from "@/lib/oanda";
import { computeChartAnalysis } from "@/lib/chart";
import { PIP_SIZE, resolveInstrument } from "@/lib/config";
import type { Candle } from "@/lib/oanda";

export const dynamic = "force-dynamic";

const GRANULARITIES: Granularity[] = [
  "S5", "S10", "S15", "S30",
  "M1", "M2", "M4", "M5", "M10", "M15", "M30",
  "H1", "H2", "H3", "H4", "H6", "H8", "H12",
  "D", "W", "M",
];

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "EUR/USD").trim();
  const granularity = (req.nextUrl.searchParams.get("granularity") || "M15").toUpperCase() as Granularity;
  const count = Math.min(2000, Math.max(60, parseInt(req.nextUrl.searchParams.get("count") || "300", 10)));

  if (!GRANULARITIES.includes(granularity)) {
    return NextResponse.json({ error: `Invalid granularity: ${granularity}` }, { status: 400 });
  }
  const inst = resolveInstrument(symbol);
  if (!inst) {
    return NextResponse.json({ error: `Unknown instrument: ${symbol}` }, { status: 400 });
  }
  const raw = inst.oandaInstrument;
  const pipSize = PIP_SIZE[raw] ?? 0.0001;

  const client = new OandaClient();
  if (!client.isConfigured) {
    return NextResponse.json({ error: "OANDA API not configured" }, { status: 503 });
  }
  try {
    const candles = await client.getCandles(raw, granularity, count, "M");
    const analysis = computeChartAnalysis(raw, candles as Candle[], pipSize, { maxLevelBars: Math.min(120, count / 2) });
    const last = candles[candles.length - 1];
    return NextResponse.json({
      instrument: raw,
      granularity,
      pipSize,
      price: last ? last.close : null,
      candleTime: last ? last.time : null,
      analysis,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch chart data" },
      { status: 502 }
    );
  }
}