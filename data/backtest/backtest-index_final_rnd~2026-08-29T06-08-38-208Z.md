# Backtest report - 5Y | $10000 prop account

- **Window:** 2021-08-29 → 2026-08-28 (5 years, 373713 M5 bars)
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
| final equity | $499854.20 |
| net P&L | +$489854.20 (4898.54%) |
| closed trades | 2573 |
| open at end | - |
| win rate | 52.82% (1359W/1214L) |
| avg R | 0.16 |
| total R | 407.90 |
| profit factor | 1.48 |
| expectancy / trade | $190.38 |
| max drawdown (peak) | 15.85% |
| max drawdown vs initial | 2.94% |
| best day | +$24652 |
| worst day | $-13566 |
| avg hold | 6.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 651 | 95.5 | +$97121 | 0.15 | 50% |
| US30 | 572 | 57.7 | +$59711 | 0.10 | 50% |
| XAU/USD | 439 | 80.1 | +$150096 | 0.18 | 56% |
| EUR/USD | 253 | 49.8 | +$31084 | 0.20 | 55% |
| USD/JPY | 236 | 68.2 | +$74262 | 0.29 | 61% |
| GBP/USD | 217 | 36.6 | +$44780 | 0.17 | 54% |
| USD/CHF | 205 | 20.0 | +$32800 | 0.10 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 1358 | 668.6 | +$747645 | 0.49 | 71% |
| sl | 825 | -854.3 | $-884226 | -1.04 | 0% |
| tp2 | 206 | 459.2 | +$485942 | 2.23 | 100% |
| tp1-be | 184 | 134.4 | +$140493 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 2303 | 381.3 | +$448211 | 0.17 | 53% |
| continuation | 133 | 15.1 | +$18360 | 0.11 | 48% |
| bounce | 106 | 16.5 | +$24999 | 0.16 | 52% |
| reversal | 31 | -5.0 | $-1715 | -0.16 | 35% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 567 | 104.7 | +$17575 | 0.18 | 55% |
| 2024 | 549 | 72.9 | +$52885 | 0.13 | 52% |
| 2023 | 507 | 67.6 | +$25008 | 0.13 | 52% |
| 2025 | 491 | 108.1 | +$195796 | 0.22 | 54% |
| 2026 | 296 | 52.6 | +$198498 | 0.18 | 54% |
| 2021 | 163 | 2.0 | +$92 | 0.01 | 43% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 382337 |
| continuation | 232946 |
| breakout | 229315 |
| bounce | 228964 |
| reversal | 228862 |
| no-signal | 228862 |
| trend-filter | 160278 |
| friday | 154239 |
| max-signals | 62208 |
| circuit | 10001 |
| daily-loss | 6476 |
| position | 1716 |

*Generated 2026-08-29T06:08:38.208Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
