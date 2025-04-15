import { useState } from 'react';
import type { Token, Route, OptimizationResult, SwapParams } from './types';
import { config } from './config';

interface UseRouteOptimizerReturn {
  optimize: (params: SwapParams) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  data: OptimizationResult | null;
}

export function useRouteOptimizer(): UseRouteOptimizerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<OptimizationResult | null>(null);

  const optimize = async (params: SwapParams) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${config.apiBaseUrl}/api/cloud/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize route');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to optimize route'));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    optimize,
    isLoading,
    error,
    data,
  };
}
