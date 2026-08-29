# Backtest report - 2024-08-28 → 2026-08-28 | $10000 prop account

- **Window:** 2024-08-28 → 2026-08-28 (5 years, 149185 M5 bars)
- **Instruments:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD
- **Initial equity:** $10000 | risk 1% = $100/trade
- **Engine gates active:** sessions (London/NY/overlap), H1 EMA200 trend + chop zone + slope, ADX20 regime, spread ≤2x typical, 3 signals/day, -3% engine day stop, 2-SL breaker, 1 pos/pair, max 3 concurrent, correlation (gold = USD bucket).
- **Prop rules (hard):** daily loss ≤ -5% of day-start balance; max drawdown ≤ -10% from initial.
- **Fills (conservative):** entries at M15-close signal price, exits resolved on M5 closes, SL wins bar conflicts, TP1 closes half @ 1.5R → SL→BE, TP2 closes @ 3R. Round-trip spread at typicalSpreadPips deducted.
- **Day-trading rule:** positions force-flat at 21:00 GMT (end of NY) — no overnight/weekend holds

## ✅ ACCOUNT DOUBLED (200% target)


## Headline

| metric | value |
| --- | --- |
| final equity | $31582.19 |
| net P&L | +$21582.19 (215.82%) |
| closed trades | 509 |
| open at end | - |
| win rate | 56.78% (289W/220L) |
| avg R | 0.23 |
| total R | 117.68 |
| profit factor | 1.87 |
| expectancy / trade | $42.40 |
| max drawdown (peak) | 6.66% |
| max drawdown vs initial | 5.89% |
| best day | +$1627 |
| worst day | $-761 |
| avg hold | 7.5h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 166 | 54.3 | +$10080 | 0.33 | 60% |
| GBP/USD | 98 | 20.7 | +$4438 | 0.21 | 56% |
| EUR/USD | 89 | 9.5 | +$1395 | 0.11 | 53% |
| USD/JPY | 79 | 25.2 | +$4176 | 0.32 | 61% |
| USD/CHF | 77 | 8.0 | +$1493 | 0.10 | 52% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 354 | 155.0 | +$26651 | 0.44 | 69% |
| sl | 109 | -114.0 | $-18847 | -1.05 | 0% |
| tp2 | 29 | 64.5 | +$11835 | 2.22 | 100% |
| tp1-be | 17 | 12.3 | +$1943 | 0.72 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 488 | 110.7 | +$20488 | 0.23 | 57% |
| continuation | 10 | -2.4 | $-506 | -0.24 | 30% |
| bounce | 6 | 5.1 | +$846 | 0.85 | 67% |
| reversal | 5 | 4.2 | +$755 | 0.84 | 100% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2025 | 250 | 63.6 | +$9296 | 0.25 | 54% |
| 2026 | 148 | 46.4 | +$11542 | 0.31 | 63% |
| 2024 | 111 | 7.6 | +$745 | 0.07 | 54% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 111699 |
| breakout | 62970 |
| reversal | 62923 |
| no-signal | 62923 |
| trend-filter | 60578 |
| friday | 44172 |
| bounce | 24538 |
| continuation | 23568 |
| max-signals | 7228 |
| position | 400 |
| circuit | 104 |

*Generated 2026-08-29T04:26:57.823Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
