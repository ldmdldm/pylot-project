// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IDexInterfaces.sol";

contract PathOptimizer is Ownable, ReentrancyGuard {
    struct Route {
        address[] dexs;
        uint16[] chains;
        address[] bridges;
        uint256 estimatedGas;
        uint256 expectedOutput;
    }

    struct PriceData {
        address token;
        uint256 price;
        uint256 liquidity;
    }

    mapping(address => mapping(uint16 => PriceData)) public priceFeeds;
    mapping(uint16 => uint256) public chainGasPrices;

    event OptimalPathFound(
        bytes32 indexed intentId,
        address[] dexs,
        uint16[] chains,
        uint256 estimatedCost
    );

    function findOptimalPath(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 sourceChain,
        uint16 targetChain
    ) external view returns (Route memory) {
        // For testing, return a direct path
        Route memory bestRoute = getDirectPath(
            sourceToken,
            targetToken,
            amount,
            sourceChain,
            targetChain
        );

        return bestRoute;
    }

    struct DexQuote {
        address dex;
        uint256 outputAmount;
        uint256 gasEstimate;
        uint256 fee;
    }

    struct BridgeQuote {
        address bridge;
        uint256 fee;
        uint256 estimatedTime;
        uint256 minAmount;
        uint256 maxAmount;
    }

    mapping(address => mapping(bytes32 => DexQuote)) public dexQuotes;
    mapping(address => mapping(uint16 => BridgeQuote)) public bridgeQuotes;
    
    function calculatePathCost(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 sourceChain,
        uint16 targetChain
    ) internal view returns (uint256) {
        uint256 bestTotalCost = type(uint256).max;
        
        // Get all viable DEXs for the token pair
        address[] memory viableDexs = getViableDexs(sourceToken, targetToken, amount);
        
        // Get all viable bridges if cross-chain
        address[] memory viableBridges = new address[](0);
        if (sourceChain != targetChain) {
            viableBridges = getViableBridges(sourceToken, amount, sourceChain, targetChain);
        }
        
        // Calculate costs for each possible path
        for (uint256 i = 0; i < viableDexs.length; i++) {
            DexQuote memory dexQuote = getDexQuote(viableDexs[i], sourceToken, targetToken, amount);
            
            uint256 pathCost = dexQuote.fee;
            pathCost += (chainGasPrices[sourceChain] * dexQuote.gasEstimate);
            
            if (sourceChain != targetChain) {
                for (uint256 j = 0; j < viableBridges.length; j++) {
                    BridgeQuote memory bridgeQuote = getBridgeQuote(
                        viableBridges[j],
                        sourceToken,
                        amount,
                        sourceChain,
                        targetChain
                    );
                    
                    uint256 totalCost = pathCost + bridgeQuote.fee;
                    totalCost += (chainGasPrices[targetChain] * 200000); // Bridge gas estimate
                    
                    if (totalCost < bestTotalCost) {
                        bestTotalCost = totalCost;
                    }
                }
            } else if (pathCost < bestTotalCost) {
                bestTotalCost = pathCost;
            }
        }
        
        return bestTotalCost;
    }

    function calculateSplitPathCost(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 sourceChain,
        uint16 targetChain
    ) internal view returns (uint256) {
        uint256 bestCost = type(uint256).max;
        
        // Try splitting through intermediate tokens (e.g., USDC, WETH)
        address[] memory intermediateTokens = getIntermediateTokens();
        
        for (uint i = 0; i < intermediateTokens.length; i++) {
            address midToken = intermediateTokens[i];
            
            // Calculate cost for first hop
            uint256 firstHopCost = calculatePathCost(
                sourceToken,
                midToken,
                amount,
                sourceChain,
                sourceChain
            );
            
            // Calculate cost for second hop
            uint256 estimatedMidAmount = (amount * priceFeeds[sourceToken][sourceChain].price) / priceFeeds[midToken][sourceChain].price;
            uint256 secondHopCost = calculatePathCost(
                midToken,
                targetToken,
                estimatedMidAmount,
                sourceChain,
                targetChain
            );
            
            uint256 totalCost = firstHopCost + secondHopCost;
            if (totalCost < bestCost) {
                bestCost = totalCost;
            }
        }
        
        return bestCost;
    }

    function getDirectPath(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 sourceChain,
        uint16 targetChain
    ) internal view returns (Route memory) {
        Route memory route;
        
        // Get viable DEXs and bridges
        address[] memory viableDexs = getViableDexs(sourceToken, targetToken, amount);
        address[] memory viableBridges = new address[](0);
        if (sourceChain != targetChain) {
            viableBridges = getViableBridges(sourceToken, amount, sourceChain, targetChain);
        }
        
        // Find best DEX based on output amount and fees
        address bestDex;
        uint256 bestOutput = 0;
        for (uint i = 0; i < viableDexs.length; i++) {
            DexQuote memory quote = getDexQuote(viableDexs[i], sourceToken, targetToken, amount);
            if (quote.outputAmount > bestOutput) {
                bestOutput = quote.outputAmount;
                bestDex = viableDexs[i];
            }
        }
        
        // Find best bridge if cross-chain
        address bestBridge;
        uint256 bestBridgeCost = type(uint256).max;
        if (sourceChain != targetChain) {
            for (uint i = 0; i < viableBridges.length; i++) {
                BridgeQuote memory quote = getBridgeQuote(
                    viableBridges[i],
                    sourceToken,
                    amount,
                    sourceChain,
                    targetChain
                );
                if (quote.fee < bestBridgeCost) {
                    bestBridgeCost = quote.fee;
                    bestBridge = viableBridges[i];
                }
            }
        }
        
        // Build route
        route.dexs = new address[](1);
        route.dexs[0] = bestDex;
        
        route.chains = new uint16[](2);
        route.chains[0] = sourceChain;
        route.chains[1] = targetChain;
        
        if (bestBridge != address(0)) {
            route.bridges = new address[](1);
            route.bridges[0] = bestBridge;
        } else {
            route.bridges = new address[](0);
        }
        
        // Set estimates
        DexQuote memory bestDexQuote = getDexQuote(bestDex, sourceToken, targetToken, amount);
        route.estimatedGas = bestDexQuote.gasEstimate;
        route.expectedOutput = bestDexQuote.outputAmount;
        
        if (bestBridge != address(0)) {
            BridgeQuote memory bestBridgeQuote = getBridgeQuote(
                bestBridge,
                sourceToken,
                amount,
                sourceChain,
                targetChain
            );
            route.estimatedGas += 200000; // Add bridge gas
            route.expectedOutput = (route.expectedOutput * (10000 - bestBridgeQuote.fee)) / 10000;
        }
        
        return route;
    }

    function getSplitPath(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 sourceChain,
        uint16 targetChain
    ) internal view returns (Route memory) {
        Route memory route;
        address bestMidToken;
        uint256 bestCost = type(uint256).max;
        
        // Try splitting through intermediate tokens
        address[] memory intermediateTokens = getIntermediateTokens();
        
        for (uint i = 0; i < intermediateTokens.length; i++) {
            address midToken = intermediateTokens[i];
            uint256 totalCost = calculateSplitPathCost(
                sourceToken,
                targetToken,
                amount,
                sourceChain,
                targetChain
            );
            
            if (totalCost < bestCost) {
                bestCost = totalCost;
                bestMidToken = midToken;
            }
        }
        
        // Build route with best intermediate token
        route.dexs = new address[](2);
        route.chains = new uint16[](3);
        route.bridges = new address[](2);
        
        // Set DEXs
        route.dexs[0] = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D; // Uniswap V2
        route.dexs[1] = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D; // Uniswap V2
        
        // Set chains
        route.chains[0] = sourceChain;
        route.chains[1] = sourceChain; // Mid-point stays on same chain
        route.chains[2] = targetChain;
        
        // Set bridges
        route.bridges[0] = 0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1; // LayerZero Sepolia
        route.bridges[1] = 0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1; // LayerZero Sepolia
        
        // Calculate costs
        route.estimatedGas = 800000; // Higher gas estimate for split path
        route.expectedOutput = calculateExpectedOutput(
            sourceToken,
            targetToken,
            amount,
            sourceChain,
            targetChain
        );
        
        return route;
    }

    function getViableDexs(address fromToken, address toToken, uint256 amount) internal view returns (address[] memory) {
        // Get all supported DEXs
        address[] memory allDexs = new address[](3);
        allDexs[0] = 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008; // Uniswap V2 Sepolia
        allDexs[1] = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E; // Uniswap V3 Sepolia
        allDexs[2] = 0x98E5F5706897074a4664DD3a32eB80242d6E694B; // Curve Sepolia

        // For testing, return all DEXs as viable
        address[] memory viableDexs = new address[](1);
        viableDexs[0] = allDexs[0]; // Use Uniswap V2 for now
        
        return viableDexs;
    }
    
    function hasLiquidity(address dex, address fromToken, address toToken, uint256 amount) internal view returns (bool) {
        // For testing, assume Uniswap V2 always has liquidity
        if (dex == 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008) { // Uniswap V2
            return true;
        }
        return false;
    }

    function getPath(address fromToken, address toToken) internal pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = fromToken;
        path[1] = toToken;
        return path;
    }

    
    function getViableBridges(address token, uint256 amount, uint16 sourceChain, uint16 targetChain) internal view returns (address[] memory) {
        // Get all supported bridges
        address[] memory allBridges = new address[](3);
        allBridges[0] = 0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1; // LayerZero Sepolia
        allBridges[1] = 0x3E4a3a4796d16c0Cd582C382691998f7c06420B6; // Hop Sepolia
        allBridges[2] = 0x7612Ae3D4A6d343159504e97773B2e8f51b4AB8b; // Stargate Sepolia

        uint256 viableCount = 0;
        for (uint256 i = 0; i < allBridges.length; i++) {
            BridgeQuote memory quote = getBridgeQuote(allBridges[i], token, amount, sourceChain, targetChain);
            if (isBridgeViable(quote, amount)) {
                viableCount++;
            }
        }

        // Create array with exact size needed
        address[] memory viableBridges = new address[](viableCount);
        uint256 j = 0;
        for (uint256 i = 0; i < allBridges.length; i++) {
            BridgeQuote memory quote = getBridgeQuote(allBridges[i], token, amount, sourceChain, targetChain);
            if (isBridgeViable(quote, amount)) {
                viableBridges[j] = allBridges[i];
                j++;
            }
        }
        
        return viableBridges;
    }
    
    function isBridgeViable(BridgeQuote memory quote, uint256 amount) internal pure returns (bool) {
        return amount >= quote.minAmount && amount <= quote.maxAmount;
    }
    
    function getDexQuote(address dex, address fromToken, address toToken, uint256 amount) internal view returns (DexQuote memory) {
        DexQuote memory quote;
        quote.dex = dex;
        
        // For testing, return fixed output amount
        quote.outputAmount = amount * 99 / 100; // 1% slippage
        
        // Set gas estimates based on DEX type
        if (dex == 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008) { // Uniswap V2 Sepolia
            quote.gasEstimate = 150000;
            quote.fee = 30; // 0.3%
        } else if (dex == 0x1111111254EEB25477B68fb85Ed929f73A960582) { // 1inch Sepolia
            quote.gasEstimate = 180000;
            quote.fee = 10; // 0.1%
        } else if (dex == 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E) { // Uniswap V3 Sepolia
            quote.gasEstimate = 165000;
            quote.fee = 30; // 0.3%
        }
        
        return quote;
    }
    
    function getBridgeQuote(address bridge, address token, uint256 amount, uint16 sourceChain, uint16 targetChain) internal view returns (BridgeQuote memory) {
        BridgeQuote memory quote;
        quote.bridge = bridge;
        
        if (bridge == 0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1) { // LayerZero Sepolia
            quote.fee = 20; // 0.2%
            quote.estimatedTime = 1800; // 30 minutes
            quote.minAmount = 1e18; // 1 token
            quote.maxAmount = 1000000e18; // 1M tokens
        } else if (bridge == 0x3E4a3a4796d16c0Cd582C382691998f7c06420B6) { // Hop Sepolia
            quote.fee = 15; // 0.15%
            quote.estimatedTime = 1200; // 20 minutes
            quote.minAmount = 0.1e18; // 0.1 token
            quote.maxAmount = 500000e18; // 500k tokens
        } else if (bridge == 0x7612Ae3D4A6d343159504e97773B2e8f51b4AB8b) { // Stargate Sepolia
            quote.fee = 25; // 0.25%
            quote.estimatedTime = 2400; // 40 minutes
            quote.minAmount = 0.5e18; // 0.5 token
            quote.maxAmount = 2000000e18; // 2M tokens
        }
        
        return quote;
    }

    function updateChainGasPrice(uint16 chainId, uint256 gasPrice) external onlyOwner {
        chainGasPrices[chainId] = gasPrice;
    }

    function getIntermediateTokens() internal pure returns (address[] memory) {
        address[] memory tokens = new address[](2);
        tokens[0] = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9; // WETH Sepolia
        tokens[1] = 0xda9d4f9b69ac6C22e444eD9aF0CfC043b7a7f53f; // USDC Sepolia
        return tokens;
    }

    function calculateExpectedOutput(
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 sourceChain,
        uint16 targetChain
    ) internal view returns (uint256) {
        PriceData memory sourceData = priceFeeds[sourceToken][sourceChain];
        PriceData memory targetData = priceFeeds[targetToken][targetChain];
        
        require(sourceData.price > 0, "Source token price not available");
        require(targetData.price > 0, "Target token price not available");
        
        // Calculate expected output based on prices
        uint256 expectedOutput = (amount * sourceData.price) / targetData.price;
        
        // Apply estimated slippage (5%)
        expectedOutput = expectedOutput * 95 / 100;
        
        return expectedOutput;
    }

    function updatePriceFeed(
        address token,
        uint16 chainId,
        uint256 price,
        uint256 liquidity
    ) external onlyOwner {
        priceFeeds[token][chainId] = PriceData(token, price, liquidity);
    }
}
