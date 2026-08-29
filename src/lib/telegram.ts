import type { Signal } from "./engine";

const seen = new Set<string>();

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Minute-granularity fingerprint so a signal is only pushed once per occurrence. */
export function signalFingerprint(sig: Signal): string {
  return `${sig.symbol}|${sig.direction}|${sig.strategy}|${sig.entry}|${sig.generatedAt.slice(0, 16)}`;
}

export interface TechAnalysis {
  price: number;
  pipSize: number;
  bias: "long" | "short";
  regime: string;
  adx: number;
  chopZone: boolean;
  session: string;
  sessionOk: boolean;
  spreadPips?: number;
  spreadOk?: boolean;
  support?: { price: number; touches: number; confirmed: boolean } | null;
  resistance?: { price: number; touches: number; confirmed: boolean } | null;
  lastEvent?: { kind: "sweep" | "break"; side: "buy" | "sell"; level: number; confirmed: boolean; when: string } | null;
  llm?: string | null;
}

function taPx(n: number, pip: number): string {
  const dec = String(pip).includes(".") ? String(pip).split(".")[1].length : 0;
  return n.toFixed(dec);
}

function levelText(p: number, touches: number, confirmed: boolean, pip: number): string {
  return `${taPx(p, pip)} (${touches}x${confirmed ? " confirmed" : ""})`;
}

/**
 * Deterministic technical-analysis block built from the live pipeline context
 * (same data the Chart Lab heuristic uses) — prefixed on every Telegram signal.
 */
export function formatTechnicalAnalysis(ta: TechAnalysis): string[] {
  const lines: string[] = [];
  lines.push(`H1 bias · ${ta.bias.toUpperCase()} (${ta.regime}, ADX ${ta.adx.toFixed(0)})${ta.chopZone ? " · price inside EMA200 chop zone, trend edge weak" : ""}`);
  lines.push(
    `Structure · nearest support ${ta.support ? levelText(ta.support.price, ta.support.touches, ta.support.confirmed, ta.pipSize) : "none in window"}, resistance ${ta.resistance ? levelText(ta.resistance.price, ta.resistance.touches, ta.resistance.confirmed, ta.pipSize) : "none in window"}`
  );
  lines.push(
    `Liquidity · ${ta.lastEvent ? `${ta.lastEvent.kind} ${ta.lastEvent.side === "buy" ? "of support (buy reclaim)" : "of resistance (sell reclaim)"} @ ${taPx(ta.lastEvent.level, ta.pipSize)}${ta.lastEvent.confirmed ? " (confirmed)" : ""} · ${ta.lastEvent.when}Z` : "no recent sweep in the visible window"}`
  );
  lines.push(`Session · ${ta.session} ${ta.sessionOk ? "(tradeable)" : "(gated)"}`);
  if (ta.spreadPips !== undefined) lines.push(`Spread · ${ta.spreadPips.toFixed(1)}p ${ta.spreadOk !== false ? "ok" : "(elevated)"}`);
  if (ta.llm) lines.push(`AI read · ${ta.llm.replace(/\s+/g, " ").trim()}`);
  return lines;
}

/**
 * Exact output format from the system prompt (SIGNAL OUTPUT FORMAT) with sizing appended.
 * Plain text — safe for Telegram Markdown.
 */
export function formatSignal(sig: Signal): string {
  const lines = [
    `PAIR: ${sig.symbol}`,
    `DIRECTION: ${sig.direction.toUpperCase()}`,
    `STRATEGY: ${sig.strategy}`,
    `ENTRY: ${sig.entry}`,
    `SL: ${sig.sl} (${sig.slPips.toFixed(1)} pips / ${sig.slAtr.toFixed(1)}x ATR)`,
    `TP1: ${sig.tp1} (1.5R, move SL to BE)`,
    `TP2: ${sig.tp2} (3R, full close)`,
    `SESSION: ${sig.session}`,
    `REGIME: ${sig.regime.kind === "trending" ? `trending (ADX ${sig.regime.adx.toFixed(0)})` : "ranging"}`,
    `SIZE: ${sig.lots.toFixed(2)} lots - risk $${sig.riskAmount.toFixed(0)} (1% equity)`,
  ];
  if (sig.confidenceNotes) lines.push("", sig.confidenceNotes);
  return lines.join("\n");
}

/** Full Telegram alert: technical analysis first, then the engine setup. */
export function formatTradeAlert(sig: Signal, ta?: TechAnalysis | null): string {
  const setup = formatSignal(sig);
  if (!ta) return setup;
  const taLines = formatTechnicalAnalysis(ta);
  if (taLines.length === 0) return setup;
  return [`TRADING SETUP · ${sig.symbol}`, "", "TECHNICAL ANALYSIS", ...taLines.map((l) => `▪ ${l}`), "", "SETUP", setup].join("\n");
}

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

export async function sendTelegramMessage(text: string, chatIdOverride?: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data?.description || `Telegram HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Telegram network error" };
  }
}

/**
 * Push a signal to Telegram unless it was already pushed (per instance or per
 * the caller's recent signal log). Returns whether it was sent.
 */
export async function maybePushSignal(
  sig: Signal,
  recentLogs: { kind: string; reason: string; time: string }[],
  chatIdOverride?: string,
  ta?: TechAnalysis | null
): Promise<{ sent: boolean; error?: string }> {
  const fp = signalFingerprint(sig);
  if (seen.has(fp)) return { sent: false };
  const inLogs = recentLogs.some(
    (l) => l.kind === "signal" && l.time.startsWith(sig.generatedAt.slice(0, 16)) && l.reason.includes(sig.symbol)
  );
  if (inLogs) return { sent: false };
  seen.add(fp);
  const res = await sendTelegramMessage(formatTradeAlert(sig, ta ?? null), chatIdOverride);
  if (!res.ok) {
    seen.delete(fp); // allow retry next scan
    return { sent: false, error: res.error };
  }
  return { sent: true };
}