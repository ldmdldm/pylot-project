import { useState } from 'react';
import type { Token } from './types';
import { config } from './config';

interface UseFaucetReturn {
  mint: (token: Token) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useFaucet(): UseFaucetReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mint = async (token: Token) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${config.apiBaseUrl}/api/faucet/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Failed to mint tokens');
      }

      await response.json();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to mint tokens'));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    mint,
    isLoading,
    error,
  };
}
