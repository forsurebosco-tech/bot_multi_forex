import { NextRequest, NextResponse } from "next/server";
import { OandaClient } from "@/lib/oanda";
import { runBacktest } from "@/lib/backtest";
import { DEFAULT_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BacktestBody {
  symbol?: string; // slash form, e.g. EUR/USD
  days?: number;
  equity?: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as BacktestBody;
  const client = new OandaClient();
  if (!client.isConfigured) {
    return NextResponse.json({ error: "OANDA API not configured" }, { status: 503 });
  }

  const slash = body.symbol || "EUR/USD";
  const instrument = slash.replace("/", "_");
  const days = Math.min(14, Math.max(1, body.days || 3));
  const equity = body.equity || 10000;

  const now = Date.now();
  const startMs = now - days * 24 * 3600 * 1000;

  try {
    // fetch generous history for warmup
    const [h1, m15, m5] = await Promise.all([
      client.getCandles(instrument, "H1", 500),
      client.getCandles(instrument, "M15", 500),
      client.getCandles(instrument, "M5", 1500),
    ]);

    const result = runBacktest(slash, h1, m15, m5, DEFAULT_CONFIG, startMs, now, equity);

    return NextResponse.json({
      instrument: slash,
      days,
      ...result,
      firstBar: m15[0]?.time,
      lastBar: m15[m15.length - 1]?.time,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backtest failed" },
      { status: 502 }
    );
  }
}