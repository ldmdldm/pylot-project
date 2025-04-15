# PYUSD DEX Integration Testing Documentation

## Overview
This document outlines the testing strategy and results for the PayPal USD (PYUSD) DEX integration project, developed during the Google x PayPal Hackathon. The project aims to optimize token swaps by integrating PYUSD with major decentralized exchanges on Ethereum mainnet.

## Test Environment
- Network: Ethereum Mainnet
- RPC Provider: Google Cloud Blockchain Node
- Test Framework: Hardhat
- Data Storage: Google BigQuery
- Analytics Dashboard: Google Sheets

## Smart Contract Addresses

### Tokens
- PYUSD: `0x6c3ea9036406852006290770BEdFcAbA0e23A0e8`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

### DEX Contracts
- Uniswap V3 Quoter V2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Uniswap V3 PYUSD/USDC Pool (0.05%): `0xaa4c9d6e5e349f319abb625aa8dca5f52abea757`
- Curve PYUSD/USDC Pool: `0x383e6b4437b59fff47b619cba855ca29342a8559`

## Test Cases

### 1. PYUSD to USDC Swaps

Test various amounts of PYUSD to USDC swaps to evaluate:
- Price impact
- Gas costs
- Route optimization

#### Test Inputs
- 100 PYUSD
- 1,000 PYUSD
- 10,000 PYUSD

#### Results

##### Uniswap V3 (0.05% Fee Pool)
- Successfully provides quotes for all test amounts
- Consistent gas cost: ~2.56M gas units
- Execution time: ~2.2 seconds
- Slippage: 0.3%
- Priority score: ~272.73

##### Curve Pool
- Successfully provides quotes for all test amounts
- Lower gas cost: ~100K gas units
- Execution time: ~2.5 seconds
- Slippage: 0.1%
- Priority score: ~0.000003

### 2. PYUSD to WETH Swaps

Test direct PYUSD to WETH swaps to verify handling of unsupported pairs.

#### Test Inputs
- 100 PYUSD
- 10,000 WETH

#### Results
- Correctly identifies that direct PYUSD/WETH pairs are not supported
- Appropriate error handling:
  - Uniswap V3: "Unexpected error"
  - Curve: "Token pair not supported"

## Route Optimization

### Priority Score Calculation
```javascript
priority_score = (
  (output_amount * 400 / input_amount) / 1000 * 0.4 + // Price impact: 40%
  (1 / gas_cost) * 0.3 + // Gas efficiency: 30%
  reliability_score * 0.3 // Historical reliability: 30%
)
```

### Data Collection
For each route, we collect:
- Timestamp
- Protocol
- Input/Output tokens and amounts
- Gas cost
- Execution time
- Slippage
- Path details
- Priority score

## Analytics Integration

### Google BigQuery
- Successfully logs all route data
- Stores historical performance metrics
- Enables analysis of:
  - Protocol efficiency
  - Gas costs over time
  - Price impact patterns

### Google Sheets Dashboard
- Auto-detects sheet name via Sheets API
- Real-time updates of:
  - Best routes
  - Protocol performance
  - Gas costs
  - Priority scores

## Error Handling

### Properly Handled Cases
1. Inactive or invalid pools
2. Unsupported token pairs
3. Failed quotes
4. Google Sheets API errors

### Recovery Mechanisms
1. Default to 'Sheet1' if sheet name detection fails
2. Skip failed protocol quotes
3. Return null for invalid routes
4. Detailed error logging

## Performance Metrics

### Response Times
- Quote retrieval: 2.2-2.5 seconds
- Route optimization: < 0.1 seconds
- Dashboard updates: < 1 second

### Gas Efficiency
- Uniswap V3: ~2.56M gas units
- Curve: ~100K gas units

## Future Improvements

1. Add support for multi-hop routes (e.g., PYUSD → USDC → WETH)
2. Implement parallel quote fetching for better performance
3. Add more DEX integrations (e.g., Balancer, SushiSwap)
4. Enhanced error recovery and retry mechanisms
5. Automated testing pipeline with GitHub Actions

## Conclusion
The PYUSD DEX integration successfully provides optimized routes for supported pairs, with proper error handling for unsupported ones. The system effectively balances price impact, gas costs, and historical reliability when selecting the best route.
