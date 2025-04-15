import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { formatEther, formatUnits } from 'ethers/utils';
import { useAccount } from 'wagmi';
import { TokenInput } from './TokenInput';
import { SwapButton } from './SwapButton';
import { useDex } from '../hooks/useDex';
import { BridgeSelector } from './BridgeSelector';
import { MEVProtection } from './MEVProtection';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { WalletButton } from './WalletButton';
import { FaucetButton } from './FaucetButton';

interface TokenAddresses {
  PYUSD: string;
  ETH: string;
  WETH: string;
  USDC: string;
}

const TOKEN_ADDRESSES: TokenAddresses = {
  PYUSD: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
};

interface Token {
  symbol: keyof TokenAddresses;
  address: string;
  decimals: number;
  name: string;
  logoURI: string;
}

type TokenSymbol = keyof TokenAddresses;

const SUPPORTED_TOKENS: Record<TokenSymbol, Token> = {
  PYUSD: { symbol: "PYUSD", address: TOKEN_ADDRESSES.PYUSD, decimals: 6, name: "PayPal USD", logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6c3ea9036406852006290770BEdFcAbA0e23A0e8/logo.png" },
  ETH: { symbol: "ETH", address: TOKEN_ADDRESSES.ETH, decimals: 18, name: "Ethereum", logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png" },
  WETH: { symbol: "WETH", address: TOKEN_ADDRESSES.WETH, decimals: 18, name: "Wrapped Ether", logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png" },
  USDC: { symbol: "USDC", address: TOKEN_ADDRESSES.USDC, decimals: 6, name: "USD Coin", logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png" }
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

interface RouteResult {
  route: string[];
  amountOut: string;
  gasEstimate: string;
  securityScore: number;
}

export function Swap() {
  const { address } = useAccount();
  const [fromToken, setFromToken] = useState<Token>(SUPPORTED_TOKENS.PYUSD);
  const [toToken, setToToken] = useState<Token>(SUPPORTED_TOKENS.ETH);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [fromBalance, setFromBalance] = useState<string>('0');
  const [toBalance, setToBalance] = useState<string>('0');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { getRoute, executeSwap } = useDex();

  const getBalance = async (token: Token) => {
    if (!address || !window.ethereum) return '0';
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      if (token.symbol === 'ETH') {
        const balance = await provider.getBalance(address);
        return formatEther(balance);
      } else {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        return formatUnits(balance, token.decimals);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
      return '0';
    }
  };

  useEffect(() => {
    const fetchBalances = async () => {
      if (address) {
        const fromBalance = await getBalance(fromToken);
        const toBalance = await getBalance(toToken);
        setFromBalance(fromBalance);
        setToBalance(toBalance);
      }
    };
    fetchBalances();
  }, [address, fromToken, toToken]);

  const handleSwap = async () => {
    if (!address || !fromAmount || !toAmount) return;
    setLoading(true);
    setError(null);
    try {
      const route = await getRoute(fromToken, toToken, fromAmount);
      setRoute(route);
      await executeSwap(route);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap-container">
      <TokenInput
        token={fromToken}
        amount={fromAmount}
        balance={fromBalance}
        onTokenChange={(symbol: string) => {
          const tokenSymbol = symbol as TokenSymbol;
          if (tokenSymbol in SUPPORTED_TOKENS) {
            setFromToken(SUPPORTED_TOKENS[tokenSymbol]);
          }
        }}
        onAmountChange={setFromAmount}
      />
      <TokenInput
        token={toToken}
        amount={toAmount}
        balance={toBalance}
        onTokenChange={(symbol: string) => {
          const tokenSymbol = symbol as TokenSymbol;
          if (tokenSymbol in SUPPORTED_TOKENS) {
            setToToken(SUPPORTED_TOKENS[tokenSymbol]);
          }
        }}
        onAmountChange={setToAmount}
      />
      <SwapButton
        loading={loading}
        disabled={!address || !fromAmount || !toAmount}
        onClick={handleSwap}
      />
      {error && <div className="error">{error}</div>}
      {route && (
        <div className="route-info">
          <h3>Route Details</h3>
          <p>Path: {route.route.join(' → ')}</p>
          <p>Expected Output: {route.amountOut}</p>
          <p>Gas Estimate: {route.gasEstimate}</p>
          <p>Security Score: {route.securityScore}</p>
        </div>
      )}
    </div>
  );
}
