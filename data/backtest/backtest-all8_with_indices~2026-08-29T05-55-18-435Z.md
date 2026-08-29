# Backtest report - 5Y | $10000 prop account

- **Window:** 2021-08-29 → 2026-08-28 (5 years, 373713 M5 bars)
- **Instruments:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD, NAS100, SPX500, US30
- **Initial equity:** $10000 | risk 1% = $100/trade
- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, 4 signals/day, -3% engine day stop, 2-SL breaker, 1 pos/pair, max 3 concurrent, correlation (gold = USD bucket).
- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.
- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.
- **Day-trading rule:** positions force-flat at 21:00 GMT (end of NY) — no overnight/weekend holds

## ✅ ACCOUNT DOUBLED (200% target)


## Headline

| metric | value |
| --- | --- |
| final equity | $319662.71 |
| net P&L | +$309662.71 (3096.63%) |
| closed trades | 2823 |
| open at end | - |
| win rate | 51.04% (1441W/1382L) |
| avg R | 0.13 |
| total R | 368.62 |
| profit factor | 1.38 |
| expectancy / trade | $109.69 |
| max drawdown (peak) | 18.37% |
| max drawdown vs initial | 2.15% |
| best day | +$15022 |
| worst day | $-10419 |
| avg hold | 6.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 602 | 82.7 | +$63867 | 0.14 | 49% |
| US30 | 487 | 61.0 | +$48402 | 0.13 | 50% |
| SPX500 | 477 | 0.5 | $-10481 | 0.00 | 45% |
| XAU/USD | 402 | 68.0 | +$88155 | 0.17 | 55% |
| EUR/USD | 244 | 46.3 | +$21400 | 0.19 | 54% |
| USD/JPY | 217 | 58.2 | +$46563 | 0.27 | 59% |
| GBP/USD | 206 | 32.9 | +$29682 | 0.16 | 53% |
| USD/CHF | 188 | 19.1 | +$22075 | 0.10 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 1396 | 697.8 | +$545327 | 0.50 | 71% |
| sl | 972 | -1014.4 | $-726724 | -1.04 | 0% |
| tp2 | 237 | 527.2 | +$373144 | 2.22 | 100% |
| tp1-be | 218 | 158.0 | +$117916 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 2545 | 338.9 | +$268826 | 0.13 | 51% |
| continuation | 146 | 13.5 | +$13666 | 0.09 | 49% |
| bounce | 104 | 21.0 | +$29919 | 0.20 | 53% |
| reversal | 28 | -4.7 | $-2748 | -0.17 | 32% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 608 | 117.1 | +$20949 | 0.19 | 54% |
| 2024 | 603 | 53.4 | +$29003 | 0.09 | 50% |
| 2023 | 572 | 42.7 | +$14732 | 0.07 | 49% |
| 2025 | 535 | 95.2 | +$111004 | 0.18 | 53% |
| 2026 | 328 | 56.6 | +$133768 | 0.17 | 54% |
| 2021 | 177 | 3.6 | +$208 | 0.02 | 43% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 433702 |
| continuation | 257535 |
| breakout | 253484 |
| bounce | 253110 |
| reversal | 253011 |
| no-signal | 253011 |
| friday | 175956 |
| trend-filter | 165424 |
| max-signals | 95932 |
| circuit | 23118 |
| daily-loss | 19572 |
| position | 1930 |

*Generated 2026-08-29T05:55:18.434Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
