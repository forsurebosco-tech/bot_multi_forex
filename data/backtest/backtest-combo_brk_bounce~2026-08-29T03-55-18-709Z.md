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
| final equity | $125234.07 |
| net P&L | +$115234.07 (1152.34%) |
| closed trades | 1385 |
| open at end | - |
| win rate | 55.67% (771W/614L) |
| avg R | 0.19 |
| total R | 259.92 |
| profit factor | 1.68 |
| expectancy / trade | $83.20 |
| max drawdown (peak) | 8.97% |
| max drawdown vs initial | 0.67% |
| best day | +$5083 |
| worst day | $-3050 |
| avg hold | 7.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 464 | 80.9 | +$46748 | 0.17 | 56% |
| EUR/USD | 249 | 46.4 | +$12375 | 0.19 | 54% |
| USD/JPY | 237 | 66.3 | +$25292 | 0.28 | 60% |
| GBP/USD | 224 | 40.3 | +$19476 | 0.18 | 55% |
| USD/CHF | 211 | 26.1 | +$11343 | 0.12 | 53% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 918 | 390.3 | +$158501 | 0.43 | 69% |
| sl | 327 | -343.6 | $-133399 | -1.05 | 0% |
| tp2 | 75 | 166.3 | +$72313 | 2.22 | 100% |
| tp1-be | 65 | 46.9 | +$17820 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1335 | 243.4 | +$108171 | 0.18 | 56% |
| bounce | 50 | 16.5 | +$7063 | 0.33 | 56% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 307 | 69.1 | +$10696 | 0.22 | 59% |
| 2024 | 306 | 37.1 | +$12892 | 0.12 | 54% |
| 2023 | 287 | 33.9 | +$8333 | 0.12 | 52% |
| 2025 | 256 | 61.3 | +$35417 | 0.24 | 54% |
| 2026 | 159 | 47.7 | +$46797 | 0.30 | 62% |
| 2021 | 70 | 10.9 | +$1100 | 0.16 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| breakout | 171398 |
| bounce | 171335 |
| reversal | 171335 |
| no-signal | 171335 |
| trend-filter | 142971 |
| friday | 110704 |
| max-signals | 3720 |
| position | 1078 |
| circuit | 764 |
| daily-loss | 197 |

*Generated 2026-08-29T03:55:18.709Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
