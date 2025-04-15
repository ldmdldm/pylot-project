const { BigQuery } = require('@google-cloud/bigquery');
const { google } = require('googleapis');
const sheets = google.sheets('v4');
const ethers = require('ethers');

const PROTOCOLS = {
  UNISWAP_V3: 'uniswap_v3',
  CURVE: 'curve'
};

const POOLS = {
  UNISWAP_V3: {
    PYUSD_USDC: '0xaa4c9d6e5e349f319abb625aa8dca5f52abea757',  // 0.05% fee
  },
  CURVE: {
    PYUSD_USDC: '0x383e6b4437b59fff47b619cba855ca29342a8559'
  }
};

class RouteOptimizer {
  constructor() {
    this.bigquery = new BigQuery();
  }

  async findBestRoute(inputToken, outputToken, amount) {
    // Query all available routes
    const routes = await this.queryRoutes(inputToken, outputToken, amount);
    
    // Calculate priority scores based on:
    // 1. Output amount
    // 2. Gas cost
    // 3. Historical reliability
    // 4. Liquidity depth
    const scoredRoutes = await this.calculatePriorityScores(routes);

    // Update BigQuery with route data
    await this.updateRouteData(scoredRoutes);

    // Update real-time dashboard
    await this.updateDashboard(scoredRoutes);

    return scoredRoutes[0]; // Return the best route
  }

  async queryRoutes(inputToken, outputToken, amount) {
    // Query each protocol in parallel
    const routePromises = Object.values(PROTOCOLS).map(async protocol => {
      try {
        const quote = await this.getQuote(protocol, inputToken, outputToken, amount);
        return {
          protocol,
          ...quote,
          timestamp: new Date()
        };
      } catch (error) {
        console.error(`Error querying ${protocol}:`, error);
        return null;
      }
    });

    const routes = (await Promise.all(routePromises)).filter(r => r !== null);
    return routes;
  }

  async getQuote(protocol, inputToken, outputToken, amount) {
    const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Convert amount to string to handle BigInt
    const amountStr = amount.toString();
    
    try {
      switch(protocol) {
        case PROTOCOLS.CURVE: {
          const poolAddress = POOLS.CURVE.PYUSD_USDC;
          const pool = new ethers.Contract(
            poolAddress,
            [
              'function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)',
              'function coins(uint256 i) external view returns (address)',
              'function get_virtual_price() external view returns (uint256)',
              'function A() external view returns (uint256)',
              'function fee() external view returns (uint256)'
            ],
            provider
          );

          // Verify pool is active
          const [virtualPrice, amplification, fee] = await Promise.all([
            pool.get_virtual_price(),
            pool.A(),
            pool.fee()
          ]);

          if (virtualPrice === BigInt(0) || amplification === BigInt(0)) {
            throw new Error('Curve pool is not active');
          }

          // Get coin indexes
          const coins = await Promise.all([0, 1].map(i => pool.coins(i)));
          const inputIndex = coins.findIndex(coin => 
            coin.toLowerCase() === inputToken.toLowerCase());
          const outputIndex = coins.findIndex(coin => 
            coin.toLowerCase() === outputToken.toLowerCase());

          if (inputIndex === -1 || outputIndex === -1) {
            throw new Error('Token pair not supported in Curve pool');
          }

          // Get output amount
          const outputAmount = await pool.get_dy.staticCall(
            inputIndex,
            outputIndex,
            amountStr
          );
          const gasCost = BigInt(100000); // Estimated gas cost for Curve swaps

          return {
            input_token: inputToken,
            output_token: outputToken,
            input_amount: amount,
            output_amount: outputAmount,
            gas_cost: gasCost.toString(),
            execution_time: 2.5,
            slippage: 0.001,
            path: `${inputToken} -> ${outputToken} (Curve)`,
            route_id: `CURVE_${Date.now()}`
          };
        }

        case PROTOCOLS.UNISWAP_V3: {
          const quoterAddress = ethers.getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e');  // Uniswap V3 Quoter V2
          const quoter = new ethers.Contract(
            quoterAddress,
            [
              'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
            ],
            provider
          );

          // Use the known pool with 0.05% fee for PYUSD/USDC
          const poolAddress = POOLS.UNISWAP_V3.PYUSD_USDC;
          const fee = 500; // 0.05%
          let bestOutput = BigInt(0);
          let gasCost = BigInt(0);

          try {
            const params = {
              tokenIn: inputToken,
              tokenOut: outputToken,
              amountIn: amountStr,
              fee: fee,
              sqrtPriceLimitX96: 0
            };
            const [output, , , gasEstimate] = await quoter.quoteExactInputSingle.staticCall(params);
            bestOutput = output;
            gasCost = gasEstimate;
          } catch (e) {
            throw new Error('Failed to get quote from Uniswap V3: ' + e.message);
          }

          if (bestOutput === BigInt(0)) {
            throw new Error('No valid route found in Uniswap V3');
          }

          return {
            input_token: inputToken,
            output_token: outputToken,
            input_amount: amount,
            output_amount: bestOutput,
            gas_cost: gasCost.toString(),
            execution_time: 2.2,
            slippage: 0.003,
            path: `${inputToken} -> ${outputToken}`,
            route_id: `UNIV3_${Date.now()}`
          };
        }

        default:
          throw new Error(`Protocol ${protocol} not implemented`);
      }
    } catch (error) {
      console.error(`Error getting quote from ${protocol}:`, error);
      return null;
    }
  }

  async calculatePriorityScores(routes) {
    // Mock historical data for testing
    const historicalData = [
      {
        protocol: PROTOCOLS.UNISWAP_V2,
        avg_execution_time: 2,
        avg_slippage: 0.001,
        total_executions: 1000
      },
      {
        protocol: PROTOCOLS.UNISWAP_V3,
        avg_execution_time: 2.2,
        avg_slippage: 0.0005,
        total_executions: 800
      }
    ];

    // Score each route
    return routes
      .map(route => {
        const history = historicalData.find(h => h.protocol === route.protocol) || {};
        const reliabilityScore = history.total_executions ? 
          (1 / (history.avg_slippage || 0.01)) * (1 / (history.avg_execution_time || 1)) : 0;

        return {
          ...route,
          priority_score: (
            Number(BigInt(route.output_amount) * BigInt(400) / BigInt(route.input_amount)) / 1000 + // Price impact: 40%
            (1 / (Number(route.gas_cost) || 1)) * 0.3 + // Gas efficiency: 30%
            reliabilityScore * 0.3 // Historical reliability: 30%
          )
        };
      })
      .sort((a, b) => b.priority_score - a.priority_score);
  }

  async updateRouteData(routes) {
    const rows = routes.map(route => ({
      timestamp: route.timestamp,
      protocol: route.protocol,
      route_id: route.route_id,
      input_token: route.input_token,
      output_token: route.output_token,
      input_amount: route.input_amount,
      output_amount: route.output_amount,
      gas_cost: route.gas_cost,
      execution_time: route.execution_time,
      slippage: route.slippage,
      path: route.path,
      priority_score: route.priority_score
    }));

    // Skip BigQuery insert for testing
    console.log('Would insert into BigQuery:', rows);
  }

  async getSheetTabName() {
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_DASHBOARD_ID,
      });

      // Get the first sheet by default
      const firstSheet = response.data.sheets[0];
      return firstSheet.properties.title;
    } catch (error) {
      console.error('Error getting sheet name:', error);
      return 'Sheet1'; // Fallback to default sheet name
    }
  }

  async updateDashboard(routes) {
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const values = routes.map(route => [
      route.timestamp.toISOString(),
      route.protocol,
      route.input_token,
      route.output_token,
      route.input_amount.toString(),
      route.output_amount.toString(),
      route.gas_cost.toString(),
      route.priority_score.toString()
    ]);

    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: process.env.GOOGLE_SHEETS_DASHBOARD_ID,
      range: `${await this.getSheetTabName()}!A2:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });
  }
}

module.exports = RouteOptimizer;
