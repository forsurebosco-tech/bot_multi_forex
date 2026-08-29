# Backtest report - 5Y | $10000 prop account

- **Window:** 2021-08-29 → 2026-08-28 (5 years, 373712 M5 bars)
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
| final equity | $146451.95 |
| net P&L | +$136451.95 (1364.52%) |
| closed trades | 1471 |
| open at end | - |
| win rate | 55.81% (821W/650L) |
| avg R | 0.19 |
| total R | 276.15 |
| profit factor | 1.71 |
| expectancy / trade | $92.76 |
| max drawdown (peak) | 9.80% |
| max drawdown vs initial | 0.67% |
| best day | +$7473 |
| worst day | $-3530 |
| avg hold | 7.2h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 486 | 85.9 | +$56663 | 0.18 | 56% |
| EUR/USD | 272 | 47.0 | +$13887 | 0.17 | 54% |
| USD/JPY | 253 | 71.6 | +$30746 | 0.28 | 60% |
| GBP/USD | 241 | 50.8 | +$24658 | 0.21 | 57% |
| USD/CHF | 219 | 20.9 | +$10498 | 0.10 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 949 | 415.3 | +$182894 | 0.44 | 70% |
| sl | 361 | -380.6 | $-154072 | -1.05 | 0% |
| tp2 | 84 | 186.2 | +$85227 | 2.22 | 100% |
| tp1-be | 77 | 55.3 | +$22403 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1310 | 248.5 | +$121803 | 0.19 | 56% |
| continuation | 84 | 9.7 | +$2307 | 0.12 | 52% |
| bounce | 48 | 15.5 | +$7521 | 0.32 | 56% |
| reversal | 29 | 2.5 | +$4820 | 0.08 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 329 | 61.6 | +$9178 | 0.19 | 58% |
| 2024 | 321 | 41.7 | +$14502 | 0.13 | 54% |
| 2023 | 305 | 38.3 | +$8991 | 0.13 | 52% |
| 2025 | 274 | 71.7 | +$44730 | 0.26 | 56% |
| 2026 | 169 | 51.4 | +$57883 | 0.30 | 62% |
| 2021 | 73 | 11.5 | +$1168 | 0.16 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279593 |
| continuation | 172728 |
| breakout | 170470 |
| bounce | 170278 |
| reversal | 170193 |
| no-signal | 170193 |
| trend-filter | 142813 |
| friday | 110804 |
| max-signals | 5461 |
| position | 1193 |
| circuit | 785 |
| daily-loss | 322 |

*Generated 2026-08-29T05:27:33.731Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
