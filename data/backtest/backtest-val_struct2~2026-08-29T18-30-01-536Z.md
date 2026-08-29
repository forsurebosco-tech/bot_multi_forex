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
| final equity | $108146.28 |
| net P&L | +$98146.28 (981.46%) |
| closed trades | 1001 |
| open at end | - |
| win rate | 55.94% (560W/441L) |
| avg R | 0.25 |
| total R | 245.43 |
| profit factor | 1.62 |
| expectancy / trade | $98.05 |
| max drawdown (peak) | 12.45% |
| max drawdown vs initial | 0.89% |
| best day | +$4759 |
| worst day | $-3575 |
| avg hold | 5.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 241 | 41.5 | +$13534 | 0.17 | 51% |
| US30 | 230 | 48.5 | +$17926 | 0.21 | 53% |
| XAU/USD | 176 | 80.0 | +$36898 | 0.45 | 65% |
| GBP/USD | 98 | 19.4 | +$11263 | 0.20 | 56% |
| EUR/USD | 96 | 15.4 | +$4701 | 0.16 | 54% |
| USD/JPY | 85 | 30.5 | +$11028 | 0.36 | 62% |
| USD/CHF | 75 | 10.2 | +$2798 | 0.14 | 55% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 437 | 220.5 | +$90392 | 0.50 | 72% |
| sl | 318 | -331.4 | $-140763 | -1.04 | 0% |
| tp2 | 131 | 275.5 | +$112969 | 2.10 | 100% |
| tp1-be | 115 | 80.8 | +$35548 | 0.70 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 921 | 223.3 | +$91495 | 0.24 | 56% |
| continuation | 50 | 9.0 | +$1722 | 0.18 | 54% |
| bounce | 28 | 11.3 | +$4042 | 0.40 | 61% |
| reversal | 2 | 1.9 | +$888 | 0.93 | 100% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2025 | 505 | 137.3 | +$42518 | 0.27 | 57% |
| 2026 | 304 | 64.9 | +$50441 | 0.21 | 55% |
| 2024 | 192 | 43.2 | +$5188 | 0.23 | 56% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 152767 |
| continuation | 89372 |
| breakout | 88023 |
| bounce | 87913 |
| reversal | 87893 |
| no-signal | 87893 |
| trend-filter | 68411 |
| friday | 61465 |
| max-signals | 25220 |
| circuit | 5068 |
| daily-loss | 4268 |
| position | 554 |

*Generated 2026-08-29T18:30:01.536Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
