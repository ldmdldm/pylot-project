const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("Setting up liquidity pool...");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", await signer.getAddress());

    // Contract addresses
    const USDC = "0x90515711FE0dCb7272711DA486507e74C20C7E06"; // Test USDC
    const PYUSD = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // Sepolia PYUSD
    const ROUTER = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"; // UniswapV2 Router
    const FACTORY = "0x7E0987E5b3a30e3f2828572Bb659A548460a3003"; // UniswapV2 Factory

    // Get contract instances
    const router = await ethers.getContractAt("IUniswapV2Router02", ROUTER);
    const factory = await ethers.getContractAt("IUniswapV2Factory", FACTORY);
    const usdcToken = await ethers.getContractAt("IERC20", USDC);
    const pyusdToken = await ethers.getContractAt("IERC20", PYUSD);

    // Create pair if it doesn't exist
    console.log("Creating USDC/PYUSD pair...");
    let pairAddress;
    try {
        pairAddress = await factory.getPair(USDC, PYUSD);
        if (pairAddress === "0x0000000000000000000000000000000000000000") {
            const tx = await factory.createPair(USDC, PYUSD);
            await tx.wait();
            pairAddress = await factory.getPair(USDC, PYUSD);
        }
        console.log("Pair address:", pairAddress);
    } catch (error) {
        console.error("Error creating pair:", error);
        return;
    }

    // Add liquidity
    console.log("Adding liquidity...");
    try {
        // Approve router to spend tokens
        const usdcAmount = ethers.parseUnits("100", 6); // 100 USDC
        const pyusdAmount = ethers.parseUnits("100", 6); // 100 PYUSD

        await usdcToken.approve(ROUTER, usdcAmount);
        await pyusdToken.approve(ROUTER, pyusdAmount);

        // Add liquidity
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const tx = await router.addLiquidity(
            USDC,
            PYUSD,
            usdcAmount,
            pyusdAmount,
            0, // slippage tolerance
            0, // slippage tolerance
            signer.address,
            deadline
        );
        await tx.wait();
        console.log("Liquidity added successfully");

        // Get pair info
        const pair = await ethers.getContractAt("IUniswapV2Pair", pairAddress);
        const reserves = await pair.getReserves();
        console.log("Pool reserves:", {
            USDC: ethers.formatUnits(reserves[0], 6),
            PYUSD: ethers.formatUnits(reserves[1], 6)
        });
    } catch (error) {
        console.error("Error adding liquidity:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
