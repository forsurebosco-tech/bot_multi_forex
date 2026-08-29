import { NextRequest, NextResponse } from "next/server";
import { OandaClient } from "@/lib/oanda";
import {
  WATCHLIST,
  DEFAULT_CONFIG,
  type StrategyConfig,
  type NewsEvent,
} from "@/lib/config";
import {
  runScanPipeline,
  initialState,
  applySignalToState,
  sessionAt,
  type EngineState,
  type Signal,
} from "@/lib/engine";
import { maybePushSignal, telegramConfigured } from "@/lib/telegram";

interface ScanBody {
  state?: Partial<EngineState> | null;
  equity?: number;
  newsEvents?: NewsEvent[];
  config?: Partial<StrategyConfig> | null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handleScan(body: ScanBody, forCron = false) {
  const client = new OandaClient();

  if (!client.isConfigured) {
    return NextResponse.json(
      {
        configured: false,
        message: "OANDA_API_KEY / OANDA_ACCOUNT_ID not set. Add them to .env and deploy, or set Vercel env vars.",
        signals: [],
        contexts: [],
      },
      { status: 200 }
    );
  }

  const cfg: StrategyConfig =
    body.config && typeof body.config === "object" ? mergeConfig(body.config) : DEFAULT_CONFIG;

  const base = body.state && typeof body.state === "object" ? (body.state as EngineState) : initialState(body.equity ?? 10000);
  if (typeof body.equity === "number" && body.equity > 0) base.equity = body.equity;
  // roll day boundaries
  const dayKey = new Date().toISOString().slice(0, 10);
  if (base.dayKey !== dayKey) {
    base.dayKey = dayKey;
    base.signalsCount = 0;
    base.consecutiveLosses = 0;
    base.circuitBreaker = false;
    base.dailyLossHit = false;
  }

  const newsEvents = Array.isArray(body.newsEvents) ? body.newsEvents : [];

  try {
    const now = new Date();
    const { contexts } = await runScanPipeline(client, WATCHLIST, cfg, now, base, newsEvents);
    const signals: Signal[] = [];
    const rejections: { symbol: string; reasons: string[] }[] = [];
    for (const c of contexts) {
      if (c.signal) signals.push(c.signal);
      if (c.rejected.length) rejections.push({ symbol: c.display, reasons: c.rejected });
    }

    let updatedState = base;
    for (const s of signals) updatedState = applySignalToState(updatedState, s);

    // push new signals to Telegram (once each)
    const telegramPushes: { symbol: string; ok: boolean; error?: string }[] = [];
    if (telegramConfigured()) {
      for (const s of signals) {
        const res = await maybePushSignal(s, base.logs);
        telegramPushes.push({ symbol: s.symbol, ok: res.sent, error: res.error });
      }
    }

    return NextResponse.json({
      configured: true,
      cron: forCron,
      telegramEnabled: telegramConfigured(),
      telegramPushes,
      session: sessionAt(now),
      signals,
      contexts: contexts.map((c) => ({
        symbol: c.symbol,
        display: c.display,
        type: c.type,
        price: c.price,
        pipSize: c.pipSize,
        spreadPips: c.spreadPips,
        spreadOk: c.spreadOk,
        regime: c.regime,
        longBias: c.longBias,
        h1Adx: c.h1Adx,
        chopZone: c.chopZone,
        emaSlopeFlat: c.h1Ema200SlopeFlat,
        canTradeSession: c.canTradeSession,
        session: c.session,
        newsBlackout: c.newsBlackout,
        signal: c.signal,
        rejected: c.rejected,
      })),
      rejections,
      state: updatedState,
      scannedAt: now.toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "OANDA fetch failed",
        signals: [],
        contexts: [],
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ScanBody;
  return handleScan(body);
}

// supports the Vercel cron (GET /api/scan) — a stateless fresh scan
export async function GET() {
  return handleScan({}, true);
}

function mergeConfig(p: Partial<StrategyConfig>): StrategyConfig {
  return {
    ...DEFAULT_CONFIG,
    ...p,
    trend: { ...DEFAULT_CONFIG.trend, ...(p.trend ?? {}) },
    setup: { ...DEFAULT_CONFIG.setup, ...(p.setup ?? {}) },
    risk: { ...DEFAULT_CONFIG.risk, ...(p.risk ?? {}) },
    sessions: { ...DEFAULT_CONFIG.sessions, ...(p.sessions ?? {}) },
    spread: { ...DEFAULT_CONFIG.spread, ...(p.spread ?? {}) },
  };
}