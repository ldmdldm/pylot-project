const GoogleCloudIntentAnalytics = require('../utils/GoogleCloudIntentAnalytics');
const TransactionTracer = require('../utils/TransactionTracer');
const { ethers } = require('ethers');
require('dotenv').config();

async function monitorIntents() {
    const analytics = new GoogleCloudIntentAnalytics();
    
    // Use Google Cloud's WebSocket endpoint for real-time monitoring
    const provider = new ethers.WebSocketProvider(process.env.HOLESKY_WSS_URL);
    console.log('Connected to Google Cloud Blockchain RPC service');
    
    // Contract ABI for events
    const intentProcessorAbi = [
        "event IntentCreated(bytes32 indexed intentId, address indexed fromToken, address indexed toToken, uint256 amount, uint16 destChain, uint256 timestamp)",
        "event IntentExecuted(bytes32 indexed intentId, bool success, uint256 gasUsed, uint256 timestamp)",
        "event OptimizationSuggestion(bytes32 indexed intentId, string suggestion, uint256 potentialSavings)"
    ];

    // Deployed contract addresses
    const intentProcessorAddress = "0x1d1eFF60989c6b169Eb0edbca04E86fA632E632d";
    const intentProcessor = new ethers.Contract(
        intentProcessorAddress,
        intentProcessorAbi,
        provider
    );

    console.log('Starting intent monitoring on Holesky...');
    console.log('Using Google Cloud RPC:', process.env.HOLESKY_RPC_URL);
    console.log('Monitoring contract:', intentProcessorAddress);

    // Listen for new intents
    intentProcessor.on("IntentCreated", async (intentId, fromToken, toToken, amount, destChain, timestamp, event) => {
        console.log(`New intent detected: ${intentId}`);
        
        try {
            await analytics.trackIntent(
                intentId,
                event.transaction.hash,
                fromToken,
                toToken,
                amount
            );

            // Use Google Cloud's debug_traceTransaction for detailed analysis
            const tracer = new TransactionTracer(process.env.HOLESKY_RPC_URL);
            const trace = await tracer.traceTransaction(event.transaction.hash);
            console.log('Transaction trace:', JSON.stringify(trace, null, 2));
        } catch (error) {
            console.error('Error tracking intent:', error);
        }
    });

    // Listen for intent executions
    intentProcessor.on("IntentExecuted", async (intentId, success, gasUsed, timestamp, event) => {
        console.log(`Intent executed: ${intentId}`);
        console.log(`Gas used: ${gasUsed}`);
        
        // Use Google Cloud's advanced tracing capabilities
        const tracer = new TransactionTracer(process.env.HOLESKY_RPC_URL);
        try {
            const trace = await tracer.traceTransaction(event.transaction.hash);
            console.log('Execution trace:', JSON.stringify(trace, null, 2));

            // Get block trace for context
            const blockTrace = await tracer.traceBlock(event.blockNumber);
            console.log('Block context:', JSON.stringify(blockTrace, null, 2));
        } catch (error) {
            console.error('Error tracing transaction:', error);
        }
    });

    // Listen for optimization suggestions
    intentProcessor.on("OptimizationSuggestion", (intentId, suggestion, potentialSavings) => {
        console.log(`Optimization suggestion for ${intentId}:`);
        console.log(`- ${suggestion}`);
        console.log(`- Potential gas savings: ${potentialSavings}`);
    });

    console.log('Monitoring system ready. Waiting for events...');
    
    // Handle WebSocket connection
    const ws = provider.websocket;
    if (ws) {
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            process.exit(1);
        });

        ws.on('close', () => {
            console.log('WebSocket closed. Attempting to reconnect...');
            setTimeout(monitorIntents, 5000);
        });
    }

    // Keep the script running
    process.stdin.resume();
}

// Create analytics table if it doesn't exist
async function setup() {
    const analytics = new GoogleCloudIntentAnalytics();
    try {
        await analytics.createAnalyticsTable();
        console.log('Analytics table created/verified');
    } catch (error) {
        console.error('Error creating analytics table:', error);
    }
}

setup()
    .then(() => monitorIntents())
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
