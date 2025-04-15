import { ethers } from "hardhat";

async function main() {
  console.log("Deploying contracts...");

  // Real PYUSD token address
  const PYUSD_ADDRESS = "0x6c3ea9036406c1b6e193a4c6793245c759f32fde";

  // Deploy PathOptimizer
  console.log("Deploying PathOptimizer...");
  const PathOptimizer = await ethers.getContractFactory("PathOptimizer");
  const pathOptimizer = await PathOptimizer.deploy();
  await pathOptimizer.waitForDeployment();
  console.log("PathOptimizer deployed to:", await pathOptimizer.getAddress());

  // Deploy DEX with PathOptimizer
  console.log("Deploying IntentProcessor...");
  const DEX = await ethers.getContractFactory("IntentProcessor");
  const dex = await DEX.deploy(await pathOptimizer.getAddress());
  await dex.waitForDeployment();
  console.log("IntentProcessor deployed to:", await dex.getAddress());

  // Write deployment addresses to a file
  const fs = require("fs");
  const deployments = {
    PYUSD: PYUSD_ADDRESS,
    DEX: await dex.getAddress(),
  };
  fs.writeFileSync(
    "frontend/src/deployments.json",
    JSON.stringify(deployments, null, 2)
  );
  console.log("Deployment addresses saved to frontend/src/deployments.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
