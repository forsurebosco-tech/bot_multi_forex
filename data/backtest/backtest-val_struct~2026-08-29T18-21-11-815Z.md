# Backtest report - 2024-08-28 → 2026-08-28 | $10000 prop account

- **Window:** 2024-08-28 → 2026-08-28 (5 years, 149185 M5 bars)
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
| final equity | $69371.20 |
| net P&L | +$59371.20 (593.71%) |
| closed trades | 966 |
| open at end | - |
| win rate | 54.76% (529W/437L) |
| avg R | 0.21 |
| total R | 200.01 |
| profit factor | 1.58 |
| expectancy / trade | $61.46 |
| max drawdown (peak) | 9.88% |
| max drawdown vs initial | 0.00% |
| best day | +$3053 |
| worst day | $-1669 |
| avg hold | 6.4h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 237 | 42.4 | +$11127 | 0.18 | 51% |
| US30 | 219 | 33.8 | +$7251 | 0.15 | 52% |
| XAU/USD | 178 | 65.3 | +$22676 | 0.37 | 61% |
| GBP/USD | 91 | 10.4 | +$4246 | 0.11 | 53% |
| EUR/USD | 90 | 11.2 | +$2769 | 0.12 | 53% |
| USD/JPY | 78 | 24.8 | +$7285 | 0.32 | 63% |
| USD/CHF | 73 | 12.0 | +$4017 | 0.16 | 56% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 515 | 252.0 | +$72528 | 0.49 | 72% |
| sl | 292 | -300.0 | $-87886 | -1.03 | 0% |
| tp2 | 90 | 198.0 | +$59106 | 2.20 | 100% |
| tp1-be | 69 | 50.0 | +$15623 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 890 | 177.5 | +$53321 | 0.20 | 55% |
| continuation | 45 | 11.5 | +$2312 | 0.26 | 53% |
| bounce | 27 | 9.1 | +$2943 | 0.34 | 59% |
| reversal | 4 | 1.8 | +$796 | 0.46 | 75% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2025 | 486 | 106.9 | +$25232 | 0.22 | 55% |
| 2026 | 293 | 59.4 | +$30274 | 0.20 | 55% |
| 2024 | 187 | 33.7 | +$3865 | 0.18 | 55% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 152767 |
| continuation | 92317 |
| breakout | 90922 |
| bounce | 90810 |
| reversal | 90789 |
| no-signal | 90789 |
| trend-filter | 69637 |
| friday | 61465 |
| max-signals | 19507 |
| circuit | 3528 |
| daily-loss | 2665 |
| position | 639 |

*Generated 2026-08-29T18:21:11.815Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
