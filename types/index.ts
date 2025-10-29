// Core Data Models

export type UserRole = 'admin' | 'stakeholder';

export type SignalLabel = 'BUY' | 'SELL' | 'HOLD';

export interface User {
  id: string;
  role: UserRole;
  theme: 'light' | 'dark' | 'system';
  localToken?: string;
}

export interface Settings {
  factors: {
    momentum: number;
    alphaDrift: number;
    peerDiff: number;
    volatility: number;
    liquidity: number;
    sectorBeta: number;
  };
  thresholds: {
    buy: number;
    sell: number;
    holdBand: [number, number];
  };
  risk: {
    maxPosPct: number;
    sectorCapPct: number;
    turnoverPct: number;
    minNotional: number;
  };
}

export interface PriceRow {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SectorMapRow {
  symbol: string;
  sector: string;
  industry: string;
  capTier: string;
}

export interface IndexRow {
  date: string;
  close: number;
}

export interface ProjectDatasets {
  prices: PriceRow[];
  sectors: SectorMapRow[];
  benchmark: string;
  benchmarkData: IndexRow[];
  constituents: string[];
}

export interface ScoreBreakdown {
  momentum: number;
  alphaDrift: number;
  peerDiff: number;
  volatility: number;
  liquidity: number;
  sectorBeta: number;
  composite: number;
  confidence: number;
}

export interface PortfolioSnapshot {
  weights: Record<string, number>;
  sectors: Record<string, number>;
}

export interface PerformanceMetrics {
  cagr: number;
  mdd: number;
  sharpe: number;
  sortino: number;
  turnover: number;
  hitRate?: number;
}

export interface RunSnapshot {
  id: string;
  at: number;
  scores: Record<string, ScoreBreakdown>;
  labels: Record<string, SignalLabel>;
  portfolio: PortfolioSnapshot;
  metrics: PerformanceMetrics;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: number;
  settingsDiff: Partial<Settings>;
  result: RunSnapshot;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  settings: Settings;
  datasets: ProjectDatasets;
  runs: RunSnapshot[];
  scenarios: Scenario[];
}

// Backtest Configuration

export interface BacktestConfig {
  cadence: 'daily' | 'weekly' | 'monthly';
  transactionCostBps: number;
  slippageBps: number;
  startDate: string;
  endDate: string;
}

export interface BacktestResult {
  equityCurve: Array<{ date: string; value: number }>;
  drawdownCurve: Array<{ date: string; drawdown: number }>;
  metrics: PerformanceMetrics;
  trades: Array<{
    date: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
  }>;
}

// Risk Gates

export interface RiskGateWarning {
  type: 'position_size' | 'sector_cap' | 'turnover' | 'liquidity';
  severity: 'warning' | 'error';
  message: string;
  symbol?: string;
  sector?: string;
  value: number;
  threshold: number;
}

// Worker Messages

export interface WorkerProgress {
  stage: string;
  progress: number;
  total: number;
  message: string;
}

export interface FactorComputeRequest {
  prices: PriceRow[];
  sectors: SectorMapRow[];
  benchmarkData: IndexRow[];
  settings: Settings;
}

export interface FactorComputeResponse {
  scores: Record<string, ScoreBreakdown>;
  labels: Record<string, SignalLabel>;
  warnings: RiskGateWarning[];
}

// UI State

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'destructive' | 'success';
  duration?: number;
}

export interface Modal {
  id: string;
  type: 'confirm' | 'info' | 'form';
  title: string;
  content: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Export Types

export interface ReportConfig {
  title: string;
  sections: Array<
    | 'executive_summary'
    | 'signals'
    | 'portfolio'
    | 'risk'
    | 'backtest'
    | 'charts'
  >;
  format: 'pdf' | 'csv';
  includeCharts: boolean;
}

// Watchlist & Notes

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: number;
}

export interface Note {
  id: string;
  symbol: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Project Bundle for Import/Export

export interface ProjectBundle {
  version: string;
  project: Project;
  watchlists: Watchlist[];
  notes: Note[];
  exportedAt: number;
}

// Default Settings

export const DEFAULT_SETTINGS: Settings = {
  factors: {
    momentum: 0.25,
    alphaDrift: 0.20,
    peerDiff: 0.15,
    volatility: 0.15,
    liquidity: 0.15,
    sectorBeta: 0.10,
  },
  thresholds: {
    buy: 0.5,
    sell: -0.5,
    holdBand: [-0.3, 0.3],
  },
  risk: {
    maxPosPct: 5.0,
    sectorCapPct: 25.0,
    turnoverPct: 20.0,
    minNotional: 100000,
  },
};
