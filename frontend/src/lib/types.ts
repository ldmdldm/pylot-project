export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI: string;
}

export interface Route {
  steps: string[];
  expectedOutput: string;
  gasEstimate: string;
  priceImpact: string;
}

export interface OptimizationResult {
  route: Route;
  analytics: {
    gasEstimate: number;
    executionTime: number;
    confidence: number;
  };
}

export interface SwapParams {
  inputToken: Token;
  outputToken: Token;
  amount: string;
  slippage: number;
  recipient: string;
} 