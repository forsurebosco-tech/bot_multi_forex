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
| final equity | $81352.86 |
| net P&L | +$71352.86 (713.53%) |
| closed trades | 1562 |
| open at end | - |
| win rate | 52.11% (814W/748L) |
| avg R | 0.14 |
| total R | 219.76 |
| profit factor | 1.34 |
| expectancy / trade | $45.68 |
| max drawdown (peak) | 12.81% |
| max drawdown vs initial | 1.76% |
| best day | +$3580 |
| worst day | $-2330 |
| avg hold | 6.5h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 403 | 60.7 | +$20670 | 0.15 | 50% |
| US30 | 337 | 24.7 | +$5699 | 0.07 | 48% |
| XAU/USD | 257 | 18.0 | +$8512 | 0.07 | 53% |
| EUR/USD | 161 | 39.2 | +$11691 | 0.24 | 56% |
| USD/JPY | 154 | 42.3 | +$13702 | 0.27 | 60% |
| USD/CHF | 131 | 11.4 | +$2891 | 0.09 | 50% |
| GBP/USD | 119 | 23.4 | +$8189 | 0.20 | 56% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 807 | 387.2 | +$123786 | 0.48 | 71% |
| sl | 513 | -532.7 | $-184571 | -1.04 | 0% |
| tp2 | 126 | 280.8 | +$102050 | 2.23 | 100% |
| tp1-be | 116 | 84.5 | +$30088 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 1432 | 207.2 | +$65374 | 0.14 | 52% |
| continuation | 86 | 3.2 | +$2555 | 0.04 | 47% |
| bounce | 37 | 6.4 | +$1969 | 0.17 | 59% |
| reversal | 7 | 2.9 | +$1456 | 0.42 | 43% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2022 | 555 | 106.7 | +$19011 | 0.19 | 55% |
| 2023 | 497 | 63.0 | +$24261 | 0.13 | 52% |
| 2024 | 353 | 43.6 | +$27521 | 0.12 | 51% |
| 2021 | 157 | 6.5 | +$560 | 0.04 | 44% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 229360 |
| continuation | 141541 |
| breakout | 139289 |
| bounce | 139116 |
| reversal | 139096 |
| no-signal | 139096 |
| friday | 92193 |
| trend-filter | 91103 |
| max-signals | 39893 |
| circuit | 6516 |
| daily-loss | 4312 |
| position | 1008 |

*Generated 2026-08-29T07:08:54.059Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
