const { ethers } = require('ethers');
require('dotenv').config();

class TransactionTracer {
    constructor(rpcUrl) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    async traceTransaction(txHash) {
        try {
            // Using GCP's debug_traceTransaction method
            const trace = await this.provider.send('debug_traceTransaction', [
                txHash,
                {
                    tracer: 'callTracer',
                    tracerConfig: {
                        onlyTopCall: false,
                        withLog: true
                    }
                }
            ]);
            return trace;
        } catch (error) {
            console.error('Error tracing transaction:', error);
            throw error;
        }
    }

    async traceBlock(blockNumber) {
        try {
            // Using GCP's trace_block method
            const trace = await this.provider.send('trace_block', [
                typeof blockNumber === 'number' ? 
                    '0x' + blockNumber.toString(16) : 
                    blockNumber
            ]);
            return trace;
        } catch (error) {
            console.error('Error tracing block:', error);
            throw error;
        }
    }

    async analyzeSwapExecution(txHash) {
        const trace = await this.traceTransaction(txHash);
        const analysis = {
            gasUsed: 0,
            callDepth: 0,
            dexInteractions: [],
            tokenTransfers: []
        };

        function processCall(call, depth = 0) {
            analysis.callDepth = Math.max(analysis.callDepth, depth);
            
            // Track DEX interactions
            if (call.input && call.input.startsWith('0x38ed1739')) { // swapExactTokensForTokens
                analysis.dexInteractions.push({
                    type: 'swap',
                    contract: call.to,
                    value: call.value,
                    gasUsed: call.gasUsed
                });
            }

            // Track token transfers
            if (call.input && call.input.startsWith('0xa9059cbb')) { // transfer
                analysis.tokenTransfers.push({
                    from: call.from,
                    to: call.to,
                    value: call.value
                });
            }

            // Process nested calls
            if (call.calls) {
                call.calls.forEach(subcall => processCall(subcall, depth + 1));
            }
        }

        processCall(trace);
        return analysis;
    }

    async analyzeBridgeExecution(txHash) {
        const trace = await this.traceTransaction(txHash);
        const analysis = {
            gasUsed: 0,
            bridgeContract: null,
            destinationChain: null,
            messageData: null,
            events: []
        };

        function processCall(call) {
            // Identify bridge contract interactions
            if (call.input && (
                call.input.startsWith('0x6e7d4d73') || // LayerZero send
                call.input.startsWith('0x9d51d9c7')    // Stargate swap
            )) {
                analysis.bridgeContract = call.to;
                analysis.gasUsed = call.gasUsed;
                
                // Decode bridge parameters
                const inputData = call.input.slice(10); // Remove function selector
                analysis.messageData = inputData;
            }

            // Process events
            if (call.logs) {
                analysis.events = call.logs.map(log => ({
                    address: log.address,
                    topics: log.topics,
                    data: log.data
                }));
            }

            // Process nested calls
            if (call.calls) {
                call.calls.forEach(subcall => processCall(subcall));
            }
        }

        processCall(trace);
        return analysis;
    }

    async estimateOptimalGas(txHash) {
        const trace = await this.traceTransaction(txHash);
        let totalGasUsed = BigInt(0);
        let potentialSavings = BigInt(0);

        function analyzeCall(call) {
            const gasUsed = BigInt(call.gasUsed || 0);
            totalGasUsed += gasUsed;

            // Identify potential gas optimizations
            if (call.type === 'CALL' && call.value === '0x0') {
                // Potential static call optimization
                potentialSavings += BigInt(2100); // Basic CALL stipend
            }

            if (call.calls) {
                call.calls.forEach(subcall => analyzeCall(subcall));
            }
        }

        analyzeCall(trace);

        return {
            totalGasUsed: totalGasUsed.toString(),
            potentialSavings: potentialSavings.toString(),
            recommendations: [
                'Use static calls where possible',
                'Batch multiple transfers',
                'Optimize storage usage'
            ]
        };
    }
}

module.exports = TransactionTracer;
