const { ethers } = require('ethers');
require('dotenv').config();

async function getWeth() {
    // Connect to Google Cloud RPC
    const provider = new ethers.JsonRpcProvider(process.env.HOLESKY_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // WETH contract address on Holesky
    const wethAddress = "0x94373a4919B3240D86eA41593D5eBa789FEF3848";
    
    // WETH ABI
    const wethAbi = [
        "function deposit() external payable",
        "function balanceOf(address) external view returns (uint256)"
    ];

    // Create WETH contract instance
    const weth = new ethers.Contract(wethAddress, wethAbi, wallet);

    try {
        // Check ETH balance
        const ethBalance = await provider.getBalance(wallet.address);
        console.log('ETH Balance:', ethers.formatEther(ethBalance));

        // Check current WETH balance
        const wethBalance = await weth.balanceOf(wallet.address);
        console.log('Current WETH Balance:', ethers.formatEther(wethBalance));

        // Wrap 0.1 ETH to WETH
        const amountToWrap = ethers.parseEther("0.1");
        console.log('Wrapping 0.1 ETH to WETH...');
        
        const tx = await weth.deposit({ value: amountToWrap });
        console.log('Transaction sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.hash);

        // Check new WETH balance
        const newWethBalance = await weth.balanceOf(wallet.address);
        console.log('New WETH Balance:', ethers.formatEther(newWethBalance));

    } catch (error) {
        console.error('Error:', error);
        if (error.transaction) {
            console.error('Transaction details:', error.transaction);
        }
    }
}

getWeth()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
