# Backtest report - 2021-08-28 → 2024-08-28 | $10000 prop account

- **Window:** 2021-08-29 → 2024-08-28 (5 years, 224277 M5 bars)
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
| final equity | $40157.49 |
| net P&L | +$30157.49 (301.57%) |
| closed trades | 909 |
| open at end | - |
| win rate | 54.79% (498W/411L) |
| avg R | 0.16 |
| total R | 143.82 |
| profit factor | 1.45 |
| expectancy / trade | $33.18 |
| max drawdown (peak) | 9.80% |
| max drawdown vs initial | 0.67% |
| best day | +$1283 |
| worst day | $-702 |
| avg hold | 7.2h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 293 | 22.4 | +$5917 | 0.08 | 53% |
| EUR/USD | 174 | 34.7 | +$6661 | 0.20 | 54% |
| USD/JPY | 165 | 43.8 | +$8587 | 0.27 | 59% |
| USD/CHF | 141 | 11.6 | +$2481 | 0.08 | 50% |
| GBP/USD | 136 | 31.3 | +$6512 | 0.23 | 58% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 573 | 242.1 | +$51406 | 0.42 | 69% |
| sl | 234 | -247.7 | $-54643 | -1.06 | 0% |
| tp1-be | 51 | 36.5 | +$8048 | 0.72 | 100% |
| tp2 | 51 | 112.8 | +$25346 | 2.21 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 820 | 135.4 | +$27945 | 0.17 | 55% |
| continuation | 50 | 2.1 | +$863 | 0.04 | 50% |
| bounce | 22 | 9.7 | +$1939 | 0.44 | 64% |
| reversal | 17 | -3.5 | $-589 | -0.20 | 35% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 328 | 60.6 | +$8973 | 0.18 | 58% |
| 2023 | 304 | 37.9 | +$8801 | 0.12 | 52% |
| 2024 | 204 | 33.8 | +$11216 | 0.17 | 55% |
| 2021 | 73 | 11.5 | +$1168 | 0.16 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 167744 |
| continuation | 106038 |
| breakout | 104621 |
| bounce | 104514 |
| reversal | 104465 |
| no-signal | 104465 |
| trend-filter | 81378 |
| friday | 66217 |
| max-signals | 3781 |
| position | 740 |
| circuit | 733 |
| daily-loss | 322 |

*Generated 2026-08-28T20:36:50.294Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
