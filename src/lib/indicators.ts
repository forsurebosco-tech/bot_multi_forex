import type { Candle } from "./oanda";

export interface Series {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

export function toSeries(candles: Candle[]): Series {
  return {
    open: candles.map((c) => c.open),
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    volume: candles.map((c) => c.volume),
  };
}

export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function trueRange(series: Series): number[] {
  const tr = new Array<number>(series.close.length).fill(0);
  for (let i = 0; i < series.close.length; i++) {
    if (i === 0) {
      tr[i] = series.high[i] - series.low[i];
    } else {
      tr[i] = Math.max(
        series.high[i] - series.low[i],
        Math.abs(series.high[i] - series.close[i - 1]),
        Math.abs(series.low[i] - series.close[i - 1])
      );
    }
  }
  return tr;
}

export function atr(series: Series, period = 14): number[] {
  const tr = trueRange(series);
  const out = new Array<number>(tr.length).fill(NaN);
  if (tr.length < period) return out;
  let prev = 0;
  for (let i = 0; i < period; i++) prev += tr[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export interface AdxResult {
  adx: number[];
  plusDi: number[];
  minusDi: number[];
}

export function adx(series: Series, period = 14): AdxResult {
  const n = series.close.length;
  const plusDm = new Array<number>(n).fill(0);
  const minusDm = new Array<number>(n).fill(0);
  const tr = trueRange(series);

  for (let i = 1; i < n; i++) {
    const upMove = series.high[i] - series.high[i - 1];
    const downMove = series.low[i - 1] - series.low[i];
    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const atrSmoothed = new Array<number>(n).fill(NaN);
  const plusSmoothed = new Array<number>(n).fill(NaN);
  const minusSmoothed = new Array<number>(n).fill(NaN);

  if (n < period) return { adx: atrSmoothed, plusDi: plusSmoothed, minusDi: minusSmoothed };

  let atrSum = 0, plusSum = 0, minusSum = 0;
  for (let i = 0; i < period; i++) {
    atrSum += tr[i];
    plusSum += plusDm[i];
    minusSum += minusDm[i];
  }
  atrSmoothed[period - 1] = atrSum;
  plusSmoothed[period - 1] = plusSum;
  minusSmoothed[period - 1] = minusSum;

  for (let i = period; i < n; i++) {
    atrSmoothed[i] = atrSmoothed[i - 1] - atrSmoothed[i - 1] / period + tr[i];
    plusSmoothed[i] = plusSmoothed[i - 1] - plusSmoothed[i - 1] / period + plusDm[i];
    minusSmoothed[i] = minusSmoothed[i - 1] - minusSmoothed[i - 1] / period + minusDm[i];
  }

  const plusDi = new Array<number>(n).fill(NaN);
  const minusDi = new Array<number>(n).fill(NaN);
  const dx = new Array<number>(n).fill(NaN);
  for (let i = period - 1; i < n; i++) {
    if (atrSmoothed[i] === 0) {
      plusDi[i] = 0;
      minusDi[i] = 0;
    } else {
      plusDi[i] = 100 * (plusSmoothed[i] / atrSmoothed[i]);
      minusDi[i] = 100 * (minusSmoothed[i] / atrSmoothed[i]);
    }
    const diSum = plusDi[i] + minusDi[i];
    dx[i] = diSum === 0 ? 0 : 100 * Math.abs(plusDi[i] - minusDi[i]) / diSum;
  }

  const adxOut = new Array<number>(n).fill(NaN);
  if (n >= period * 2 - 1) {
    let adxSum = 0;
    for (let i = period - 1; i < period * 2 - 1; i++) {
      if (!isNaN(dx[i])) adxSum += dx[i];
    }
    adxOut[period * 2 - 2] = adxSum / period;
    for (let i = period * 2 - 1; i < n; i++) {
      if (!isNaN(adxOut[i - 1]) && !isNaN(dx[i])) {
        adxOut[i] = (adxOut[i - 1] * (period - 1) + dx[i]) / period;
      }
    }
  }

  return { adx: adxOut, plusDi, minusDi };
}

export function slope(values: number[], period: number, index: number): number {
  const from = Math.max(0, index - period + 1);
  if (from >= index) return 0;
  return (values[index] - values[from]) / (index - from);
}

export function highest(values: number[], period: number, end: number): number {
  const from = Math.max(0, end - period + 1);
  let h = -Infinity;
  for (let i = from; i <= end; i++) if (values[i] > h) h = values[i];
  return h;
}

export function lowest(values: number[], period: number, end: number): number {
  const from = Math.max(0, end - period + 1);
  let l = Infinity;
  for (let i = from; i <= end; i++) if (values[i] < l) l = values[i];
  return l;
}