import { NextRequest, NextResponse } from "next/server";
import { OandaClient } from "@/lib/oanda";
import { WATCHLIST, DEFAULT_CONFIG } from "@/lib/config";
import { runScanPipeline, initialState, sessionAt, type PairContext, type Signal } from "@/lib/engine";
import { formatSignal, sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HELP = [
  "FX/Gold signal engine bot",
  "/scan - run a full watchlist scan now",
  "/status - session, regime snapshot, config",
  "/help - this message",
  "",
  "Signals are also auto-pushed here whenever the engine fires one.",
].join("\n");

async function scanAndReply(chatId: string): Promise<{ ok: boolean; error?: string }> {
  const client = new OandaClient();
  if (!client.isConfigured) {
    return sendTelegramMessage("OANDA API not configured", chatId);
  }
  try {
    const now = new Date();
    const { contexts } = await runScanPipeline(client, WATCHLIST, DEFAULT_CONFIG, now, initialState(10000), []);
    const signals = contexts.filter((c): c is PairContext & { signal: Signal } => Boolean(c.signal)).map((c) => c.signal);

    if (signals.length === 0) {
      const sess = sessionAt(now);
      const gateCount = contexts.filter((c) => c.rejected.length > 0).length;
      return sendTelegramMessage(
        `No qualifying setups right now.\nSession: ${sess.label} (${sess.canTrade ? "tradeable" : "closed"})\n${gateCount}/${contexts.length} pairs gated out.\nTry again on the next M5 close.`,
        chatId
      );
    }
    for (const s of signals) {
      const res = await sendTelegramMessage(formatSignal(s), chatId);
      if (!res.ok) return res;
    }
    return { ok: true };
  } catch (err) {
    return sendTelegramMessage(`Scan failed: ${err instanceof Error ? err.message : "unknown"}`, chatId);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body?.message;
    const text = (msg?.text || "").trim();
    const chatId = String(msg?.chat?.id || "");
    if (!chatId) return NextResponse.json({ ok: true });

    if (text === "/start" || text === "/help") {
      await sendTelegramMessage(HELP, chatId);
    } else if (text === "/scan") {
      await scanAndReply(chatId);
    } else if (text === "/status") {
      const sess = sessionAt(new Date());
      const env = (process.env.OANDA_ENVIRONMENT || "practice").toUpperCase();
      await sendTelegramMessage(
        [`STATUS`, `OANDA: ${env} ${new OandaClient().isConfigured ? "configured" : "NOT configured"}`, `SESSION: ${sess.label} (${sess.canTrade ? "tradeable" : "closed"})`, `WATCHLIST: ${WATCHLIST.filter((w) => w.enabled).length} pairs`, `Mode: signal-only (no execution)`].join("\n"),
        chatId
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("telegram webhook error", err);
    return NextResponse.json({ ok: true, error: String(err) }, { status: 500 });
  }
}

// Telegram polls this URL with a GET when checking setup; return 200.
export async function GET() {
  return NextResponse.json({ ok: true });
}