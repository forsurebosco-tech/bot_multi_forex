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
| final equity | $64531.57 |
| net P&L | +$54531.57 (545.32%) |
| closed trades | 978 |
| open at end | - |
| win rate | 54.40% (532W/446L) |
| avg R | 0.20 |
| total R | 192.78 |
| profit factor | 1.52 |
| expectancy / trade | $55.76 |
| max drawdown (peak) | 9.90% |
| max drawdown vs initial | 0.57% |
| best day | +$3183 |
| worst day | $-1752 |
| avg hold | 6.5h |

## By symbol

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| NAS100 | 236 | 43.1 | +$10172 | 0.18 | 51% |
| US30 | 225 | 33.0 | +$6820 | 0.15 | 52% |
| XAU/USD | 179 | 57.6 | +$17995 | 0.32 | 59% |
| GBP/USD | 93 | 10.3 | +$4908 | 0.11 | 52% |
| EUR/USD | 90 | 11.2 | +$2837 | 0.12 | 53% |
| USD/JPY | 81 | 26.9 | +$7943 | 0.33 | 63% |
| USD/CHF | 74 | 10.6 | +$3857 | 0.14 | 55% |

## By outcome

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| eod | 542 | 276.4 | +$81025 | 0.51 | 72% |
| sl | 295 | -304.0 | $-90549 | -1.03 | 0% |
| tp2 | 78 | 174.1 | +$49785 | 2.23 | 100% |
| tp1-be | 63 | 46.2 | +$14270 | 0.73 | 100% |

## By strategy

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| breakout | 878 | 172.6 | +$49829 | 0.20 | 55% |
| continuation | 44 | 10.6 | +$2009 | 0.24 | 50% |
| bounce | 43 | 10.6 | +$2831 | 0.25 | 51% |
| reversal | 13 | -1.0 | $-137 | -0.08 | 46% |

## By year

| group | # | net R | net $ | R/trade | win% |
| --- | --- | --- | --- | --- | --- |
| 2025 | 490 | 108.0 | +$25051 | 0.22 | 54% |
| 2026 | 296 | 53.5 | +$25962 | 0.18 | 54% |
| 2024 | 192 | 31.3 | +$3518 | 0.16 | 55% |

## Gate hit counts

| gate | rejections |
| --- | --- |
| session | 152767 |
| continuation | 92586 |
| breakout | 91192 |
| bounce | 91053 |
| reversal | 91001 |
| no-signal | 91001 |
| trend-filter | 69438 |
| friday | 61465 |
| max-signals | 19681 |
| circuit | 3336 |
| daily-loss | 2015 |
| position | 684 |

*Generated 2026-08-29T06:00:34.617Z — engine v1 (analyzePair), conservative fills, no news calendar feed (blackout = empty).*
