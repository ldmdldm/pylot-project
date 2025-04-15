import type { SwapParams, OptimizationResult } from './types';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://pyusd-intent-system.uc.r.appspot.com'
  : 'http://localhost:8001';

export async function optimizeRoute(params: SwapParams): Promise<OptimizationResult> {
  const response = await fetch(`${API_BASE_URL}/process-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user: params.recipient,
      amount: parseFloat(params.amount),
      targetToken: params.outputToken.symbol,
      targetChain: 'ethereum_mainnet',
      minAmountOut: parseFloat(params.amount) * (1 - params.slippage / 100),
      deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to optimize route');
  }

  const data = await response.json();
  
  return {
    route: {
      steps: data.route || [],
      expectedOutput: data.expectedOutput || '0',
      gasEstimate: data.gasEstimate || '0',
      priceImpact: data.priceImpact || '0',
    },
    analytics: {
      gasEstimate: data.analytics?.gasEstimate || 0,
      executionTime: data.analytics?.executionTime || 0,
      confidence: data.analytics?.securityScore || 0,
    },
  };
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    return false;
  }
} 