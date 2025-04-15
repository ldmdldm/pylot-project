const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying test tokens...");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", await signer.getAddress());

    // Deploy USDC
    console.log("Deploying test USDC...");
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const usdc = await TestERC20.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("Test USDC deployed to:", usdcAddress);

    // Deploy PYUSD
    console.log("Deploying test PYUSD...");
    const pyusd = await TestERC20.deploy("PayPal USD", "PYUSD", 6);
    await pyusd.waitForDeployment();
    const pyusdAddress = await pyusd.getAddress();
    console.log("Test PYUSD deployed to:", pyusdAddress);

    // Mint tokens
    console.log("Minting test tokens...");
    const mintAmount = ethers.parseUnits("1000000", 6); // 1M tokens
    await usdc.mint(signer.address, mintAmount);
    await pyusd.mint(signer.address, mintAmount);
    
    // Print balances
    const usdcBalance = await usdc.balanceOf(signer.address);
    const pyusdBalance = await pyusd.balanceOf(signer.address);
    console.log("Balances:");
    console.log("USDC:", ethers.formatUnits(usdcBalance, 6));
    console.log("PYUSD:", ethers.formatUnits(pyusdBalance, 6));

    // Verify contracts
    console.log("\nVerifying contracts...");
    try {
        await hre.run("verify:verify", {
            address: usdcAddress,
            constructorArguments: ["USD Coin", "USDC", 6],
        });
        console.log("USDC verified");
    } catch (error) {
        console.error("Error verifying USDC:", error.message);
    }

    try {
        await hre.run("verify:verify", {
            address: pyusdAddress,
            constructorArguments: ["PayPal USD", "PYUSD", 6],
        });
        console.log("PYUSD verified");
    } catch (error) {
        console.error("Error verifying PYUSD:", error.message);
    }

    console.log("\nTest token addresses:");
    console.log("USDC:", usdcAddress);
    console.log("PYUSD:", pyusdAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
