const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Using account:", await signer.getAddress());

    // Contract addresses
    const pathOptimizerAddress = "0x74dF18462Bd8dD4Bc080806592a645A168EA1B9d";
    const intentProcessorAddress = "0x3Bfd47Bf1554251326a8EeD9945f2C3aC3811183";
    const intentParserAddress = "0xd4Cc11736D839cAbb625d741CAD191ff8228d63F";

    // Get contract instances
    const pathOptimizer = await ethers.getContractAt("PathOptimizer", pathOptimizerAddress);
    const intentProcessor = await ethers.getContractAt("IntentProcessor", intentProcessorAddress);
    const intentParser = await ethers.getContractAt("IntentParser", intentParserAddress);

    // Test tokens on Sepolia
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    const PYUSD = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

    // Debug: Check USDC balance
    const USDC_Contract = await ethers.getContractAt("IERC20", USDC);
    const balance = await USDC_Contract.balanceOf(await signer.getAddress());
    console.log("USDC Balance:", ethers.formatUnits(balance, 6));

    // Step 1: Set up price feeds
    console.log("\nStep 1: Setting up price feeds...");
    try {
        // Set price feeds for USDC
        console.log("Setting USDC price feed...");
        await pathOptimizer.connect(signer).updatePriceFeed(
            USDC,
            11155,
            ethers.parseUnits("1", 6), // $1 price
            ethers.parseUnits("1000000", 6) // $1M liquidity
        );
        const usdcPrice = await pathOptimizer.priceFeeds(USDC, 11155);
        console.log("USDC price feed:", {
            price: usdcPrice.price.toString(),
            liquidity: usdcPrice.liquidity.toString()
        });

        // Set price feeds for PYUSD
        console.log("\nSetting PYUSD price feed...");
        await pathOptimizer.connect(signer).updatePriceFeed(
            PYUSD,
            11155,
            ethers.parseUnits("1", 6), // $1 price
            ethers.parseUnits("500000", 6) // $500k liquidity
        );
        const pyusdPrice = await pathOptimizer.priceFeeds(PYUSD, 11155);
        console.log("PYUSD price feed:", {
            price: pyusdPrice.price.toString(),
            liquidity: pyusdPrice.liquidity.toString()
        });
    } catch (error) {
        console.error("Error setting price feeds:", error);
        return;
    }

    // Step 2: Find optimal path
    console.log("\nStep 2: Finding optimal path...");
    try {
        const path = await pathOptimizer.findOptimalPath(
            USDC,
            PYUSD,
            ethers.parseUnits("10", 6),
            11155,
            11155
        );
        console.log("Optimal path:", {
            dexs: path.dexs,
            bridges: path.bridges,
            expectedOutput: path.expectedOutput.toString(),
            estimatedGas: path.estimatedGas.toString()
        });
    } catch (error) {
        console.error("Error finding optimal path:", error);
        return;
    }

    // Step 3: Parse intent
    console.log("\nStep 3: Parsing intent...");
    try {
        const tx = await intentParser.connect(signer).parseIntent(
            "Swap USDC to PYUSD on Sepolia",
            ethers.parseUnits("10", 6),
            ethers.parseUnits("0.5", 6), // 0.5% max slippage
            Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline
        );
        console.log("Waiting for transaction to be mined...");
        const receipt = await tx.wait();
        
        // Get the IntentParsed event
        const event = receipt.logs.find(log => {
            try {
                return intentParser.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                }).name === 'IntentParsed';
            } catch (e) {
                return false;
            }
        });
        
        if (!event) {
            throw new Error("IntentParsed event not found");
        }
        
        const parsedEvent = intentParser.interface.parseLog({
            topics: event.topics,
            data: event.data
        });
        
        const intentId = parsedEvent.args.intentId;
        console.log("Intent parsed with ID:", intentId);

        // Get intent details
        const intent = await intentParser.getIntent(intentId);
        console.log("Intent details:", {
            sourceToken: intent.sourceToken,
            targetToken: intent.targetToken,
            amount: intent.amount.toString(),
            sourceChain: intent.sourceChain,
            targetChain: intent.targetChain,
            maxSlippage: intent.maxSlippage.toString(),
            deadline: intent.deadline.toString()
        });

        // Step 4: Process intent
        console.log("\nStep 4: Processing intent...");
        try {
            // Approve USDC for IntentProcessor
            console.log("Approving USDC...");
            const approveTx = await USDC_Contract.connect(signer).approve(
                intentProcessorAddress,
                ethers.parseUnits("10", 6)
            );
            await approveTx.wait();
            console.log("USDC approved");

            // Process intent
            console.log("Processing intent...");
            const processTx = await intentProcessor.connect(signer).processIntent(intentId);
            const processReceipt = await processTx.wait();
            console.log("Intent processed:", processReceipt.hash);
        } catch (error) {
            console.error("Error processing intent:", error);
            return;
        }
    } catch (error) {
        console.error("Error parsing intent:", error);
        return;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
