import { NextRequest, NextResponse } from "next/server";
import { OandaClient, lotsToUnits } from "@/lib/oanda";
import { INSTRUMENTS, PIP_SIZE } from "@/lib/config";

export const dynamic = "force-dynamic";

const client = () => new OandaClient();

export async function GET() {
  if (!client().isConfigured) {
    return NextResponse.json({ configured: false, error: "OANDA API not configured" }, { status: 503 });
  }
  try {
    const [summary, positions] = await Promise.all([client().getAccountSummary(), client().getOpenPositions()]);
    const mapped = positions.map((p) => {
      const dir = p.long ? "long" : "short";
      const side = p.long ?? p.short;
      const instrument = p.instrument;
      return {
        instrument,
        symbol: instrument.replace("_", "/"),
        direction: dir,
        units: Number(side?.units ?? 0),
        avgPrice: Number(side?.averagePrice ?? 0),
        unrealizedPL: Number(side?.unrealizedPL ?? 0),
        pipSize: PIP_SIZE[instrument] ?? 0.0001,
      };
    });
    return NextResponse.json({
      configured: true,
      account: {
        id: summary.id,
        currency: summary.currency,
        balance: Number(summary.balance),
        nav: Number(summary.NAV),
        openTrades: Number(summary.openTradeCount),
        marginUsed: Number(summary.marginUsed),
        marginCallPercent: Number(summary.marginCallPercent),
        marginCloseoutPercent: Number(summary.marginCloseoutPercent),
      },
      positions: mapped,
    });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Failed to load account" },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!client().isConfigured) {
    return NextResponse.json({ configured: false, error: "OANDA API not configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    symbol?: string;
    direction?: "long" | "short";
    lots?: number;
    sl?: number;
    tp?: number;
  };
  const symbol = (body.symbol || "").toUpperCase();
  const inst = INSTRUMENTS.find((i) => i.symbol.toUpperCase() === symbol || i.oandaInstrument === symbol.replace("/", "_"));
  if (!inst || !inst.enabled) {
    return NextResponse.json({ error: `Unknown or disabled instrument: ${symbol}` }, { status: 400 });
  }
  if (body.direction !== "long" && body.direction !== "short") {
    return NextResponse.json({ error: "direction must be 'long' or 'short'" }, { status: 400 });
  }
  const lots = Number(body.lots);
  if (!Number.isFinite(lots) || lots <= 0) {
    return NextResponse.json({ error: "lots must be a positive number" }, { status: 400 });
  }
  if (lots % 1 !== 0 && inst.type === "index") {
    return NextResponse.json({ error: "index CFD positions are placed in whole contracts (lots = contracts)" }, { status: 400 });
  }

  const direction = body.direction;
  const rawUnits = lotsToUnits(lots, inst.type);
  const units = direction === "long" ? rawUnits : -rawUnits;
  if (rawUnits === 0) {
    return NextResponse.json({ error: "lots too small for this instrument" }, { status: 400 });
  }

  try {
    const result = await client().placeMarketOrder(inst.oandaInstrument, units, body.sl, body.tp);
    return NextResponse.json({
      ok: true,
      orderId: result.orderTransaction.id,
      instrument: inst.oandaInstrument,
      direction,
      lots,
      units,
      sl: body.sl ?? null,
      tp: body.tp ?? null,
      note: "Market order FOK. Practice OANDA accounts accept CURRENCY pairs only — indices/gold will be rejected by the broker.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Order placement failed" },
      { status: 502 }
    );
  }
}