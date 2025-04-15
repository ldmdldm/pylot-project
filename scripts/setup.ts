import { ethers } from "hardhat";

async function main() {
  console.log("Setting up DEX configuration...");

  // Get DEX contract
  const DEX = await ethers.getContractFactory("IntentProcessor");
  const dex = await DEX.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

  // Set up protocol addresses
  console.log("Setting protocol addresses...");
  const tx1 = await dex.setProtocolAddresses(
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
    "0x0000000000000000000000000000000000000000", // Curve (not using)
    "0x0000000000000000000000000000000000000000", // Stargate (not using)
    "0x0000000000000000000000000000000000000000", // Hop (not using)
    "0x0000000000000000000000000000000000000000"  // LayerZero (not using)
  );
  await tx1.wait();
  console.log("Protocol addresses set");

  // Enable Uniswap DEX
  console.log("Enabling Uniswap DEX...");
  const tx2 = await dex.setSupportedDEX(
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    true
  );
  await tx2.wait();
  console.log("Uniswap DEX enabled");

  // Enable local chain
  console.log("Enabling local chain...");
  const tx3 = await dex.setSupportedChain(1337, true);
  await tx3.wait();
  console.log("Local chain enabled");

  console.log("DEX configuration completed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
