"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ContextRow {
  symbol: string;
  display: string;
  type: string;
  price: number;
  pipSize: number;
  spreadPips: number;
  spreadOk: boolean;
  regime: "trending" | "ranging";
  longBias: boolean;
  h1Adx: number;
  chopZone: boolean;
  emaSlopeFlat: boolean;
  canTradeSession: boolean;
  session: string;
  newsBlackout: boolean;
  signal: Signal | null;
  rejected: string[];
}

interface Signal {
  symbol: string;
  direction: "long" | "short";
  strategy: "continuation" | "breakout" | "bounce" | "reversal";
  entry: number;
  sl: number;
  slPips: number;
  slAtr: number;
  tp1: number;
  tp2: number;
  session: string;
  regime: { kind: string; adx: number };
  spreadPips: number;
  atr: number;
  lots: number;
  riskAmount: number;
  confidenceNotes: string;
  generatedAt: string;
}

interface OpenPosition {
  symbol: string;
  direction: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  lots: number;
  openedAt: string;
}

interface LogEntry {
  time: string;
  symbol: string;
  kind: "signal" | "rejection";
  strategy?: string;
  reason: string;
}

interface EngineState {
  equity: number;
  signalsCount: number;
  consecutiveLosses: number;
  circuitBreaker: boolean;
  circuitBreakerDay: string | null;
  dailyLossHit: boolean;
  dayKey: string;
  openPositions: OpenPosition[];
  logs: LogEntry[];
}

interface ConfigPayload {
  configured: boolean;
  watchlist: Array<{ symbol: string; display: string; type: string; enabled: boolean }>;
  config: any;
  accountRules: { equity: number };
  session: { label: string; canTrade: boolean };
  initialState: EngineState;
}

interface ScanResponse {
  configured: boolean;
  message?: string;
  error?: string;
  session?: { label: string; canTrade: boolean };
  signals: Signal[];
  contexts: ContextRow[];
  rejections: Array<{ symbol: string; reasons: string[] }>;
  state: EngineState;
  scannedAt: string;
}

interface BacktestTrade {
  signal: Signal;
  entryTime: string;
  exitTime: string;
  exitPrice: number;
  resultR: number;
  resultPips: number;
  outcome: string;
}

interface BacktestResponse {
  symbol: string;
  trades: BacktestTrade[];
  summary: {
    totalTrades: number;
    winners: number;
    losers: number;
    winRate: number;
    avgR: number;
    totalR: number;
    maxDrawdownPct: number;
  };
  error?: string;
}

const LS_KEY = "fx-engine-state-v1";

function fmtPrice(n: number | null | undefined, pip: number): string {
  if (n === null || n === undefined || !isFinite(n)) return "-";
  const decimals = pip <= 0.0001 ? 5 : pip === 0.01 ? 3 : 2;
  return n.toFixed(decimals);
}

function fmtPips(n: number): string {
  return n.toFixed(1);
}

export default function Home() {
  const [cfg, setCfg] = useState<ConfigPayload | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [contexts, setContexts] = useState<ContextRow[] | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [rejections, setRejections] = useState<Array<{ symbol: string; reasons: string[] }>>([]);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [equity, setEquity] = useState(10000);
  const [lastScan, setLastScan] = useState<string>("");
  const [autoMs, setAutoMs] = useState(0);
  const [session, setSession] = useState<{ label: string; canTrade: boolean }>({ label: "-", canTrade: false });
  const [bt, setBt] = useState<BacktestResponse | null>(null);
  const [btRunning, setBtRunning] = useState(false);
  const [btPair, setBtPair] = useState("EUR/USD");
  const [btDays, setBtDays] = useState(3);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLocalState = useCallback((): EngineState | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as EngineState) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: ConfigPayload) => {
        setCfg(c);
        setSession(c.session);
        setEquity(c.accountRules?.equity ?? 10000);
        const local = loadLocalState();
        setState(local && local.equity > 0 ? { ...c.initialState, ...local } : c.initialState);
      })
      .catch(() => setMsg("Failed to load config"));
  }, [loadLocalState]);

  const scan = useCallback(async () => {
    setScanning(true);
    setMsg("");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          equity,
          newsEvents: [],
        }),
      });
      const data = (await res.json()) as ScanResponse;
      if (data.error) {
        setMsg(`Error: ${data.error}`);
        return;
      }
      if (data.message) setMsg(data.message);
      setSignals(data.signals ?? []);
      setContexts(data.contexts ?? null);
      setRejections(data.rejections ?? []);
      if (data.session) setSession(data.session);
      if (data.state) {
        setState(data.state);
        try {
          window.localStorage.setItem(LS_KEY, JSON.stringify(data.state));
        } catch {
          /* storage unavailable */
        }
      }
      setLastScan(data.scannedAt || new Date().toISOString());
    } catch (e) {
      setMsg(`Scan failed: ${e instanceof Error ? e.message : "network"}`);
    } finally {
      setScanning(false);
    }
  }, [state, equity]);

  useEffect(() => {
    if (autoMs > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => scan(), autoMs);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [autoMs, scan]);

  const runBacktest = useCallback(async () => {
    setBtRunning(true);
    setMsg("");
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: btPair, days: btDays, equity }),
      });
      const data = (await res.json()) as BacktestResponse;
      setBt(data);
      if (data.error) setMsg(`Backtest error: ${data.error}`);
    } catch (e) {
      setMsg(`Backtest failed: ${e instanceof Error ? e.message : "network"}`);
    } finally {
      setBtRunning(false);
    }
  }, [btPair, btDays, equity]);

  const configured = cfg?.configured !== false && cfg?.configured !== undefined ? cfg.configured : true;

  return (
    <div className="wrap">
      <header className="topbar">
        <div>
          <h1>FX / XAU·USD SIGNAL ENGINE</h1>
          <div className="sub">H1 trend filter · M15 setup · M5 trigger · OANDA data</div>
        </div>
        <div className="badges">
          <a href="/chart" className="badge" style={{ textDecoration: "none" }}>Chart Lab →</a>
          <div className={configured ? "badge ok" : "badge bad"}>
            <span className={configured ? "status-dot on" : "status-dot off"}></span>
            OANDA {configured ? "connected" : "not configured"}
          </div>
          <div className={session.canTrade ? "badge ok" : "badge warn"}>
            session: {session.label} {session.canTrade ? "· tradeable" : "· closed"}
          </div>
          <div className={state?.circuitBreaker ? "badge bad" : "badge"}>
            circuit breaker {state?.circuitBreaker ? "ARMED" : "off"}
          </div>
          <div className={state?.dailyLossHit ? "badge bad" : "badge"}>
            daily loss gate {state?.dailyLossHit ? "HIT" : "ok"}
          </div>
          <div className="badge">
            signals today: <b>{state?.signalsCount ?? 0}</b>/4
          </div>
          <div className="badge">
            open: <b>{state?.openPositions.length ?? 0}</b>/3
          </div>
        </div>
      </header>

      {msg && <div className="muted-box errors">{msg}</div>}

      <div className="controls">
        <label style={{ color: "var(--text-dim)", fontSize: 11 }}>Equity ($)</label>
        <input
          type="number"
          value={equity}
          onChange={(e) => setEquity(Math.max(1, Number(e.target.value) || 10000))}
          style={{ width: 110 }}
        />
        <button className="primary" onClick={scan} disabled={scanning}>
          {scanning ? (
            <>
              <span className="spin"></span> scanning…
            </>
          ) : (
            "Scan watchlist"
          )}
        </button>
        <label style={{ color: "var(--text-dim)", fontSize: 11 }}>Auto:</label>
        <select value={autoMs} onChange={(e) => setAutoMs(Number(e.target.value))}>
          <option value={0}>off</option>
          <option value={60000}>1 min</option>
          <option value={300000}>5 min</option>
          <option value={900000}>15 min</option>
          <option value={1800000}>30 min</option>
        </select>
        {lastScan && <span className="dim" style={{ fontSize: 11 }}>last scan {new Date(lastScan).toLocaleTimeString()}</span>}
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Watchlist — {cfg?.watchlist.filter((w) => w.enabled).length ?? 0} instruments</h2>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Pair</th>
                  <th className="num">Price</th>
                  <th className="num">Spread(p)</th>
                  <th>Regime</th>
                  <th>H1 Bias</th>
                  <th>Filters</th>
                  <th>Signal</th>
                  <th>Rejection</th>
                </tr>
              </thead>
              <tbody>
                {!contexts &&
                  (cfg?.watchlist ?? []).map((w) => (
                    <tr key={w.symbol}>
                      <td>{w.symbol}</td>
                      <td className="num dim">-</td>
                      <td className="num dim">-</td>
                      <td className="dim">-</td>
                      <td className="dim">-</td>
                      <td className="dim">pending scan</td>
                      <td>-</td>
                      <td className="dim">-</td>
                    </tr>
                  ))}
                {contexts?.map((c) => {
                  const gates = [
                    c.chopZone ? "chop" : null,
                    c.emaSlopeFlat ? "flat-EMA200" : null,
                    !c.canTradeSession ? `closed (${c.session})` : null,
                    c.newsBlackout ? "news" : null,
                    !c.spreadOk ? `spread ${fmtPips(c.spreadPips)}p` : null,
                  ].filter(Boolean);
                  return (
                    <tr key={c.symbol}>
                      <td>
                        {c.display}
                        {c.type === "gold" && <span className="badge gold" style={{ marginLeft: 6, padding: "1px 5px" }}>GOLD BUCKET</span>}
                      </td>
                      <td className="num">{fmtPrice(c.price, c.pipSize)}</td>
                      <td className="num" style={{ color: c.spreadOk ? undefined : "var(--amber)" }}>
                        {fmtPips(c.spreadPips)}
                      </td>
                      <td>
                        <span className={`sig ${c.regime === "trending" ? "strategy" : "none"}`}>
                          {c.regime} {c.regime === "trending" ? `(ADX ${c.h1Adx.toFixed(0)})` : `(ADX ${c.h1Adx.toFixed(0)})`}
                        </span>
                      </td>
                      <td className={c.longBias ? "up" : "down"}>{c.longBias ? "LONG" : "SHORT"}</td>
                      <td>
                        {gates.length === 0 ? (
                          <span className="up">pass</span>
                        ) : (
                          gates.map((g) => (
                            <span key={g} className="badge warn" style={{ marginRight: 4, padding: "1px 5px", fontSize: 10 }}>
                              {g}
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        {c.signal ? (
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <span className={`sig ${c.signal.direction}`}>{c.signal.direction.toUpperCase()}</span>
                            <span className="sig strategy">{c.signal.strategy}</span>
                          </div>
                        ) : (
                          <span className="sig none">none</span>
                        )}
                      </td>
                      <td>
                        <span className="dim" title={(c.rejected ?? []).join("\n")}>
                          {(c.rejected ?? []).length > 0 ? (
                            <span style={{ color: "var(--amber)", cursor: "help" }}>{c.rejected[0]}</span>
                          ) : (
                            "-"
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <h2>Risk / session state</h2>
            </div>
            <div className="panel-body">
              {state && (
                <div className="stat-row">
                  <div className="stat">
                    <div className="label">Equity</div>
                    <div className="value">${Number(state.equity).toLocaleString()}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Signals today</div>
                    <div className="value">{state.signalsCount}/4</div>
                  </div>
                  <div className="stat">
                    <div className="label">Consec. losses</div>
                    <div className="value" style={{ color: state.consecutiveLosses >= 2 ? "var(--red)" : undefined }}>
                      {state.consecutiveLosses}/2
                    </div>
                  </div>
                  <div className="stat">
                    <div className="label">Open positions</div>
                    <div className="value">{state.openPositions.length}/3</div>
                  </div>
                </div>
              )}
              {state && state.openPositions.length > 0 && (
                <table style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Dir</th>
                      <th className="num">Entry</th>
                      <th className="num">SL</th>
                      <th className="num">TP2</th>
                      <th className="num">Lots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.openPositions.map((p, i) => (
                      <tr key={i}>
                        <td>{p.symbol}</td>
                        <td className={p.direction === "long" ? "up" : "down"}>{p.direction.toUpperCase()}</td>
                        <td className="num">{p.entry}</td>
                        <td className="num">{p.sl}</td>
                        <td className="num">{p.tp2}</td>
                        <td className="num">{p.lots}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Signal feed</h2>
            </div>
            <div className="panel-body">
              {signals.length === 0 && <div className="dim" style={{ fontSize: 11 }}>No signals since last scan.</div>}
              {signals.map((s, i) => (
                <div className="signal-card" key={i}>
                  <div className="sc-head">
                    <span className="sym">{s.symbol}</span>
                    <span className={`sig ${s.direction}`}>{s.direction.toUpperCase()}</span>
                    <span className="sig strategy">{s.strategy}</span>
                    <span className="dim" style={{ fontSize: 10 }}>session: {s.session}</span>
                  </div>
                  <div className="kv">
                    <span className="k">ENTRY</span>
                    <span className="v dim">{s.entry}</span>
                    <span></span>
                    <span className="k">SL</span>
                    <span className="v down">{s.sl} ({fmtPips(s.slPips)} pips / {s.slAtr.toFixed(1)}x ATR)</span>
                    <span></span>
                    <span className="k">TP1</span>
                    <span className="v">{s.tp1} (1.5R, move to BE)</span>
                    <span></span>
                    <span className="k">TP2</span>
                    <span className="v up">{s.tp2} (3R, full close)</span>
                    <span></span>
                    <span className="k">SIZE</span>
                    <span className="v">{s.lots} lots · risk ${s.riskAmount.toFixed(0)}</span>
                    <span className="dim">1%</span>
                    <span className="k">REGIME</span>
                    <span className="v dim">{s.regime.kind} (ADX {s.regime.adx})</span>
                    <span></span>
                  </div>
                  {s.confidenceNotes && <div className="notes">{s.confidenceNotes}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Setup / rejection log</h2>
          </div>
          <div className="panel-body" style={{ maxHeight: 260, overflowY: "auto" }}>
            {rejections.length === 0 && <div className="dim" style={{ fontSize: 11 }}>No rejections logged — all gates passed or pairs gap-free.</div>}
            {rejections.map((r, i) => (
              <div className="reject" key={i}>
                <span className="sym">{r.symbol}</span> —{" "}
                {r.reasons.map((reason, j) => (
                  <span key={j}>
                    <span className="reason">{reason}</span>
                    {j < r.reasons.length - 1 ? " · " : ""}
                  </span>
                ))}
              </div>
            ))}
            {state && state.logs.length > 0 && (
              <>
                <div className="dim" style={{ marginTop: 10, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Signal history</div>
                {state.logs
                  .filter((l) => l.kind === "signal")
                  .slice(0, 20)
                  .map((l, i) => (
                    <div className="reject" key={i}>
                      <span className="sym">{l.symbol}</span>{" "}
                      <span className={l.reason.startsWith("SHORT") ? "down" : "up"}>{l.reason.slice(0, 60)}</span>{" "}
                      <span className="dim" style={{ fontSize: 10 }}>{new Date(l.time).toLocaleString()}</span>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>

        <div className="panel backtest">
          <div className="panel-head">
            <h2>Backtest this exact ruleset</h2>
          </div>
          <div className="panel-body">
            <div className="controls" style={{ marginBottom: 8 }}>
              <select value={btPair} onChange={(e) => setBtPair(e.target.value)}>
                {(cfg?.watchlist ?? []).map((w) => (
                  <option key={w.symbol} value={w.symbol}>
                    {w.symbol}
                  </option>
                ))}
              </select>
              <select value={btDays} onChange={(e) => setBtDays(Number(e.target.value))}>
                <option value={1}>1 day</option>
                <option value={2}>2 days</option>
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
              </select>
              <button className="primary" onClick={runBacktest} disabled={btRunning}>
                {btRunning ? "running…" : "Run backtest"}
              </button>
            </div>
            {bt?.error && <div className="errors">{bt.error}</div>}
            {bt && !bt.error && (
              <>
                <div className="bt-sum">
                  <div className="stat">
                    <div className="label">Trades</div>
                    <div className="value">{bt.summary.totalTrades}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Win rate</div>
                    <div className="value">{(bt.summary.winRate * 100).toFixed(1)}%</div>
                  </div>
                  <div className="stat">
                    <div className="label">Avg R</div>
                    <div className="value">{bt.summary.avgR.toFixed(2)}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Total R</div>
                    <div className="value">{bt.summary.totalR.toFixed(2)}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Max DD</div>
                    <div className="value">{(bt.summary.maxDrawdownPct * 100).toFixed(1)}%</div>
                  </div>
                </div>
                {bt.summary.totalTrades === 0 && (
                  <div className="muted-box" style={{ marginTop: 10 }}>
                    No qualifying setups in window. That is expected — this ruleset is selective by design.
                  </div>
                )}
                {bt.trades.length > 0 && (
                  <table style={{ marginTop: 10 }}>
                    <thead>
                      <tr>
                        <th>Entry time</th>
                        <th>Dir</th>
                        <th>Strategy</th>
                        <th className="num">R</th>
                        <th className="num">Pips</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bt.trades.slice(0, 50).map((t, i) => (
                        <tr key={i}>
                          <td className="dim">{new Date(t.entryTime).toLocaleString()}</td>
                          <td className={t.signal.direction === "long" ? "up" : "down"}>{t.signal.direction.toUpperCase()}</td>
                          <td>{t.signal.strategy}</td>
                          <td className={`num ${t.resultR > 0 ? "up" : t.resultR < 0 ? "down" : "dim"}`}>
                            {t.resultR > 0 ? "+" : ""}
                            {t.resultR.toFixed(2)}
                          </td>
                          <td className="num dim">{t.resultPips.toFixed(1)}</td>
                          <td>{t.outcome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="muted-box">
        Signal engine only — it does not place trades. Fill <code>.env.local</code> with your OANDA API token and account ID
        before going live, add economic-calendar events if desired, and backtest this exact ruleset before any live execution.
        Not financial advice.
      </footer>
    </div>
  );
}