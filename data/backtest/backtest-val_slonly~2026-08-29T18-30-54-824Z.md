# Backtest report - 2024-08-28 → 2026-08-28 | $10000 prop account

- **Window:** 2024-08-28 → 2026-08-28 (5 years, 149185 M5 bars)
- **Instruments:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD, NAS100, US30
- **Initial equity:** $10000 | risk 1% = $100/trade
- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, 4 signals/day, -3% engine day stop, 2-SL breaker, 1 pos/pair, max 3 concurrent, correlation (gold = USD bucket).
- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.
- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.
- **Day-trading rule:** positions force-flat at 21:00 GMT (end of NY) — no overnight/weekend holds

## ✅ ACCOUNT DOUBLED (200% target)


## Headline

| metric | value |
| --- | --- |
| final equity | $120445.55 |
| net P&L | +$110445.55 (1104.46%) |
| closed trades | 998 |
| open at end | - |
| win rate | 56.31% (562W/436L) |
| avg R | 0.26 |
| total R | 256.40 |
| profit factor | 1.66 |
| expectancy / trade | $110.67 |
| max drawdown (peak) | 12.00% |
| max drawdown vs initial | 1.10% |
| best day | +$5244 |
| worst day | $-3873 |
| avg hold | 5.5h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 240 | 47.9 | +$17679 | 0.20 | 51% |
| US30 | 228 | 50.5 | +$19000 | 0.22 | 54% |
| XAU/USD | 176 | 79.6 | +$38870 | 0.45 | 65% |
| GBP/USD | 98 | 18.0 | +$11245 | 0.18 | 56% |
| EUR/USD | 95 | 16.4 | +$5835 | 0.17 | 55% |
| USD/JPY | 85 | 30.5 | +$11878 | 0.36 | 62% |
| USD/CHF | 76 | 13.4 | +$5939 | 0.18 | 57% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 443 | 234.1 | +$103343 | 0.53 | 73% |
| sl | 317 | -330.1 | $-150237 | -1.04 | 0% |
| tp2 | 120 | 267.1 | +$115904 | 2.23 | 100% |
| tp1-be | 118 | 85.4 | +$41435 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 917 | 231.8 | +$103081 | 0.25 | 56% |
| continuation | 50 | 11.1 | +$2532 | 0.22 | 54% |
| bounce | 28 | 10.5 | +$3587 | 0.38 | 61% |
| reversal | 3 | 3.0 | +$1246 | 0.99 | 100% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2025 | 503 | 143.3 | +$46959 | 0.28 | 57% |
| 2026 | 303 | 67.9 | +$57998 | 0.22 | 55% |
| 2024 | 192 | 45.2 | +$5489 | 0.24 | 56% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 152767 |
| continuation | 89409 |
| breakout | 88057 |
| bounce | 87947 |
| reversal | 87928 |
| no-signal | 87928 |
| trend-filter | 68532 |
| friday | 61465 |
| max-signals | 24983 |
| circuit | 4650 |
| daily-loss | 3958 |
| position | 559 |

*Generated 2026-08-29T18:30:54.824Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
