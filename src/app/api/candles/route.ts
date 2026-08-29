import { NextRequest, NextResponse } from "next/server";
import { OandaClient, type Granularity } from "@/lib/oanda";

export const dynamic = "force-dynamic";

const GRANULARITIES: Granularity[] = [
  "S5", "S10", "S15", "S30",
  "M1", "M2", "M4", "M5", "M10", "M15", "M30",
  "H1", "H2", "H3", "H4", "H6", "H8", "H12",
  "D", "W", "M",
];

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "EUR_USD").toUpperCase();
  const granularity = (req.nextUrl.searchParams.get("granularity") || "M15").toUpperCase() as Granularity;
  const count = Math.min(5000, Math.max(1, parseInt(req.nextUrl.searchParams.get("count") || "200", 10)));
  const price = (req.nextUrl.searchParams.get("price") || "M") as "M" | "B" | "A";

  if (!GRANULARITIES.includes(granularity)) {
    return NextResponse.json({ error: `Invalid granularity: ${granularity}` }, { status: 400 });
  }

  const client = new OandaClient();
  if (!client.isConfigured) {
    return NextResponse.json({ error: "OANDA API not configured" }, { status: 503 });
  }
  try {
    const candles = await client.getCandles(symbol, granularity, count, price);
    return NextResponse.json({ instrument: symbol, granularity, candles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch candles" },
      { status: 502 }
    );
  }
}