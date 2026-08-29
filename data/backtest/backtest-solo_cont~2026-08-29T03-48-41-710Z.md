# Backtest report - 5Y | $10000 prop account

- **Window:** 2021-08-29 → 2026-08-28 (5 years, 373654 M5 bars)
- **Instruments:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD
- **Initial equity:** $10000 | risk 1% = $100/trade
- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, 4 signals/day, -3% engine day stop, 2-SL breaker, 1 pos/pair, max 3 concurrent, correlation (gold = USD bucket).
- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.
- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.
- **Day-trading rule:** positions force-flat at 21:00 GMT (end of NY) — no overnight/weekend holds

## ✅ SURVIVED FULL WINDOW


## Headline

| metric | value |
| --- | --- |
| final equity | $11097.35 |
| net P&L | +$1097.35 (10.97%) |
| closed trades | 121 |
| open at end | - |
| win rate | 50.41% (61W/60L) |
| avg R | 0.09 |
| total R | 11.17 |
| profit factor | 1.20 |
| expectancy / trade | $9.07 |
| max drawdown (peak) | 9.61% |
| max drawdown vs initial | 8.81% |
| best day | +$248 |
| worst day | $-242 |
| avg hold | 4.6h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 35 | 3.0 | +$284 | 0.09 | 49% |
| USD/JPY | 25 | 6.2 | +$649 | 0.25 | 64% |
| GBP/USD | 23 | -1.4 | $-171 | -0.06 | 43% |
| EUR/USD | 23 | 0.3 | +$55 | 0.01 | 48% |
| USD/CHF | 15 | 3.1 | +$280 | 0.20 | 47% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 57 | 31.2 | +$3213 | 0.55 | 74% |
| sl | 45 | -48.4 | $-4970 | -1.08 | 0% |
| tp2 | 10 | 22.1 | +$2216 | 2.21 | 100% |
| tp1-be | 9 | 6.3 | +$639 | 0.70 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| continuation | 121 | 11.2 | +$1097 | 0.09 | 50% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2023 | 28 | 9.9 | +$951 | 0.35 | 50% |
| 2022 | 26 | -5.5 | $-549 | -0.21 | 42% |
| 2025 | 25 | 6.2 | +$660 | 0.25 | 60% |
| 2024 | 24 | 1.5 | +$138 | 0.06 | 54% |
| 2026 | 13 | -0.4 | $-51 | -0.03 | 38% |
| 2021 | 5 | -0.5 | $-51 | -0.10 | 60% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| breakout | 175419 |
| continuation | 175290 |
| reversal | 175290 |
| no-signal | 175290 |
| trend-filter | 143730 |
| friday | 110704 |
| position | 8 |

*Generated 2026-08-29T03:48:41.709Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
