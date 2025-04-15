import { ethers } from "hardhat";

async function main() {
  console.log("Deploying PYUSD token...");

  // Deploy PYUSD token
  const PYUSD = await ethers.getContractFactory("PYUSD");
  const pyusd = await PYUSD.deploy();
  await pyusd.waitForDeployment();
  const pyusdAddress = await pyusd.getAddress();
  console.log("PYUSD deployed to:", pyusdAddress);

  // Update deployments.json
  const fs = require("fs");
  const path = require("path");
  const deploymentsPath = path.join(__dirname, "../frontend/src/deployments.json");
  
  let deployments = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  }
  
  deployments.PYUSD = pyusdAddress;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Updated deployments.json with PYUSD address");

  // Mint some tokens to the deployer
  const [deployer] = await ethers.getSigners();
  const mintAmount = ethers.parseEther("1000000"); // 1M PYUSD
  await pyusd.mint(deployer.address, mintAmount);
  console.log("Minted", ethers.formatEther(mintAmount), "PYUSD to", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
