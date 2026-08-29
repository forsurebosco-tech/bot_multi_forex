# Backtest report - 2021-08-28 → 2024-08-28 | $10000 prop account

- **Window:** 2021-08-29 → 2024-08-28 (5 years, 224277 M5 bars)
- **Instruments:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD
- **Initial equity:** $10000 | risk 1% = $100/trade
- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, 3 signals/day, -3% engine day stop, 2-SL breaker, 1 pos/pair, max 3 concurrent, correlation (gold = USD bucket).
- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.
- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.
- **Day-trading rule:** positions force-flat at 21:00 GMT (end of NY) — no overnight/weekend holds

## ✅ ACCOUNT DOUBLED (200% target)


## Headline

| metric | value |
| --- | --- |
| final equity | $38443.45 |
| net P&L | +$28443.45 (284.43%) |
| closed trades | 844 |
| open at end | - |
| win rate | 54.86% (463W/381L) |
| avg R | 0.16 |
| total R | 139.11 |
| profit factor | 1.47 |
| expectancy / trade | $33.70 |
| max drawdown (peak) | 8.42% |
| max drawdown vs initial | 0.67% |
| best day | +$1165 |
| worst day | $-682 |
| avg hold | 7.5h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 263 | 21.8 | +$5524 | 0.08 | 54% |
| USD/JPY | 162 | 43.0 | +$8642 | 0.27 | 59% |
| EUR/USD | 156 | 35.2 | +$6480 | 0.23 | 54% |
| USD/CHF | 137 | 13.5 | +$2652 | 0.10 | 52% |
| GBP/USD | 126 | 25.6 | +$5145 | 0.20 | 56% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 542 | 225.8 | +$47364 | 0.42 | 68% |
| sl | 210 | -221.7 | $-48054 | -1.06 | 0% |
| tp1-be | 46 | 33.1 | +$6986 | 0.72 | 100% |
| tp2 | 46 | 101.9 | +$22147 | 2.21 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 817 | 127.3 | +$25590 | 0.16 | 55% |
| continuation | 11 | 0.2 | +$191 | 0.02 | 45% |
| bounce | 10 | 8.0 | +$1655 | 0.80 | 80% |
| reversal | 6 | 3.6 | +$1008 | 0.59 | 67% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 306 | 65.4 | +$9871 | 0.21 | 59% |
| 2023 | 279 | 25.7 | +$5764 | 0.09 | 51% |
| 2024 | 190 | 37.6 | +$11766 | 0.20 | 55% |
| 2021 | 69 | 10.3 | +$1043 | 0.15 | 52% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 167744 |
| breakout | 97602 |
| reversal | 97546 |
| no-signal | 97546 |
| trend-filter | 79573 |
| friday | 66217 |
| bounce | 39360 |
| continuation | 38710 |
| max-signals | 16726 |
| position | 632 |
| circuit | 556 |
| daily-loss | 197 |

*Generated 2026-08-29T04:26:10.556Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
