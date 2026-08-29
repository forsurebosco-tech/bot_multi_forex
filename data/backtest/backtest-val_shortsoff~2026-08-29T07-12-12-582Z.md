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
| final equity | $65024.99 |
| net P&L | +$55024.99 (550.25%) |
| closed trades | 955 |
| open at end | - |
| win rate | 54.87% (524W/431L) |
| avg R | 0.20 |
| total R | 193.32 |
| profit factor | 1.55 |
| expectancy / trade | $57.62 |
| max drawdown (peak) | 9.88% |
| max drawdown vs initial | 0.00% |
| best day | +$3146 |
| worst day | $-1729 |
| avg hold | 6.6h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 231 | 43.6 | +$10689 | 0.19 | 52% |
| US30 | 217 | 31.5 | +$7067 | 0.15 | 52% |
| XAU/USD | 175 | 59.7 | +$18574 | 0.34 | 61% |
| GBP/USD | 91 | 10.7 | +$4404 | 0.12 | 53% |
| EUR/USD | 90 | 11.2 | +$2838 | 0.12 | 53% |
| USD/JPY | 78 | 24.8 | +$7256 | 0.32 | 63% |
| USD/CHF | 73 | 11.9 | +$4197 | 0.16 | 56% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 540 | 275.6 | +$80769 | 0.51 | 72% |
| sl | 281 | -288.7 | $-86015 | -1.03 | 0% |
| tp2 | 72 | 160.9 | +$46109 | 2.23 | 100% |
| tp1-be | 62 | 45.5 | +$14162 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 882 | 176.1 | +$50992 | 0.20 | 55% |
| continuation | 45 | 10.8 | +$2142 | 0.24 | 51% |
| bounce | 24 | 4.5 | +$1103 | 0.19 | 54% |
| reversal | 4 | 1.8 | +$788 | 0.46 | 75% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2025 | 479 | 108.3 | +$25783 | 0.23 | 55% |
| 2026 | 289 | 51.5 | +$25410 | 0.18 | 54% |
| 2024 | 187 | 33.5 | +$3832 | 0.18 | 56% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 152767 |
| continuation | 93329 |
| breakout | 91928 |
| bounce | 91813 |
| reversal | 91791 |
| no-signal | 91791 |
| trend-filter | 69945 |
| friday | 61465 |
| max-signals | 17921 |
| circuit | 2857 |
| daily-loss | 1740 |
| position | 661 |

*Generated 2026-08-29T07:12:12.582Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
