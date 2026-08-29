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
| final equity | $545618.23 |
| net P&L | +$535618.23 (5356.18%) |
| closed trades | 2521 |
| open at end | - |
| win rate | 53.19% (1341W/1180L) |
| avg R | 0.17 |
| total R | 416.22 |
| profit factor | 1.50 |
| expectancy / trade | $212.46 |
| max drawdown (peak) | 12.82% |
| max drawdown vs initial | 1.76% |
| best day | +$26418 |
| worst day | $-14537 |
| avg hold | 6.5h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 634 | 104.0 | +$111299 | 0.16 | 51% |
| US30 | 556 | 58.4 | +$66313 | 0.11 | 50% |
| XAU/USD | 431 | 78.6 | +$165898 | 0.18 | 56% |
| EUR/USD | 252 | 50.8 | +$34106 | 0.20 | 55% |
| USD/JPY | 232 | 67.1 | +$75413 | 0.29 | 61% |
| GBP/USD | 212 | 34.0 | +$44015 | 0.16 | 55% |
| USD/CHF | 204 | 23.2 | +$38574 | 0.11 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 1352 | 665.4 | +$808426 | 0.49 | 71% |
| sl | 793 | -820.7 | $-918891 | -1.03 | 0% |
| tp2 | 198 | 441.6 | +$495256 | 2.23 | 100% |
| tp1-be | 178 | 130.0 | +$150828 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 2314 | 383.6 | +$494570 | 0.17 | 53% |
| continuation | 134 | 15.3 | +$21019 | 0.11 | 49% |
| bounce | 62 | 12.6 | +$11884 | 0.20 | 58% |
| reversal | 11 | 4.7 | +$8145 | 0.43 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 555 | 108.8 | +$19628 | 0.20 | 56% |
| 2024 | 541 | 77.5 | +$61653 | 0.14 | 52% |
| 2023 | 499 | 65.0 | +$25878 | 0.13 | 52% |
| 2025 | 480 | 108.0 | +$218408 | 0.23 | 55% |
| 2026 | 289 | 50.4 | +$209490 | 0.17 | 54% |
| 2021 | 157 | 6.5 | +$560 | 0.04 | 44% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 382337 |
| continuation | 234770 |
| breakout | 231120 |
| bounce | 230828 |
| reversal | 230786 |
| no-signal | 230786 |
| trend-filter | 160984 |
| friday | 154239 |
| max-signals | 58139 |
| circuit | 9373 |
| daily-loss | 6052 |
| position | 1669 |

*Generated 2026-08-29T07:16:34.125Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
