// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract IntentParser is Ownable {
    struct Intent {
        address sourceToken;
        address targetToken;
        uint256 amount;
        uint16 sourceChain;
        uint16 targetChain;
        uint256 minOutput;
        uint256 maxSlippage;
        uint256 deadline;
    }

    mapping(bytes32 => Intent) public intents;
    mapping(string => address) public tokenSymbolToAddress;
    mapping(string => uint16) public chainNameToId;

    event IntentParsed(
        bytes32 indexed intentId,
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 sourceChain,
        uint16 targetChain
    );

    function parseIntent(
        string calldata intentString,
        uint256 amount,
        uint256 maxSlippage,
        uint256 deadline
    ) external returns (bytes32) {
        // This would be implemented off-chain with NLP
        // Here we just create a structured intent
        bytes32 intentId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                intentString
            )
        );

        // For demo, assuming USDC to PYUSD on Sepolia
        Intent memory newIntent = Intent({
            sourceToken: tokenSymbolToAddress["USDC"],
            targetToken: tokenSymbolToAddress["PYUSD"],
            amount: amount,
            sourceChain: chainNameToId["Sepolia"],
            targetChain: chainNameToId["Sepolia"],
            minOutput: 0, // To be calculated based on current prices
            maxSlippage: maxSlippage,
            deadline: deadline
        });

        intents[intentId] = newIntent;

        emit IntentParsed(
            intentId,
            newIntent.sourceToken,
            newIntent.targetToken,
            newIntent.amount,
            newIntent.sourceChain,
            newIntent.targetChain
        );

        return intentId;
    }

    function addTokenSymbol(string calldata symbol, address tokenAddress) external onlyOwner {
        tokenSymbolToAddress[symbol] = tokenAddress;
    }

    function addChainName(string calldata name, uint16 chainId) external onlyOwner {
        chainNameToId[name] = chainId;
    }

    function getIntent(bytes32 intentId) external view returns (Intent memory) {
        return intents[intentId];
    }
}
