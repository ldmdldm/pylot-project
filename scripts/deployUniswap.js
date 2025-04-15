const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying Uniswap V2 contracts with account:", deployer.address);

    // Deploy WETH
    console.log("Deploying WETH...");
    const wethArtifact = require("@uniswap/v2-periphery/build/WETH9.json");
    const WETH = await ethers.getContractFactory(wethArtifact.abi, wethArtifact.bytecode);
    const weth = await WETH.deploy();
    await weth.deployed();
    console.log("WETH deployed to:", weth.address);

    // Deploy Factory
    console.log("Deploying Factory...");
    const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");
    const Factory = await ethers.getContractFactory(factoryArtifact.abi, factoryArtifact.bytecode);
    const factory = await Factory.deploy(deployer.address);
    await factory.deployed();
    console.log("Factory deployed to:", factory.address);

    // Deploy Router
    console.log("Deploying Router...");
    const routerArtifact = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
    const Router = await ethers.getContractFactory(routerArtifact.abi, routerArtifact.bytecode);
    const router = await Router.deploy(factory.address, weth.address);
    await router.deployed();
    console.log("Router deployed to:", router.address);

    // Deploy PYUSD
    console.log("Deploying PYUSD...");
    const pyusdArtifact = require("./artifacts/contracts/PYUSD.sol/PYUSD.json");
    const PYUSD = await ethers.getContractFactory(pyusdArtifact.abi, pyusdArtifact.bytecode);
    const pyusd = await PYUSD.deploy();
    await pyusd.deployed();
    console.log("PYUSD deployed to:", pyusd.address);

    // Create WETH/PYUSD pair
    console.log("Creating WETH/PYUSD pair...");
    await factory.createPair(weth.address, pyusd.address);
    const pairAddress = await factory.getPair(weth.address, pyusd.address);
    console.log("WETH/PYUSD pair created at:", pairAddress);

    // Add initial liquidity
    console.log("Adding initial liquidity...");

    // Wrap some ETH
    await weth.deposit({ value: ethers.utils.parseEther("1.0") });
    console.log("Wrapped 1 ETH to WETH");

    // Mint some PYUSD
    await pyusd.mint(deployer.address, ethers.utils.parseEther("1000"));
    console.log("Minted 1000 PYUSD");

    // Approve tokens
    await weth.approve(router.address, ethers.utils.parseEther("1.0"));
    await pyusd.approve(router.address, ethers.utils.parseEther("1000"));
    console.log("Approved tokens for router");

    // Add liquidity
    await router.addLiquidity(
        weth.address,
        pyusd.address,
        ethers.utils.parseEther("1.0"),
        ethers.utils.parseEther("1000"),
        0,
        0,
        deployer.address,
        Math.floor(Date.now() / 1000) + 300
    );
    console.log("Added initial liquidity");

    console.log("\nDeployment Summary:");
    console.log("WETH:", weth.address);
    console.log("Factory:", factory.address);
    console.log("Router:", router.address);
    console.log("PYUSD:", pyusd.address);
    console.log("WETH/PYUSD Pair:", pairAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
