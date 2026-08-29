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
| final equity | $12010.93 |
| net P&L | +$2010.93 (20.11%) |
| closed trades | 60 |
| open at end | - |
| win rate | 55.00% (33W/27L) |
| avg R | 0.31 |
| total R | 18.78 |
| profit factor | 1.80 |
| expectancy / trade | $33.52 |
| max drawdown (peak) | 5.39% |
| max drawdown vs initial | 0.29% |
| best day | +$261 |
| worst day | $-255 |
| avg hold | 3.3h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 37 | 3.5 | +$376 | 0.10 | 49% |
| GBP/USD | 13 | 5.4 | +$544 | 0.42 | 62% |
| USD/JPY | 8 | 10.4 | +$1152 | 1.29 | 75% |
| EUR/USD | 1 | 0.7 | +$72 | 0.69 | 100% |
| USD/CHF | 1 | -1.2 | $-133 | -1.19 | 0% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 24 | 15.3 | +$1657 | 0.64 | 71% |
| sl | 20 | -21.3 | $-2375 | -1.07 | 0% |
| tp2 | 9 | 19.8 | +$2161 | 2.19 | 100% |
| tp1-be | 7 | 5.1 | +$568 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| bounce | 60 | 18.8 | +$2011 | 0.31 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2026 | 16 | 4.7 | +$536 | 0.29 | 56% |
| 2022 | 12 | 1.5 | +$146 | 0.13 | 50% |
| 2023 | 12 | 9.7 | +$1027 | 0.81 | 75% |
| 2024 | 11 | 2.0 | +$216 | 0.18 | 45% |
| 2025 | 9 | 0.8 | +$85 | 0.09 | 44% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| breakout | 175419 |
| bounce | 175355 |
| reversal | 175355 |
| no-signal | 175355 |
| trend-filter | 143730 |
| friday | 110704 |
| position | 4 |

*Generated 2026-08-29T03:50:10.599Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
