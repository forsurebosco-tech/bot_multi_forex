import { NextRequest, NextResponse } from "next/server";
import { OandaClient } from "@/lib/oanda";
import { INSTRUMENTS, WATCHLIST, DEFAULT_CONFIG, PIP_SIZE, resolveInstrument, type InstrumentConfig } from "@/lib/config";
import { analyzePair, initialState, sessionAt } from "@/lib/engine";
import { computeChartAnalysis } from "@/lib/chart";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "EUR/USD").trim();
  const granularity = (req.nextUrl.searchParams.get("granularity") || "M15").toUpperCase();
  if (granularity !== "M5" && granularity !== "M15" && granularity !== "H1") {
    return NextResponse.json({ error: `Invalid granularity: ${granularity}` }, { status: 400 });
  }
  const inst = resolveInstrument(symbol);
  if (!inst) {
    return NextResponse.json({ error: `Unknown instrument: ${symbol}` }, { status: 400 });
  }

  const client = new OandaClient();
  if (!client.isConfigured) {
    return NextResponse.json({ error: "OANDA API not configured" }, { status: 503 });
  }

  try {
    const [h1, m15, m5, prices] = await Promise.all([
      client.getCandles(inst.oandaInstrument, "H1", 260, "M"),
      client.getCandles(inst.oandaInstrument, "M15", 300, "M"),
      client.getCandles(inst.oandaInstrument, "M5", 360, "M"),
      client.getPrices(WATCHLIST.map((w) => w.oandaInstrument)).catch(() => []),
    ]);
    const rates: Record<string, number> = {};
    for (const p of prices) {
      const bid = parseFloat(p.bids?.[0]?.price ?? "0");
      const ask = parseFloat(p.asks?.[0]?.price ?? "0");
      if (bid > 0 && ask > 0) rates[p.instrument] = (bid + ask) / 2;
    }
    const price = m15[m15.length - 1]?.close ?? 0;
    const now = new Date();
    const ctx = analyzePair(
      inst,
      { h1, m15, m5, price, spreadPips: inst.typicalSpreadPips, rates },
      DEFAULT_CONFIG,
      now,
      initialState(),
      []
    );

    const pipSize = PIP_SIZE[inst.oandaInstrument] ?? 0.0001;
    const chartSrc = granularity === "H1" ? h1 : granularity === "M5" ? m5 : m15;
    const chart = computeChartAnalysis(inst.oandaInstrument, chartSrc, pipSize, { maxLevelBars: 120 });
    const session = sessionAt(now);

    // ---- heuristic (always-on) AI commentary ------------------------------
    const nearestSupport = [...chart.supports]
      .filter((s) => s.price < price)
      .sort((a, b) => b.price - a.price)[0];
    const nearestResistance = [...chart.resistances]
      .filter((r) => r.price > price)
      .sort((a, b) => a.price - b.price)[0];
    const pct = (p: number) => `${((Math.abs(p - price) / price) * 100).toFixed(2)}%`;
    const eventsText = chart.events
      .slice(-3)
      .map((e) => {
        const d = new Date(e.t * 1000).toISOString().slice(11, 16) + "Z";
        return `${d} ${e.kind === "sweep" ? (e.side === "buy" ? "BUY reclaim" : "SELL reclaim") : "structure " + e.kind} of ${e.kind === "sweep" ? (e.side === "buy" ? "support" : "resistance") : (e.side === "buy" ? "resistance up" : "support down")} @ ${e.level.toFixed(5)}${e.confirmed ? " (confirmed level)" : ""}`;
      })
      .join("\n");

  const bias = ctx.longBias ? "bullish (above 200-EMA)" : "bearish (below 200-EMA)";
  const lines: string[] = [];
    lines.push(`TREND · H1 bias is ${bias}. ADX ${ctx.h1Adx.toFixed(0)} → ${ctx.regime} regime${ctx.chopZone ? " but price is inside the chop zone (EMA200 band), so trend-filter trades are currently gated" : ""}.`);
    lines.push(
      `LEVELS · nearest support ${nearestSupport ? nearestSupport.price.toFixed(5) + " (" + nearestSupport.touches + "x) " + pct(nearestSupport.price) + " away" : "none in window"}, nearest resistance ${nearestResistance ? nearestResistance.price.toFixed(5) + " (" + nearestResistance.touches + "x) " + pct(nearestResistance.price) + " away" : "none in window"}.`
    );
    lines.push(`LIQUIDITY · last sweeps (${granularity}): ${eventsText || "none in the current window."}`);
    if (ctx.signal) {
      const s = ctx.signal;
      lines.push(
        `SETUP · eligible ${s.strategy.toUpperCase()} ${s.direction.toUpperCase()} at ${s.entry.toFixed(5)}. SL ${s.sl.toFixed(5)} (${s.slAtr.toFixed(1)}x ATR) → real risk /$ ${s.riskAmount.toFixed(0)} at ${s.lots} lots; TP1 ${s.tp1.toFixed(5)} (${s.tp1R.toFixed(2)}R) TP2 ${s.tp2.toFixed(5)} (${s.tp2R.toFixed(2)}R). ${s.confidenceNotes || ""}`.trim()
      );
      const rMult = Math.abs(s.tp1 - s.entry) / Math.abs(s.sl - s.entry || 1);
      lines.push(
        `VERDICT · risk-reward is ${rMult.toFixed(2)}R on the first partial target. If you take it: it matches the engine profile, structure ${s.confidenceNotes.includes("SL under") || s.confidenceNotes.includes("SL above") ? "has a real level to hang the stop under" : "has no clean level — the stop is ATR-based"}. No position is guaranteed profit; this is the engine's highest-conviction candidate on ${inst.symbol} right now.`
      );
    } else {
      const reasons = ctx.rejected.slice(0, 4);
      lines.push(`SETUP · no signal — the engine gated the pair${reasons.length ? " for: " + reasons.join("; ") : " (setup conditions not met)"}. Waiting for a clean structure affords the edge — forced trades are how accounts get cut for the day.`);
    }
    const heuristic = lines.join("\n");

    // ---- optional LLM enhancement ---------------------------------------
    let llm: string | null = null;
    let llmError: string | null = null;
    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const key = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    if (key) {
      const payload = {
        symbol: inst.symbol,
        price,
        pipSize,
        bias: ctx.longBias ? "long" : "short",
        regime: ctx.regime,
        adx: Math.round(ctx.h1Adx),
        rsiM15: Math.round(ctx.m15Rsi),
        session: session.label,
        sessionTradeable: session.canTrade,
        nearestSupport: nearestSupport ? { price: nearestSupport.price, touches: nearestSupport.touches } : null,
        nearestResistance: nearestResistance ? { price: nearestResistance.price, touches: nearestResistance.touches } : null,
        levels: { supports: chart.supports.slice(0, 4), resistances: chart.resistances.slice(0, 4) },
        recentEvents: chart.events.slice(-6),
        signal: ctx.signal
          ? {
              strategy: ctx.signal.strategy,
              direction: ctx.signal.direction,
              entry: ctx.signal.entry,
              sl: ctx.signal.sl,
              tp1: ctx.signal.tp1,
              slAtr: ctx.signal.slAtr,
              riskAmount: ctx.signal.riskAmount,
              confidenceNotes: ctx.signal.confidenceNotes,
            }
          : null,
        rejected: ctx.rejected,
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
                  "You are a precise forex/gold market analyst. Read the structured data and write a short 120-180 word technical analysis: bias, key levels and how strong they are (touch count), any notable liquidity sweeps and what they imply, whether the engine signal (if any) aligns with structure, and one clear risk note. Use concrete prices. No disclaimers, no hedging filler.",
              },
              { role: "user", content: JSON.stringify(payload) },
            ],
          }),
        });
        if (!res.ok) {
          llmError = `LLM ${res.status}`;
        } else {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          llm = data.choices?.[0]?.message?.content ?? null;
        }
      } catch (e) {
        llmError = e instanceof Error ? e.message : "LLM request failed";
      }
    }

    return NextResponse.json({
      symbol: inst.symbol,
      display: inst.display,
      granularity,
      type: inst.type,
      price,
      pipSize,
      session: session.label,
      sessionTradeable: session.canTrade,
      heuristic,
      llm,
      llmEnabled: Boolean(key),
      llmModel: key ? model : null,
      llmError,
      context: {
        regime: ctx.regime,
        h1Adx: ctx.h1Adx,
        longBias: ctx.longBias,
        chopZone: ctx.chopZone,
        m15Rsi: ctx.m15Rsi,
        spreadPips: ctx.spreadPips,
      },
      structure: {
        supports: chart.supports,
        resistances: chart.resistances,
      },
      events: chart.events.slice(-6),
      signal: ctx.signal ?? null,
      rejected: ctx.rejected,
      analyzedAt: now.toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 502 }
    );
  }
}