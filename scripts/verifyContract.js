const { ethers } = require('ethers');
require('dotenv').config();

async function verifyContract() {
    const provider = new ethers.JsonRpcProvider(process.env.HOLESKY_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const intentProcessorAddress = "0x6BCD92dC74a1578a4F6c289bfDB0522734c632F5";
    
    // Contract ABI (minimal for testing)
    const intentProcessorAbi = [
        "function processIntent(bytes32 intentId, address fromToken, address toToken, uint256 amount, uint16 destChain) external payable",
        "function supportedChains(uint16) external view returns (bool)",
        "function supportedDEXs(address) external view returns (bool)",
        "function uniswapRouter() external view returns (address)",
        "function layerZeroEndpoint() external view returns (address)",
        "function processedIntents(bytes32) external view returns (bool)"
    ];

    try {
        const contract = new ethers.Contract(intentProcessorAddress, intentProcessorAbi, wallet);
        
        // Check if contract exists
        const code = await provider.getCode(intentProcessorAddress);
        console.log('Contract exists:', code !== '0x');
        
        // Check if we can call view functions
        const uniswapAddr = await contract.uniswapRouter();
        console.log('Uniswap Router:', uniswapAddr);
        
        const lzEndpoint = await contract.layerZeroEndpoint();
        console.log('LayerZero Endpoint:', lzEndpoint);
        
        // Check if Holesky chain is supported
        const isHoleskySupported = await contract.supportedChains(17000);
        console.log('Is Holesky chain supported:', isHoleskySupported);
        
        // Check if Uniswap DEX is supported
        const isUniswapSupported = await contract.supportedDEXs("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
        console.log('Is Uniswap supported:', isUniswapSupported);
        
        // Generate an intentId and check if it's processed
        const intentId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'address', 'address', 'uint256', 'uint16'],
                [wallet.address, "0x94373a4919B3240D86eA41593D5eBa789FEF3848", "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c", ethers.parseEther("0.01"), 17000]
            )
        );
        const isProcessed = await contract.processedIntents(intentId);
        console.log('Is intent processed:', isProcessed);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

verifyContract()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
