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
| final equity | $100165.18 |
| net P&L | +$90165.18 (901.65%) |
| closed trades | 1609 |
| open at end | - |
| win rate | 50.96% (820W/789L) |
| avg R | 0.15 |
| total R | 242.73 |
| profit factor | 1.34 |
| expectancy / trade | $56.04 |
| max drawdown (peak) | 13.05% |
| max drawdown vs initial | 3.93% |
| best day | +$4250 |
| worst day | $-2966 |
| avg hold | 5.3h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 419 | 59.5 | +$25657 | 0.14 | 49% |
| US30 | 346 | 20.9 | +$3199 | 0.06 | 46% |
| XAU/USD | 261 | 27.3 | +$14854 | 0.10 | 52% |
| EUR/USD | 166 | 43.3 | +$13438 | 0.26 | 54% |
| USD/JPY | 155 | 57.8 | +$20323 | 0.37 | 61% |
| USD/CHF | 136 | 8.6 | +$2180 | 0.06 | 47% |
| GBP/USD | 126 | 25.3 | +$10514 | 0.20 | 56% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 646 | 352.3 | +$121489 | 0.55 | 73% |
| sl | 614 | -646.7 | $-242675 | -1.05 | 0% |
| tp2 | 191 | 423.6 | +$169437 | 2.22 | 100% |
| tp1-be | 158 | 113.5 | +$41914 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1476 | 229.8 | +$82002 | 0.16 | 51% |
| continuation | 89 | 3.8 | +$3137 | 0.04 | 44% |
| bounce | 36 | 7.3 | +$3780 | 0.20 | 61% |
| reversal | 8 | 1.8 | +$1246 | 0.22 | 38% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 575 | 109.1 | +$19280 | 0.19 | 53% |
| 2023 | 505 | 72.3 | +$29567 | 0.14 | 52% |
| 2024 | 365 | 55.1 | +$40829 | 0.15 | 49% |
| 2021 | 164 | 6.2 | +$488 | 0.04 | 44% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 229360 |
| continuation | 135956 |
| breakout | 133767 |
| bounce | 133604 |
| reversal | 133585 |
| no-signal | 133585 |
| friday | 92193 |
| trend-filter | 88946 |
| max-signals | 48668 |
| circuit | 9896 |
| daily-loss | 8326 |
| position | 882 |

*Generated 2026-08-29T18:28:56.385Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
