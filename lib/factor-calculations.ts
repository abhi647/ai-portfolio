import type { PriceRow, SectorMapRow, IndexRow } from '@/types';

// Helper: Group data by symbol
export function groupBySymbol(prices: PriceRow[]): Map<string, PriceRow[]> {
  const grouped = new Map<string, PriceRow[]>();
  for (const row of prices) {
    if (!grouped.has(row.symbol)) {
      grouped.set(row.symbol, []);
    }
    grouped.get(row.symbol)!.push(row);
  }
  // Sort each group by date
  for (const [, rows] of grouped) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  return grouped;
}

// Helper: Calculate returns over N days
export function calculateReturns(
  prices: number[],
  period: number
): number | null {
  if (prices.length < period + 1) return null;
  const start = prices[prices.length - period - 1];
  const end = prices[prices.length - 1];
  if (start === 0) return null;
  return (end - start) / start;
}

// Helper: Rolling statistics
export function rollingMean(values: number[], window: number): number | null {
  if (values.length < window) return null;
  const slice = values.slice(-window);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

export function rollingStd(values: number[], window: number): number | null {
  const mean = rollingMean(values, window);
  if (mean === null || values.length < window) return null;
  const slice = values.slice(-window);
  const variance =
    slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / slice.length;
  return Math.sqrt(variance);
}

// Helper: Maximum drawdown
export function maxDrawdown(prices: number[]): number {
  let maxDD = 0;
  let peak = prices[0];
  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    const dd = (peak - price) / peak;
    if (dd > maxDD) {
      maxDD = dd;
    }
  }
  return maxDD;
}

// Helper: Z-score normalization
export function zScore(value: number, values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const std = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );
  if (std === 0) return 0;
  return (value - mean) / std;
}

// Main: Momentum Factor
export function calculateMomentum(
  symbolPrices: PriceRow[]
): {
  w1: number | null;
  m1: number | null;
  m3: number | null;
  m6: number | null;
  y1: number | null;
} {
  const closes = symbolPrices.map((row) => row.close);

  return {
    w1: calculateReturns(closes, 5), // 1 week ~ 5 trading days
    m1: calculateReturns(closes, 21), // 1 month ~ 21 trading days
    m3: calculateReturns(closes, 63), // 3 months
    m6: calculateReturns(closes, 126), // 6 months
    y1: calculateReturns(closes, 252), // 1 year
  };
}

// Main: Alpha vs Benchmark
export function calculateAlpha(
  symbolPrices: PriceRow[],
  benchmarkData: Map<string, number>
): {
  alpha1m: number | null;
  alpha3m: number | null;
  alpha6m: number | null;
  alpha1y: number | null;
} {
  const closes = symbolPrices.map((row) => row.close);
  const dates = symbolPrices.map((row) => row.date);

  const calculatePeriodAlpha = (period: number): number | null => {
    if (closes.length < period + 1) return null;

    const startDate = dates[dates.length - period - 1];
    const endDate = dates[dates.length - 1];

    const benchStart = benchmarkData.get(startDate);
    const benchEnd = benchmarkData.get(endDate);

    if (!benchStart || !benchEnd || benchStart === 0) return null;

    const stockReturn = calculateReturns(closes, period);
    const benchReturn = (benchEnd - benchStart) / benchStart;

    if (stockReturn === null) return null;

    return stockReturn - benchReturn;
  };

  return {
    alpha1m: calculatePeriodAlpha(21),
    alpha3m: calculatePeriodAlpha(63),
    alpha6m: calculatePeriodAlpha(126),
    alpha1y: calculatePeriodAlpha(252),
  };
}

// Main: Volatility
export function calculateVolatility(symbolPrices: PriceRow[]): {
  volatility21d: number | null;
  maxDrawdown: number | null;
} {
  const closes = symbolPrices.map((row) => row.close);

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] !== 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }

  return {
    volatility21d: rollingStd(returns, 21),
    maxDrawdown: maxDrawdown(closes),
  };
}

// Main: Liquidity
export function calculateLiquidity(symbolPrices: PriceRow[]): {
  medianNotional21d: number | null;
} {
  const notionals = symbolPrices
    .slice(-21)
    .map((row) => row.close * row.volume);

  if (notionals.length === 0) return { medianNotional21d: null };

  // Calculate median
  const sorted = [...notionals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  return { medianNotional21d: median };
}

// Main: Peer Comparison
export function calculatePeerDiff(
  symbol: string,
  symbolReturn: number | null,
  allPrices: Map<string, PriceRow[]>,
  sectorMap: Map<string, SectorMapRow>
): {
  sectorMedianDiff: number | null;
  industryMedianDiff: number | null;
} {
  if (symbolReturn === null) {
    return { sectorMedianDiff: null, industryMedianDiff: null };
  }

  const symbolSector = sectorMap.get(symbol);
  if (!symbolSector) {
    return { sectorMedianDiff: null, industryMedianDiff: null };
  }

  // Get peers in same sector and industry
  const sectorPeers: number[] = [];
  const industryPeers: number[] = [];

  for (const [sym, sector] of sectorMap) {
    if (sym === symbol) continue;

    const peerPrices = allPrices.get(sym);
    if (!peerPrices || peerPrices.length < 21) continue;

    const peerReturn = calculateReturns(
      peerPrices.map((p) => p.close),
      21
    );
    if (peerReturn === null) continue;

    if (sector.sector === symbolSector.sector) {
      sectorPeers.push(peerReturn);
    }
    if (sector.industry === symbolSector.industry) {
      industryPeers.push(peerReturn);
    }
  }

  const calculateMedianDiff = (peers: number[]): number | null => {
    if (peers.length === 0) return null;
    const sorted = [...peers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    return symbolReturn - median;
  };

  return {
    sectorMedianDiff: calculateMedianDiff(sectorPeers),
    industryMedianDiff: calculateMedianDiff(industryPeers),
  };
}

// Main: Sector Beta
export function calculateSectorBeta(
  symbol: string,
  symbolPrices: PriceRow[],
  allPrices: Map<string, PriceRow[]>,
  sectorMap: Map<string, SectorMapRow>
): number | null {
  const symbolSector = sectorMap.get(symbol);
  if (!symbolSector || symbolPrices.length < 63) return null;

  // Calculate symbol returns
  const symbolReturns: number[] = [];
  const symbolCloses = symbolPrices.map((p) => p.close);
  for (let i = 1; i < Math.min(63, symbolCloses.length); i++) {
    if (symbolCloses[i - 1] !== 0) {
      symbolReturns.push(
        (symbolCloses[i] - symbolCloses[i - 1]) / symbolCloses[i - 1]
      );
    }
  }

  // Calculate sector average returns
  const sectorSymbols = Array.from(sectorMap.entries())
    .filter(([, s]) => s.sector === symbolSector.sector)
    .map(([sym]) => sym);

  if (sectorSymbols.length < 2) return null;

  // Get sector returns for each day
  const sectorReturns: number[] = [];
  const dates = symbolPrices.slice(-63).map((p) => p.date);

  for (let i = 1; i < dates.length; i++) {
    const dayReturns: number[] = [];

    for (const sym of sectorSymbols) {
      if (sym === symbol) continue;

      const prices = allPrices.get(sym);
      if (!prices) continue;

      const priceMap = new Map(prices.map((p) => [p.date, p.close]));
      const prevClose = priceMap.get(dates[i - 1]);
      const currClose = priceMap.get(dates[i]);

      if (prevClose && currClose && prevClose !== 0) {
        dayReturns.push((currClose - prevClose) / prevClose);
      }
    }

    if (dayReturns.length > 0) {
      const avgReturn =
        dayReturns.reduce((sum, r) => sum + r, 0) / dayReturns.length;
      sectorReturns.push(avgReturn);
    }
  }

  if (symbolReturns.length !== sectorReturns.length || symbolReturns.length === 0) {
    return null;
  }

  // Calculate beta (covariance / variance)
  const n = symbolReturns.length;
  const meanSymbol = symbolReturns.reduce((sum, r) => sum + r, 0) / n;
  const meanSector = sectorReturns.reduce((sum, r) => sum + r, 0) / n;

  let covariance = 0;
  let variance = 0;

  for (let i = 0; i < n; i++) {
    covariance += (symbolReturns[i] - meanSymbol) * (sectorReturns[i] - meanSector);
    variance += Math.pow(sectorReturns[i] - meanSector, 2);
  }

  covariance /= n;
  variance /= n;

  if (variance === 0) return null;

  return covariance / variance;
}

// Normalization: Calculate cross-sectional z-scores
export function normalizeCrossSectional(
  factorValues: Map<string, number>
): Map<string, number> {
  const values = Array.from(factorValues.values()).filter(
    (v) => v !== null && !isNaN(v)
  );

  if (values.length === 0) {
    return new Map();
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const std = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );

  const normalized = new Map<string, number>();

  for (const [symbol, value] of factorValues) {
    if (value === null || isNaN(value)) {
      normalized.set(symbol, 0);
    } else {
      normalized.set(symbol, std === 0 ? 0 : (value - mean) / std);
    }
  }

  return normalized;
}
