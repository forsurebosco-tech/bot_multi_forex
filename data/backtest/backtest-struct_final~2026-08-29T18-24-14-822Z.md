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
| final equity | $638328.69 |
| net P&L | +$628328.69 (6283.29%) |
| closed trades | 2537 |
| open at end | - |
| win rate | 53.25% (1351W/1186L) |
| avg R | 0.17 |
| total R | 432.39 |
| profit factor | 1.53 |
| expectancy / trade | $247.67 |
| max drawdown (peak) | 12.82% |
| max drawdown vs initial | 1.76% |
| best day | +$28115 |
| worst day | $-15389 |
| avg hold | 6.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 646 | 104.2 | +$127152 | 0.16 | 50% |
| US30 | 556 | 63.7 | +$75184 | 0.11 | 49% |
| XAU/USD | 436 | 88.8 | +$220592 | 0.20 | 57% |
| EUR/USD | 250 | 49.7 | +$35783 | 0.20 | 55% |
| USD/JPY | 231 | 68.5 | +$82896 | 0.30 | 61% |
| GBP/USD | 213 | 35.2 | +$46765 | 0.17 | 55% |
| USD/CHF | 205 | 22.4 | +$39957 | 0.11 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 1293 | 643.5 | +$804859 | 0.50 | 72% |
| sl | 822 | -851.1 | $-1020664 | -1.04 | 0% |
| tp2 | 227 | 498.8 | +$664996 | 2.20 | 100% |
| tp1-be | 195 | 141.2 | +$179137 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 2326 | 394.1 | +$564799 | 0.17 | 53% |
| continuation | 133 | 14.3 | +$24259 | 0.11 | 50% |
| bounce | 67 | 19.2 | +$30361 | 0.29 | 61% |
| reversal | 11 | 4.7 | +$8910 | 0.43 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 559 | 107.9 | +$20224 | 0.19 | 55% |
| 2024 | 541 | 85.0 | +$72092 | 0.16 | 53% |
| 2023 | 501 | 63.7 | +$26023 | 0.13 | 52% |
| 2025 | 486 | 106.6 | +$234423 | 0.22 | 55% |
| 2026 | 293 | 58.3 | +$274542 | 0.20 | 55% |
| 2021 | 157 | 10.9 | +$1024 | 0.07 | 45% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 382337 |
| continuation | 232758 |
| breakout | 229124 |
| bounce | 228837 |
| reversal | 228796 |
| no-signal | 228796 |
| trend-filter | 160353 |
| friday | 154239 |
| max-signals | 61412 |
| circuit | 9889 |
| daily-loss | 7026 |
| position | 1628 |

*Generated 2026-08-29T18:24:14.822Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
