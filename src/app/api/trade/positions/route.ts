import { NextRequest, NextResponse } from "next/server";
import { OandaClient } from "@/lib/oanda";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "").toUpperCase().replace("/", "_");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }
  const client = new OandaClient();
  if (!client.isConfigured) {
    return NextResponse.json({ error: "OANDA API not configured" }, { status: 503 });
  }
  try {
    const result = await client.closePosition(symbol);
    return NextResponse.json({ ok: true, instrument: symbol, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Close failed" },
      { status: 502 }
    );
  }
}