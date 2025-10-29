import type {
  ScoreBreakdown,
  SignalLabel,
  Settings,
  RiskGateWarning,
  PriceRow,
  SectorMapRow,
} from '@/types';

/**
 * Apply decision rules to generate BUY/SELL/HOLD labels
 */
export function applyLabeling(
  scores: Record<string, ScoreBreakdown>,
  settings: Settings,
  currentPortfolio?: Record<string, number>
): Record<string, SignalLabel> {
  const labels: Record<string, SignalLabel> = {};
  const { buy, sell, holdBand } = settings.thresholds;

  for (const [symbol, score] of Object.entries(scores)) {
    const composite = score.composite;
    const currentWeight = currentPortfolio?.[symbol] || 0;

    // BUY rule: composite > buy threshold AND (underweight OR not in portfolio)
    if (composite > buy) {
      labels[symbol] = 'BUY';
    }
    // SELL rule: composite < sell threshold AND (overweight OR reduce exposure)
    else if (composite < sell) {
      labels[symbol] = 'SELL';
    }
    // HOLD rule: within hold band
    else if (composite >= holdBand[0] && composite <= holdBand[1]) {
      labels[symbol] = 'HOLD';
    }
    // Default to HOLD for edge cases
    else {
      labels[symbol] = 'HOLD';
    }
  }

  return labels;
}

/**
 * Validate against risk gates and generate warnings
 */
export function checkRiskGates(
  labels: Record<string, SignalLabel>,
  scores: Record<string, ScoreBreakdown>,
  prices: PriceRow[],
  sectors: SectorMapRow[],
  settings: Settings,
  currentPortfolio?: Record<string, number>
): RiskGateWarning[] {
  const warnings: RiskGateWarning[] = [];
  const { maxPosPct, sectorCapPct, turnoverPct, minNotional } = settings.risk;

  // Build sector map
  const sectorMap = new Map<string, string>();
  for (const sector of sectors) {
    sectorMap.set(sector.symbol, sector.sector);
  }

  // Build latest price map
  const latestPrices = new Map<string, number>();
  const pricesBySymbol = new Map<string, PriceRow[]>();

  for (const row of prices) {
    if (!pricesBySymbol.has(row.symbol)) {
      pricesBySymbol.set(row.symbol, []);
    }
    pricesBySymbol.get(row.symbol)!.push(row);
  }

  for (const [symbol, rows] of pricesBySymbol) {
    const sorted = rows.sort((a, b) => b.date.localeCompare(a.date));
    latestPrices.set(symbol, sorted[0].close);
  }

  // Calculate proposed portfolio
  const proposedWeights: Record<string, number> = { ...currentPortfolio };
  const buySignals = Object.entries(labels).filter(([, label]) => label === 'BUY');
  const sellSignals = Object.entries(labels).filter(([, label]) => label === 'SELL');

  // Simple position sizing: equal weight for buys, reduce sells
  const buyWeight = buySignals.length > 0 ? 100 / buySignals.length : 0;

  for (const [symbol] of buySignals) {
    proposedWeights[symbol] = (proposedWeights[symbol] || 0) + buyWeight;
  }

  for (const [symbol] of sellSignals) {
    proposedWeights[symbol] = Math.max(0, (proposedWeights[symbol] || 0) * 0.5);
  }

  // Normalize weights
  const totalWeight = Object.values(proposedWeights).reduce((sum, w) => sum + w, 0);
  if (totalWeight > 0) {
    for (const symbol of Object.keys(proposedWeights)) {
      proposedWeights[symbol] = (proposedWeights[symbol] / totalWeight) * 100;
    }
  }

  // Check 1: Position size limits
  for (const [symbol, weight] of Object.entries(proposedWeights)) {
    if (weight > maxPosPct) {
      warnings.push({
        type: 'position_size',
        severity: 'warning',
        message: `${symbol} weight (${weight.toFixed(1)}%) exceeds max position size (${maxPosPct}%)`,
        symbol,
        value: weight,
        threshold: maxPosPct,
      });
    }
  }

  // Check 2: Sector concentration
  const sectorWeights: Record<string, number> = {};
  for (const [symbol, weight] of Object.entries(proposedWeights)) {
    const sector = sectorMap.get(symbol) || 'Unknown';
    sectorWeights[sector] = (sectorWeights[sector] || 0) + weight;
  }

  for (const [sector, weight] of Object.entries(sectorWeights)) {
    if (weight > sectorCapPct) {
      warnings.push({
        type: 'sector_cap',
        severity: 'warning',
        message: `${sector} sector weight (${weight.toFixed(1)}%) exceeds sector cap (${sectorCapPct}%)`,
        sector,
        value: weight,
        threshold: sectorCapPct,
      });
    }
  }

  // Check 3: Turnover (change from current to proposed)
  let turnover = 0;
  const allSymbols = new Set([
    ...Object.keys(currentPortfolio || {}),
    ...Object.keys(proposedWeights),
  ]);

  for (const symbol of allSymbols) {
    const current = currentPortfolio?.[symbol] || 0;
    const proposed = proposedWeights[symbol] || 0;
    turnover += Math.abs(proposed - current);
  }

  if (turnover > turnoverPct) {
    warnings.push({
      type: 'turnover',
      severity: 'warning',
      message: `Portfolio turnover (${turnover.toFixed(1)}%) exceeds limit (${turnoverPct}%)`,
      value: turnover,
      threshold: turnoverPct,
    });
  }

  // Check 4: Minimum notional (liquidity check)
  for (const [symbol] of buySignals) {
    const symbolPrices = pricesBySymbol.get(symbol);
    if (!symbolPrices || symbolPrices.length === 0) continue;

    // Calculate avg daily notional (last 21 days)
    const recentPrices = symbolPrices.slice(-21);
    const avgNotional =
      recentPrices.reduce((sum, p) => sum + p.close * p.volume, 0) /
      recentPrices.length;

    if (avgNotional < minNotional) {
      warnings.push({
        type: 'liquidity',
        severity: 'warning',
        message: `${symbol} avg notional (${(avgNotional / 1000000).toFixed(2)}M) below minimum (${(minNotional / 1000000).toFixed(2)}M)`,
        symbol,
        value: avgNotional,
        threshold: minNotional,
      });
    }
  }

  return warnings;
}

/**
 * Calculate confidence score based on factor completeness and agreement
 */
export function calculateSignalConfidence(
  score: ScoreBreakdown,
  warnings: RiskGateWarning[]
): number {
  // Base confidence from factor computation
  let confidence = score.confidence;

  // Reduce confidence based on risk warnings
  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;

  confidence *= 1 - errorCount * 0.2; // -20% per error
  confidence *= 1 - warningCount * 0.05; // -5% per warning

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Generate portfolio weights from labels
 */
export function generatePortfolioWeights(
  labels: Record<string, SignalLabel>,
  scores: Record<string, ScoreBreakdown>,
  settings: Settings
): Record<string, number> {
  const weights: Record<string, number> = {};

  // Get all BUY and HOLD signals
  const buySignals = Object.entries(labels)
    .filter(([, label]) => label === 'BUY')
    .map(([symbol]) => ({ symbol, score: scores[symbol].composite }));

  const holdSignals = Object.entries(labels)
    .filter(([, label]) => label === 'HOLD')
    .map(([symbol]) => ({ symbol, score: scores[symbol].composite }));

  // Sort by composite score (descending)
  buySignals.sort((a, b) => b.score - a.score);
  holdSignals.sort((a, b) => b.score - a.score);

  // Allocate 70% to BUY signals, 30% to HOLD signals
  const buyAllocation = 70;
  const holdAllocation = 30;

  // Equal weight within each group
  if (buySignals.length > 0) {
    const weightPerBuy = buyAllocation / buySignals.length;
    for (const { symbol } of buySignals) {
      weights[symbol] = Math.min(weightPerBuy, settings.risk.maxPosPct);
    }
  }

  if (holdSignals.length > 0) {
    const weightPerHold = holdAllocation / holdSignals.length;
    for (const { symbol } of holdSignals) {
      weights[symbol] = Math.min(weightPerHold, settings.risk.maxPosPct);
    }
  }

  // Normalize to 100%
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight > 0) {
    for (const symbol of Object.keys(weights)) {
      weights[symbol] = (weights[symbol] / totalWeight) * 100;
    }
  }

  return weights;
}

/**
 * Calculate sector allocations from portfolio weights
 */
export function calculateSectorAllocations(
  weights: Record<string, number>,
  sectors: SectorMapRow[]
): Record<string, number> {
  const sectorMap = new Map<string, string>();
  for (const sector of sectors) {
    sectorMap.set(sector.symbol, sector.sector);
  }

  const sectorWeights: Record<string, number> = {};
  for (const [symbol, weight] of Object.entries(weights)) {
    const sector = sectorMap.get(symbol) || 'Unknown';
    sectorWeights[sector] = (sectorWeights[sector] || 0) + weight;
  }

  return sectorWeights;
}
