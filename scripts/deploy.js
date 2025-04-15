const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy test USDC
  console.log("Deploying test USDC...");
  const TestERC20 = await ethers.getContractFactory("TestERC20");
  const usdc = await TestERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("Test USDC deployed to:", usdcAddress);

  // Mint test USDC
  console.log("Minting test USDC...");
  const mintAmount = ethers.parseUnits("1000000", 6); // 1M USDC
  await usdc.mint(deployer.address, mintAmount);
  const balance = await usdc.balanceOf(deployer.address);
  console.log("USDC Balance:", ethers.formatUnits(balance, 6));

  // Deploy PathOptimizerV2
  console.log("Deploying PathOptimizerV2...");
  const PathOptimizer = await ethers.getContractFactory("PathOptimizerV2");
  const pathOptimizer = await PathOptimizer.deploy();
  await pathOptimizer.waitForDeployment();
  const pathOptimizerAddress = await pathOptimizer.getAddress();
  console.log("PathOptimizerV2 deployed to:", pathOptimizerAddress);

  // Deploy IntentParser
  console.log("Deploying IntentParser...");
  const IntentParser = await ethers.getContractFactory("IntentParser");
  const intentParser = await IntentParser.deploy();
  await intentParser.waitForDeployment();
  const intentParserAddress = await intentParser.getAddress();
  console.log("IntentParser deployed to:", intentParserAddress);

  // Deploy IntentProcessor
  console.log("Deploying IntentProcessor...");
  const IntentProcessor = await ethers.getContractFactory("IntentProcessor");
  const intentProcessor = await IntentProcessor.deploy(pathOptimizerAddress);
  await intentProcessor.waitForDeployment();
  const intentProcessorAddress = await intentProcessor.getAddress();
  console.log("IntentProcessor deployed to:", intentProcessorAddress);

  // Set up protocol addresses
  console.log("Setting up protocol addresses...");
  
  // Protocol addresses for Sepolia
  const uniswapV2Router = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008";
  const uniswapV3Router = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
  const oneInchRouter = "0x1111111254EEB25477B68fb85Ed929f73A960582";
  const curvePool = "0x98E5F5706897074a4664DD3a32eB80242d6E694B";
  const layerZeroEndpoint = "0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1";
  const hopBridge = "0x3E4a3a4796d16c0Cd582C382691998f7c06420B6";
  const stargateRouter = "0x7612Ae3D4A6d343159504e97773B2e8f51b4AB8b";
  
  try {
    // Enable Sepolia chain
    await intentProcessor.setSupportedChain(11155, true);
    console.log("Enabled Sepolia chain");

    // Enable DEXs
    await intentProcessor.setSupportedDEX(uniswapV2Router, true);
    await intentProcessor.setSupportedDEX(uniswapV3Router, true);
    await intentProcessor.setSupportedDEX(oneInchRouter, true);
    await intentProcessor.setSupportedDEX(curvePool, true);
    console.log("Enabled DEXs");

    // Set protocol addresses
    await intentProcessor.setProtocolAddresses(
      uniswapV2Router,    // Uniswap V2
      curvePool,          // Curve
      stargateRouter,     // Stargate
      hopBridge,          // Hop
      layerZeroEndpoint   // LayerZero
    );
    console.log("Set protocol addresses");
  } catch (error) {
    console.error("Error setting up protocol:", error);
  }

  // Wait for contract verifications
  console.log("Waiting for contract verifications...");
  
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Verifying contracts on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: pathOptimizerAddress,
        constructorArguments: [],
      });
      console.log("PathOptimizer verified");

      await hre.run("verify:verify", {
        address: intentProcessorAddress,
        constructorArguments: [pathOptimizerAddress],
      });
      console.log("IntentProcessor verified");

      await hre.run("verify:verify", {
        address: intentParserAddress,
        constructorArguments: [],
      });
      console.log("IntentParser verified");
    } catch (error) {
      console.error("Error during verification:", error);
    }
  }

  console.log("Deployment completed!");
  console.log("Contract Addresses:");
  console.log("PathOptimizer:", pathOptimizerAddress);
  console.log("IntentProcessor:", intentProcessorAddress);
  console.log("IntentParser:", intentParserAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
