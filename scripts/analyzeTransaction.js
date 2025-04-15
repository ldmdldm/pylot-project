const TransactionTracer = require('../utils/TransactionTracer');
require('dotenv').config();

async function main() {
    // Initialize tracer with GCP RPC URL
    const useTestnet = process.env.USE_TESTNET === 'true';
    const rpcUrl = useTestnet ? process.env.HOLESKY_RPC_URL : process.env.MAINNET_RPC_URL;
    
    const tracer = new TransactionTracer(rpcUrl);

    // Example transaction hash - replace with actual transaction
    const txHash = process.argv[2];
    if (!txHash) {
        console.error('Please provide a transaction hash');
        process.exit(1);
    }

    try {
        console.log('Analyzing transaction:', txHash);
        
        // Get detailed transaction trace
        console.log('\nTransaction Trace:');
        const trace = await tracer.traceTransaction(txHash);
        console.log(JSON.stringify(trace, null, 2));

        // Analyze swap execution if it's a swap transaction
        console.log('\nSwap Analysis:');
        const swapAnalysis = await tracer.analyzeSwapExecution(txHash);
        console.log(JSON.stringify(swapAnalysis, null, 2));

        // Analyze bridge execution if it's a bridge transaction
        console.log('\nBridge Analysis:');
        const bridgeAnalysis = await tracer.analyzeBridgeExecution(txHash);
        console.log(JSON.stringify(bridgeAnalysis, null, 2));

        // Get gas optimization suggestions
        console.log('\nGas Optimization Analysis:');
        const gasAnalysis = await tracer.estimateOptimalGas(txHash);
        console.log(JSON.stringify(gasAnalysis, null, 2));

    } catch (error) {
        console.error('Error analyzing transaction:', error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
