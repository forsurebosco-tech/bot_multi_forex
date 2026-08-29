# Backtest report - 5Y | $10000 prop account

- **Window:** 2021-08-29 → 2026-08-28 (5 years, 354162 M5 bars)
- **Instruments:** NAS100, SPX500, US30
- **Initial equity:** $10000 | risk 1% = $100/trade
- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, 4 signals/day, -3% engine day stop, 2-SL breaker, 1 pos/pair, max 3 concurrent, correlation (gold = USD bucket).
- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.
- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.
- **Day-trading rule:** positions force-flat at 21:00 GMT (end of NY) — no overnight/weekend holds

## ✅ ACCOUNT DOUBLED (200% target)


## Headline

| metric | value |
| --- | --- |
| final equity | $48836.79 |
| net P&L | +$38836.79 (388.37%) |
| closed trades | 1873 |
| open at end | - |
| win rate | 49.55% (928W/945L) |
| avg R | 0.09 |
| total R | 176.66 |
| profit factor | 1.21 |
| expectancy / trade | $20.74 |
| max drawdown (peak) | 21.42% |
| max drawdown vs initial | 9.69% |
| best day | +$2215 |
| worst day | $-1549 |
| avg hold | 5.9h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 694 | 86.7 | +$19129 | 0.12 | 50% |
| US30 | 603 | 68.8 | +$16082 | 0.11 | 51% |
| SPX500 | 576 | 21.1 | +$3626 | 0.04 | 47% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 811 | 431.6 | +$97772 | 0.53 | 73% |
| sl | 729 | -755.7 | $-167420 | -1.04 | 0% |
| tp2 | 172 | 383.4 | +$82138 | 2.23 | 100% |
| tp1-be | 161 | 117.3 | +$26346 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1684 | 172.8 | +$35125 | 0.10 | 50% |
| continuation | 93 | 3.0 | +$2400 | 0.03 | 47% |
| bounce | 80 | 5.3 | +$2072 | 0.07 | 51% |
| reversal | 16 | -4.4 | $-760 | -0.28 | 31% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 411 | 66.6 | +$7815 | 0.16 | 51% |
| 2024 | 400 | 44.0 | +$9673 | 0.11 | 49% |
| 2023 | 384 | 17.1 | +$2556 | 0.04 | 49% |
| 2025 | 348 | 39.4 | +$12744 | 0.11 | 52% |
| 2026 | 204 | 16.7 | +$6849 | 0.08 | 49% |
| 2021 | 126 | -7.1 | $-801 | -0.06 | 41% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 154094 |
| continuation | 123188 |
| breakout | 120908 |
| bounce | 120668 |
| reversal | 120612 |
| no-signal | 120612 |
| friday | 65152 |
| trend-filter | 41762 |
| max-signals | 11600 |
| circuit | 6684 |
| daily-loss | 6018 |
| position | 836 |

*Generated 2026-08-29T05:52:55.605Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
