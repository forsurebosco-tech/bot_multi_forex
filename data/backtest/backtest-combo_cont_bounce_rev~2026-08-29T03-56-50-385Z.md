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
| final equity | $14408.82 |
| net P&L | +$4408.82 (44.09%) |
| closed trades | 239 |
| open at end | - |
| win rate | 52.72% (126W/113L) |
| avg R | 0.16 |
| total R | 38.17 |
| profit factor | 1.38 |
| expectancy / trade | $18.45 |
| max drawdown (peak) | 12.50% |
| max drawdown vs initial | 9.34% |
| best day | +$336 |
| worst day | $-438 |
| avg hold | 3.9h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 80 | 12.2 | +$1359 | 0.15 | 51% |
| GBP/USD | 53 | 13.8 | +$1394 | 0.26 | 57% |
| USD/JPY | 43 | 15.6 | +$1920 | 0.36 | 63% |
| EUR/USD | 35 | -3.0 | $-194 | -0.09 | 46% |
| USD/CHF | 28 | -0.4 | $-70 | -0.01 | 43% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 102 | 60.5 | +$7178 | 0.59 | 75% |
| sl | 88 | -94.4 | $-10830 | -1.07 | 0% |
| tp2 | 25 | 55.0 | +$6048 | 2.20 | 100% |
| tp1-be | 24 | 17.0 | +$2012 | 0.71 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| continuation | 121 | 11.2 | +$1244 | 0.09 | 50% |
| reversal | 60 | 9.2 | +$1157 | 0.15 | 55% |
| bounce | 58 | 17.8 | +$2007 | 0.31 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2023 | 52 | 15.7 | +$1541 | 0.30 | 50% |
| 2022 | 50 | -9.1 | $-918 | -0.18 | 42% |
| 2024 | 48 | 13.3 | +$1500 | 0.28 | 60% |
| 2025 | 46 | 12.7 | +$1640 | 0.28 | 61% |
| 2026 | 36 | 2.9 | +$387 | 0.08 | 47% |
| 2021 | 7 | 2.6 | +$260 | 0.37 | 71% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| breakout | 175357 |
| continuation | 175228 |
| bounce | 175164 |
| reversal | 175104 |
| no-signal | 175104 |
| trend-filter | 143652 |
| friday | 110704 |
| circuit | 186 |
| daily-loss | 186 |
| position | 14 |

*Generated 2026-08-29T03:56:50.384Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
