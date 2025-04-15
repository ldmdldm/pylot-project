import { ethers } from 'ethers';

// ERC20 ABI for token operations
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

// ABI for our DEX contract
const DEX_ABI = [
  'function processIntent(bytes32 intentId, address fromToken, address toToken, uint256 amount, uint16 destChain) payable',
  'function supportedDEXs(address) view returns (bool)',
  'function supportedChains(uint16) view returns (bool)',
  'function setProtocolAddresses(address _uniswap, address _curve, address _stargate, address _hop, address _layerZero)',
  'function setSupportedChain(uint16 chainId, bool supported)',
  'function setSupportedDEX(address dex, bool supported)',
];

import deployments from '../deployments.json';
import uniswap from '../uniswap.json';

// Token addresses
export type TokenAddresses = {
  PYUSD: string;
  ETH: string;
  WETH: string;
  USDC: string;
};

export const TOKENS = {
  PYUSD: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788', // Local PYUSD token
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Special address for ETH
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Mainnet WETH
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Mainnet USDC
};

// Contract addresses
export const DEX_CONTRACT_ADDRESS = '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82'; // Local DEX contract
export const UNISWAP_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Mainnet router
export const UNISWAP_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'; // Mainnet factory

// Error messages
const ERRORS = {
  NO_PROVIDER: 'Web3 provider not found',
  NOT_CONNECTED: 'Wallet not connected',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  APPROVAL_NEEDED: 'Token approval needed',
  PRICE_IMPACT_HIGH: 'Price impact too high',
  SLIPPAGE_EXCEEDED: 'Slippage tolerance exceeded',
  TRANSACTION_FAILED: 'Transaction failed',
  INVALID_AMOUNT: 'Invalid amount',
  ROUTE_NOT_FOUND: 'No valid route found',
};

export class DexContract {
  private contract: ethers.Contract | null = null;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized: boolean = false;

  constructor(contractAddress: string) {
    if (typeof window === 'undefined') {
      console.error('Server-side initialization attempted');
      return;
    }

    // Check for various Web3 providers
    const provider = this.detectProvider();
    if (!provider) {
      console.error('No Web3 provider found. Please install MetaMask or another Web3 wallet.');
      return;
    }

    try {
      console.log('Web3 provider detected:', {
        isMetaMask: provider.isMetaMask,
        chainId: provider.chainId,
        selectedAddress: provider.selectedAddress
      });

      console.log('Initializing BrowserProvider...');
      this.provider = new ethers.BrowserProvider(provider);

      console.log('Validating contract address:', contractAddress);
      if (!ethers.isAddress(contractAddress)) {
        console.error('Invalid contract address');
        return;
      }

      console.log('Creating contract instance...');
      this.contract = new ethers.Contract(contractAddress, DEX_ABI, this.provider);
      this.isInitialized = true;
      console.log('Contract initialized successfully');

      // Listen for account changes
      provider.on('accountsChanged', (accounts: string[]) => {
        console.log('Account changed:', accounts[0]);
        this.handleAccountChange(accounts[0]);
      });

      // Listen for chain changes
      provider.on('chainChanged', (chainId: string) => {
        console.log('Chain changed:', chainId);
        window.location.reload();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize DexContract:', {
        error: errorMessage,
        contractAddress,
        providerStatus: window.ethereum ? 'available' : 'not available'
      });
      throw new Error(`Failed to initialize Web3 provider: ${errorMessage}`);
    }
  }

  async connect() {
    try {
      if (!window.ethereum) {
        console.error('No Web3 provider found');
        throw new Error(ERRORS.NO_PROVIDER);
      }

      if (!this.provider || !this.contract || !this.isInitialized) {
        console.error('Contract not initialized');
        throw new Error('Contract not initialized');
      }

      await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
      if (!this.provider) {
        throw new Error('Provider not available');
      }
      this.signer = await this.provider.getSigner();
      const address = await this.signer.getAddress();
      
      if (this.contract && this.signer) {
        this.contract = this.contract.connect(this.signer) as ethers.Contract & { connect: (signer: ethers.Signer) => ethers.Contract };
      }

      return address;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      return null;
    }
  }

  private async checkAndApproveToken(tokenAddress: string, amount: bigint): Promise<void> {
    if (tokenAddress === TOKENS.ETH) return;
    if (!this.signer) throw new Error(ERRORS.NOT_CONNECTED);

    if (!this.contract || !this.signer) throw new Error(ERRORS.NOT_CONNECTED);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const address = await this.signer.getAddress();
    const allowance = await tokenContract.allowance(address, this.contract.target);

    if (allowance < amount) {
      const tx = await tokenContract.approve(this.contract.target, amount);
      const receipt = await tx.wait();
      if (!receipt.status) {
        throw new Error(ERRORS.APPROVAL_NEEDED);
      }
    }
  }

  async getBestRoute(amountIn: string, tokenIn: string, tokenOut: string): Promise<{
    route: string[];
    expectedOut: string;
    priceImpact: string;
    path: string;
  }> {
    if (!this.provider || !this.contract || !this.isInitialized) {
      console.error('Contract not initialized');
      throw new Error(ERRORS.NO_PROVIDER);
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      console.error('Invalid amount:', amountIn);
      throw new Error(ERRORS.INVALID_AMOUNT);
    }

    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
      console.error('Invalid token addresses:', { tokenIn, tokenOut });
      throw new Error('Invalid token addresses');
    }

    try {
      console.log('Finding best route for:', {
        amountIn,
        tokenIn,
        tokenOut
      });

      const amountInWei = ethers.parseEther(amountIn);
      
      // Define possible paths
      const paths = [
        [tokenIn, tokenOut], // Direct path
        [tokenIn, TOKENS.WETH, tokenOut], // Path through WETH
      ];

      console.log('Trying paths:', paths.map(path => path.join(' -> ')));

      // Try all paths and get quotes
      const quotes = await Promise.all(
        paths.map(async (path) => {
          try {
            // Validate all addresses in path
            const validAddresses = path.every(addr => ethers.isAddress(addr));
            if (!validAddresses) {
              console.error('Invalid addresses in path:', path);
              return null;
            }

            if (!this.provider) {
              console.error('Provider not available');
              return null;
            }

            const amountOut = await this.getUniswapQuote(amountInWei, path);
            console.log('Quote received for path:', {
              path: path.join(' -> '),
              amountOut: amountOut.toString()
            });
            return { path, amountOut };
          } catch (err) {
            console.warn('Path not available:', {
              path: path.join(' -> '),
              error: err instanceof Error ? err.message : 'Unknown error'
            });
            return null;
          }
        })
      );

      // Filter valid quotes and find best
      const validQuotes = quotes.filter((q): q is NonNullable<typeof q> => q !== null);
      console.log('Valid quotes found:', validQuotes.length);

      if (validQuotes.length === 0) {
        console.error('No valid routes found');
        throw new Error(ERRORS.ROUTE_NOT_FOUND);
      }

      // Find best quote by output amount
      const bestQuote = validQuotes.reduce((best, current) => {
        console.log('Comparing quotes:', {
          current: current.amountOut.toString(),
          best: best.amountOut.toString()
        });
        return current.amountOut > best.amountOut ? current : best;
      });

      // Format amounts and calculate price impact
      const amountOutFormatted = ethers.formatEther(bestQuote.amountOut);
      const inputValue = parseFloat(amountIn);
      const outputValue = parseFloat(amountOutFormatted);
      const priceImpact = ((inputValue - outputValue) / inputValue * 100).toFixed(2);

      console.log('Best route found:', {
        path: bestQuote.path.join(' -> '),
        expectedOut: amountOutFormatted,
        priceImpact
      });

      // Get token symbols for path
      const pathWithSymbols = bestQuote.path.map(addr => {
        const symbol = Object.entries(TOKENS).find(([_, value]) => 
          value.toLowerCase() === addr.toLowerCase()
        )?.[0];
        return symbol || addr.slice(0, 6) + '...';
      });

      return {
        route: bestQuote.path,
        expectedOut: amountOutFormatted,
        priceImpact,
        path: pathWithSymbols.join(' → ')
      };
    } catch (error: any) {
      console.error('Failed to get best route:', {
        error: error.message,
        stack: error.stack,
        tokenIn,
        tokenOut,
        amountIn
      });
      throw error;
    }
  }

  async getSwapRate(amountIn: string, tokenIn: string, tokenOut: string): Promise<string> {
    try {
      const amountInWei = ethers.parseEther(amountIn);
      const [route, expectedOut] = await this.contract.getBestRoute(amountInWei, tokenIn, tokenOut);
      return ethers.formatEther(expectedOut);
    } catch (error) {
      console.error('Failed to get swap rate:', error);
      throw error;
    }
  }

  async executeSwap(amountIn: string, tokenIn: string, tokenOut: string, slippage: number = 0.5): Promise<ethers.TransactionReceipt> {
    // Input validation
    if (!this.provider || !this.contract || !this.isInitialized) {
      throw new Error('Contract not initialized');
    }

    if (!this.signer) throw new Error(ERRORS.NOT_CONNECTED);
    if (!amountIn || parseFloat(amountIn) <= 0) throw new Error(ERRORS.INVALID_AMOUNT);
    if (slippage < 0 || slippage > 100) throw new Error('Invalid slippage value');
    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
      throw new Error('Invalid token address');
    }

    try {
      const amountInWei = ethers.parseEther(amountIn);
      const userAddress = await this.signer.getAddress();
      
      // Check balance with retry
      let balance;
      for (let i = 0; i < 3; i++) {
        try {
          balance = await this.getTokenBalance(tokenIn, userAddress);
          break;
        } catch (err) {
          if (i === 2) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!balance || ethers.parseEther(balance) < amountInWei) {
        throw new Error(ERRORS.INSUFFICIENT_BALANCE);
      }

      // Get route and validate output
      const { route, expectedOut } = await this.getBestRoute(amountIn, tokenIn, tokenOut);
      if (!route || route.length < 2) {
        throw new Error(ERRORS.ROUTE_NOT_FOUND);
      }

      // Calculate minimum output with slippage
      const minOutput = (ethers.parseEther(expectedOut) * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000);
      
      // Approve token if needed
      if (tokenIn !== TOKENS.ETH) {
        await this.checkAndApproveToken(tokenIn, amountInWei);
      }

      // Generate intent ID with nonce for uniqueness
      const nonce = Date.now().toString() + Math.random().toString().slice(2, 8);
      const intentId = ethers.keccak256(
        ethers.solidityPacked(
          ['string', 'address', 'address', 'address', 'uint256', 'uint256'],
          [nonce, userAddress, tokenIn, tokenOut, amountInWei, minOutput]
        )
      );

      // Execute swap with gas estimation
      const gasEstimate = await this.contract.processIntent.estimateGas(
        intentId,
        tokenIn,
        tokenOut,
        amountInWei,
        1337, // Local chain ID
        { value: tokenIn === TOKENS.ETH ? amountInWei : BigInt(0) }
      );

      const tx = await this.contract.processIntent(
        intentId,
        tokenIn,
        tokenOut,
        amountInWei,
        1337,
        { 
          value: tokenIn === TOKENS.ETH ? amountInWei : BigInt(0),
          gasLimit: (gasEstimate * BigInt(120)) / BigInt(100) // Add 20% buffer
        }
      );
      
      const receipt = await tx.wait();
      if (!receipt.status) {
        throw new Error(ERRORS.TRANSACTION_FAILED);
      }

      // Verify the swap was successful by checking balances
      const newBalance = await this.getTokenBalance(tokenOut, userAddress);
      if (newBalance === '0') {
        throw new Error('Swap may have failed: no output tokens received');
      }

      return receipt;
    } catch (error: any) {
      console.error('Failed to execute swap:', error);
      // Map common errors to user-friendly messages
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction was rejected by user');
      }
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient ETH for gas');
      }
      throw error;
    }
  }

  async getTokenBalance(token: string, account: string): Promise<string> {
    if (!token || !account) throw new Error('Invalid token or account address');
    if (!this.provider || !this.isInitialized) {
      console.error('Contract not initialized');
      return '0';
    }
    
    try {
      if (token === TOKENS.ETH) {
        const balance = await this.provider.getBalance(account);
        return ethers.formatEther(balance);
      }

      // Ensure we have a valid token contract
      if (!ethers.isAddress(token)) {
        throw new Error('Invalid token address');
      }

      const tokenContract = new ethers.Contract(token, ERC20_ABI, this.provider);
      const balance = await tokenContract.balanceOf(account);
      return ethers.formatEther(balance);
    } catch (error: any) {
      console.error('Failed to get token balance:', error);
      if (error.code === 'BAD_DATA') {
        return '0'; // Return 0 for invalid token contracts
      }
      throw new Error(`Failed to get ${token} balance: ${error.message}`);
    }
  }

  private detectProvider(): any {
    if (typeof window !== 'undefined' && window.ethereum) {
      return window.ethereum;
    }
    return null;
  }

  private async handleAccountChange(newAccount: string | undefined) {
    if (!this.provider || !this.contract || !this.isInitialized) {
      console.error('Contract not initialized');
      return;
    }

    if (newAccount) {
      try {
        this.signer = await this.provider.getSigner();
        this.contract = this.contract.connect(this.signer) as ethers.Contract;
      } catch (error) {
        console.error('Failed to update signer:', error);
      }
    } else {
      this.signer = null;
    }
  }

  private async getUniswapQuote(amountIn: bigint, path: string[]): Promise<bigint> {
    if (!this.provider || !this.isInitialized) {
      console.error('Contract not initialized');
      throw new Error(ERRORS.NO_PROVIDER);
    }

    if (!path || path.length < 2) {
      console.error('Invalid path:', path);
      throw new Error('Invalid swap path');
    }

    const UNISWAP_ROUTER_ABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
    ];

    try {
      console.log('Getting Uniswap quote for path:', {
        path,
        amountIn: amountIn.toString(),
        routerAddress: UNISWAP_ROUTER
      });

      if (!ethers.isAddress(UNISWAP_ROUTER)) {
        console.error('Invalid Uniswap router address');
        throw new Error('Invalid router configuration');
      }

      const uniswapRouter = new ethers.Contract(UNISWAP_ROUTER, UNISWAP_ROUTER_ABI, this.provider);
      
      console.log('Calling getAmountsOut...');
      const amounts = await uniswapRouter.getAmountsOut(amountIn, path);
      
      if (!amounts || !amounts.length) {
        throw new Error('Invalid amounts returned from Uniswap');
      }

      console.log('Quote received:', {
        amounts: amounts.map((a: bigint) => (a !== undefined && a !== null) ? a.toString() : 'invalid'),
        outputAmount: amounts[amounts.length - 1]?.toString() || '0'
      });
      
      const outputAmount = amounts[amounts.length - 1];
      if (!outputAmount) {
        throw new Error('Invalid output amount');
      }

      return outputAmount;
    } catch (error: any) {
      console.error('Failed to get Uniswap quote:', {
        error: error.message,
        path,
        amountIn: amountIn.toString(),
        code: error.code,
        reason: error.reason
      });

      // Map common Uniswap errors to user-friendly messages
      if (error.code === 'UNPREDICTABLE_GAS_LIMIT' || error.reason?.includes('INSUFFICIENT_LIQUIDITY')) {
        throw new Error('Insufficient liquidity for this trade');
      }
      if (error.code === 'CALL_EXCEPTION') {
        throw new Error('Trade cannot be executed at this time');
      }
      throw new Error(error.message || 'Failed to get quote');
    }
  }
}
