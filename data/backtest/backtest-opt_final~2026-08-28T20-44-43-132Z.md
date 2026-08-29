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
| final equity | $142751.86 |
| net P&L | +$132751.86 (1327.52%) |
| closed trades | 1469 |
| open at end | - |
| win rate | 55.75% (819W/650L) |
| avg R | 0.19 |
| total R | 273.58 |
| profit factor | 1.70 |
| expectancy / trade | $90.37 |
| max drawdown (peak) | 10.48% |
| max drawdown vs initial | 0.67% |
| best day | +$7284 |
| worst day | $-3441 |
| avg hold | 7.2h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 486 | 85.8 | +$55287 | 0.18 | 56% |
| EUR/USD | 272 | 46.4 | +$13695 | 0.17 | 54% |
| USD/JPY | 253 | 71.6 | +$30097 | 0.28 | 60% |
| GBP/USD | 239 | 48.8 | +$23416 | 0.20 | 56% |
| USD/CHF | 219 | 20.9 | +$10258 | 0.10 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 947 | 412.7 | +$178362 | 0.44 | 69% |
| sl | 361 | -380.6 | $-150992 | -1.05 | 0% |
| tp2 | 84 | 186.2 | +$83434 | 2.22 | 100% |
| tp1-be | 77 | 55.3 | +$21948 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1310 | 247.3 | +$118653 | 0.19 | 56% |
| continuation | 82 | 8.3 | +$2059 | 0.10 | 51% |
| bounce | 48 | 15.5 | +$7352 | 0.32 | 56% |
| reversal | 29 | 2.5 | +$4687 | 0.08 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 328 | 60.6 | +$8973 | 0.18 | 58% |
| 2024 | 321 | 40.5 | +$13792 | 0.13 | 54% |
| 2023 | 304 | 37.9 | +$8801 | 0.12 | 52% |
| 2025 | 274 | 71.7 | +$43598 | 0.26 | 56% |
| 2026 | 169 | 51.4 | +$56420 | 0.30 | 62% |
| 2021 | 73 | 11.5 | +$1168 | 0.16 | 53% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 279573 |
| continuation | 172734 |
| breakout | 170475 |
| bounce | 170285 |
| reversal | 170200 |
| no-signal | 170200 |
| trend-filter | 142825 |
| friday | 110704 |
| max-signals | 5461 |
| position | 1192 |
| circuit | 785 |
| daily-loss | 322 |

*Generated 2026-08-28T20:44:43.131Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
