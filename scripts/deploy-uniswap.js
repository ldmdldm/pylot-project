const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Uniswap V2...");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", await signer.getAddress());

    // Deploy WETH
    console.log("Deploying WETH...");
    const WETH = await ethers.getContractFactory("WETH9");
    const weth = await WETH.deploy();
    await weth.waitForDeployment();
    const wethAddress = await weth.getAddress();
    console.log("WETH deployed to:", wethAddress);

    // Deploy Factory
    console.log("Deploying Factory...");
    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy(signer.address); // Set feeTo setter to deployer
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("Factory deployed to:", factoryAddress);

    // Deploy Router
    console.log("Deploying Router...");
    const Router = await ethers.getContractFactory("UniswapV2Router02");
    const router = await Router.deploy(factoryAddress, wethAddress);
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log("Router deployed to:", routerAddress);

    // Verify contracts
    console.log("\nVerifying contracts...");
    try {
        await hre.run("verify:verify", {
            address: wethAddress,
            constructorArguments: [],
        });
        console.log("WETH verified");
    } catch (error) {
        console.error("Error verifying WETH:", error.message);
    }

    try {
        await hre.run("verify:verify", {
            address: factoryAddress,
            constructorArguments: [signer.address],
        });
        console.log("Factory verified");
    } catch (error) {
        console.error("Error verifying Factory:", error.message);
    }

    try {
        await hre.run("verify:verify", {
            address: routerAddress,
            constructorArguments: [factoryAddress, wethAddress],
        });
        console.log("Router verified");
    } catch (error) {
        console.error("Error verifying Router:", error.message);
    }

    console.log("\nUniswap V2 Deployment Complete!");
    console.log("WETH:", wethAddress);
    console.log("Factory:", factoryAddress);
    console.log("Router:", routerAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
