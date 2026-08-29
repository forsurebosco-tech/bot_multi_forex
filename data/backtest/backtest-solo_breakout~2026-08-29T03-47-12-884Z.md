# Backtest report - 5Y | $10000 prop account

- **Window:** 2021-08-29 → 2026-08-28 (5 years, 373654 M5 bars)
- **Instruments:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD
- **Initial equity:** $10000 | risk 1% = $100/trade
- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, 4 signals/day, -3% engine day stop, 2-SL breaker, 1 pos/pair, max 3 concurrent, correlation (gold = USD bucket).
- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.
- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.
- **Day-trading rule:** positions force-flat at 21:00 GMT (end of NY) — no overnight/weekend holds

## ✅ ACCOUNT DOUBLED (200% target)


## Headline

| metric | value |
| --- | --- |
| final equity | $109373.61 |
| net P&L | +$99373.61 (993.74%) |
| closed trades | 1339 |
| open at end | - |
| win rate | 55.71% (746W/593L) |
| avg R | 0.18 |
| total R | 246.10 |
| profit factor | 1.69 |
| expectancy / trade | $74.21 |
| max drawdown (peak) | 8.90% |
| max drawdown vs initial | 0.67% |
| best day | +$4439 |
| worst day | $-2664 |
| avg hold | 7.5h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 434 | 78.2 | +$41113 | 0.18 | 56% |
| EUR/USD | 249 | 47.3 | +$11863 | 0.19 | 55% |
| USD/JPY | 233 | 59.0 | +$20068 | 0.25 | 59% |
| GBP/USD | 213 | 34.8 | +$16089 | 0.16 | 54% |
| USD/CHF | 210 | 26.8 | +$10241 | 0.13 | 53% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 902 | 380.1 | +$139960 | 0.42 | 69% |
| sl | 311 | -326.8 | $-112264 | -1.05 | 0% |
| tp2 | 68 | 150.9 | +$58333 | 2.22 | 100% |
| tp1-be | 58 | 41.8 | +$13345 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1339 | 246.1 | +$99374 | 0.18 | 56% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 297 | 66.2 | +$10100 | 0.22 | 59% |
| 2024 | 297 | 37.3 | +$11765 | 0.13 | 54% |
| 2023 | 280 | 26.4 | +$6022 | 0.09 | 51% |
| 2025 | 249 | 60.4 | +$31494 | 0.24 | 55% |
| 2026 | 146 | 44.8 | +$38893 | 0.31 | 63% |
| 2021 | 70 | 10.9 | +$1100 | 0.16 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| breakout | 171422 |
| reversal | 171422 |
| no-signal | 171422 |
| trend-filter | 143015 |
| friday | 110704 |
| max-signals | 3595 |
| position | 1062 |
| circuit | 764 |
| daily-loss | 197 |

*Generated 2026-08-29T03:47:12.884Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
