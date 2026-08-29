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
| final equity | $74520.95 |
| net P&L | +$64520.95 (645.21%) |
| closed trades | 1591 |
| open at end | - |
| win rate | 51.79% (824W/767L) |
| avg R | 0.13 |
| total R | 211.19 |
| profit factor | 1.32 |
| expectancy / trade | $40.55 |
| max drawdown (peak) | 15.85% |
| max drawdown vs initial | 2.94% |
| best day | +$3292 |
| worst day | $-2186 |
| avg hold | 6.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 415 | 52.3 | +$17026 | 0.13 | 49% |
| US30 | 345 | 22.4 | +$5226 | 0.06 | 48% |
| XAU/USD | 261 | 21.4 | +$9352 | 0.08 | 53% |
| EUR/USD | 162 | 38.2 | +$10468 | 0.24 | 56% |
| USD/JPY | 155 | 41.3 | +$12085 | 0.27 | 59% |
| USD/CHF | 131 | 9.4 | +$2572 | 0.07 | 50% |
| GBP/USD | 122 | 26.3 | +$7793 | 0.22 | 57% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 811 | 389.5 | +$115010 | 0.48 | 71% |
| sl | 531 | -551.5 | $-174011 | -1.04 | 0% |
| tp2 | 128 | 285.1 | +$95194 | 2.23 | 100% |
| tp1-be | 121 | 88.1 | +$28328 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1425 | 207.8 | +$60604 | 0.15 | 52% |
| continuation | 86 | 3.2 | +$2292 | 0.04 | 47% |
| bounce | 62 | 4.1 | +$2322 | 0.07 | 52% |
| reversal | 18 | -4.0 | $-697 | -0.22 | 28% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 567 | 102.6 | +$17005 | 0.18 | 55% |
| 2023 | 505 | 65.5 | +$23441 | 0.13 | 52% |
| 2024 | 356 | 41.1 | +$23983 | 0.12 | 50% |
| 2021 | 163 | 2.0 | +$92 | 0.01 | 43% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 229360 |
| continuation | 140460 |
| breakout | 138220 |
| bounce | 138012 |
| reversal | 137962 |
| no-signal | 137962 |
| friday | 92193 |
| trend-filter | 90904 |
| max-signals | 42202 |
| circuit | 6665 |
| daily-loss | 4461 |
| position | 1032 |

*Generated 2026-08-29T07:10:11.200Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
