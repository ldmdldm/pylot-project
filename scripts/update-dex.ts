import { ethers } from "hardhat";

async function main() {
  console.log("Updating DEX configuration...");

  // Get DEX contract
  const DEX = await ethers.getContractFactory("IntentProcessor");
  const dex = await DEX.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

  // Get Uniswap addresses
  const uniswap = require("../frontend/src/uniswap.json");

  // Update protocol addresses with correct Uniswap router
  console.log("Setting protocol addresses...");
  const tx1 = await dex.setProtocolAddresses(
    uniswap.ROUTER,
    "0x0000000000000000000000000000000000000000", // Curve (not using)
    "0x0000000000000000000000000000000000000000", // Stargate (not using)
    "0x0000000000000000000000000000000000000000", // Hop (not using)
    "0x0000000000000000000000000000000000000000"  // LayerZero (not using)
  );
  await tx1.wait();
  console.log("Protocol addresses updated");

  // Enable Uniswap DEX with correct router
  console.log("Enabling Uniswap DEX...");
  const tx2 = await dex.setSupportedDEX(uniswap.ROUTER, true);
  await tx2.wait();
  console.log("Uniswap DEX enabled");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
