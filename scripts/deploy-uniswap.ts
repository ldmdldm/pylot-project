import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Uniswap contracts...");

  // Deploy WETH
  const WETH = await ethers.getContractFactory("WETH9");
  const weth = await WETH.deploy();
  await weth.waitForDeployment();
  console.log("WETH deployed to:", await weth.getAddress());

  // Deploy Factory
  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(await weth.getAddress());
  await factory.waitForDeployment();
  console.log("Factory deployed to:", await factory.getAddress());

  // Deploy Router
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(await factory.getAddress(), await weth.getAddress());
  await router.waitForDeployment();
  console.log("Router deployed to:", await router.getAddress());

  // Write deployment addresses to a file
  const fs = require("fs");
  const deployments = {
    WETH: await weth.getAddress(),
    FACTORY: await factory.getAddress(),
    ROUTER: await router.getAddress(),
  };
  fs.writeFileSync(
    "frontend/src/uniswap.json",
    JSON.stringify(deployments, null, 2)
  );
  console.log("Uniswap addresses saved to frontend/src/uniswap.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
