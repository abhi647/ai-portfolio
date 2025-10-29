// Factor Calculation WebWorker
// This runs in a separate thread to avoid blocking the UI

// Import helper functions (inlined for worker context)
function groupBySymbol(prices) {
  const grouped = new Map();
  for (const row of prices) {
    if (!grouped.has(row.symbol)) {
      grouped.set(row.symbol, []);
    }
    grouped.get(row.symbol).push(row);
  }
  // Sort each group by date
  for (const rows of grouped.values()) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  return grouped;
}

function calculateReturns(prices, period) {
  if (prices.length < period + 1) return null;
  const start = prices[prices.length - period - 1];
  const end = prices[prices.length - 1];
  if (start === 0) return null;
  return (end - start) / start;
}

function rollingStd(values, window) {
  if (values.length < window) return null;
  const slice = values.slice(-window);
  const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length;
  const variance =
    slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / slice.length;
  return Math.sqrt(variance);
}

function calculateCompositeScore(factors, weights) {
  let score = 0;
  let totalWeight = 0;

  if (factors.momentum !== null && !isNaN(factors.momentum)) {
    score += factors.momentum * weights.momentum;
    totalWeight += weights.momentum;
  }
  if (factors.alphaDrift !== null && !isNaN(factors.alphaDrift)) {
    score += factors.alphaDrift * weights.alphaDrift;
    totalWeight += weights.alphaDrift;
  }
  if (factors.peerDiff !== null && !isNaN(factors.peerDiff)) {
    score += factors.peerDiff * weights.peerDiff;
    totalWeight += weights.peerDiff;
  }
  if (factors.volatility !== null && !isNaN(factors.volatility)) {
    score += factors.volatility * weights.volatility;
    totalWeight += weights.volatility;
  }
  if (factors.liquidity !== null && !isNaN(factors.liquidity)) {
    score += factors.liquidity * weights.liquidity;
    totalWeight += weights.liquidity;
  }
  if (factors.sectorBeta !== null && !isNaN(factors.sectorBeta)) {
    score += factors.sectorBeta * weights.sectorBeta;
    totalWeight += weights.sectorBeta;
  }

  return totalWeight > 0 ? score / totalWeight : 0;
}

function calculateConfidence(factors) {
  // Confidence based on data completeness and factor agreement
  let validFactors = 0;
  const factorValues = [];

  if (factors.momentum !== null && !isNaN(factors.momentum)) {
    validFactors++;
    factorValues.push(factors.momentum);
  }
  if (factors.alphaDrift !== null && !isNaN(factors.alphaDrift)) {
    validFactors++;
    factorValues.push(factors.alphaDrift);
  }
  if (factors.peerDiff !== null && !isNaN(factors.peerDiff)) {
    validFactors++;
    factorValues.push(factors.peerDiff);
  }
  if (factors.volatility !== null && !isNaN(factors.volatility)) {
    validFactors++;
    factorValues.push(factors.volatility);
  }
  if (factors.liquidity !== null && !isNaN(factors.liquidity)) {
    validFactors++;
    factorValues.push(factors.liquidity);
  }
  if (factors.sectorBeta !== null && !isNaN(factors.sectorBeta)) {
    validFactors++;
    factorValues.push(factors.sectorBeta);
  }

  const dataSufficiency = validFactors / 6;

  // Factor agreement: low std dev means high agreement
  if (factorValues.length < 2) return dataSufficiency;

  const mean = factorValues.reduce((sum, v) => sum + v, 0) / factorValues.length;
  const std = Math.sqrt(
    factorValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      factorValues.length
  );

  // Normalize disagreement (higher std = lower confidence)
  const agreement = Math.max(0, 1 - std / 3);

  return (dataSufficiency + agreement) / 2;
}

// Main message handler
self.onmessage = function (e) {
  const { type, data } = e.data;

  try {
    if (type === 'COMPUTE_FACTORS') {
      const { prices, sectors, benchmarkData, settings } = data;

      // Group data
      const pricesBySymbol = groupBySymbol(prices);
      const sectorMap = new Map(sectors.map((s) => [s.symbol, s]));
      const benchmarkMap = new Map(benchmarkData.map((b) => [b.date, b.close]));

      const symbols = Array.from(pricesBySymbol.keys());
      const results = {};

      // Calculate raw factors for each symbol
      let processed = 0;
      for (const symbol of symbols) {
        const symbolPrices = pricesBySymbol.get(symbol);
        if (!symbolPrices || symbolPrices.length < 21) continue;

        const closes = symbolPrices.map((p) => p.close);

        // Momentum (avg of 1m and 3m returns)
        const m1 = calculateReturns(closes, 21);
        const m3 = calculateReturns(closes, 63);
        const momentum =
          m1 !== null && m3 !== null ? (m1 + m3) / 2 : m1 || m3 || 0;

        // Alpha vs benchmark (3m)
        const dates = symbolPrices.map((p) => p.date);
        let alpha3m = null;
        if (closes.length >= 64) {
          const startDate = dates[dates.length - 64];
          const endDate = dates[dates.length - 1];
          const benchStart = benchmarkMap.get(startDate);
          const benchEnd = benchmarkMap.get(endDate);
          if (benchStart && benchEnd && benchStart !== 0) {
            const stockReturn = calculateReturns(closes, 63);
            const benchReturn = (benchEnd - benchStart) / benchStart;
            if (stockReturn !== null) {
              alpha3m = stockReturn - benchReturn;
            }
          }
        }

        // Volatility (21d rolling std of returns)
        const returns = [];
        for (let i = 1; i < closes.length; i++) {
          if (closes[i - 1] !== 0) {
            returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
          }
        }
        const vol21d = rollingStd(returns, 21);
        const volatility = vol21d !== null ? -vol21d : 0; // Negative because lower vol is better

        // Liquidity (median notional 21d)
        const notionals = symbolPrices
          .slice(-21)
          .map((p) => p.close * p.volume);
        const sortedNotionals = [...notionals].sort((a, b) => a - b);
        const mid = Math.floor(sortedNotionals.length / 2);
        const medianNotional =
          sortedNotionals.length % 2 === 0
            ? (sortedNotionals[mid - 1] + sortedNotionals[mid]) / 2
            : sortedNotionals[mid];

        // Peer diff (sector median)
        const symbolSector = sectorMap.get(symbol);
        let peerDiff = 0;
        if (symbolSector && m1 !== null) {
          const sectorPeers = [];
          for (const [sym, sector] of sectorMap) {
            if (sym === symbol) continue;
            if (sector.sector === symbolSector.sector) {
              const peerPrices = pricesBySymbol.get(sym);
              if (peerPrices && peerPrices.length >= 21) {
                const peerReturn = calculateReturns(
                  peerPrices.map((p) => p.close),
                  21
                );
                if (peerReturn !== null) {
                  sectorPeers.push(peerReturn);
                }
              }
            }
          }
          if (sectorPeers.length > 0) {
            const sorted = [...sectorPeers].sort((a, b) => a - b);
            const medianPeer =
              sorted.length % 2 === 0
                ? (sorted[Math.floor(sorted.length / 2) - 1] +
                    sorted[Math.floor(sorted.length / 2)]) /
                  2
                : sorted[Math.floor(sorted.length / 2)];
            peerDiff = m1 - medianPeer;
          }
        }

        // Sector beta (simplified)
        const sectorBeta = 1.0; // Placeholder - full calculation is complex

        results[symbol] = {
          momentum,
          alphaDrift: alpha3m || 0,
          peerDiff,
          volatility,
          liquidity: medianNotional / 1000000, // Normalize to millions
          sectorBeta,
        };

        processed++;
        if (processed % 10 === 0) {
          self.postMessage({
            type: 'PROGRESS',
            data: {
              stage: 'Computing factors',
              progress: processed,
              total: symbols.length,
            },
          });
        }
      }

      // Normalize each factor cross-sectionally
      const normalizedResults = {};

      for (const factor of [
        'momentum',
        'alphaDrift',
        'peerDiff',
        'volatility',
        'liquidity',
      ]) {
        const values = Object.values(results).map((r) => r[factor]);
        const validValues = values.filter((v) => v !== null && !isNaN(v));

        if (validValues.length === 0) continue;

        const mean =
          validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
        const std = Math.sqrt(
          validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
            validValues.length
        );

        for (const symbol of symbols) {
          if (!normalizedResults[symbol]) {
            normalizedResults[symbol] = { ...results[symbol] };
          }

          const value = results[symbol][factor];
          normalizedResults[symbol][factor] =
            std === 0 || value === null || isNaN(value)
              ? 0
              : (value - mean) / std;
        }
      }

      // Calculate composite scores
      const scores = {};
      for (const symbol of symbols) {
        const factors = normalizedResults[symbol];
        if (!factors) continue;

        const composite = calculateCompositeScore(factors, settings.factors);
        const confidence = calculateConfidence(factors);

        scores[symbol] = {
          ...factors,
          composite,
          confidence,
        };
      }

      self.postMessage({
        type: 'COMPLETE',
        data: { scores },
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { message: error.message, stack: error.stack },
    });
  }
};
