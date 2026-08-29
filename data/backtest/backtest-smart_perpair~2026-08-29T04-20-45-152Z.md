# Backtest report - 5Y | $10000 prop account

- **Window:** 2021-08-29 → 2026-08-28 (5 years, 373654 M5 bars)
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
| final equity | $127443.11 |
| net P&L | +$117443.11 (1174.43%) |
| closed trades | 1380 |
| open at end | - |
| win rate | 55.80% (770W/610L) |
| avg R | 0.19 |
| total R | 261.75 |
| profit factor | 1.72 |
| expectancy / trade | $85.10 |
| max drawdown (peak) | 8.85% |
| max drawdown vs initial | 0.67% |
| best day | +$6565 |
| worst day | $-3068 |
| avg hold | 7.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 437 | 78.6 | +$46966 | 0.18 | 57% |
| USD/JPY | 250 | 68.9 | +$26337 | 0.28 | 60% |
| EUR/USD | 248 | 45.7 | +$12173 | 0.18 | 54% |
| GBP/USD | 230 | 47.2 | +$23259 | 0.21 | 56% |
| USD/CHF | 215 | 21.4 | +$8708 | 0.10 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 918 | 389.1 | +$158712 | 0.42 | 69% |
| sl | 323 | -339.8 | $-127200 | -1.05 | 0% |
| tp2 | 75 | 166.4 | +$70471 | 2.22 | 100% |
| tp1-be | 64 | 46.1 | +$15459 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1331 | 243.4 | +$110176 | 0.18 | 56% |
| continuation | 22 | -2.6 | $-1915 | -0.12 | 36% |
| bounce | 16 | 13.1 | +$5091 | 0.82 | 75% |
| reversal | 11 | 7.8 | +$4091 | 0.71 | 82% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 310 | 67.3 | +$10310 | 0.22 | 59% |
| 2024 | 308 | 43.7 | +$14765 | 0.14 | 55% |
| 2023 | 288 | 28.8 | +$6734 | 0.10 | 51% |
| 2025 | 254 | 64.0 | +$37418 | 0.25 | 55% |
| 2026 | 150 | 47.1 | +$47116 | 0.31 | 63% |
| 2021 | 70 | 10.9 | +$1100 | 0.16 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| breakout | 171039 |
| reversal | 170930 |
| no-signal | 170930 |
| trend-filter | 142922 |
| friday | 110704 |
| bounce | 67968 |
| continuation | 66299 |
| max-signals | 4396 |
| position | 1125 |
| circuit | 764 |
| daily-loss | 197 |

*Generated 2026-08-29T04:20:45.151Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
