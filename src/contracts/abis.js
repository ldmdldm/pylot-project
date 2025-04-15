export const IntentProcessorABI = [
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "targetToken",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "targetChain",
            "type": "uint16"
          },
          {
            "internalType": "uint256",
            "name": "minAmountOut",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxGasPrice",
            "type": "uint256"
          },
          {
            "internalType": "string[]",
            "name": "dexPath",
            "type": "string[]"
          },
          {
            "internalType": "uint256",
            "name": "bridgeFee",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "requireAtomicity",
            "type": "bool"
          }
        ],
        "internalType": "struct IntentProcessor.Intent",
        "name": "intent",
        "type": "tuple"
      },
      {
        "internalType": "bytes32",
        "name": "intentId",
        "type": "bytes32"
      }
    ],
    "name": "processIntent",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "intentId",
        "type": "bytes32"
      }
    ],
    "name": "getIntentStatus",
    "outputs": [
      {
        "internalType": "bool",
        "name": "processed",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "bridgeInitiated",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "swapCompleted",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "finalAmount",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "status",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
