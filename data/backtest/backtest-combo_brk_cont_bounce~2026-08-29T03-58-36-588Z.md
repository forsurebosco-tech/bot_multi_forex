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
| final equity | $138093.92 |
| net P&L | +$128093.92 (1280.94%) |
| closed trades | 1440 |
| open at end | - |
| win rate | 55.69% (802W/638L) |
| avg R | 0.19 |
| total R | 270.04 |
| profit factor | 1.68 |
| expectancy / trade | $88.95 |
| max drawdown (peak) | 10.14% |
| max drawdown vs initial | 0.67% |
| best day | +$5552 |
| worst day | $-3367 |
| avg hold | 7.2h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 483 | 85.4 | +$54795 | 0.18 | 56% |
| EUR/USD | 266 | 49.8 | +$14260 | 0.19 | 54% |
| USD/JPY | 245 | 70.1 | +$28434 | 0.29 | 60% |
| GBP/USD | 232 | 42.0 | +$19714 | 0.18 | 56% |
| USD/CHF | 214 | 22.8 | +$10892 | 0.11 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 934 | 403.9 | +$173742 | 0.43 | 69% |
| sl | 350 | -368.9 | $-149257 | -1.05 | 0% |
| tp2 | 82 | 181.8 | +$82802 | 2.22 | 100% |
| tp1-be | 74 | 53.2 | +$20807 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1311 | 246.9 | +$118924 | 0.19 | 56% |
| continuation | 81 | 7.6 | +$1827 | 0.09 | 51% |
| bounce | 48 | 15.5 | +$7343 | 0.32 | 56% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 322 | 63.5 | +$9546 | 0.20 | 58% |
| 2024 | 313 | 40.7 | +$14353 | 0.13 | 54% |
| 2023 | 300 | 38.6 | +$9239 | 0.13 | 52% |
| 2025 | 266 | 67.7 | +$41702 | 0.25 | 55% |
| 2026 | 166 | 48.4 | +$52128 | 0.29 | 61% |
| 2021 | 73 | 11.1 | +$1127 | 0.15 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| continuation | 173311 |
| breakout | 171044 |
| bounce | 170854 |
| reversal | 170854 |
| no-signal | 170854 |
| trend-filter | 142869 |
| friday | 110704 |
| max-signals | 4511 |
| position | 1144 |
| circuit | 785 |
| daily-loss | 322 |

*Generated 2026-08-29T03:58:36.588Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
