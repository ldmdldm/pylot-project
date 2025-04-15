import { ethers } from 'ethers';
import { TOKENS, UNISWAP_ROUTER } from './contract';

interface Route {
  protocol: string;
  input_token: string;
  output_token: string;
  input_amount: string;
  output_amount: string;
  gas_cost: string;
  execution_time: number;
  slippage: number;
  path: string;
  priority_score?: number;
}

export default class RouteOptimizer {
  private provider: any; // Using any temporarily to handle provider type compatibility
  private uniswapRouter: ethers.Contract;

  constructor() {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Web3 provider not found');
    }
    this.provider = new ethers.BrowserProvider(window.ethereum as any);
    this.uniswapRouter = new ethers.Contract(
      UNISWAP_ROUTER,
      [
        'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
        'function getAmountsIn(uint amountOut, address[] memory path) view returns (uint[] memory amounts)',
      ],
      this.provider
    );
  }

  async findBestRoute(inputToken: string, outputToken: string, amount: string): Promise<Route> {
    if (!inputToken || !outputToken) {
      throw new Error('Input and output tokens are required');
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      throw new Error('Invalid amount');
    }
    try {
      // Convert amount to Wei
      const amountIn = ethers.parseEther(amount);

      // Define possible paths
      const paths = [
        [TOKENS[inputToken as keyof typeof TOKENS], TOKENS.WETH, TOKENS[outputToken as keyof typeof TOKENS]], // Through WETH
        [TOKENS[inputToken as keyof typeof TOKENS], TOKENS[outputToken as keyof typeof TOKENS]], // Direct path
      ];

      // Filter out paths with duplicate tokens
      const validPaths = paths.filter(path => {
        const uniqueTokens = new Set(path);
        return uniqueTokens.size === path.length;
      });

      // Get quotes for all paths
      const quotes = await Promise.all(
        validPaths.map(async (path) => {
          try {
            // Validate path addresses
            if (!path.every(addr => ethers.isAddress(addr))) {
              console.error('Invalid address in path:', path);
              return null;
            }

            const amounts = await this.uniswapRouter.getAmountsOut(amountIn, path);
            const gasEstimate = await this.uniswapRouter.getAmountsOut.estimateGas(amountIn, path);
            
            if (!amounts || amounts.length === 0) {
              console.error('Invalid amounts returned for path:', path);
              return null;
            }

            return {
              path,
              outputAmount: amounts[amounts.length - 1],
              gasEstimate,
            };
          } catch (err) {
            console.error('Failed to get quote for path:', path, err);
            return null;
          }
        })
      );

      // Filter out failed quotes and find the best route
      const validQuotes = quotes.filter((q): q is NonNullable<typeof q> => q !== null);
      
      if (validQuotes.length === 0) {
        throw new Error('No valid routes found');
      }

      // Find the best route based on output amount and gas cost
      const bestQuote = validQuotes.reduce((best, current) => {
        const currentValue = current.outputAmount - (current.gasEstimate * BigInt(50e9)); // Assuming 50 gwei gas price
        const bestValue = best.outputAmount - (best.gasEstimate * BigInt(50e9));
        return currentValue > bestValue ? current : best;
      });

      // Estimate execution time (assume 12 seconds per block on average)
      const estimatedTime = 24; // 2 blocks * 12 seconds

      // Calculate price impact
      const inputValue = parseFloat(amount);
      const outputValue = parseFloat(ethers.formatEther(bestQuote.outputAmount));
      const priceImpact = Math.abs((outputValue - inputValue) / inputValue) * 100;

      return {
        protocol: 'Uniswap V2',
        input_token: inputToken,
        output_token: outputToken,
        input_amount: amount,
        output_amount: ethers.formatEther(bestQuote.outputAmount),
        gas_cost: ethers.formatEther(bestQuote.gasEstimate * BigInt(50e9)), // Convert to ETH
        execution_time: estimatedTime,
        slippage: priceImpact,
        path: bestQuote.path.map(addr => {
          // Convert addresses back to token symbols
          const symbol = Object.entries(TOKENS).find(([_, value]) => value.toLowerCase() === addr.toLowerCase())?.[0];
          return symbol || addr;
        }).join(' -> '),
        priority_score: Number(bestQuote.outputAmount) / Number(bestQuote.gasEstimate) || 1,
      };
    } catch (error: any) {
      console.error('Route optimization failed:', error);
      throw error;
    }
  }
}
