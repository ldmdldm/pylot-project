# Uniswap V2 PYUSD Integration and Testing Documentation

## Project Overview

This project implements a critical DeFi infrastructure by deploying Uniswap V2 contracts on the Sepolia testnet and establishing a PYUSD/USDC liquidity pool. PYUSD (PayPal USD) represents a significant step in mainstream financial institutions adopting blockchain technology, and our implementation provides essential DeFi functionality for this stablecoin.

### Why PYUSD is Important

PayPal USD (PYUSD) is a fully-backed stablecoin issued by PayPal, one of the world's largest payment processors. By integrating PYUSD into Uniswap V2:

1. **Institutional Adoption**: We're bridging traditional finance with DeFi
2. **Liquidity Access**: Providing easy conversion between PYUSD and other stablecoins
3. **Market Efficiency**: Creating price stability through automated market making
4. **Cross-Platform Utility**: Enabling PYUSD usage across the DeFi ecosystem

## Google Cloud Integration

Our infrastructure leverages several Google Cloud services for robust operation and monitoring:

### 1. Google Cloud RPC Node
```javascript
// hardhat.config.js
networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL, // Google Cloud hosted Sepolia node
      accounts: [process.env.PRIVATE_KEY]
    }
}
```

### 2. Google Cloud Storage
- Stores contract artifacts and deployment history
- Maintains transaction logs and performance metrics
- Enables easy backup and restoration of deployment states

### 3. BigQuery Integration
```javascript
// analytics/export.js
const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

async function exportSwapEvents() {
    const swapData = // ... fetch swap events
    await bigquery.dataset('uniswap_v2').table('swap_events').insert(swapData);
}
```

### 4. Google Sheets Export
- Real-time liquidity pool statistics
- Trading volume analytics
- Price impact monitoring
- Automated reporting for stakeholders

## Deployed Contract Addresses (Sepolia)

- WETH: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- Factory: `0xB7f907f7A9eBC822a80BD25E224be42Ce0A698A8`
- Router: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- Test USDC: `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`
- PYUSD: `0x5425890298aed601595a70AB815c96711a31Bc65`

## Testing Steps

1. **Approve Router for PYUSD**
```javascript
const pyusd = await ethers.getContractAt("IERC20", "0x5425890298aed601595a70AB815c96711a31Bc65");
await pyusd.approve("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", ethers.utils.parseEther("1000"));
```

2. **Approve Router for USDC**
```javascript
const usdc = await ethers.getContractAt("IERC20", "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8");
await usdc.approve("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", ethers.utils.parseUnits("1000", 6));
```

3. **Add Liquidity**
```javascript
const router = await ethers.getContractAt("IUniswapV2Router02", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
await router.addLiquidity(
    "0x5425890298aed601595a70AB815c96711a31Bc65", // PYUSD
    "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // USDC
    ethers.utils.parseEther("100"),  // PYUSD amount
    ethers.utils.parseUnits("100", 6), // USDC amount
    0, // min PYUSD
    0, // min USDC
    signer.address,
    Math.floor(Date.now() / 1000) + 60 * 20 // deadline 20 minutes
);
```

4. **Perform a Swap**
```javascript
await router.swapExactTokensForTokens(
    ethers.utils.parseEther("1"), // input amount (1 PYUSD)
    0, // minimum output amount
    [
        "0x5425890298aed601595a70AB815c96711a31Bc65", // PYUSD
        "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"  // USDC
    ],
    signer.address,
    Math.floor(Date.now() / 1000) + 60 * 20 // deadline 20 minutes
);
```

## Verification

1. **Check Liquidity Pool Balance**
```javascript
const factory = await ethers.getContractAt("IUniswapV2Factory", "0xB7f907f7A9eBC822a80BD25E224be42Ce0A698A8");
const pairAddress = await factory.getPair("0x5425890298aed601595a70AB815c96711a31Bc65", "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8");
const pair = await ethers.getContractAt("IUniswapV2Pair", pairAddress);
const reserves = await pair.getReserves();
console.log("PYUSD Reserve:", ethers.utils.formatEther(reserves[0]));
console.log("USDC Reserve:", ethers.utils.formatUnits(reserves[1], 6));
```

2. **Check Token Balances**
```javascript
const pyusdBalance = await pyusd.balanceOf(signer.address);
const usdcBalance = await usdc.balanceOf(signer.address);
console.log("PYUSD Balance:", ethers.utils.formatEther(pyusdBalance));
console.log("USDC Balance:", ethers.utils.formatUnits(usdcBalance, 6));
```

## Important Notes

1. All transactions have been tested and confirmed working on Sepolia testnet
2. The liquidity pool has been created and is active
3. Swaps are working in both directions (PYUSD → USDC and USDC → PYUSD)
4. The price impact depends on the size of the liquidity pool and the size of your swap
5. Make sure to have enough Sepolia ETH for gas fees

## Common Issues and Solutions

1. **Insufficient Balance**
   - Make sure you have enough tokens before attempting swaps or adding liquidity
   - For testnet tokens, you can mint more using the respective token contracts

2. **Transaction Failing**
   - Check that you have approved enough tokens for the router
   - Ensure you have enough Sepolia ETH for gas
   - Verify that the deadline hasn't expired (currently set to 20 minutes)

3. **High Slippage**
   - If the pool has low liquidity, you might need to adjust the minimum output amount
   - Consider adding more liquidity to improve swap rates
