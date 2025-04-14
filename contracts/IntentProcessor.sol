// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PathOptimizer.sol";
import "./interfaces/IDexInterfaces.sol";

contract IntentProcessor is ReentrancyGuard, Pausable, Ownable {
    address public constant PYUSD = 0x610178dA211FEF7D417bC0e6FeD39F05609AD788; // Local PYUSD address
    
    // Protocol addresses
    address public uniswapRouter;
    address public curvePool;
    address public stargateRouter;
    address public hopBridge;
    address public layerZeroEndpoint;
    PathOptimizer public pathOptimizer;
    
    // Protocol states
    mapping(bytes32 => bool) public processedIntents;
    mapping(bytes32 => IntentStatus) public intentStatus;
    mapping(uint16 => bool) public supportedChains;
    mapping(address => bool) public supportedDEXs;
    
    enum IntentStatus {
        Pending,
        Processing,
        Completed,
        Failed
    }
    
    // Events
    event IntentProcessed(
        bytes32 indexed intentId,
        address indexed user,
        uint256 amount,
        bool success
    );
    
    event BridgeInitiated(
        bytes32 indexed intentId,
        uint16 destChain,
        address recipient,
        uint256 amount
    );
    
    event SwapCompleted(
        bytes32 indexed intentId,
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // Events for Google Cloud Analytics
    event IntentCreated(
        bytes32 indexed intentId,
        address indexed fromToken,
        address indexed toToken,
        uint256 amount,
        uint16 destChain,
        uint256 timestamp
    );

    event IntentExecuted(
        bytes32 indexed intentId,
        bool success,
        uint256 gasUsed,
        uint256 timestamp
    );

    event OptimizationSuggestion(
        bytes32 indexed intentId,
        string suggestion,
        uint256 potentialSavings
    );

    event Debug(string message);

    constructor(address _pathOptimizer) {
        _transferOwnership(msg.sender);
        pathOptimizer = PathOptimizer(_pathOptimizer);
    }
    
    // Cross-chain transaction tracking
    mapping(bytes32 => bool) public pendingCrossChainTx;
    mapping(bytes32 => uint256) public crossChainAmounts;
    
    function processIntent(
        bytes32 intentId,
        address fromToken,
        address toToken,
        uint256 amount,
        uint16 destChain
    ) external payable nonReentrant whenNotPaused {
        require(!processedIntents[intentId], "Intent already processed");
        require(supportedChains[destChain], "Unsupported chain");
        require(fromToken != address(0), "Invalid fromToken");
        require(toToken != address(0), "Invalid toToken");
        require(amount > 0, "Invalid amount");

        // Record intent creation for analytics
        emit IntentCreated(
            intentId,
            fromToken,
            toToken,
            amount,
            destChain,
            block.timestamp
        );

        // Simulate gas usage for analytics
        uint256 startGas = gasleft();

        // Set intent status to Processing
        intentStatus[intentId] = IntentStatus.Processing;

        // Check if we need to swap
        if (fromToken != toToken) {
            require(supportedDEXs[uniswapRouter], "Uniswap router not supported");
            // Pre-approve the router
            try IERC20(fromToken).approve(uniswapRouter, amount) {
                emit Debug("Router approved");
            } catch Error(string memory reason) {
                emit Debug(string.concat("Router approval failed: ", reason));
                revert(string.concat("Router approval failed: ", reason));
            }
        }

        // Get optimal path
        PathOptimizer.Route memory route = pathOptimizer.findOptimalPath(
            fromToken,
            toToken,
            amount,
            11155, // Sepolia
            destChain
        );
        
        // Validate route
        require(route.dexs.length > 0, "No viable route found");
        require(route.expectedOutput > 0, "Zero output amount");
        
        // Approve tokens for all DEXs and bridges in the path
        for (uint i = 0; i < route.dexs.length; i++) {
            IERC20(fromToken).approve(route.dexs[i], 0); // Clear previous approval
            IERC20(fromToken).approve(route.dexs[i], amount);
        }
        for (uint i = 0; i < route.bridges.length; i++) {
            IERC20(fromToken).approve(route.bridges[i], 0); // Clear previous approval
            IERC20(fromToken).approve(route.bridges[i], amount);
        }

        // Transfer tokens from user
        try IERC20(fromToken).transferFrom(msg.sender, address(this), amount) {
            emit Debug("Token transfer successful");
        } catch Error(string memory reason) {
            emit Debug(string.concat("Token transfer failed: ", reason));
            revert(string.concat("Token transfer failed: ", reason));
        }
        
        // Execute swaps using the optimal path
        uint256 currentAmount = amount;
        address currentToken = fromToken;
        
        for (uint256 i = 0; i < route.dexs.length; i++) {
            if (currentToken != toToken) {
                // Calculate the portion for this DEX
                uint256 swapAmount = currentAmount / (route.dexs.length - i);
                
                // Execute swap
                currentAmount = executeSwapOnDex(
                    route.dexs[i],
                    currentToken,
                    toToken,
                    swapAmount
                );
                currentToken = toToken;
            }
        }
        
        // Execute bridge if cross-chain using the optimal bridge
        if (destChain != 11155111) { // Not Sepolia
            require(route.bridges.length > 0, "No viable bridge found");
            
            // Use the first bridge in the optimal path
            executeBridge(
                intentId,
                currentToken,
                currentAmount,
                destChain,
                msg.sender,
                route.bridges[0]
            );
        } else {
            // Transfer tokens back to user if same chain
            IERC20(currentToken).transfer(msg.sender, currentAmount);
        }
        
        // Mark intent as completed and processed only after successful execution
        intentStatus[intentId] = IntentStatus.Completed;
        processedIntents[intentId] = true;
        
        emit IntentProcessed(intentId, msg.sender, amount, true);

        // Calculate gas used for analytics
        uint256 gasUsed = startGas - gasleft();

        // Emit execution result for analytics
        emit IntentExecuted(
            intentId,
            true,
            gasUsed,
            block.timestamp
        );

        // Emit optimization suggestions based on gas usage
        if (gasUsed > 200000) {
            emit OptimizationSuggestion(
                intentId,
                "Consider batching multiple transfers",
                50000
            );
        }
    }
    
    function executeSwapOnDex(
        address dex,
        address fromToken,
        address toToken,
        uint256 amount
    ) internal returns (uint256) {
        if (dex == uniswapRouter) {
            return executeUniswapSwap(fromToken, toToken, amount);
        } else if (dex == curvePool) {
            return executeCurveSwap(fromToken, toToken, amount);
        }
        revert("Unsupported DEX");
    }
    
    function executeUniswapSwap(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal returns (uint256) {
        // Check if pair exists
        address factory = IUniswapRouter(uniswapRouter).factory();
        address pair = IUniswapFactory(factory).getPair(fromToken, toToken);
        
        emit Debug(string.concat("Pair address: ", addressToString(pair)));
        
        if (pair == address(0)) {
            emit Debug("No liquidity pool found");
            revert("No liquidity pool found");
        }

        // Approval is now done in processIntent
        address[] memory path = new address[](2);
        path[0] = fromToken;
        path[1] = toToken;
        
        // Get token decimals
        uint8 fromDecimals = IERC20Metadata(fromToken).decimals();
        uint8 toDecimals = IERC20Metadata(toToken).decimals();
        emit Debug(string.concat("From decimals: ", uint2str(fromDecimals)));
        emit Debug(string.concat("To decimals: ", uint2str(toDecimals)));
        
        // Get expected output amount
        uint[] memory amounts = IUniswapRouter(uniswapRouter).getAmountsOut(amount, path);
        emit Debug(string.concat("Input amount: ", uint2str(amount)));
        emit Debug(string.concat("Expected output: ", uint2str(amounts[1])));
        
        // Execute swap with minimum output
        uint[] memory received = IUniswapRouter(uniswapRouter).swapExactTokensForTokens(
            amount,
            amounts[1] * 95 / 100, // Accept 5% slippage
            path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );
        
        emit SwapCompleted(
            keccak256(abi.encodePacked(block.timestamp, msg.sender)),
            fromToken,
            toToken,
            amount,
            received[1]
        );
        
        return received[1];
    }

    function executeCurveSwap(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal returns (uint256) {
        // Build 1inch swap params
        bytes memory data = abi.encodeWithSignature(
            "swap(address,address,uint256,uint256,uint256,address,address[],bytes)",
            fromToken,
            toToken,
            amount,
            (amount * 95) / 100, // 5% slippage
            0, // Parts = 0 means use internal split algorithm
            address(0), // No referrer
            new address[](0), // No custom routes
            "" // No permit data
        );
        
        // Execute swap
        (bool success, bytes memory result) = address(0x1111111254EEB25477B68fb85Ed929f73A960582).call(data);
        require(success, "1inch swap failed");
        
        uint256 received = abi.decode(result, (uint256));
        
        emit SwapCompleted(
            keccak256(abi.encodePacked(block.timestamp, msg.sender)),
            fromToken,
            toToken,
            amount,
            received
        );
        
        return received;
    }
    
    function executeUniswapV3Swap(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal returns (uint256) {
        // Build exact input params
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: fromToken,
            tokenOut: toToken,
            fee: 3000, // 0.3% fee tier
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amount,
            amountOutMinimum: (amount * 95) / 100, // 5% slippage
            sqrtPriceLimitX96: 0
        });
        
        // Execute swap
        uint256 received = IUniswapV3Router(0xE592427A0AEce92De3Edee1F18E0157C05861564).exactInputSingle(params);
        
        emit SwapCompleted(
            keccak256(abi.encodePacked(block.timestamp, msg.sender)),
            fromToken,
            toToken,
            amount,
            received
        );
        
        return received;
    }

    function addressToString(address _addr) internal pure returns(string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }

    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
    
    function executeBridge(
        bytes32 intentId,
        address token,
        uint256 amount,
        uint16 destChain,
        address recipient,
        address bridge
    ) internal {
        // Track cross-chain transaction
        pendingCrossChainTx[intentId] = true;
        crossChainAmounts[intentId] = amount;
        
        if (bridge == hopBridge) {
            // Use Hop Protocol
            IHopBridge(hopBridge).sendToL2{
                value: msg.value
            }(
                destChain,
                recipient,
                amount,
                block.timestamp + 3600, // 1 hour deadline
                address(0), // No relayer
                0 // No relayer fee
            );
        } else if (bridge == stargateRouter) {
            // Use Stargate
            IStargateRouter(stargateRouter).swap{
                value: msg.value
            }(
                destChain,
                getPoolId(token), // Implement pool ID mapping
                getPoolId(token),
                payable(msg.sender),
                amount,
                amount * 95 / 100, // 5% slippage
                abi.encodePacked(recipient)
            );
        } else {
            // Default to LayerZero
            bytes memory payload = abi.encode(recipient, amount);
            
            ILayerZeroEndpoint(layerZeroEndpoint).send{
                value: msg.value
            }(
                destChain,
                abi.encodePacked(address(this)),
                payload,
                payable(msg.sender),
                address(0),
                bytes("")
            );
        }
        
        emit BridgeInitiated(intentId, destChain, recipient, amount);
    }
    
    // Admin functions
    function setProtocolAddresses(
        address _uniswap,
        address _curve,
        address _stargate,
        address _hop,
        address _layerZero
    ) external onlyOwner {
        uniswapRouter = _uniswap;
        curvePool = _curve;
        stargateRouter = _stargate;
        hopBridge = _hop;
        layerZeroEndpoint = _layerZero;
    }
    
    function setSupportedChain(uint16 chainId, bool supported) external onlyOwner {
        supportedChains[chainId] = supported;
    }
    
    function setSupportedDEX(address dex, bool supported) external onlyOwner {
        supportedDEXs[dex] = supported;
    }
    
    // Pool management
    mapping(address => uint256) public poolIds;
    mapping(address => int128) public tokenIndices;
    
    function getPoolId(address token) internal view returns (uint256) {
        require(poolIds[token] != 0, "Pool not supported");
        return poolIds[token];
    }

    function getTokenIndex(address token) internal view returns (int128) {
        int128 index = tokenIndices[token];
        require(index != 0, "Token not supported in Curve pool");
        return index;
    }

    function setTokenIndex(address token, int128 index) external onlyOwner {
        tokenIndices[token] = index;
    }
    
    function setPoolId(address token, uint256 poolId) external onlyOwner {
        poolIds[token] = poolId;
    }
    
    // Cross-chain callback handling
    function lzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) external {
        require(msg.sender == address(layerZeroEndpoint), "Invalid endpoint");
        
        // Decode the payload
        (bytes32 intentId, uint256 amount) = abi.decode(_payload, (bytes32, uint256));
        
        // Verify and complete the cross-chain transaction
        require(pendingCrossChainTx[intentId], "No pending transaction");
        require(crossChainAmounts[intentId] == amount, "Amount mismatch");
        
        // Clear the pending state
        pendingCrossChainTx[intentId] = false;
        delete crossChainAmounts[intentId];
        
        emit IntentExecuted(intentId, true, 0, block.timestamp);
    }
    
    // Emergency functions
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(msg.sender, balance);
    }

    // Function to handle incoming ETH
    receive() external payable {}
}
