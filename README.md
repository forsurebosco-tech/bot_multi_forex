# Forex + Gold Day-Trading Signal Engine

A Next.js dashboard that applies the **exact** ruleset from the `SYSTEM_PROMPT.md` (ROLE → GUARDRAILS): scans the FX / XAU·USD watchlist, runs the H1 trend filter, evaluates the four entry strategies top-down, applies session/news/spread/correlation gates, sizes each signal off its own ATR, and logs every rejection reason. It is a **signal engine only** — it never places trades.

Hosts on Vercel. Market data comes from the **OANDA v20 REST API**.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your OANDA credentials
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable              | Purpose                                                          | Demo          |
| --------------------- | ---------------------------------------------------------------- | ------------- |
| `OANDA_API_TOKEN`     | Personal v20 access token from your OANDA account portal (`Manage API Access`) | (required) |
| `OANDA_ACCOUNT_ID`    | e.g. `101-004-1234567-001`                                       | (required)    |
| `OANDA_ENVIRONMENT`   | `practice` (demo) or `live`                                      | practice      |
| `OANDA_BASE_URL`      | optional override; defaults to `https://api-fxpractice.oanda.com` / `https://api-fxtrade.oanda.com` from the environment | auto |
| `TELEGRAM_BOT_TOKEN`  | bot token from @BotFather — notify a chat on every new signal    | (optional)    |
| `TELEGRAM_CHAT_ID`    | chat/group/user id the bot posts to (get it with @userinfobot)   | (optional)    |

On Vercel: add these as environment variables (Project → Settings → Environment Variables). `.env.local` holds your real values and is gitignored.

## What it does

- **Watchlist** — optimized 5-instrument profile: **EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD**. USD/CAD, AUD/USD, NZD/USD and all crosses ship disabled (`enabled: false` in `src/lib/config.ts`) — the 2021–26 backtest showed they bleed structurally under this ruleset. Flip back on only after a live track record.
- **Timeframe stack** — H1 trend/regime (EMA200 + ADX14), M15 setup (EMA50 pullback, 20-bar breakout, S/R pivots), M5 trigger (EMA21 reclaim, RSI turn, pin/engulfing).
- **4 entry strategies, first match fires** — `continuation` (workhorse), `breakout` (range-expansion + M5 close confirmation, never the breakout bar), `bounce` (only strategy allowed when ADX < 20), `reversal` (rare, tightly gated).
- **Risk management** — 1% fixed-dollar risk, SL = 1.8× ATR(14) placed beyond the invalidating structure, TP1 1.5R → breakeven, TP2 3R, lot size computed **per pair off its own ATR/pip value**, 1 max position per pair / 3 total, no doubled correlated exposure (gold counts as a USD basket and pairs with exactly one aligned USD-major as a single correlated bet).
- **Session + event gates** — London/NY only (overlap prioritized), no new entries last 30 min of NY, **day-trading rule: all positions force-flat at 21:00 GMT** (`risk.closeAtSessionEnd`, `risk.sessionCloseMinutes`) — no overnight or weekend holds. **No entries on Friday** (`risk.noFridayEntries`) — the ONLY losing weekday after the 2021–26 backtest. 15-min red-folder news blackout (widened to 30 min for FOMC), skip pairs whose spread exceeds 2× typical.
- **Circuit breaker** — pause until next session after 3 consecutive stop-outs; stop for the day at −3%.
- **Backtester** — `npx tsx scripts/backtest-5y.ts` replays the same `analyzePair` over the whole watchlist for N years (default 5) on a configurable equity (`--equity=`, `--start=`/`--end=` windows, `--pairs=` sub-list), with shared engine state, correlation limits, TP1-partial/TP2 exit modeling, M5-bar fills, spread costs, prop-firm hard stops (daily −5%, max −10% static, both from day-start/initial) and the force-flat day-trading rule. Emits a full markdown report + equity CSV + trade JSON into `data/backtest/` (each trade now also logs `stopPips`/`tp1Pips`/`tp2Pips` — the R:R in pips — and `realizedPips`). `--fresh` refetches OANDA history (cached otherwise), `--years=N` changes the window.
- **Optimized profile** — grid-searched knobs baked into `src/lib/config.ts`: `setup.breakoutRangeMult: 1.6`, `risk.atrMult: 2.3` (baseline stop, used when no structure), `risk.maxConsecutiveLosses: 3`, uniform all-4 strategies with **counter-trend shorts disabled** (`reversalShortEnabled`/`bounceShortEnabled: false` — short legs lost at 25%/42% win), on a **7-market watchlist — EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD, and index CFDs NAS100 + US30** (SPX500, USD/CAD, AUD/USD, NZD/USD `enabled: false` after backtests) + Friday gate reproduces `$10,000 → $1,230,455 (+12,205%)` over 2021–08→2026–08: **2,611 trades, 53.0% win, +501R, PF 1.61, max DD from initial 3.9% (peak 13.1%)**. Loss analysis: 100% of red R comes from SL stops, no single pair is a loser-quality outlier, winners hold longer (7.7h) than losers (5.0h) — the fixes were (1) cutting the low-win-rate short flanks (reversal/bounce), and (2) **structural stops** (below). **Walk-forward verified:** training 2021–08→2024–08 +954% (PF 1.35); untouched validation 2024–08→2026–08 **+1,105% (PF 1.66, ddPeak 12.0%)** — the pre-optimization ruleset blew in 7 weeks on this same window (−10.6% by 2024-10-18). Practice OANDA account is currency-only; index orders require a CFD-capable account (candles/backtests work either way).
- **Structural stops (2026-08):** SLs are now anchored to **confirmed M15 swing structure** instead of a blind ATR number — stop sits below the nearest ≥2-pivot support (long) / above the nearest ≥2-pivot resistance (short) plus a 0.5·ATR buffer (`setup.structuralSlBufferAtr`, cap 3·ATR `structuralSlCapAtr`, ATR fallback when no clean level exists), so **1R = a real invalidation point**. OOS this was the single biggest verified edge (+256R / PF 1.66 vs +193R / PF 1.55 on the untouched 2024–26 window). Structural TP magnets (`structuralTpEnabled`) won on the fit window but **failed out-of-sample** (win-rate drag ~45%), so TPs stay proportional R-multiples of the *structural* stop (1.5R/3R) — the knob remains if you want to trial them live. Signal notes now print the level, e.g. `SL above resistance 4029.81500 (3 pivots, 0.5 ATR buffer)`.
- **Chart Lab (`/chart`)** — interactive `lightweight-charts` panel: candlestick chart with toggleable EMA21/50/200, confirmed S/R price lines, sweep/break markers (wick reclaims vs structure breaks), the live engine signal overlaid as ENTRY/SL/TP1/TP2 lines, a Structure & Sweeps readout, always-on AI commentary (heuristic; optional LLM via `AI_API_KEY`/`OPENAI_API_KEY` + `AI_BASE_URL`/`AI_MODEL`), and a manual trade panel (BUY/SELL, 1%-risk lot estimate, SL/TP prefilled from the signal or nearest structure, open-position close). Backed by `/api/chart`, `/api/analyze`, `/api/trade`.
- **Calibration knobs** (all in `src/lib/config.ts`): `setup.breakoutRangeMult` (#/-quality of the breakout workhorse), `risk.atrMult` (SL width), `risk.maxConsecutiveLosses` (breaker leniency), `trend.adxThreshold`/`adxReversalThreshold`, `setup.reversalRsiOversold/Overbought` + `risk.maxReversalPerDay` (keeps the counter-trend `reversal` rare), `setup.continuationRsiFloor`/`continuationPullbackDist`/`continuationReclaimAtr` (continuation frequency). The backtester accepts live overrides: `--k.<dotted.path>=value`, `--strategies=breakout,continuation,bounce,reversal` (isolate/compose any strategy mix), per-pair routing via `--k.setup.symbolStrategies.EUR/USD=breakout,bounce`, `--tag=`, `--summary` prints a one-line RESULT for grid search. Live deployments should respect `eodCloseDue(now, cfg)` to flatten positions at 21:00 GMT.

## API routes

| Route            | Method   | Description                                                                  |
| ---------------- | -------- | ---------------------------------------------------------------------------- |
| `/api/scan`      | POST     | Fetch H1/M15/M5 for the watchlist, run the engine, return signals + per-pair gates + updated state. Body: `{ state?, equity?, newsEvents?, config? }` |
| `/api/candles`   | GET      | OANDA candle proxy. `?symbol=EUR_USD&granularity=M15&count=200&price=M`       |
| `/api/backtest`  | POST     | Body `{ symbol: "EUR/USD", days: 3, equity }`. Returns trades + summary.      |
| `/api/config`    | GET      | Watchlist, strategy config, account rules, current session.                  |
| `/api/chart`     | GET      | Chart-lab feed for `/chart`. `?symbol=NAS100&granularity=M15&count=500` → OHLCV bars, EMA21/50/200, ATR14, confirmed S/R levels, sweep/break events. Accepts display names (`EUR/USD`), OANDA instrument names (`EUR_USD`) and index names (`NAS100`/`US30`). |
| `/api/analyze`   | GET      | Engine analysis for one symbol (H1/M15/M5) + always-on heuristic commentary + optional LLM (set `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`). |
| `/api/trade`     | GET/POST | GET: account summary + open positions. POST `{ symbol, direction, lots, sl?, tp? }` places a FOK market order. Practice accounts accept currency pairs only (indices/gold get rejected). |
| `/api/trade/positions` | DELETE | `?symbol=EUR_USD` closes the open position for that instrument. |
| `/api/telegram/webhook` | POST | Inbound Telegram bot commands. Set the bot's webhook to your deployed URL: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/telegram/webhook` |

No persistence is assumed: the dashboard keeps engine state (signals today, circuit breaker, positions) in browser `localStorage` and sends it back on each scan, so the server stays stateless — deploy to Vercel with no database.

## Telegram alerts

- **Outbound (recommended):** with `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` set, every new signal fired by `/api/scan` (the dashboard Scan button or the 15-min cron) is pushed to the chat as the exact system-prompt signal block (`PAIR` → `SIZE`). A fingerprint + the scan state dedupe each signal so it is sent once per occurrence.
- **Inbound commands:** the bot answers `/scan` (run the whole watchlist and reply with signals), `/status`, and `/help`. After deploying, register the webhook once:
  `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/telegram/webhook"`
  (For local dev, use `getUpdates` with a polling loop instead — the webhook needs a public HTTPS URL.)
- `scripts/live-scan.ts` runs the same pipeline from the CLI: `set OANDA_API_TOKEN=... OANDA_ACCOUNT_ID=... OANDA_ENVIRONMENT=practice; npx tsx scripts/live-scan.ts`.

## News blackout

The engine checks a `newsEvents` list (empty by default). To activate, add calendar entries — release times you enter yourself or pull from a provider — and pass them per-scan:

```ts
const newsEvents = [
  { start: new Date("2026-09-04T12:30:00Z").getTime(),
    end:   new Date("2026-09-04T12:30:00Z").getTime(),
    currencies: ["USD"], label: "NFP" },
  { start: ..., end: ..., currencies: ["USD"], label: "FOMC" }, // widened to 30 min
];
```

## Filling in your placeholders

- Account size / equity → on the dashboard and `ACCOUNT_RULES.equity` in `src/lib/config.ts`.
- Broker/spread assumptions → `typicalSpreadPips` per instrument in `src/lib/config.ts`, and `OANDA_BASE_URL` per account type.
- Pair list → toggle `enabled` per instrument in `src/lib/config.ts`.
- Prop-firm rule (e.g. 20% best-day / consistency) → add as a hard gate in `runScanPipeline` or `analyzePair` (check before `computeSize`, mirroring the daily-loss gate).

## Deploy

1. Push the folder to a GitHub repo.
2. Import it in Vercel → framework preset auto-detected (Next.js).
3. Set the five environment variables (`OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID`, `OANDA_ENVIRONMENT`, and optional Telegram pair).
4. Deploy. `vercel.json` also registers an optional cron that pings `/api/scan` every 15 min during London/NY hours (replay/alert use). Cached signal pushes on a cold cron instance are best-effort deduped by fingerprint.

## Notes / limits

- Demo OANDA candles are midpoint; spread gate uses live bid/ask. A real feed should use the same price component the broker will fill at, and live execution should be wired to OANDA orders (`/v3/accounts/{id}/orders`) — intentionally not done here.
- S/R detection is pivot-cluster based; trendline bounces are not auto-drawn (documented in strategy 3).
- The engine is deterministic per snapshot and never outputs free text outside the signal block.