const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("Testing deployed contracts...");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", await signer.getAddress());

    // Contract addresses
    const pathOptimizerAddress = "0xA2CE2025e0FA3Ed0E7f804D7e48Be8188f777c0C";
    const intentProcessorAddress = "0x49c3555f3D4A6D1c8B48a72c8Ed4dEf2111B4eFb";
    const intentParserAddress = "0x10A38dd335c497D90fD739536bC6796527D6283E";

    // DEX addresses
    const uniswapV2Router = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008";
    const uniswapV3Router = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
    const curvePool = "0x98E5F5706897074a4664DD3a32eB80242d6E694B";

    // Connect to contracts
    const pathOptimizer = await ethers.getContractAt("PathOptimizerV2", pathOptimizerAddress);
    const intentProcessor = await ethers.getContractAt("IntentProcessor", intentProcessorAddress);
    const intentParser = await ethers.getContractAt("IntentParser", intentParserAddress);

    // Test tokens on Sepolia
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
    const PYUSD = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // Sepolia PYUSD
    const amount = ethers.parseUnits("1", 6); // 1 USDC (6 decimals)

    // Check USDC balance
    const USDC_Contract = await ethers.getContractAt("IERC20", USDC);
    const balance = await USDC_Contract.balanceOf(await signer.getAddress());
    console.log("USDC Balance:", ethers.formatUnits(balance, 6));

    // Test IntentParser
    console.log("\nTesting IntentParser...");
    console.log("Setting up token symbols and chain names...");
    await intentParser.connect(signer).addTokenSymbol("USDC", USDC);
    await intentParser.connect(signer).addTokenSymbol("PYUSD", PYUSD);
    await intentParser.connect(signer).addChainName("Ethereum", 1);
    await intentParser.connect(signer).addChainName("Sepolia", 11155);
    console.log("Token symbols and chain names set");

    // Parse intent
    console.log("\nParsing intent...");
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

    console.log("\nTesting PathOptimizer...");
    try {
        // Setup protocol
        console.log("Setting up protocol...");
        
        // Enable chains
        await intentProcessor.connect(signer).setSupportedChain(11155, true);
        await intentProcessor.connect(signer).setSupportedChain(1, true);
        console.log("Enabled chains");

        // Enable DEXs
        console.log("Enabling DEXs...");
        await intentProcessor.connect(signer).setSupportedDEX(uniswapV2Router, true);
        await intentProcessor.connect(signer).setSupportedDEX(uniswapV3Router, true);
        await intentProcessor.connect(signer).setSupportedDEX(curvePool, true);
        console.log("DEXs enabled");

        // Set protocol addresses
        const layerZeroEndpoint = "0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1";
        const hopBridge = "0x3E4a3a4796d16c0Cd582C382691998f7c06420B6";
        const stargateRouter = "0x7612Ae3D4A6d343159504e97773B2e8f51b4AB8b";

        await intentProcessor.connect(signer).setProtocolAddresses(
            uniswapV2Router,    // Uniswap V2
            curvePool,          // Curve
            stargateRouter,     // Stargate
            hopBridge,          // Hop
            layerZeroEndpoint   // LayerZero
        );
        console.log("Set protocol addresses");

        // Set pool IDs
        await intentProcessor.connect(signer).setPoolId(USDC, 1);
        await intentProcessor.connect(signer).setPoolId(PYUSD, 2);
        console.log("Set pool IDs");

        // Set token indices for Curve
        await intentProcessor.connect(signer).setTokenIndex(USDC, 0);
        await intentProcessor.connect(signer).setTokenIndex(PYUSD, 1);
        console.log("Set token indices");

        // Set price feeds for PathOptimizer
        console.log("Setting up price feeds...");
        await pathOptimizer.connect(signer).updatePriceFeed(
            USDC,
            11155, // Sepolia
            ethers.parseUnits("1", 6), // $1
            ethers.parseUnits("1000000", 6) // $1M liquidity
        );
        await pathOptimizer.connect(signer).updatePriceFeed(
            PYUSD,
            11155, // Sepolia
            ethers.parseUnits("1", 6), // $1
            ethers.parseUnits("500000", 6) // $500k liquidity
        );
        await pathOptimizer.connect(signer).updateChainGasPrice(11155, ethers.parseUnits("20", "gwei"));
        console.log("Set price feeds and gas price");

        console.log("Finding optimal path for USDC -> PYUSD swap...");
        
        // Debug: Check if tokens are properly set up
        console.log("Checking price feeds...");
        const usdcPrice = await pathOptimizer.priceFeeds(USDC, 11155);
        const pyusdPrice = await pathOptimizer.priceFeeds(PYUSD, 11155);
        console.log("USDC price feed:", {
            price: usdcPrice.price.toString(),
            liquidity: usdcPrice.liquidity.toString()
        });
        console.log("PYUSD price feed:", {
            price: pyusdPrice.price.toString(),
            liquidity: pyusdPrice.liquidity.toString()
        });

        // Debug: Check DEX support
        console.log("Checking DEX support...");
        const uniV2Support = await intentProcessor.supportedDEXs(uniswapV2Router);
        const uniV3Support = await intentProcessor.supportedDEXs(uniswapV3Router);
        const curveSupport = await intentProcessor.supportedDEXs(curvePool);
        console.log("DEX support:", {
            UniswapV2: uniV2Support,
            UniswapV3: uniV3Support,
            Curve: curveSupport
        });

        console.log("Attempting to find optimal path...");
        const route = await pathOptimizer.findOptimalPath(
            USDC,
            PYUSD,
            amount,
            11155, // Sepolia
            11155  // Same chain for this test
        );
        console.log("Optimal route found:");
        console.log("- DEXs:", route.dexs);
        console.log("- Chains:", route.chains);
        console.log("- Bridges:", route.bridges);
        console.log("- Gas estimate:", route.estimatedGas.toString());
        console.log("- Expected output:", ethers.formatUnits(route.expectedOutput, 6));
    } catch (error) {
        console.error("Error testing PathOptimizer:", error.message);
    }

    console.log("\nTesting IntentProcessor...");
    try {
        // Generate a random intent ID
        const intentId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "address"],
                [Date.now(), await signer.getAddress()]
            )
        );

        console.log("Processing intent for USDC -> PYUSD swap...");
        // First approve USDC for IntentProcessor
        const USDC_Contract = await ethers.getContractAt("IERC20", USDC);
        await USDC_Contract.connect(signer).approve(intentProcessorAddress, amount);
        console.log("Approved USDC for IntentProcessor");

        const tx = await intentProcessor.connect(signer).processIntent(
            intentId,
            USDC,
            PYUSD,
            amount,
            11155 // Sepolia
        );
        console.log("Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Transaction confirmed!");
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check if intent was processed
        const status = await intentProcessor.intentStatus(intentId);
        console.log("Intent status:", ["Pending", "Processing", "Completed", "Failed"][status]);
    } catch (error) {
        console.error("Error testing IntentProcessor:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
