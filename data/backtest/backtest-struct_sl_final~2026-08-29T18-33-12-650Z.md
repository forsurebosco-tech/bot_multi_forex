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
| final equity | $1230455.27 |
| net P&L | +$1220455.27 (12204.55%) |
| closed trades | 2611 |
| open at end | - |
| win rate | 53.01% (1384W/1227L) |
| avg R | 0.19 |
| total R | 501.17 |
| profit factor | 1.61 |
| expectancy / trade | $467.43 |
| max drawdown (peak) | 13.05% |
| max drawdown vs initial | 3.93% |
| best day | +$53607 |
| worst day | $-39601 |
| avg hold | 5.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 659 | 107.1 | +$208159 | 0.16 | 50% |
| US30 | 576 | 72.1 | +$197079 | 0.13 | 49% |
| XAU/USD | 437 | 106.8 | +$414948 | 0.24 | 57% |
| EUR/USD | 261 | 61.4 | +$70366 | 0.24 | 54% |
| USD/JPY | 240 | 88.3 | +$143156 | 0.37 | 61% |
| GBP/USD | 226 | 43.5 | +$123360 | 0.19 | 56% |
| USD/CHF | 212 | 22.0 | +$63388 | 0.10 | 50% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 1089 | 586.6 | +$1181587 | 0.54 | 73% |
| sl | 932 | -978.3 | $-1800518 | -1.05 | 0% |
| tp2 | 312 | 692.7 | +$1369141 | 2.22 | 100% |
| tp1-be | 278 | 200.2 | +$470245 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 2394 | 459.0 | +$1134984 | 0.19 | 53% |
| continuation | 141 | 17.7 | +$30093 | 0.13 | 48% |
| bounce | 65 | 19.7 | +$41289 | 0.30 | 62% |
| reversal | 11 | 4.8 | +$14090 | 0.43 | 55% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 576 | 111.2 | +$19911 | 0.19 | 53% |
| 2024 | 558 | 99.1 | +$98423 | 0.18 | 51% |
| 2023 | 507 | 74.8 | +$31724 | 0.15 | 52% |
| 2025 | 503 | 142.9 | +$484018 | 0.28 | 57% |
| 2026 | 303 | 66.8 | +$585890 | 0.22 | 55% |
| 2021 | 164 | 6.2 | +$488 | 0.04 | 44% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 382337 |
| continuation | 225137 |
| breakout | 221598 |
| bounce | 221322 |
| reversal | 221284 |
| no-signal | 221284 |
| trend-filter | 157336 |
| friday | 154239 |
| max-signals | 74154 |
| circuit | 14660 |
| daily-loss | 12398 |
| position | 1440 |

*Generated 2026-08-29T18:33:12.649Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
