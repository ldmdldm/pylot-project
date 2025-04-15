import { ethers } from 'ethers';
import { TOKENS, UNISWAP_ROUTER } from '../../frontend/src/lib/contract';

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
  private provider: ethers.JsonRpcProvider;
  private uniswapRouter: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
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
    try {
      // Convert amount to Wei
      const amountIn = ethers.parseEther(amount);

      // Define possible paths
      const paths = [
        [inputToken, TOKENS.WETH, outputToken], // Through WETH
        [inputToken, outputToken], // Direct path
      ];

      // Get quotes for all paths
      const quotes = await Promise.all(
        paths.map(async (path) => {
          try {
            const amounts = await this.uniswapRouter.getAmountsOut(amountIn, path);
            const gasEstimate = await this.uniswapRouter.getAmountsOut.estimateGas(amountIn, path);
            
            return {
              path,
              outputAmount: amounts[amounts.length - 1],
              gasEstimate,
            };
          } catch (err) {
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

      // Calculate execution time based on recent block times
      const lastBlock = await this.provider.getBlock('latest');
      const prevBlock = await this.provider.getBlock(lastBlock!.number - 1);
      const blockTime = lastBlock!.timestamp - prevBlock!.timestamp;
      const estimatedTime = blockTime * 2; // Assume 2 blocks for confirmation

      return {
        protocol: 'Uniswap V2',
        input_token: inputToken,
        output_token: outputToken,
        input_amount: amount,
        output_amount: ethers.formatEther(bestQuote.outputAmount),
        gas_cost: bestQuote.gasEstimate.toString(),
        execution_time: estimatedTime,
        slippage: 0.5,
        path: bestQuote.path.join(' -> '),
        priority_score: 1,
      };
    } catch (error: any) {
      console.error('Route optimization failed:', error);
      throw error;
    }
  }
}
