const RouteOptimizer = require('./analytics/route_optimizer');
const ethers = require('ethers');

async function main() {
    console.log('Testing PYUSD Route Optimization System...');
    
    const optimizer = new RouteOptimizer();
    
    // Test amounts
    const amounts = [
        ethers.parseEther('100'),   // 100 PYUSD
        ethers.parseEther('1000'),  // 1000 PYUSD
        ethers.parseEther('10000'), // 10000 PYUSD
    ];

    // Token addresses on mainnet
    const PYUSD = ethers.getAddress('0x6c3ea9036406852006290770BEdFcAbA0e23A0e8');  // PayPal USD
    const USDC = ethers.getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');  // USDC
    const WETH = ethers.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');  // WETH
    
    // Test different paths
    const paths = [
        { from: PYUSD, to: USDC, desc: 'PYUSD to USDC' },
        { from: PYUSD, to: WETH, desc: 'PYUSD to WETH' },
        { from: WETH, to: PYUSD, desc: 'WETH to PYUSD' },
    ];

    for (const path of paths) {
        console.log(`\n=== Testing ${path.desc} ===`);
        
        for (const amount of amounts) {
            console.log(`\nTesting amount: ${ethers.formatEther(amount)} ${path.desc.split(' ')[0]}`);
            
            try {
                const bestRoute = await optimizer.findBestRoute(
                    path.from,
                    path.to,
                    amount
                );
                
                if (bestRoute) {
                    console.log('Best Route Found:');
                    console.log('Protocol:', bestRoute.protocol);
                    console.log('Output Amount:', ethers.formatUnits(bestRoute.output_amount, path.to === USDC ? 6 : 18));
                    console.log('Gas Cost:', ethers.formatEther(bestRoute.gas_cost), 'ETH');
                    console.log('Priority Score:', bestRoute.priority_score);
                    console.log('Path:', bestRoute.path);
                } else {
                    console.log('No valid route found');
                }
            } catch (error) {
                console.error(`Error finding route: ${error.message}`);
            }
        }
    }
    
    console.log('\nTest completed successfully!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
