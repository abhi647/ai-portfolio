import Papa from 'papaparse';
import type { PriceRow, SectorMapRow, IndexRow } from '@/types';

export interface ValidationResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
}

// Price CSV validation
export function validatePriceRow(row: any, rowIndex: number): {
  valid: boolean;
  errors: string[];
  data?: PriceRow;
} {
  const errors: string[] = [];

  if (!row.symbol || typeof row.symbol !== 'string') {
    errors.push(`Row ${rowIndex}: Missing or invalid symbol`);
  }

  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    errors.push(
      `Row ${rowIndex}: Missing or invalid date (expected YYYY-MM-DD format)`
    );
  }

  const numericFields = ['open', 'high', 'low', 'close', 'volume'];
  for (const field of numericFields) {
    const value = parseFloat(row[field]);
    if (isNaN(value) || value < 0) {
      errors.push(`Row ${rowIndex}: Invalid ${field} value`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      symbol: row.symbol.trim().toUpperCase(),
      date: row.date,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
    },
  };
}

// Sector CSV validation
export function validateSectorRow(row: any, rowIndex: number): {
  valid: boolean;
  errors: string[];
  data?: SectorMapRow;
} {
  const errors: string[] = [];

  if (!row.symbol || typeof row.symbol !== 'string') {
    errors.push(`Row ${rowIndex}: Missing or invalid symbol`);
  }

  if (!row.sector || typeof row.sector !== 'string') {
    errors.push(`Row ${rowIndex}: Missing or invalid sector`);
  }

  if (!row.industry || typeof row.industry !== 'string') {
    errors.push(`Row ${rowIndex}: Missing or invalid industry`);
  }

  if (!row.cap_tier || typeof row.cap_tier !== 'string') {
    errors.push(`Row ${rowIndex}: Missing or invalid cap_tier`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      symbol: row.symbol.trim().toUpperCase(),
      sector: row.sector.trim(),
      industry: row.industry.trim(),
      capTier: row.cap_tier.trim(),
    },
  };
}

// Index CSV validation
export function validateIndexRow(row: any, rowIndex: number): {
  valid: boolean;
  errors: string[];
  data?: IndexRow;
} {
  const errors: string[] = [];

  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    errors.push(
      `Row ${rowIndex}: Missing or invalid date (expected YYYY-MM-DD format)`
    );
  }

  const close = parseFloat(row.close);
  if (isNaN(close) || close < 0) {
    errors.push(`Row ${rowIndex}: Invalid close value`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      date: row.date,
      close: parseFloat(row.close),
    },
  };
}

// CSV Parser with chunking
export async function parsePriceCSV(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ValidationResult<PriceRow>> {
  return new Promise((resolve) => {
    const validData: PriceRow[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let rowCount = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      chunk: (results) => {
        for (const row of results.data) {
          rowCount++;
          const validation = validatePriceRow(row, rowCount);

          if (validation.valid && validation.data) {
            validData.push(validation.data);
          } else {
            errors.push(...validation.errors);
          }
        }

        if (onProgress) {
          onProgress(rowCount);
        }
      },
      complete: () => {
        // Check for duplicate entries
        const seen = new Set<string>();
        validData.forEach((row) => {
          const key = `${row.symbol}-${row.date}`;
          if (seen.has(key)) {
            warnings.push(`Duplicate entry: ${key}`);
          }
          seen.add(key);
        });

        resolve({
          success: errors.length === 0,
          data: validData,
          errors,
          warnings,
        });
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [`Parse error: ${error.message}`],
          warnings: [],
        });
      },
    });
  });
}

export async function parseSectorCSV(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ValidationResult<SectorMapRow>> {
  return new Promise((resolve) => {
    const validData: SectorMapRow[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let rowCount = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      chunk: (results) => {
        for (const row of results.data) {
          rowCount++;
          const validation = validateSectorRow(row, rowCount);

          if (validation.valid && validation.data) {
            validData.push(validation.data);
          } else {
            errors.push(...validation.errors);
          }
        }

        if (onProgress) {
          onProgress(rowCount);
        }
      },
      complete: () => {
        resolve({
          success: errors.length === 0,
          data: validData,
          errors,
          warnings,
        });
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [`Parse error: ${error.message}`],
          warnings: [],
        });
      },
    });
  });
}

export async function parseIndexCSV(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ValidationResult<IndexRow>> {
  return new Promise((resolve) => {
    const validData: IndexRow[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let rowCount = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      chunk: (results) => {
        for (const row of results.data) {
          rowCount++;
          const validation = validateIndexRow(row, rowCount);

          if (validation.valid && validation.data) {
            validData.push(validation.data);
          } else {
            errors.push(...validation.errors);
          }
        }

        if (onProgress) {
          onProgress(rowCount);
        }
      },
      complete: () => {
        resolve({
          success: errors.length === 0,
          data: validData,
          errors,
          warnings,
        });
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [`Parse error: ${error.message}`],
          warnings: [],
        });
      },
    });
  });
}

// Generate demo data
export function generateDemoData(): {
  prices: PriceRow[];
  sectors: SectorMapRow[];
  benchmark: IndexRow[];
} {
  const symbols = [
    'RELIANCE',
    'TCS',
    'HDFCBANK',
    'INFY',
    'HINDUNILVR',
    'ICICIBANK',
    'SBIN',
    'BHARTIARTL',
    'ITC',
    'KOTAKBANK',
  ];

  const sectors: SectorMapRow[] = [
    {
      symbol: 'RELIANCE',
      sector: 'Energy',
      industry: 'Oil & Gas',
      capTier: 'Large',
    },
    {
      symbol: 'TCS',
      sector: 'Technology',
      industry: 'IT Services',
      capTier: 'Large',
    },
    {
      symbol: 'HDFCBANK',
      sector: 'Finance',
      industry: 'Private Banks',
      capTier: 'Large',
    },
    { symbol: 'INFY', sector: 'Technology', industry: 'IT Services', capTier: 'Large' },
    {
      symbol: 'HINDUNILVR',
      sector: 'Consumer',
      industry: 'FMCG',
      capTier: 'Large',
    },
    {
      symbol: 'ICICIBANK',
      sector: 'Finance',
      industry: 'Private Banks',
      capTier: 'Large',
    },
    {
      symbol: 'SBIN',
      sector: 'Finance',
      industry: 'Public Banks',
      capTier: 'Large',
    },
    {
      symbol: 'BHARTIARTL',
      sector: 'Telecom',
      industry: 'Telecom Services',
      capTier: 'Large',
    },
    { symbol: 'ITC', sector: 'Consumer', industry: 'FMCG', capTier: 'Large' },
    {
      symbol: 'KOTAKBANK',
      sector: 'Finance',
      industry: 'Private Banks',
      capTier: 'Large',
    },
  ];

  const prices: PriceRow[] = [];
  const benchmark: IndexRow[] = [];

  // Generate 1 year of daily data
  const startDate = new Date('2023-01-01');
  const endDate = new Date('2024-01-01');
  let currentDate = new Date(startDate);

  let benchmarkValue = 18000;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Skip weekends
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Generate benchmark data
      const benchmarkChange = (Math.random() - 0.48) * 100;
      benchmarkValue += benchmarkChange;
      benchmark.push({ date: dateStr, close: Math.round(benchmarkValue * 100) / 100 });

      // Generate stock prices
      for (const symbol of symbols) {
        const basePrice = Math.random() * 1000 + 500;
        const volatility = 0.02;
        const change = (Math.random() - 0.48) * basePrice * volatility;

        const close = basePrice + change;
        const open = basePrice;
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = Math.floor(Math.random() * 10000000) + 1000000;

        prices.push({
          symbol,
          date: dateStr,
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          close: Math.round(close * 100) / 100,
          volume,
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { prices, sectors, benchmark };
}
