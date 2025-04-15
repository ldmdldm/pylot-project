import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { DexContract, TOKENS, DEX_CONTRACT_ADDRESS } from './contract';
import { useRouteOptimizer } from './useRouteOptimizer';
import { useFaucet } from './useFaucet';

interface OptimizedRoute {
  path: string;
  output_amount: string;
  slippage: number;
  gas_cost?: string;
  execution_time?: number;
}

interface SwapRoute {
  route: string[];
  expectedOut: string;
  priceImpact: string;
  gasCost?: string;
  executionTime?: number;
}

export function useDex() {
  const [dex, setDex] = useState<DexContract | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<SwapRoute | null>(null);

  const { address: account, isConnected } = useAccount();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const { findBestRoute, bestRoute, isLoading: isOptimizing } = useRouteOptimizer();
  const { requestTokens, isLoading: isMinting, error: faucetError } = useFaucet();

  // Initialize DexContract
  useEffect(() => {
    const initDex = async () => {
      try {
        const contract = new DexContract(DEX_CONTRACT_ADDRESS);
        if (isConnected && account) {
          await contract.connect();
        }
        setDex(contract);
      } catch (err) {
        console.error('Failed to initialize DexContract:', err);
        setError('Web3 provider not found. Please install MetaMask.');
      }
    };
    
    initDex();
  }, [isConnected, account]);

  // Reset error when account changes
  useEffect(() => {
    setError('');
  }, [account]);

  const getBestRoute = async (amount: string, fromToken: string, toToken: string) => {
    if (!dex) {
      console.error('DexContract not initialized');
      setError('Web3 provider not initialized');
      return null;
    }
    if (!amount) {
      console.error('Amount is required');
      setError('Please enter an amount');
      return null;
    }
    if (!isConnected) {
      console.error('Wallet not connected');
      setError('Please connect your wallet');
      return null;
    }

    try {
      // First try to get the optimized route from Google Cloud
      const optimizedRoute = await findBestRoute(fromToken, toToken, amount);
      
      if (optimizedRoute) {
        const route: SwapRoute = {
          route: optimizedRoute.path.split(' -> '),
          expectedOut: optimizedRoute.output_amount,
          priceImpact: (optimizedRoute.slippage * 100).toString(),
          gasCost: optimizedRoute.gas_cost,
          executionTime: optimizedRoute.execution_time,
        };
        setCurrentRoute(route);
        return route;
      }

      console.log('Cloud route not available, falling back to local calculation');

      // Fallback to local route calculation
      const localRoute = await dex.getBestRoute(
        amount,
        TOKENS[fromToken as keyof typeof TOKENS],
        TOKENS[toToken as keyof typeof TOKENS]
      );
      
      if (!localRoute || !localRoute.route || !localRoute.expectedOut) {
        throw new Error('Invalid route returned from local calculation');
      }

      const route: SwapRoute = {
        route: localRoute.route,
        expectedOut: localRoute.expectedOut,
        priceImpact: localRoute.priceImpact,
      };
      
      setCurrentRoute(route);
      return route;
    } catch (err) {
      console.error('Route optimization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate swap route');
      return null;
    }
  };

  const getSwapRate = async (amount: string, fromToken: string, toToken: string) => {
    if (!dex || !amount || !isConnected) return '0';
    try {
      const route = await getBestRoute(amount, fromToken, toToken);
      if (!route) {
        throw new Error('No valid route found');
      }
      return route.expectedOut;
    } catch (err) {
      console.error('Failed to get swap rate:', err);
      setError('Failed to get swap rate');
      return '0';
    }
  };

  const executeSwap = async (amount: string, fromToken: string, toToken: string, slippage: number = 0.5) => {
    if (!dex || !account) throw new Error('Not connected');
    if (!amount) throw new Error('Amount is required');
    
    setIsLoading(true);
    try {
      // Get the latest route before executing swap
      const route = await getBestRoute(amount, fromToken, toToken);
      if (!route) {
        throw new Error('No valid route found');
      }

      // Check if the route is optimized (has gas cost)
      const isOptimized = !!route.gasCost;
      console.log(`Using ${isOptimized ? 'optimized' : 'local'} route for swap`);

      const tx = await dex.executeSwap(
        amount,
        TOKENS[fromToken as keyof typeof TOKENS],
        TOKENS[toToken as keyof typeof TOKENS],
        slippage
      );
      
      setCurrentRoute(null); // Reset route after successful swap
      return tx;
    } catch (err: any) {
      console.error('Swap failed:', err);
      setError(err.message || 'Failed to execute swap');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getBalance = async (token: string) => {
    if (!dex || !account) return '0';
    try {
      const tokenAddress = TOKENS[token as keyof typeof TOKENS];
      if (!tokenAddress) {
        console.error('Invalid token:', token);
        return '0';
      }
      
      const balance = await dex.getTokenBalance(tokenAddress, account);
      return balance;
    } catch (err) {
      console.error('Failed to get balance:', err);
      // Don't set error for balance check failures
      return '0';
    }
  };

  return {
    account,
    isConnected,
    isConnecting,
    isLoading: isLoading || isOptimizing || isMinting,
    error: error || faucetError,
    currentRoute,
    bestRoute,
    connectAsync,
    getSwapRate,
    executeSwap,
    getBalance,
    getBestRoute,
    requestTokens,
  };
}
