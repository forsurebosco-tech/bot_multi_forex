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
| final equity | $121823.04 |
| net P&L | +$111823.04 (1118.23%) |
| closed trades | 1396 |
| open at end | - |
| win rate | 55.73% (778W/618L) |
| avg R | 0.18 |
| total R | 257.23 |
| profit factor | 1.69 |
| expectancy / trade | $80.10 |
| max drawdown (peak) | 8.90% |
| max drawdown vs initial | 0.67% |
| best day | +$4898 |
| worst day | $-2970 |
| avg hold | 7.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 455 | 83.7 | +$48880 | 0.18 | 56% |
| EUR/USD | 266 | 50.7 | +$13682 | 0.19 | 55% |
| USD/JPY | 241 | 62.7 | +$22940 | 0.26 | 59% |
| GBP/USD | 221 | 36.5 | +$16466 | 0.17 | 55% |
| USD/CHF | 213 | 23.6 | +$9855 | 0.11 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 920 | 394.7 | +$154948 | 0.43 | 69% |
| sl | 334 | -352.0 | $-126993 | -1.05 | 0% |
| tp2 | 75 | 166.4 | +$67944 | 2.22 | 100% |
| tp1-be | 67 | 48.1 | +$15924 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1315 | 249.6 | +$110080 | 0.19 | 56% |
| continuation | 81 | 7.6 | +$1743 | 0.09 | 51% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 313 | 62.0 | +$9241 | 0.20 | 58% |
| 2024 | 305 | 40.7 | +$13145 | 0.13 | 55% |
| 2023 | 293 | 31.1 | +$7008 | 0.11 | 51% |
| 2025 | 259 | 66.8 | +$37505 | 0.26 | 56% |
| 2026 | 153 | 45.5 | +$43797 | 0.30 | 62% |
| 2021 | 73 | 11.1 | +$1127 | 0.15 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| continuation | 173336 |
| breakout | 171068 |
| reversal | 170941 |
| no-signal | 170941 |
| trend-filter | 142913 |
| friday | 110704 |
| max-signals | 4386 |
| position | 1126 |
| circuit | 785 |
| daily-loss | 322 |

*Generated 2026-08-29T03:53:46.860Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
