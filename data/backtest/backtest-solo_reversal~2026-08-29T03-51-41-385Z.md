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
| final equity | $10922.46 |
| net P&L | +$922.46 (9.22%) |
| closed trades | 60 |
| open at end | - |
| win rate | 55.00% (33W/27L) |
| avg R | 0.15 |
| total R | 9.22 |
| profit factor | 1.34 |
| expectancy / trade | $15.37 |
| max drawdown (peak) | 7.56% |
| max drawdown vs initial | 4.68% |
| best day | +$221 |
| worst day | $-135 |
| avg hold | 3.2h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| GBP/USD | 17 | 9.7 | +$977 | 0.57 | 71% |
| USD/CHF | 12 | -2.2 | $-226 | -0.19 | 42% |
| EUR/USD | 11 | -4.0 | $-385 | -0.36 | 36% |
| USD/JPY | 10 | -0.9 | $-86 | -0.09 | 50% |
| XAU/USD | 10 | 6.6 | +$642 | 0.66 | 70% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 23 | 15.0 | +$1586 | 0.65 | 83% |
| sl | 23 | -24.7 | $-2540 | -1.07 | 0% |
| tp1-be | 8 | 5.7 | +$582 | 0.71 | 100% |
| tp2 | 6 | 13.2 | +$1294 | 2.20 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| reversal | 60 | 9.2 | +$922 | 0.15 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2024 | 14 | 9.5 | +$939 | 0.68 | 79% |
| 2022 | 13 | -3.8 | $-390 | -0.29 | 38% |
| 2023 | 12 | -3.9 | $-390 | -0.33 | 25% |
| 2025 | 12 | 5.7 | +$603 | 0.47 | 75% |
| 2026 | 7 | -1.3 | $-152 | -0.19 | 43% |
| 2021 | 2 | 3.1 | +$312 | 1.55 | 100% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| breakout | 175419 |
| reversal | 175359 |
| no-signal | 175359 |
| trend-filter | 143730 |
| friday | 110704 |

*Generated 2026-08-29T03:51:41.385Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
