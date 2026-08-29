"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
} from "lightweight-charts";

interface Analysis {
  bars: { t: number; o: number; h: number; l: number; c: number }[];
  ema21: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  atr14: number;
  supports: { price: number; kind: string; touches: number; confirmed: boolean }[];
  resistances: { price: number; kind: string; touches: number; confirmed: boolean }[];
  events: { t: number; side: "buy" | "sell"; price: number; level: number; kind: string; confirmed: boolean }[];
}

interface ChartResult {
  instrument: string;
  granularity: string;
  pipSize: number;
  price: number;
  analysis: Analysis;
  error?: string;
}

interface AnalyzeResult {
  symbol: string;
  price: number;
  pipSize: number;
  session: string;
  sessionTradeable: boolean;
  heuristic: string;
  llm: string | null;
  llmEnabled: boolean;
  llmError: string | null;
  context: { regime: string; h1Adx: number; longBias: boolean; m15Rsi: number; spreadPips: number };
  structure: { supports: StructLevel[]; resistances: StructLevel[] };
  events: SwingEv[];
  signal: Signal | null;
  rejected: string[];
  error?: string;
}

interface StructLevel { price: number; kind: string; touches: number; confirmed: boolean }
interface SwingEv { t: number; side: "buy" | "sell"; price: number; level: number; kind: string; confirmed: boolean }

interface Signal {
  direction: "long" | "short";
  strategy: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  slAtr: number;
  slPips: number;
  lots: number;
  riskAmount: number;
  confidenceNotes: string;
}

interface AccountInfo {
  account: { currency: string; balance: number; nav: number; openTrades: number; marginCloseoutPercent: number };
  positions: Array<{ symbol: string; instrument: string; direction: string; units: number; avgPrice: number; unrealizedPL: number; pipSize: number }>;
  error?: string;
  configured?: boolean;
}

const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "XAU/USD", "NAS100", "US30"];
const TFS = ["M5", "M15", "H1"] as const;

// pip value per 1.00 lot and units per 1.00 lot, mirroring the engine's sizing table
const META: Record<string, { pip: number; pv: (price: number) => number; unitPerLot: number; total: boolean }> = {
  "EUR/USD": { pip: 0.0001, pv: () => 10, unitPerLot: 100000, total: true },
  "GBP/USD": { pip: 0.0001, pv: () => 10, unitPerLot: 100000, total: true },
  "USD/JPY": { pip: 0.01, pv: (p) => 100000 * 0.01 / Math.max(p, 1e-9), unitPerLot: 100000, total: true },
  "USD/CHF": { pip: 0.0001, pv: (p) => 100000 * 0.0001 / Math.max(p, 1e-9), unitPerLot: 100000, total: true },
  "XAU/USD": { pip: 0.1, pv: () => 10, unitPerLot: 100, total: true },
  NAS100: { pip: 1, pv: () => 1, unitPerLot: 1, total: false },
  US30: { pip: 1, pv: () => 1, unitPerLot: 1, total: false },
};

function fmt(n: number | null | undefined, dp = 5): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toFixed(dp);
}

function nearestBelow(levels: StructLevel[] | undefined, price: number): StructLevel | undefined {
  return (levels ?? []).filter((s) => s.price < price).sort((a, b) => b.price - a.price)[0];
}
function nearestAbove(levels: StructLevel[] | undefined, price: number): StructLevel | undefined {
  return (levels ?? []).filter((r) => r.price > price).sort((a, b) => a.price - b.price)[0];
}

export default function ChartPage() {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [tf, setTf] = useState<(typeof TFS)[number]>("M15");
  const [count, setCount] = useState(300);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [showEma, setShowEma] = useState({ ema21: true, ema50: true, ema200: false });
  const [analyze, setAnalyze] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [msg, setMsg] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState("");
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [ordDir, setOrdDir] = useState<"long" | "short">("long");
  const [ordLots, setOrdLots] = useState(0.01);
  const [ordSl, setOrdSl] = useState("");
  const [ordTp, setOrdTp] = useState("");

  const chartElRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRefs = useRef<Array<ISeriesApi<"Line">>>([]);
  const priceLineRefs = useRef<Array<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>>>([]);
  const hoverRef = useRef<HTMLDivElement | null>(null);
  const analyzingRef = useRef(false);
  const dataReadyRef = useRef(false);

  const loadAccount = useCallback(async () => {
    const res = await fetch("/api/trade").catch(() => null);
    if (res && res.ok) setAccount((await res.json()) as AccountInfo);
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const loadChart = useCallback(async (sym: string, g: string, c: number, quiet = false) => {
    if (!quiet) setChartLoading(true);
    try {
      const res = await fetch(`/api/chart?symbol=${encodeURIComponent(sym)}&granularity=${g}&count=${c}`);
      const data = (await res.json()) as ChartResult;
      if (data.error) setMsg(`chart: ${data.error}`);
      setChart(data);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (e) {
      if (!quiet) setMsg(`chart fetch failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      if (!quiet) setChartLoading(false);
    }
  }, []);

  const loadAnalyze = useCallback(async (sym: string, gran: string) => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/analyze?symbol=${encodeURIComponent(sym)}&granularity=${gran}`);
      const data = (await res.json()) as AnalyzeResult;
      if (data.error) setMsg(`analyze: ${data.error}`);
      else setAnalyze(data);
    } catch (e) {
      setMsg(`analyze failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    dataReadyRef.current = false;
    loadChart(symbol, tf, count);
    const t = setTimeout(() => loadAnalyze(symbol, tf), 350);
    return () => clearTimeout(t);
  }, [symbol, tf, count, loadChart, loadAnalyze]);

  // live refresh: candles every 15s, engine+AI every 60s, account every 45s
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => loadChart(symbol, tf, count, true), 15000);
    return () => clearInterval(id);
  }, [live, symbol, tf, count, loadChart]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => loadAnalyze(symbol, tf), 60000);
    return () => clearInterval(id);
  }, [live, symbol, tf, loadAnalyze]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(loadAccount, 45000);
    return () => clearInterval(id);
  }, [live, loadAccount]);

  // ---- chart lifecycle: create once ----------------------------------------
  useEffect(() => {
    const el = chartElRef.current;
    if (!el) return;
    const container = el.parentElement;
    const width = container ? Math.max(300, container.clientWidth - 2) : 900;
    const height = container ? Math.max(420, Math.min(760, (container as HTMLElement).clientHeight)) : 520;

    const api = createChart(el, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#10141f" },
        textColor: "#7f8aa0",
        fontSize: 11,
      },
      grid: { vertLines: { color: "#151b28" }, horzLines: { color: "#151b28" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#222a3a" },
      timeScale: { borderColor: "#222a3a", timeVisible: true, secondsVisible: false },
    });
    apiRef.current = api;
    candleRef.current = api.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });
    lineRefs.current = ["#22d3ee", "#f59e0b", "#8b5cf6"].map((color) =>
      api.addLineSeries({ color, lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false })
    );
    api.subscribeCrosshairMove((param: MouseEventParams) => {
      const h = hoverRef.current;
      if (!h) return;
      if (param.time && param.seriesData && candleRef.current) {
        const d = param.seriesData.get(candleRef.current) as { open?: number; high?: number; low?: number; close?: number } | undefined;
        h.textContent = d && d.close !== undefined ? `O ${fmt(d.open)}  H ${fmt(d.high)}  L ${fmt(d.low)}  C ${fmt(d.close)}` : "";
      } else {
        h.textContent = "";
      }
    });
    const onResize = () => {
      if (!apiRef.current || !chartElRef.current) return;
      const c = chartElRef.current.parentElement;
      apiRef.current.applyOptions({
        width: c ? Math.max(300, c.clientWidth - 2) : 900,
        height: c ? Math.max(420, Math.min(760, (c as HTMLElement).clientHeight)) : 520,
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      api.remove();
      apiRef.current = null;
      candleRef.current = null;
      lineRefs.current = [];
      priceLineRefs.current = [];
      dataReadyRef.current = false;
    };
  }, []);

  // ---- chart data + overlays: re-render on fresh data without recreating ----
  useEffect(() => {
    if (!chart || !apiRef.current || !candleRef.current) return;
    const a = chart.analysis;
    const api = apiRef.current;
    const prevRange = dataReadyRef.current ? api.timeScale().getVisibleRange() : null;

    for (const pl of priceLineRefs.current) candleRef.current?.removePriceLine(pl);
    priceLineRefs.current = [];

    const t2 = (n: number): UTCTimestamp => n as UTCTimestamp;
    candleRef.current!.setData(
      a.bars.map((b) => ({ time: t2(b.t), open: b.o, high: b.h, low: b.l, close: b.c }))
    );

    const emaArrs = [a.ema21, a.ema50, a.ema200];
    const vis = [showEma.ema21, showEma.ema50, showEma.ema200];
    lineRefs.current.forEach((s, idx) => {
      s.setData(
        emaArrs[idx]
          .map((v, i) => ({ v, t: a.bars[i]?.t }))
          .filter((x): x is { v: number; t: number } => x.v !== null && x.v !== undefined && Number.isFinite(x.v) && x.t !== undefined)
          .map((x) => ({ time: t2(x.t), value: x.v }))
      );
      s.applyOptions({ visible: vis[idx] });
    });

    // confirmed structure levels
    a.supports.filter((s) => s.confirmed).forEach((s, i) => {
      priceLineRefs.current.push(
        candleRef.current!.createPriceLine({
          price: s.price,
          color: "#22d3ee",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `S${i + 1} ${s.touches}x`,
        })
      );
    });
    a.resistances.filter((r) => r.confirmed).forEach((r, i) => {
      priceLineRefs.current.push(
        candleRef.current!.createPriceLine({
          price: r.price,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `R${i + 1} ${r.touches}x`,
        })
      );
    });

    // sweep / break markers
    const markers = a.events.map((e) => ({
      time: t2(e.t),
      position: (e.side === "buy" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
      color: e.side === "buy" ? "#22c55e" : "#ef4444",
      shape: (e.side === "buy" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
      text: e.kind,
    }));

    // active signal overlay
    const sig = analyze?.signal;
    const lastBar = a.bars[a.bars.length - 1];
    if (sig && lastBar) {
      markers.push({
        time: t2(lastBar.t),
        position: (sig.direction === "long" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
        color: sig.direction === "long" ? "#22c55e" : "#ef4444",
        shape: (sig.direction === "long" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
        text: `${sig.strategy.toUpperCase()} ${sig.direction.toUpperCase()}`,
      });
      const defs = [
        { price: sig.entry, color: "#3b82f6", lineStyle: LineStyle.Solid, title: "ENTRY" },
        { price: sig.sl, color: "#ef4444", lineStyle: LineStyle.Dashed, title: "SL" },
        { price: sig.tp1, color: "#22c55e", lineStyle: LineStyle.Dashed, title: "TP1" },
        { price: sig.tp2, color: "#22d3ee", lineStyle: LineStyle.Dashed, title: "TP2" },
      ];
      for (const d of defs) {
        priceLineRefs.current.push(
          candleRef.current!.createPriceLine({ price: d.price, color: d.color, lineWidth: 1, lineStyle: d.lineStyle, axisLabelVisible: true, title: d.title })
        );
      }
    }
    candleRef.current!.setMarkers(markers.slice(-60));

    // keep the visible time window stable across live refreshes (clamped to data)
    if (a.bars.length > 0) {
      const first = a.bars[0].t;
      const last = a.bars[a.bars.length - 1].t;
      let restored = false;
      if (prevRange && typeof prevRange.from === "number" && typeof prevRange.to === "number") {
        const from = Math.min(Math.max(prevRange.from, first), last);
        const to = Math.min(Math.max(prevRange.to, first), last);
        if (from < to) {
          try {
            api.timeScale().setVisibleRange({ from: t2(from), to: t2(to) });
            restored = true;
          } catch {
            /* out-of-range; fall through */
          }
        }
      }
      if (!restored) {
        try {
          api.timeScale().scrollToRealTime();
        } catch {
          /* noop */
        }
      }
      dataReadyRef.current = true;
    }
  }, [chart, analyze, showEma]);

  // ---- trade helpers ---------------------------------------------------------
  const meta = META[symbol] ?? META["EUR/USD"];
  const price = chart?.price ?? analyze?.price ?? 0;
  const equity = account?.account.nav ?? 10000;
  const supp = nearestBelow(analyze?.structure?.supports, price);
  const res = nearestAbove(analyze?.structure?.resistances, price);

  const suggestedSl = (() => {
    if (ordDir === "long") return analyze?.signal?.sl ?? supp?.price ?? (price > 0 ? price * 0.997 : 0);
    return analyze?.signal?.sl ?? res?.price ?? (price > 0 ? price * 1.003 : 0);
  })();

  const suggestedTp = (() => {
    const tp = analyze?.signal?.tp1;
    if (tp !== undefined && tp !== null) return tp;
    if (ordDir === "long") return res?.price ?? (price > 0 ? price * 1.006 : 0);
    return supp?.price ?? (price > 0 ? price * 0.994 : 0);
  })();

  const parsePriceOr = (s: string, fallback: number): number => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : fallback;
  };
  const effSl = parsePriceOr(ordSl, suggestedSl);
  const effTp = parsePriceOr(ordTp, suggestedTp);

  const riskLots = (() => {
    if (price <= 0 || effSl <= 0) return 0.01;
    const stopDist = Math.abs(price - effSl);
    if (stopDist === 0) return 0.01;
    const hit = (equity * 0.01) / (stopDist * meta.pv(price));
    return meta.unitPerLot === 1 ? Math.max(1, Math.floor(hit)) : Math.max(0.01, Math.floor(hit * 100) / 100);
  })();

  const placeOrder = async () => {
    setOrderBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          direction: ordDir,
          lots: ordLots,
          sl: effSl > 0 ? effSl : undefined,
          tp: effTp > 0 ? effTp : undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; orderId?: string; lots?: number };
      if (data.ok) setMsg(`ORDER FILLED #${data.orderId} — ${symbol} ${ordDir.toUpperCase()} ${data.lots} lots`);
      else setMsg(`order rejected: ${data.error ?? "unknown"}`);
      await loadAccount();
    } catch (e) {
      setMsg(`order failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setOrderBusy(false);
    }
  };

  const closePosition = async (instrument: string) => {
    setCloseBusy(instrument);
    try {
      const res = await fetch(`/api/trade/positions?symbol=${encodeURIComponent(instrument)}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) setMsg(`closed ${instrument}`);
      else setMsg(`close failed: ${data.error}`);
      await loadAccount();
    } finally {
      setCloseBusy("");
    }
  };

  return (
    <div className="wrap">
      <header className="topbar">
        <div>
          <h1>CHART LAB · {symbol}</h1>
          <div className="sub">structure levels · liquidity sweeps · AI commentary · manual orders (OANDA)</div>
        </div>
        <div className="badges">
          <a href="/" className="badge" style={{ textDecoration: "none" }}>← Dashboard</a>
          <span className={`badge ${chartLoading ? "warn" : live ? "ok" : "dim"}`}>
            {chartLoading ? "loading…" : live ? `LIVE ${chart?.granularity ?? tf} · ${updatedAt ?? ""}` : `static ${chart?.granularity ?? tf}`}
          </span>
          <span className={`badge ${analyze?.sessionTradeable ? "ok" : "warn"}`}>session {analyze?.session ?? "-"} {analyze?.sessionTradeable ? "· tradeable" : ""}</span>
          {account && <span className="badge">bal {fmt(account.account.balance, 2)} {account.account.currency}</span>}
        </div>
      </header>

      {msg && <div className="muted-box errors">{msg}</div>}

      <div className="controls">
        <select value={symbol} onChange={(e) => { setSymbol(e.target.value); setOrdLots(META[e.target.value]?.unitPerLot === 1 ? 1 : 0.01); setOrdSl(""); setOrdTp(""); }} style={{ minWidth: 110 }}>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={tf} onChange={(e) => { const v = e.target.value as (typeof TFS)[number]; setTf(v); setCount(v === "H1" ? 200 : 300); }}>
          {TFS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[100, 200, 300, 500].map((c) => (
            <option key={c} value={c}>{c} bars</option>
          ))}
        </select>
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <label style={{ color: showEma.ema21 ? "var(--cyan)" : "var(--text-dim)", fontSize: 11 }}>
            <input type="checkbox" checked={showEma.ema21} onChange={(e) => setShowEma((s) => ({ ...s, ema21: e.target.checked }))} /> EMA21
          </label>
          <label style={{ color: showEma.ema50 ? "var(--amber)" : "var(--text-dim)", fontSize: 11 }}>
            <input type="checkbox" checked={showEma.ema50} onChange={(e) => setShowEma((s) => ({ ...s, ema50: e.target.checked }))} /> EMA50
          </label>
          <label style={{ color: showEma.ema200 ? "#8b5cf6" : "var(--text-dim)", fontSize: 11 }}>
            <input type="checkbox" checked={showEma.ema200} onChange={(e) => setShowEma((s) => ({ ...s, ema200: e.target.checked }))} /> EMA200
          </label>
        </span>
        <button className={live ? "primary" : ""} onClick={() => setLive((v) => !v)} title="auto-refresh candles (15s) + engine/AI (60s) + account (45s)">
          {live ? "LIVE ●" : "PAUSED"}
        </button>
        <button className="primary" disabled={analyzing} onClick={() => { loadChart(symbol, tf, count); loadAnalyze(symbol, tf); }}>
          {analyzing ? "analyzing…" : "Re-analyze"}
        </button>
        <button onClick={loadAccount}>refresh account</button>
        {chart && <span className="dim" style={{ fontSize: 11 }}>last {fmt(chart.price)} · ATR14 {fmt(chart.analysis.atr14, 4)}</span>}
      </div>

      <div className="grid chartGrid">
        <div className="panel">
          <div className="panel-head">
            <h2>{symbol} · {tf} — candles, confirmed S/R, sweeps ▼▲, engine signal</h2>
            <div ref={hoverRef} className="dim" style={{ fontSize: 11 }} />
          </div>
          <div style={{ padding: 10 }}>
            <div ref={chartElRef} style={{ height: 520 }} />
          </div>
          <div className="legend" style={{ margin: "0 12px 10px", display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "var(--text-dim)" }}>
            <span><i style={{ display: "inline-block", width: 10, height: 1, background: "var(--cyan)", verticalAlign: "middle", marginRight: 5 }} />confirmed support</span>
            <span><i style={{ display: "inline-block", width: 10, height: 1, background: "var(--amber)", verticalAlign: "middle", marginRight: 5 }} />confirmed resistance</span>
            <span><span style={{ color: "var(--green)" }}>▲</span> buy sweep / bullish break</span>
            <span><span style={{ color: "var(--red)" }}>▼</span> sell sweep / bearish break</span>
            <span><span style={{ color: "var(--blue)" }}>ENTRY</span> · <span style={{ color: "var(--red)" }}>SL</span> · <span style={{ color: "var(--green)" }}>TP1</span> · <span style={{ color: "var(--cyan)" }}>TP2</span> signal overlay</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel">
            <div className="panel-head">
              <h2>AI analysis</h2>
              {analyzing && <span className="dim" style={{ fontSize: 10 }}>converging…</span>}
            </div>
            <div className="panel-body">
              {!analyze && !analyzing && <div className="dim" style={{ fontSize: 11 }}>Waiting for the engine + structure pass…</div>}
              {analyze?.error && <div className="errors">{analyze.error}</div>}
              {analyze && !analyze.error && (
                <>
                  <div className="ai-box">{analyze.heuristic}</div>
                  {analyze.llmEnabled && (
                    <>
                      <div className="dim" style={{ marginTop: 10, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                        LLM {analyze.llmError ? "(model unavailable)" : "enhanced view"}
                      </div>
                      {analyze.llmError ? (
                        <div className="errors" style={{ marginTop: 4 }}>{analyze.llmError}</div>
                      ) : (
                        <div className="ai-box llm">{analyze.llm}</div>
                      )}
                    </>
                  )}
                  <div className="kv" style={{ marginTop: 10 }}>
                    <span className="k">BIAS</span>
                    <span className={`v ${analyze.context.longBias ? "up" : "down"}`}>{analyze.context.longBias ? "LONG" : "SHORT"}</span>
                    <span></span>
                    <span className="k">REGIME</span>
                    <span className="v dim">{analyze.context.regime} · ADX {analyze.context.h1Adx.toFixed(0)}</span>
                    <span></span>
                    <span className="k">M15 RSI</span>
                    <span className="v dim">{analyze.context.m15Rsi.toFixed(0)}</span>
                    <span></span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Structure &amp; sweeps</h2></div>
            <div className="panel-body" style={{ maxHeight: 200, overflowY: "auto" }}>
              {(analyze?.events ?? []).length === 0 && <div className="dim" style={{ fontSize: 11 }}>No sweeps or structure breaks in the visible {tf} window.</div>}
              {(analyze?.events ?? []).slice().reverse().map((e, i) => (
                <div className={`reject ${e.side === "buy" ? "up" : "down"}`} key={i} style={{ fontSize: 11 }}>
                  <span className="sym">{new Date(e.t * 1000).toLocaleString()}</span>{" "}
                  {e.kind === "sweep" ? `${e.side === "buy" ? "sweep of support" : "sweep of resistance"}` : `${e.side === "buy" ? "break up" : "break down"}`}{" "}
                  @ {fmt(e.level)}{e.confirmed ? <span className="badge ok" style={{ marginLeft: 6 }}>confirmed</span> : null}
                </div>
              ))}
              <div className="dim" style={{ marginTop: 8, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Confirmed levels</div>
              {(analyze?.structure?.supports?.length ?? 0) === 0 && (analyze?.structure?.resistances?.length ?? 0) === 0 && (
                <div className="dim" style={{ fontSize: 11 }}>none in window</div>
              )}
              {analyze?.structure?.supports?.map((s, i) => (
                <div key={`s${i}`} style={{ fontSize: 11 }}><span className="up">S{i + 1}</span> {fmt(s.price)} · {s.touches} touches {s.confirmed ? "✓" : ""}</div>
              ))}
              {analyze?.structure?.resistances?.map((r, i) => (
                <div key={`r${i}`} style={{ fontSize: 11 }}><span className="down">R{i + 1}</span> {fmt(r.price)} · {r.touches} touches {r.confirmed ? "✓" : ""}</div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Trade — place order</h2></div>
            <div className="panel-body">
              {analyze?.signal && (
                <div className="signal-card" style={{ marginBottom: 10 }}>
                  <div className="sc-head">
                    <span className="sym">{analyze.symbol}</span>
                    <span className={`sig ${analyze.signal.direction}`}>{analyze.signal.direction.toUpperCase()}</span>
                    <span className="sig strategy">{analyze.signal.strategy}</span>
                  </div>
                  <div className="kv" style={{ fontSize: 11 }}>
                    <span className="k">ENTRY</span><span className="v dim">{fmt(analyze.signal.entry)}</span><span></span>
                    <span className="k">SL</span><span className="v down">{fmt(analyze.signal.sl)}</span><span className="dim">{analyze.signal.slAtr.toFixed(1)}x ATR</span>
                    <span className="k">TP1</span><span className="v">{fmt(analyze.signal.tp1)}</span><span className="dim">move to BE</span>
                    <span className="k">TP2</span><span className="v up">{fmt(analyze.signal.tp2)}</span><span className="dim">full close</span>
                  </div>
                  <div className="notes">{analyze.signal.confidenceNotes}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button className={ordDir === "long" ? "seg-btn on-long" : "seg-btn"} onClick={() => setOrdDir("long")}>BUY</button>
                <button className={ordDir === "short" ? "seg-btn on-short" : "seg-btn"} onClick={() => setOrdDir("short")}>SELL</button>
              </div>
              <div className="kv" style={{ fontSize: 11 }}>
                <span className="k">LOTS</span>
                <span className="v">
                  <input type="number" step={meta.unitPerLot === 1 ? 1 : 0.01} min={meta.unitPerLot === 1 ? 1 : 0.01} value={ordLots} onChange={(e) => setOrdLots(Number(e.target.value))} style={{ width: 90 }} />
                </span>
                <span className="dim">1% risk ≈ {riskLots} lots</span>
              </div>
              <div className="kv" style={{ fontSize: 11 }}>
                <span className="k">SL</span>
                <span className="v"><input type="text" placeholder={fmt(suggestedSl)} value={ordSl} onChange={(e) => setOrdSl(e.target.value)} style={{ width: 100 }} /></span>
                <span className="dim">{fmt(effSl)}</span>
              </div>
              <div className="kv" style={{ fontSize: 11 }}>
                <span className="k">TP1</span>
                <span className="v"><input type="text" placeholder={fmt(suggestedTp)} value={ordTp} onChange={(e) => setOrdTp(e.target.value)} style={{ width: 100 }} /></span>
                <span className="dim">{fmt(effTp)}</span>
              </div>
              <button className="primary" style={{ width: "100%", marginTop: 8 }} onClick={placeOrder} disabled={orderBusy || price <= 0}>
                {orderBusy ? "placing…" : `Place ${ordDir.toUpperCase()} ${symbol} · ${ordLots} lots`}
              </button>
              <div className="dim" style={{ fontSize: 10, marginTop: 6 }}>
                Market order (FOK) with optional SL/TP. Practice OANDA accepts CURRENCY pairs only — gold/index orders will be rejected by the broker.
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Open positions</h2></div>
            <div className="panel-body" style={{ padding: "6px 0" }}>
              {!account && <div className="dim" style={{ fontSize: 11, padding: "8px 14px" }}>loading…</div>}
              {account?.error && <div className="errors" style={{ margin: 8 }}>{account.error}</div>}
              {account?.configured === false && <div className="dim" style={{ fontSize: 11, padding: "8px 14px" }}>OANDA not configured.</div>}
              {account && account.positions.length === 0 && !account.error && (
                <div className="dim" style={{ fontSize: 11, padding: "8px 14px" }}>No open positions.</div>
              )}
              {account?.positions.map((p) => (
                <div key={p.instrument} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 14px", borderBottom: "1px solid rgba(34,42,58,0.5)" }}>
                  <span className="sym">{p.symbol}</span>
                  <span className={p.direction === "long" ? "up" : "down"}>{p.direction.slice(0, 4).toUpperCase()}</span>
                  <span className="dim" style={{ fontSize: 11 }}>{p.units} @ {fmt(p.avgPrice)}</span>
                  <span className={`num ${p.unrealizedPL >= 0 ? "up" : "down"}`} style={{ marginLeft: "auto" }}>
                    {p.unrealizedPL >= 0 ? "+" : ""}{p.unrealizedPL.toFixed(2)}
                  </span>
                  <button className="small" disabled={closeBusy === p.instrument} onClick={() => closePosition(p.instrument)}>
                    {closeBusy === p.instrument ? "…" : "close"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}