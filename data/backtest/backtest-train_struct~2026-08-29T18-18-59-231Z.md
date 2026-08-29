# Backtest report - 2021-08-28 → 2024-08-28 | $10000 prop account

- **Window:** 2021-08-29 → 2024-08-28 (5 years, 224278 M5 bars)
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
| final equity | $89320.83 |
| net P&L | +$79320.83 (793.21%) |
| closed trades | 1568 |
| open at end | - |
| win rate | 52.23% (819W/749L) |
| avg R | 0.15 |
| total R | 229.36 |
| profit factor | 1.35 |
| expectancy / trade | $50.59 |
| max drawdown (peak) | 12.82% |
| max drawdown vs initial | 1.76% |
| best day | +$3793 |
| worst day | $-2442 |
| avg hold | 6.3h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 409 | 62.1 | +$23835 | 0.15 | 50% |
| US30 | 335 | 27.9 | +$7074 | 0.08 | 47% |
| XAU/USD | 259 | 22.6 | +$10358 | 0.09 | 54% |
| EUR/USD | 160 | 38.0 | +$11672 | 0.24 | 56% |
| USD/JPY | 153 | 43.7 | +$14973 | 0.29 | 60% |
| USD/CHF | 132 | 10.4 | +$2529 | 0.08 | 50% |
| GBP/USD | 120 | 24.8 | +$8881 | 0.21 | 57% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 774 | 389.0 | +$130802 | 0.50 | 72% |
| sl | 531 | -551.8 | $-198335 | -1.04 | 0% |
| tp2 | 137 | 300.9 | +$113559 | 2.20 | 100% |
| tp1-be | 126 | 91.2 | +$33295 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1436 | 216.4 | +$72853 | 0.15 | 52% |
| continuation | 86 | 1.5 | +$2323 | 0.02 | 47% |
| bounce | 39 | 8.5 | +$2646 | 0.22 | 62% |
| reversal | 7 | 2.9 | +$1498 | 0.42 | 43% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 559 | 105.8 | +$19588 | 0.19 | 55% |
| 2023 | 499 | 61.8 | +$24439 | 0.12 | 52% |
| 2024 | 353 | 50.8 | +$34270 | 0.14 | 52% |
| 2021 | 157 | 10.9 | +$1024 | 0.07 | 45% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 229360 |
| continuation | 140515 |
| breakout | 138274 |
| bounce | 138102 |
| reversal | 138082 |
| no-signal | 138082 |
| friday | 92193 |
| trend-filter | 90778 |
| max-signals | 41693 |
| circuit | 6361 |
| daily-loss | 4361 |
| position | 989 |

*Generated 2026-08-29T18:18:59.230Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
