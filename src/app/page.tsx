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
  const [now, setNow] = useState<Date>(new Date());
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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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
  const clock = now.toISOString().slice(11, 19);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">☰</div>
          <div>
            <div className="name">
              SIGNAL <em>TERMINAL</em>
            </div>
            <div className="tag">FX · XAU · INDICES — OANDA PRACTICE</div>
          </div>
        </div>
        <nav className="nav">
          <a href="/" className="active">Dashboard</a>
          <a href="/chart">Chart Lab</a>
        </nav>
        <div className="top-status">
          <span className={`chip ${configured ? "ok" : "bad"}`}>
            <span className={`chip-dot ${configured ? "on" : "off"}`} />
            OANDA {configured ? "connected" : "not configured"}
          </span>
          <span className={`chip ${session.canTrade ? "ok" : "warn"}`}>
            session <b>{session.label}</b> {session.canTrade ? "· tradeable" : "· closed"}
          </span>
          <span className="chip clock">{clock} UTC</span>
        </div>
      </header>

      {msg && <div className="muted-box errors">{msg}</div>}

      <div className="stat-row">
        <div className="stat-card">
          <div className="sc-label">Equity <small>risk base</small></div>
          <div className="sc-value">${Number(state?.equity ?? equity).toLocaleString()}</div>
          <div className="sc-sub">state-tracking equity from last scan</div>
        </div>
        <div className="stat-card cyan">
          <div className="sc-label">Instruments</div>
          <div className="sc-value">{cfg?.watchlist.filter((w) => w.enabled).length ?? 0}</div>
          <div className="sc-sub">on watchlist</div>
        </div>
        <div className="stat-card violet">
          <div className="sc-label">Open positions</div>
          <div className="sc-value">{state?.openPositions.length ?? 0}<span style={{ fontSize: 13, color: "var(--text-3)" }}>/3</span></div>
          <div className="sc-sub">max 3 concurrent</div>
        </div>
        <div className="stat-card amber">
          <div className="sc-label">Signals today</div>
          <div className="sc-value">{state?.signalsCount ?? 0}<span style={{ fontSize: 13, color: "var(--text-3)" }}>/4</span></div>
          <div className="sc-sub">daily signal cap</div>
        </div>
        <div className={`stat-card ${(state?.consecutiveLosses ?? 0) >= 2 ? "red" : ""}`}>
          <div className="sc-label">Consec. losses</div>
          <div className={`sc-value ${(state?.consecutiveLosses ?? 0) >= 2 ? "red" : ""}`}>{state?.consecutiveLosses ?? 0}<span style={{ fontSize: 13, color: "var(--text-3)" }}>/2</span></div>
          <div className="sc-sub">{(state?.consecutiveLosses ?? 0) >= 2 ? "stop-loss latching" : "breakeven when hits 2"}</div>
        </div>
      </div>

      <div className="toolbar">
        <span className="lbl">equity ($)</span>
        <input
          className="input"
          type="number"
          value={equity}
          onChange={(e) => setEquity(Math.max(1, Number(e.target.value) || 10000))}
          style={{ width: 120 }}
        />
        <span className="sep" />
        <button className="btn btn-primary" onClick={scan} disabled={scanning}>
          {scanning ? (
            <>
              <span className="spin"></span> scanning…
            </>
          ) : (
            "Scan watchlist"
          )}
        </button>
        <span className="lbl">auto</span>
        <select className="input" value={autoMs} onChange={(e) => setAutoMs(Number(e.target.value))}>
          <option value={0}>off</option>
          <option value={60000}>1 min</option>
          <option value={300000}>5 min</option>
          <option value={900000}>15 min</option>
          <option value={1800000}>30 min</option>
        </select>
        {lastScan && (
          <span className="lbl">
            last scan · {new Date(lastScan).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Watchlist <span className="hint">H1 trend · M15 setup · M5 trigger</span></h3>
            <span className="pill pill-none">{contexts ? contexts.length : cfg?.watchlist.filter((w) => w.enabled).length ?? 0} / {cfg?.watchlist.length ?? 0} scanned</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pair</th>
                  <th className="num">Price</th>
                  <th className="num">Spread</th>
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
                      <td className="sym">{w.symbol}</td>
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
                        <span className="sym">{c.display}</span>
                        {c.type === "gold" && <span className="pill pill-gold" style={{ marginLeft: 6 }}>GOLD</span>}
                      </td>
                      <td className="num">{fmtPrice(c.price, c.pipSize)}</td>
                      <td className="num" style={{ color: c.spreadOk ? "var(--text-2)" : "var(--amber)" }}>
                        {fmtPips(c.spreadPips)}p
                      </td>
                      <td>
                        <span className={`pill ${c.regime === "trending" ? "pill-strat" : "pill-none"}`}>
                          {c.regime} · {c.h1Adx.toFixed(0)}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${c.longBias ? "pill-long" : "pill-short"}`}>
                          {c.longBias ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td>
                        {gates.length === 0 ? (
                          <span className="up">pass</span>
                        ) : (
                          gates.map((g) => (
                            <span key={g} className="pill pill-warn" style={{ marginRight: 4 }}>
                              {g}
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        {c.signal ? (
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <span className={`pill ${c.signal.direction === "long" ? "pill-long" : "pill-short"}`}>
                              {c.signal.direction.toUpperCase()}
                            </span>
                            <span className="pill pill-strat">{c.signal.strategy}</span>
                          </div>
                        ) : (
                          <span className="pill pill-none">none</span>
                        )}
                      </td>
                      <td>
                        {(c.rejected ?? []).length > 0 ? (
                          <span className="dim" title={(c.rejected ?? []).join("\n")} style={{ color: "var(--amber)", cursor: "help" }}>
                            {c.rejected[0]}
                          </span>
                        ) : (
                          <span className="dim">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="side-col">
          <div className="panel">
            <div className="panel-head">
              <h3>Signal feed <span className="hint">this scan</span></h3>
              {signals.length > 0 && <span className={`pill ${signals.some((s) => s.direction === "long") ? "pill-long" : "pill-short"}`}>{signals.length} new</span>}
            </div>
            <div className="panel-body">
              {signals.length === 0 && <div className="empty">No signals since last scan.</div>}
              {signals.map((s, i) => (
                <div className={`signal-card ${s.direction}`} key={i}>
                  <div className="sc-head">
                    <span className="sym">{s.symbol}</span>
                    <span className={`pill ${s.direction === "long" ? "pill-long" : "pill-short"}`}>{s.direction.toUpperCase()}</span>
                    <span className="pill pill-strat">{s.strategy}</span>
                    <span className="sc-time">{s.session}</span>
                  </div>
                  <div className="kv">
                    <span className="k">ENTRY</span>
                    <span className="v">{s.entry}</span>
                    <span></span>
                    <span className="k">SL</span>
                    <span className="v" style={{ color: "var(--red)" }}>{s.sl} <span style={{ color: "var(--text-3)" }}>· {fmtPips(s.slPips)} pips · {s.slAtr.toFixed(1)}x ATR</span></span>
                    <span></span>
                    <span className="k">TP1</span>
                    <span className="v">{s.tp1} <span style={{ color: "var(--text-3)" }}>· 1.5R, move to BE</span></span>
                    <span></span>
                    <span className="k">TP2</span>
                    <span className="v" style={{ color: "var(--green)" }}>{s.tp2} <span style={{ color: "var(--text-3)" }}>· 3R, full close</span></span>
                    <span></span>
                    <span className="k">SIZE</span>
                    <span className="v">{s.lots} lots <span style={{ color: "var(--text-3)" }}>· risk ${s.riskAmount.toFixed(0)} (1%)</span></span>
                    <span></span>
                    <span className="k">REGIME</span>
                    <span className="v">{s.regime.kind}<span style={{ color: "var(--text-3)" }}> · ADX {s.regime.adx}</span></span>
                    <span></span>
                  </div>
                  {s.confidenceNotes && <div className="notes">{s.confidenceNotes}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Risk &amp; session</h3>
              <div className="top-status">
                <span className={`chip ${state?.circuitBreaker ? "bad" : "ok"}`}>
                  {state?.circuitBreaker ? "breaker ARMED" : "breaker off"}
                </span>
                <span className={`chip ${state?.dailyLossHit ? "bad" : "ok"}`}>
                  {state?.dailyLossHit ? "daily loss HIT" : "daily gate ok"}
                </span>
              </div>
            </div>
            <div className="panel-body">
              {state && state.openPositions.length > 0 && (
                <table style={{ marginBottom: 4 }}>
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
                        <td className="sym">{p.symbol}</td>
                        <td><span className={`pill ${p.direction === "long" ? "pill-long" : "pill-short"}`}>{p.direction.slice(0, 4).toUpperCase()}</span></td>
                        <td className="num">{p.entry}</td>
                        <td className="num">{p.sl}</td>
                        <td className="num">{p.tp2}</td>
                        <td className="num">{p.lots}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {state && state.openPositions.length === 0 && <div className="empty">No tracked positions. Scans gate size/breakeven from the state above.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Setup / rejection log</h3>
          </div>
          <div className="panel-body" style={{ maxHeight: 320, overflowY: "auto" }}>
            {rejections.length === 0 && <div className="empty">No rejections logged — all gates passed or pairs gap-free.</div>}
            {rejections.map((r, i) => (
              <div className="log-line" key={i}>
                <span className="log-sym">{r.symbol}</span>
                {r.reasons.map((reason, j) => (
                  <span key={j} className={j === 0 ? "log-reason" : ""}>
                    {reason}
                    {j < r.reasons.length - 1 ? " · " : ""}
                  </span>
                ))}
              </div>
            ))}
            {state && state.logs.length > 0 && (
              <>
                <div className="section-label">Signal history</div>
                {state.logs
                  .filter((l) => l.kind === "signal")
                  .slice(0, 20)
                  .map((l, i) => (
                    <div className="log-line" key={i}>
                      <span className="log-time">{new Date(l.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="log-sym">{l.symbol}</span>
                      <span className={l.reason.startsWith("SHORT") ? "down" : "up"}>{l.reason.slice(0, 60)}</span>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Backtest this exact ruleset</h3>
          </div>
          <div className="panel-body">
            <div className="controls" style={{ marginBottom: 8 }}>
              <select className="input" value={btPair} onChange={(e) => setBtPair(e.target.value)}>
                {(cfg?.watchlist ?? []).map((w) => (
                  <option key={w.symbol} value={w.symbol}>
                    {w.symbol}
                  </option>
                ))}
              </select>
              <select className="input" value={btDays} onChange={(e) => setBtDays(Number(e.target.value))}>
                <option value={1}>1 day</option>
                <option value={2}>2 days</option>
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
              </select>
              <button className="btn btn-primary" onClick={runBacktest} disabled={btRunning}>
                {btRunning ? (
                  <>
                    <span className="spin"></span> running…
                  </>
                ) : (
                  "Run backtest"
                )}
              </button>
            </div>
            {bt?.error && <div className="errors">{bt.error}</div>}
            {bt && !bt.error && (
              <>
                {bt.summary.totalTrades === 0 && (
                  <div className="muted-box" style={{ marginTop: 10 }}>
                    No qualifying setups in window. That is expected — this ruleset is selective by design.
                  </div>
                )}
                {bt.trades.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: 10 }}>
                    <table>
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
                            <td><span className={`pill ${t.signal.direction === "long" ? "pill-long" : "pill-short"}`}>{t.signal.direction.toUpperCase()}</span></td>
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
                  </div>
                )}
                <div className="bt-sum">
                  <div className="stat-card green">
                    <div className="sc-label">Win rate</div>
                    <div className="sc-value green">{(bt.summary.winRate * 100).toFixed(1)}%</div>
                    <div className="sc-sub">{bt.summary.winners}W / {bt.summary.losers}L</div>
                  </div>
                  <div className="stat-card cyan">
                    <div className="sc-label">Avg R</div>
                    <div className="sc-value">{bt.summary.avgR.toFixed(2)}R</div>
                    <div className="sc-sub">per trade</div>
                  </div>
                  <div className="stat-card violet">
                    <div className="sc-label">Total R</div>
                    <div className="sc-value">{bt.summary.totalR.toFixed(2)}R</div>
                    <div className="sc-sub">cumulative</div>
                  </div>
                  <div className="stat-card red">
                    <div className="sc-label">Max DD</div>
                    <div className="sc-value red">{(bt.summary.maxDrawdownPct * 100).toFixed(1)}%</div>
                    <div className="sc-sub">trades {bt.summary.totalTrades}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="foot">
        Signal engine only — it does not place trades. Fill <code>.env.local</code> with your OANDA API token and account ID before
        going live, add economic-calendar events if desired, and backtest this exact ruleset before any live execution. Not financial advice.
      </footer>
    </div>
  );
}