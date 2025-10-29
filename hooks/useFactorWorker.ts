import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  PriceRow,
  SectorMapRow,
  IndexRow,
  Settings,
  ScoreBreakdown,
  WorkerProgress,
} from '@/types';

interface FactorWorkerResult {
  scores: Record<string, ScoreBreakdown>;
}

interface UseFactorWorkerReturn {
  compute: (
    prices: PriceRow[],
    sectors: SectorMapRow[],
    benchmarkData: IndexRow[],
    settings: Settings
  ) => Promise<FactorWorkerResult>;
  isComputing: boolean;
  progress: WorkerProgress | null;
  error: string | null;
  cancel: () => void;
}

export function useFactorWorker(): UseFactorWorkerReturn {
  const [isComputing, setIsComputing] = useState(false);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((result: FactorWorkerResult) => void) | null>(
    null
  );
  const rejectRef = useRef<((error: Error) => void) | null>(null);

  // Initialize worker
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const compute = useCallback(
    (
      prices: PriceRow[],
      sectors: SectorMapRow[],
      benchmarkData: IndexRow[],
      settings: Settings
    ): Promise<FactorWorkerResult> => {
      return new Promise((resolve, reject) => {
        setIsComputing(true);
        setProgress(null);
        setError(null);

        // Create new worker
        const worker = new Worker('/factor-worker.js');
        workerRef.current = worker;
        resolveRef.current = resolve;
        rejectRef.current = reject;

        worker.onmessage = (e) => {
          const { type, data } = e.data;

          switch (type) {
            case 'PROGRESS':
              setProgress({
                stage: data.stage,
                progress: data.progress,
                total: data.total,
                message: `${data.stage}: ${data.progress}/${data.total}`,
              });
              break;

            case 'COMPLETE':
              setIsComputing(false);
              setProgress(null);
              worker.terminate();
              workerRef.current = null;
              resolve(data);
              break;

            case 'ERROR':
              setIsComputing(false);
              setProgress(null);
              setError(data.message);
              worker.terminate();
              workerRef.current = null;
              reject(new Error(data.message));
              break;
          }
        };

        worker.onerror = (error) => {
          setIsComputing(false);
          setProgress(null);
          setError(error.message);
          worker.terminate();
          workerRef.current = null;
          reject(new Error(error.message));
        };

        // Send data to worker
        worker.postMessage({
          type: 'COMPUTE_FACTORS',
          data: {
            prices,
            sectors,
            benchmarkData,
            settings,
          },
        });
      });
    },
    []
  );

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsComputing(false);
    setProgress(null);
    if (rejectRef.current) {
      rejectRef.current(new Error('Computation cancelled'));
    }
  }, []);

  return {
    compute,
    isComputing,
    progress,
    error,
    cancel,
  };
}
