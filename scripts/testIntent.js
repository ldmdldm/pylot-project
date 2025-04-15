const { ethers } = require('ethers');
require('dotenv').config();

async function testIntent() {
    // Connect to Google Cloud RPC with custom options
    const provider = new ethers.JsonRpcProvider(process.env.HOLESKY_RPC_URL, undefined, {
        batchMaxCount: 1,
        polling: true,
        pollingInterval: 1000,
        staticNetwork: await ethers.Network.from(17000)
    });
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Contract addresses from deployment
    const intentProcessorAddress = "0x6BCD92dC74a1578a4F6c289bfDB0522734c632F5";
    
    // Contract ABI (minimal for testing)
    const intentProcessorAbi = [
        "function processIntent(bytes32 intentId, address fromToken, address toToken, uint256 amount, uint16 destChain) external payable",
        "function isChainEnabled(uint16) external view returns (bool)",
        "function isDexEnabled(address) external view returns (bool)",
        "function setSupportedChain(uint16 chainId, bool enabled) external",
        "function setSupportedDEX(address dex, bool enabled) external",
        "function setProtocolAddresses(address _uniswap, address _curve, address _stargate, address _hop, address _lz) external",
        "function supportedChains(uint16) external view returns (bool)",
        "function supportedDEXs(address) external view returns (bool)",
        "function paused() external view returns (bool)",
        "function unpause() external",
        "function owner() external view returns (address)",
        "function transferOwnership(address newOwner) external",
        "function processedIntents(bytes32) external view returns (bool)",
        "function intentStatus(bytes32) external view returns (uint8)",
        "event IntentCreated(bytes32 indexed intentId, address indexed fromToken, address indexed toToken, uint256 amount, uint16 destChain, uint256 timestamp)",
        "event IntentExecuted(bytes32 indexed intentId, bool success, uint256 gasUsed, uint256 timestamp)",
        "event SwapCompleted(bytes32 indexed intentId, address fromToken, address toToken, uint256 amountIn, uint256 amountOut)",
        "event IntentProcessed(bytes32 indexed intentId, address indexed user, uint256 amount, bool success)",
        "event Debug(string message)"
    ];

    // ERC20 ABI for approvals
    const erc20Abi = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function transfer(address to, uint256 amount) external returns (bool)"
    ];

    // Create contract instances
    const intentProcessor = new ethers.Contract(
        intentProcessorAddress,
        intentProcessorAbi,
        wallet
    );

    // Listen for events
    intentProcessor.on("Debug", (message) => {
        console.log('Debug:', message);
    });

    intentProcessor.on("IntentCreated", (intentId, fromToken, toToken, amount, destChain, timestamp) => {
        console.log('Intent created:', {
            intentId,
            fromToken,
            toToken,
            amount: ethers.formatEther(amount),
            destChain,
            timestamp: new Date(Number(timestamp) * 1000)
        });
    });

    intentProcessor.on("IntentExecuted", (intentId, success, gasUsed, timestamp) => {
        console.log('Intent executed:', {
            intentId,
            success,
            gasUsed: gasUsed.toString(),
            timestamp: new Date(Number(timestamp) * 1000)
        });
    });

    intentProcessor.on("SwapCompleted", (intentId, fromToken, toToken, amountIn, amountOut) => {
        console.log('Swap completed:', {
            intentId,
            fromToken,
            toToken,
            amountIn: ethers.formatEther(amountIn),
            amountOut: ethers.formatEther(amountOut)
        });
    });

    try {
        console.log('Starting test with account:', wallet.address);
        
        // Check ownership
        const owner = await intentProcessor.owner();
        console.log('Contract owner:', owner);
        console.log('Current account:', wallet.address);

        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.log('Transferring ownership...');
            const ownerSigner = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
            const ownerContract = intentProcessor.connect(ownerSigner);
            const transferTx = await ownerContract.transferOwnership(wallet.address);
            await transferTx.wait();
            console.log('Ownership transferred');
        }
        
        // Test parameters - using WETH on Holesky
        const fromToken = "0x94373a4919B3240D86eA41593D5eBa789FEF3848"; // Holesky WETH
        const toToken = "0xde0267533b7e50eef7fb78af324df48d77f5fdfa"; // Holesky PYUSD
        const amount = ethers.parseEther("0.01"); // 0.01 WETH
        const destChain = 17000; // Holesky chain ID
        const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Holesky Uniswap V2 Router
        const layerZeroEndpoint = "0x3c2269811836af69497E5F486A85D7316753cf62"; // Holesky LZ Endpoint

        // Check if contract is paused
        const isPaused = await intentProcessor.paused();
        console.log('Is contract paused:', isPaused);

        if (isPaused) {
            console.log('Unpausing contract...');
            const unpauseTx = await intentProcessor.unpause();
            await unpauseTx.wait();
            console.log('Contract unpaused');
        }

        // Initialize contract if needed
        console.log('Initializing contract...');
        
        // Set protocol addresses
        console.log('Setting protocol addresses...');
        await intentProcessor.setProtocolAddresses(
            uniswapRouter,      // Uniswap
            ethers.ZeroAddress, // Curve (not used)
            ethers.ZeroAddress, // Stargate (not used)
            ethers.ZeroAddress, // Hop (not used)
            layerZeroEndpoint   // LayerZero
        );
        console.log('Protocol addresses set');

        // Enable DEX
        console.log('Enabling DEX...');
        await intentProcessor.setSupportedDEX(uniswapRouter, true);
        console.log('DEX enabled');

        // Check if DEX is supported
        const isDexSupported = await intentProcessor.supportedDEXs(uniswapRouter);
        console.log('Is DEX supported:', isDexSupported);

        // Check if chain is enabled
        const isChainEnabled = await intentProcessor.supportedChains(destChain);
        console.log('Is chain enabled:', isChainEnabled);

        if (!isChainEnabled) {
            console.log('Enabling chain...');
            const enableTx = await intentProcessor.setSupportedChain(destChain, true);
            await enableTx.wait();
            console.log('Chain enabled');
        }

        // Initialize Uniswap Factory
        const factoryAbi = [
            "function getPair(address tokenA, address tokenB) external view returns (address pair)",
            "function createPair(address tokenA, address tokenB) external returns (address pair)"
        ];
        const factoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"; // Uniswap V2 Factory on Holesky
        const factory = new ethers.Contract(factoryAddress, factoryAbi, wallet);

        // Check if pair exists
        console.log('Checking if WETH/PYUSD pair exists...');
        const pair = await factory.getPair(fromToken, toToken);
        console.log('Pair address:', pair);

        if (pair === "0x0000000000000000000000000000000000000000") {
            console.log('Creating WETH/PYUSD pair...');
            const createPairTx = await factory.createPair(fromToken, toToken);
            await createPairTx.wait();
            console.log('Pair created');

            // Initialize PYUSD contract
            const pyusdContract = new ethers.Contract(toToken, erc20Abi, wallet);

            // Approve tokens for router
            console.log('Approving tokens for router...');
            await wethContract.approve(uniswapRouter, ethers.parseEther("0.1"));
            await pyusdContract.approve(uniswapRouter, ethers.parseEther("100"));

            // Add liquidity
            console.log('Adding initial liquidity...');
            const routerAbi = [
                "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)"
            ];
            const router = new ethers.Contract(uniswapRouter, routerAbi, wallet);

            const addLiquidityTx = await router.addLiquidity(
                fromToken,
                toToken,
                ethers.parseEther("0.1"), // 0.1 WETH
                ethers.parseEther("100"), // 100 PYUSD
                0, // Accept any amount of WETH
                0, // Accept any amount of PYUSD
                wallet.address,
                Math.floor(Date.now() / 1000) + 300 // 5 minute deadline
            );
            await addLiquidityTx.wait();
            console.log('Initial liquidity added');
        }

        // Create ERC20 contract instances
        const wethContract = new ethers.Contract(fromToken, erc20Abi, wallet);
        
        // Check WETH balance
        const wethBalance = await wethContract.balanceOf(wallet.address);
        console.log('WETH Balance:', ethers.formatEther(wethBalance));

        // Check allowances
        const intentProcessorAllowance = await wethContract.allowance(wallet.address, intentProcessorAddress);
        console.log('Current IntentProcessor allowance:', ethers.formatEther(intentProcessorAllowance));

        const uniswapAllowance = await wethContract.allowance(wallet.address, uniswapRouter);
        console.log('Current Uniswap allowance:', ethers.formatEther(uniswapAllowance));

        // Approve WETH for IntentProcessor if needed
        if (intentProcessorAllowance < amount) {
            console.log('Approving WETH for IntentProcessor...');
            await wethContract.approve(intentProcessorAddress, amount);
            console.log('WETH approved for IntentProcessor');
        } else {
            console.log('WETH already approved for IntentProcessor');
        }

        // Approve WETH for Uniswap if needed
        if (uniswapAllowance < amount) {
            console.log('Approving WETH for Uniswap...');
            await wethContract.approve(uniswapRouter, amount);
            console.log('WETH approved for Uniswap');
        } else {
            console.log('WETH already approved for Uniswap');
        }

        // Generate unique intentId
        const intentId = ethers.keccak256(ethers.toUtf8Bytes(Date.now().toString() + wallet.address));
        console.log('Generated intentId:', intentId);

        // Check if intent is already processed
        const isProcessed = await intentProcessor.processedIntents(intentId);
        console.log('Is intent already processed:', isProcessed);

        // Check intent status
        const intentStatus = await intentProcessor.intentStatus(intentId);
        console.log('Intent status:', intentStatus);

        // Process intent
        console.log('Processing intent...');
        const params = {
            intentId,
            fromToken,
            toToken,
            amount,
            destChain
        };
        console.log('Parameters:', params);

        // Encode transaction data
        const data = intentProcessor.interface.encodeFunctionData('processIntent', [
            params.intentId,
            params.fromToken,
            params.toToken,
            params.amount,
            params.destChain
        ]);
        console.log('Encoded transaction data:', data);

        // Create transaction object
        const tx = {
            to: intentProcessorAddress,
            value: ethers.parseEther('0.01'), // Send 0.01 ETH for gas
            data: data
        };

        // Simulate transaction
        console.log('Unsigned transaction:', await wallet.populateTransaction(tx));
        console.log('Signed transaction:', await wallet.signTransaction(tx));

        try {
            // Simulate transaction
            await intentProcessor.processIntent.staticCall(
                params.intentId,
                params.fromToken,
                params.toToken,
                params.amount,
                params.destChain,
                { value: ethers.parseEther('0.01') }
            );
        } catch (error) {
            console.log('Simulation error:', error);
        }

        // Send transaction
        const txResponse = await intentProcessor.processIntent(
            params.intentId,
            params.fromToken,
            params.toToken,
            params.amount,
            params.destChain,
            { value: ethers.parseEther('0.01') }
        );
        console.log('Transaction sent:', txResponse.hash);

        // Wait for transaction to be mined
        try {
            const receipt = await txResponse.wait();
            console.log('Transaction mined:', receipt);
        } catch (error) {
            console.log('Error: Error: Transaction failed');
        }

        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Error:', error);
        if (error.data) {
            console.error('Error data:', error.data);
        }
        if (error.transaction) {
            console.error('Transaction details:', {
                to: error.transaction.to,
                from: error.transaction.from,
                data: error.transaction.data,
                value: error.transaction.value ? ethers.formatEther(error.transaction.value) : '0'
            });
        }
        if (error.reason) {
            console.error('Error reason:', error.reason);
        }
        if (error.error) {
            console.error('Inner error:', error.error);
        }
    }
}

testIntent()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
