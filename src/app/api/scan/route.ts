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
  type PairContext,
} from "@/lib/engine";
import { maybePushSignal, telegramConfigured, type TechAnalysis } from "@/lib/telegram";
import { computeChartAnalysis, type ChartAnalysis } from "@/lib/chart";
import { resolveInstrument, type InstrumentConfig } from "@/lib/config";
import type { Candle } from "@/lib/oanda";

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
    const taBySymbol = new Map<string, TechAnalysis | null>();
    for (const c of contexts) {
      if (c.signal) {
        signals.push(c.signal);
        taBySymbol.set(c.symbol, await buildTechAnalysis(client, c));
      }
      if (c.rejected.length) rejections.push({ symbol: c.display, reasons: c.rejected });
    }

    let updatedState = base;
    for (const s of signals) updatedState = applySignalToState(updatedState, s);

    // push new signals to Telegram (once each) — technical analysis first, then setup
    const telegramPushes: { symbol: string; ok: boolean; error?: string }[] = [];
    if (telegramConfigured()) {
      for (const s of signals) {
        const res = await maybePushSignal(s, base.logs, undefined, taBySymbol.get(s.symbol) ?? null);
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

/**
 * Deterministic technical analysis for a signal: nearest confirmed S/R with touch
 * counts and the last liquidity sweep on M15 (same logic as the Chart Lab /api/analyze).
 * Enriched with an optional LLM read when AI creds are set. Best-effort — on any
 * failure we push the raw setup with the deterministic TA only.
 */
async function buildTechAnalysis(client: OandaClient, ctx: PairContext): Promise<TechAnalysis | null> {
  const inst = resolveInstrument(ctx.symbol);
  if (!inst) return null;
  try {
    const candles = (await client.getCandles(inst.oandaInstrument, "M15", 300, "M")) as Candle[];
    const chart = computeChartAnalysis(inst.oandaInstrument, candles, ctx.pipSize, { maxLevelBars: 120 });
    const supports = (chart.supports ?? [])
      .filter((s) => s.confirmed && s.price < ctx.price)
      .sort((x, y) => y.price - x.price);
    const resistances = (chart.resistances ?? [])
      .filter((r) => r.confirmed && r.price > ctx.price)
      .sort((x, y) => x.price - y.price);
    const lastEvent = chart.events[chart.events.length - 1];
    const ta: TechAnalysis = {
      price: ctx.price,
      pipSize: ctx.pipSize,
      bias: ctx.longBias ? "long" : "short",
      regime: ctx.regime,
      adx: ctx.h1Adx,
      chopZone: ctx.chopZone,
      session: ctx.session,
      sessionOk: ctx.canTradeSession,
      spreadPips: ctx.spreadPips,
      spreadOk: ctx.spreadOk,
      support: supports[0] ? { price: supports[0].price, touches: supports[0].touches, confirmed: true } : null,
      resistance: resistances[0] ? { price: resistances[0].price, touches: resistances[0].touches, confirmed: true } : null,
      lastEvent: lastEvent
        ? {
            kind: lastEvent.kind,
            side: lastEvent.side,
            level: lastEvent.level,
            confirmed: lastEvent.confirmed,
            when: new Date(lastEvent.t * 1000).toISOString().slice(11, 16),
          }
        : null,
    };
    if (process.env.TG_AI_ANALYSIS !== "0") ta.llm = await llmTradeRead(inst, ctx, chart, ta);
    return ta;
  } catch {
    return null;
  }
}

/** Short LLM read of the same setup (best-effort; falls back to deterministic TA). */
async function llmTradeRead(
  inst: InstrumentConfig,
  ctx: PairContext,
  chart: ChartAnalysis,
  ta: TechAnalysis
): Promise<string | null> {
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const key = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  if (!key) return null;
  const payload = {
    symbol: inst.symbol,
    price: ctx.price,
    pipSize: ctx.pipSize,
    bias: ctx.longBias ? "long" : "short",
    regime: ctx.regime,
    adx: Math.round(ctx.h1Adx),
    rsiM15: Math.round(ctx.m15Rsi),
    session: ctx.session,
    support: ta.support,
    resistance: ta.resistance,
    lastSweep: ta.lastEvent,
    recentEvents: chart.events.slice(-3),
    signal: ctx.signal
      ? { strategy: ctx.signal.strategy, direction: ctx.signal.direction, entry: ctx.signal.entry, sl: ctx.signal.sl, tp1: ctx.signal.tp1 }
      : null,
    rejected: ctx.rejected.slice(0, 3),
  };
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content:
              "You are a concise forex/gold day-trader assistant reading a live setup. In at most 60 words give: whether the setup aligns with the H1 bias and structure trend, the meaning of the last liquidity sweep for entry timing, and one concrete risk. Use tick prices. No filler.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim()?.slice(0, 700) ?? null;
  } catch {
    return null;
  }
}