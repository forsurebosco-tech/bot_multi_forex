import { NextResponse } from "next/server";
import { OandaClient } from "@/lib/oanda";
import { WATCHLIST, DEFAULT_CONFIG, ACCOUNT_RULES } from "@/lib/config";
import { sessionAt, initialState } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = new OandaClient();
  return NextResponse.json({
    configured: client.isConfigured,
    watchlist: WATCHLIST,
    config: DEFAULT_CONFIG,
    accountRules: ACCOUNT_RULES,
    session: sessionAt(new Date()),
    initialState: initialState(ACCOUNT_RULES.equity),
    env: {
      oandaBaseUrl: process.env.OANDA_BASE_URL || "https://api-fxpractice.oanda.com",
    },
  });
}