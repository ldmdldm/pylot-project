const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABIs
const IntentProcessorABI = [
    "function processIntent(bytes32 intentId, address fromToken, address toToken, uint256 amount, uint16 destChain) external",
    "function setSupportedChain(uint16 chainId, bool supported) external",
    "function setSupportedDEX(address dex, bool supported) external",
    "function setProtocolAddresses(address _uniswap, address _curve, address _stargate, address _hop, address _layerZero) external"
];

// Test WETH address on Sepolia
const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const USDC = "0xda9d4f9b69ac6C22e444eD9aF0CfC043b7a7f53f";

async function main() {
    // Connect to Sepolia
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Using wallet address:", wallet.address);

    // Connect to deployed contracts
    const intentProcessor = new ethers.Contract(
        "0x6b7DdFaCEaF93A8e713b09cFCCc29AB56F3f511E", // Your deployed IntentProcessor address
        IntentProcessorABI,
        wallet
    );

    // Set up protocol (normally this would be done once by admin)
    console.log("Setting up protocol...");
    try {
        // Enable Sepolia chain
        await intentProcessor.setSupportedChain(11155111, true);
        console.log("Enabled Sepolia chain");

        // Set Uniswap V2 router address for Sepolia
        const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
        await intentProcessor.setSupportedDEX(uniswapRouter, true);
        console.log("Enabled Uniswap DEX");

        // Set protocol addresses
        await intentProcessor.setProtocolAddresses(
            uniswapRouter, // Uniswap
            ethers.ZeroAddress, // Curve (not used)
            ethers.ZeroAddress, // Stargate (not used)
            ethers.ZeroAddress, // Hop (not used)
            ethers.ZeroAddress  // LayerZero (not used)
        );
        console.log("Set protocol addresses");

        // Create a random intent ID
        const intentId = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "uint256"],
                [wallet.address, Date.now()]
            )
        );

        // Execute swap
        console.log("Executing swap...");
        const amount = ethers.parseEther("0.01"); // 0.01 ETH worth
        const tx = await intentProcessor.processIntent(
            intentId,
            WETH,
            USDC,
            amount,
            11155111, // Sepolia chain ID
            { value: amount }
        );

        console.log("Swap transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("Swap completed! Transaction hash:", receipt.hash);
        
        return receipt.hash;
    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
}

main()
    .then(async (txHash) => {
        // Wait a few seconds for the transaction to be fully processed
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Analyze the transaction
        console.log("\nAnalyzing transaction...");
        const TransactionTracer = require('./utils/TransactionTracer');
        const tracer = new TransactionTracer(process.env.SEPOLIA_RPC_URL);
        
        const analysis = await tracer.analyzeSwapExecution(txHash);
        console.log("\nSwap Analysis:", JSON.stringify(analysis, null, 2));
        
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
