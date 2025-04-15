export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://pyusd-intent-system.uc.r.appspot.com',
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID || '1', // mainnet by default
  defaultGasLimit: 250000,
  defaultSlippage: 0.5, // 0.5%
  refreshInterval: 10000, // 10 seconds
  maxRetries: 3,
}; 