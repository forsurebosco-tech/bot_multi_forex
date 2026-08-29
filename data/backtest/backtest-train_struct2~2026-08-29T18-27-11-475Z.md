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
| final equity | $105404.20 |
| net P&L | +$95404.20 (954.04%) |
| closed trades | 1612 |
| open at end | - |
| win rate | 51.24% (826W/786L) |
| avg R | 0.15 |
| total R | 247.83 |
| profit factor | 1.35 |
| expectancy / trade | $59.18 |
| max drawdown (peak) | 13.10% |
| max drawdown vs initial | 3.15% |
| best day | +$4443 |
| worst day | $-3080 |
| avg hold | 5.3h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 418 | 55.2 | +$23814 | 0.13 | 50% |
| US30 | 348 | 19.8 | +$1626 | 0.06 | 45% |
| XAU/USD | 264 | 30.8 | +$17928 | 0.12 | 53% |
| EUR/USD | 165 | 49.3 | +$17472 | 0.30 | 55% |
| USD/JPY | 155 | 57.6 | +$20888 | 0.37 | 61% |
| USD/CHF | 136 | 10.4 | +$3072 | 0.08 | 48% |
| GBP/USD | 126 | 24.7 | +$10606 | 0.20 | 56% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 645 | 351.5 | +$125244 | 0.54 | 73% |
| sl | 613 | -645.5 | $-251880 | -1.05 | 0% |
| tp2 | 202 | 433.7 | +$181185 | 2.15 | 100% |
| tp1-be | 152 | 108.1 | +$40855 | 0.71 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1480 | 235.0 | +$86815 | 0.16 | 51% |
| continuation | 88 | 5.8 | +$4265 | 0.07 | 44% |
| bounce | 36 | 6.0 | +$3231 | 0.17 | 61% |
| reversal | 8 | 1.0 | +$1093 | 0.13 | 38% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 575 | 112.0 | +$19976 | 0.19 | 53% |
| 2023 | 507 | 77.3 | +$33166 | 0.15 | 52% |
| 2024 | 366 | 53.3 | +$41874 | 0.15 | 49% |
| 2021 | 164 | 5.1 | +$388 | 0.03 | 45% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 229360 |
| continuation | 135462 |
| breakout | 133277 |
| bounce | 133114 |
| reversal | 133097 |
| no-signal | 133097 |
| friday | 92193 |
| trend-filter | 88752 |
| max-signals | 49550 |
| circuit | 9286 |
| daily-loss | 7783 |
| position | 873 |

*Generated 2026-08-29T18:27:11.474Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
