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
| final equity | $494456.61 |
| net P&L | +$484456.61 (4844.57%) |
| closed trades | 2573 |
| open at end | - |
| win rate | 52.78% (1358W/1215L) |
| avg R | 0.16 |
| total R | 406.81 |
| profit factor | 1.48 |
| expectancy / trade | $188.28 |
| max drawdown (peak) | 15.79% |
| max drawdown vs initial | 2.83% |
| best day | +$24391 |
| worst day | $-13423 |
| avg hold | 6.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 651 | 94.9 | +$95934 | 0.15 | 50% |
| US30 | 572 | 57.7 | +$58801 | 0.10 | 50% |
| XAU/USD | 439 | 79.8 | +$148501 | 0.18 | 56% |
| EUR/USD | 253 | 49.8 | +$30833 | 0.20 | 55% |
| USD/JPY | 236 | 68.2 | +$73571 | 0.29 | 61% |
| GBP/USD | 217 | 36.5 | +$44360 | 0.17 | 54% |
| USD/CHF | 205 | 20.0 | +$32457 | 0.10 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 1358 | 668.5 | +$740475 | 0.49 | 71% |
| sl | 825 | -855.0 | $-876727 | -1.04 | 0% |
| tp2 | 206 | 459.1 | +$481526 | 2.23 | 100% |
| tp1-be | 184 | 134.2 | +$139182 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 2303 | 380.5 | +$443317 | 0.17 | 53% |
| continuation | 133 | 14.9 | +$18141 | 0.11 | 48% |
| bounce | 106 | 16.3 | +$24715 | 0.15 | 52% |
| reversal | 31 | -5.0 | $-1716 | -0.16 | 35% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 567 | 104.6 | +$17579 | 0.18 | 55% |
| 2024 | 549 | 72.5 | +$52233 | 0.13 | 52% |
| 2023 | 507 | 67.0 | +$24699 | 0.13 | 52% |
| 2025 | 491 | 108.0 | +$193586 | 0.22 | 54% |
| 2026 | 296 | 52.6 | +$196260 | 0.18 | 54% |
| 2021 | 163 | 2.1 | +$101 | 0.01 | 43% |

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

*Generated 2026-08-29T06:02:49.211Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
