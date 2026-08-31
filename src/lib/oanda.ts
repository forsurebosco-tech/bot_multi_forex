export type Granularity =
  | "S5" | "S10" | "S15" | "S30"
  | "M1" | "M2" | "M4" | "M5" | "M10" | "M15" | "M30"
  | "H1" | "H2" | "H3" | "H4" | "H6" | "H8" | "H12"
  | "D" | "W" | "M";

export interface Candle {
  time: string;
  complete: boolean;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricesResponse {
  prices: Array<{
    instrument: string;
    bids: Array<{ price: string; liquidity: number }>;
    asks: Array<{ price: string; liquidity: number }>;
    closeoutBid: string;
    closeoutAsk: string;
    status: string;
    time: string;
  }>;
}

export interface InstrumentMeta {
  name: string;
  type: string;
  displayName: string;
  pipLocation: number;
  displayPrecision: number;
  marginRate: string;
  minimumTradeSize?: string;
  maximumOrderUnits?: string;
}

export class OandaClient {
  private apiKey: string;
  private accountId: string;
  private baseUrl: string;

  constructor() {
    // supports OANDA_API_TOKEN (new) or OANDA_API_KEY (legacy)
    this.apiKey = process.env.OANDA_API_TOKEN || process.env.OANDA_API_KEY || "";
    this.accountId = process.env.OANDA_ACCOUNT_ID || "";
    const env = (process.env.OANDA_ENVIRONMENT || "practice").toLowerCase();
    this.baseUrl =
      process.env.OANDA_BASE_URL ||
      (env === "live" ? "https://api-fxtrade.oanda.com" : "https://api-fxpractice.oanda.com");
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.accountId);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new Error("OANDA_API_TOKEN / OANDA_API_KEY is not configured");
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Accept-Datetime-Format": "UNIX",
        "Content-Type": "application/json",
      },
      ...init,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OANDA request failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async getCandles(
    instrument: string,
    granularity: Granularity,
    count = 500,
    price: "M" | "B" | "A" = "M",
    from?: number | string
  ): Promise<Candle[]> {
    let path = `/v3/accounts/${this.accountId}/instruments/${instrument}/candles?granularity=${granularity}&count=${count}&price=${price}`;
    if (from !== undefined) path += `&from=${from}`;
    const data = await this.request<{
      instrument: string;
      granularity: Granularity;
      candles: Array<{
        time: string;
        complete: boolean;
        volume: number;
        mid?: { o: string; h: string; l: string; c: string };
        bid?: { o: string; h: string; l: string; c: string };
        ask?: { o: string; h: string; l: string; c: string };
      }>;
    }>(path);
    return data.candles.map((c) => {
      const px = price === "M" ? c.mid : price === "B" ? c.bid : c.ask;
      if (!px) throw new Error(`Missing ${price} price data for candle`);
      return {
        time: c.time,
        complete: c.complete,
        open: parseFloat(px.o),
        high: parseFloat(px.h),
        low: parseFloat(px.l),
        close: parseFloat(px.c),
        volume: c.volume,
      };
    });
  }

  getInstruments(): Promise<InstrumentMeta[]> {
    const path = `/v3/accounts/${this.accountId}/instruments`;
    return this.request<{ instruments: InstrumentMeta[] }>(path).then((d) => d.instruments);
  }

  async getPrices(instruments: string[]): Promise<PricesResponse["prices"]> {
    const path = `/v3/accounts/${this.accountId}/pricing?instruments=${encodeURIComponent(
      instruments.join(",")
    )}`;
    const data = await this.request<PricesResponse>(path);
    return data.prices;
  }

  async getAccountSummary(): Promise<{
    id: string;
    currency: string;
    balance: string;
    NAV: string;
    openTradeCount: string;
    openPositionCount: string;
    marginUsed: string;
    marginCallPercent: string;
    marginCloseoutPercent: string;
    pl: string;
  }> {
    const data = await this.request<{ account: { id: string; currency: string; balance: string; NAV: string; openTradeCount: string; openPositionCount: string; marginUsed: string; marginCallPercent: string; marginCloseoutPercent: string; pl: string } }>(
      `/v3/accounts/${this.accountId}/summary`
    );
    return data.account;
  }

  async getOpenPositions(): Promise<
    Array<{
      instrument: string;
      long: { units: string; averagePrice: string; pl: string; unrealizedPL: string } | null;
      short: { units: string; averagePrice: string; pl: string; unrealizedPL: string } | null;
    }>
  > {
    const data = await this.request<{
      positions: Array<{
        instrument: string;
        long: { units: string; averagePrice: string; pl: string; unrealizedPL: string } | null;
        short: { units: string; averagePrice: string; pl: string; unrealizedPL: string } | null;
      }>;
    }>(`/v3/accounts/${this.accountId}/openPositions`);
    return data.positions.map((p) => ({
      instrument: p.instrument,
      long: p.long,
      short: p.short,
    }));
  }

  async placeMarketOrder(
    instrument: string,
    units: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<{ orderTransaction: { id: string } }> {
    const order: Record<string, unknown> = {
      order: {
        type: "MARKET",
        instrument,
        units,
        timeInForce: "FOK",
      },
    };
    const o = order.order as Record<string, unknown>;
    if (stopLoss !== undefined) o.stopLossOnFill = { price: String(stopLoss) };
    if (takeProfit !== undefined) o.takeProfitOnFill = { price: String(takeProfit) };
    return this.request<{ orderTransaction: { id: string } }>(`/v3/accounts/${this.accountId}/orders`, {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  async closePosition(instrument: string): Promise<{ longOrder?: unknown; shortOrder?: unknown }> {
    return this.request(`/v3/accounts/${this.accountId}/positions/${instrument}/close`, {
      method: "PUT",
      body: JSON.stringify({ longUnits: "ALL", shortUnits: "ALL" }),
    });
  }

  async getOpenTrades(): Promise<
    Array<{
      id: string;
      instrument: string;
      units: string;
      currentUnits: string;
      averagePrice: string;
      pl: string;
      unrealizedPL: string;
      openTime: string;
      state: string;
      stopLossOrder?: { price: string; state: string };
      takeProfitOrder?: { price: string; state: string };
    }>
  > {
    const data = await this.request<{
      trades: Array<any>;
    }>(`/v3/accounts/${this.accountId}/openTrades`);
    return (data.trades || []).map((t) => ({
      id: String(t.id),
      instrument: t.instrument,
      units: t.initialUnits ?? t.units ?? "",
      currentUnits: t.currentUnits ?? t.units ?? "",
      averagePrice: t.averageClosePrice ?? "",
      pl: t.pl ?? "0",
      unrealizedPL: t.unrealizedPL ?? "0",
      openTime: t.openTime ?? "",
      state: t.state ?? "",
      stopLossOrder: t.stopLossOrder
        ? { price: t.stopLossOrder.price, state: t.stopLossOrder.state }
        : undefined,
      takeProfitOrder: t.takeProfitOrder
        ? { price: t.takeProfitOrder.price, state: t.takeProfitOrder.state }
        : undefined,
    }));
  }

  async closeTrade(tradeId: string): Promise<{ orderFillTransaction?: { price?: string } }> {
    return this.request(`/v3/accounts/${this.accountId}/trades/${tradeId}/close`, {
      method: "PUT",
      body: JSON.stringify({ units: "ALL" }),
    });
  }

  async modifyTrade(
    tradeId: string,
    sl?: number,
    tp?: number
  ): Promise<{ stopLossTransactionWitness?: unknown; takeProfitTransactionWitness?: unknown }> {
    const body: Record<string, unknown> = { tradeID: tradeId };
    if (sl !== undefined) body.stopLoss = { price: String(sl) };
    if (tp !== undefined) body.takeProfit = { price: String(tp) };
    return this.request(`/v3/accounts/${this.accountId}/trades/${tradeId}/orders`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async getInstrumentMeta(instrument: string): Promise<InstrumentMeta | undefined> {
    const meta = await this.getInstruments();
    return meta.find((i) => i.name === instrument);
  }
}

// units per 1.0 lot per instrument family (matches the sizing table used by the engine)
export function unitsPerLot(type: "major" | "cross" | "gold" | "index"): number {
  switch (type) {
    case "gold":
      return 100; // 100 troy oz per lot
    case "index":
      return 1; // 1 CF contract = 1 unit
    default:
      return 100000; // 100k base per standard lot
  }
}

export function lotsToUnits(lots: number, type: "major" | "cross" | "gold" | "index"): number {
  return Math.round(lots * unitsPerLot(type));
}