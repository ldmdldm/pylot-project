// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IDexInterfaces.sol";

contract PathOptimizerV2 is Ownable, ReentrancyGuard {
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
        Route memory bestRoute;
        
        // Build route
        bestRoute.dexs = new address[](1);
        bestRoute.dexs[0] = 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008; // Uniswap V2 Sepolia
        
        bestRoute.chains = new uint16[](2);
        bestRoute.chains[0] = sourceChain;
        bestRoute.chains[1] = targetChain;
        
        bestRoute.bridges = new address[](1);
        bestRoute.bridges[0] = 0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1; // LayerZero Sepolia
        
        // Calculate costs
        bestRoute.estimatedGas = 150000; // Base gas estimate
        bestRoute.expectedOutput = calculateExpectedOutput(
            sourceToken,
            targetToken,
            amount,
            sourceChain,
            targetChain
        );
        
        return bestRoute;
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

    function updateChainGasPrice(uint16 chainId, uint256 gasPrice) external onlyOwner {
        chainGasPrices[chainId] = gasPrice;
    }
}
