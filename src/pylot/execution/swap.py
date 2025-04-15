"""
Swap Executor Module for handling token swaps through DEXs.

This module provides functionality for executing token swaps through 
decentralized exchanges with a focus on PYUSD trading pairs.
"""

import logging
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Union

from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractLogicError

from pylot.execution.base import TransactionExecutor
from pylot.integrations.gcp import GCPIntegration
from pylot.routing.optimizer import Route

# Set up logging
logger = logging.getLogger(__name__)


class TokenSwapExecutor(TransactionExecutor):
    """
    Executor for DEX-based token swaps, with support for various protocols.
    
    This executor handles all aspects of swapping tokens on decentralized exchanges,
    including price quotes, slippage protection, and execution monitoring.
    """
    
    # Common DEX router addresses (Ethereum mainnet)
    DEX_ROUTERS = {
        'uniswap_v2': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        'uniswap_v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        'sushiswap': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        'curve': '0x8e764bE4288B842791989DB5b8ec067279829809',  # Curve router
    }
    
    # PYUSD token address (Ethereum mainnet)
    PYUSD_ADDRESS = '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8'
    
    # Common token addresses (Ethereum mainnet)
    COMMON_TOKENS = {
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',  # Special address for ETH
        'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'PYUSD': '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    }
    
    def __init__(self, web3_provider: Union[Web3, GCPIntegration], wallet_address: str, private_key: Optional[str] = None):
        """
        Initialize the TokenSwapExecutor.
        
        Args:
            web3_provider: Web3 provider or GCPIntegration instance
            wallet_address: Address of the wallet executing swaps
            private_key: Optional private key for signing transactions
        """
        super().__init__(web3_provider, wallet_address, private_key)
        self.dex_contracts = {}
        self._initialize_dex_contracts()
        
    def _initialize_dex_contracts(self) -> None:
        """Initialize DEX router contracts."""
        for dex_name, router_address in self.DEX_ROUTERS.items():
            # ABI would typically be loaded from a JSON file or a database
            # For now, we'll use a minimal ABI for router functions
            router_abi = self._get_router_abi(dex_name)
            if router_abi:
                self.dex_contracts[dex_name] = self.web3.eth.contract(
                    address=Web3.to_checksum_address(router_address), 
                    abi=router_abi
                )
    
    def _get_router_abi(self, dex_name: str) -> List[Dict]:
        """
        Get minimal ABI for a DEX router.
        
        Args:
            dex_name: Name of the DEX (uniswap_v2, uniswap_v3, etc.)
            
        Returns:
            List containing minimal ABI for the DEX router
        """
        # In a real implementation, this would load from a file or API
        # Returning minimal ABIs here for demonstration
        if dex_name == 'uniswap_v2':
            return [
                # getAmountsOut function
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"}
                    ],
                    "name": "getAmountsOut",
                    "outputs": [
                        {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                # swapExactTokensForTokens function
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"},
                        {"internalType": "address", "name": "to", "type": "address"},
                        {"internalType": "uint256", "name": "deadline", "type": "uint256"}
                    ],
                    "name": "swapExactTokensForTokens",
                    "outputs": [
                        {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
        elif dex_name == 'uniswap_v3':
            return [
                # exactInputSingle function
                {
                    "inputs": [
                        {
                            "components": [
                                {"internalType": "address", "name": "tokenIn", "type": "address"},
                                {"internalType": "address", "name": "tokenOut", "type": "address"},
                                {"internalType": "uint24", "name": "fee", "type": "uint24"},
                                {"internalType": "address", "name": "recipient", "type": "address"},
                                {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                                {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                                {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
                                {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
                            ],
                            "internalType": "struct ISwapRouter.ExactInputSingleParams",
                            "name": "params",
                            "type": "tuple"
                        }
                    ],
                    "name": "exactInputSingle",
                    "outputs": [
                        {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
                    ],
                    "stateMutability": "payable",
                    "type": "function"
                }
            ]
        # Add other DEX ABIs as needed
        return []

    def get_price_quote(
        self, 
        source_token: str, 
        target_token: str, 
        amount: Union[int, float, Decimal], 
        dex: str = 'uniswap_v2'
    ) -> Dict:
        """
        Get price quote for swapping tokens.
        
        Args:
            source_token: Address or symbol of the source token
            target_token: Address or symbol of the target token
            amount: Amount of source token to swap
            dex: DEX to use for the quote (default: uniswap_v2)
            
        Returns:
            Dict containing quote information
        """
        # Resolve token addresses if symbols were provided
        source_address = self._resolve_token_address(source_token)
        target_address = self._resolve_token_address(target_token)
        
        # Get token decimals
        source_decimals = self._get_token_decimals(source_address)
        target_decimals = self._get_token_decimals(target_address)
        
        # Convert amount to wei
        amount_in_wei = int(Decimal(amount) * (10 ** source_decimals))
        
        try:
            router = self.dex_contracts.get(dex)
            if not router:
                raise ValueError(f"DEX {dex} not supported or initialized")
            
            if dex == 'uniswap_v2':
                # Create the token path
                path = [source_address, target_address]
                
                # Get amounts out
                amounts = router.functions.getAmountsOut(amount_in_wei, path).call()
                amount_out = amounts[1]
                
                # Calculate price impact (simplified)
                # In a real implementation, this would compare to the current market price
                price_impact = 0.005  # Placeholder, would be calculated based on pool depth
                
                return {
                    'source_token': source_token,
                    'target_token': target_token,
                    'input_amount': amount,
                    'output_amount': amount_out / (10 ** target_decimals),
                    'price_impact': price_impact,
                    'fee': 0.003,  # Uniswap V2 fee
                    'dex': dex,
                    'raw_amount_out': amount_out
                }
            
            # Add support for other DEXs as needed
            raise ValueError(f"Quote functionality not implemented for {dex}")
        
        except (ContractLogicError, ValueError) as e:
            logger.error(f"Failed to get price quote: {str(e)}")
            raise
    
    def execute_swap(
        self, 
        route: Route, 
        source_token: str, 
        target_token: str, 
        amount: Union[int, float, Decimal], 
        slippage_tolerance: float = 0.005,
        deadline_minutes: int = 20
    ) -> Dict:
        """
        Execute a token swap through a specified DEX.
        
        Args:
            route: Route object with swap details
            source_token: Address or symbol of source token
            target_token: Address or symbol of target token
            amount: Amount of source token to swap
            slippage_tolerance: Maximum acceptable slippage (default: 0.5%)
            deadline_minutes: Transaction deadline in minutes (default: 20)
            
        Returns:
            Dict containing transaction details
        """
        # Resolve token addresses
        source_address = self._resolve_token_address(source_token)
        target_address = self._resolve_token_address(target_token)
        
        # Get token information
        source_decimals = self._get_token_decimals(source_address)
        target_decimals = self._get_token_decimals(target_address)
        
        # Convert amount to wei
        amount_in_wei = int(Decimal(amount) * (10 ** source_decimals))
        
        # Check and set allowance if needed
        if source_token != 'ETH':
            self._ensure_token_allowance(source_address, self.DEX_ROUTERS[route.dex], amount_in_wei)
        
        # Get price quote
        quote = self.get_price_quote(source_token, target_token, amount, route.dex)
        
        # Calculate minimum output amount with slippage protection
        min_output = int(quote['raw_amount_out'] * (1 - slippage_tolerance))
        
        # Set deadline
        deadline = self._get_deadline(deadline_minutes)
        
        try:
            # Execute the swap based on DEX
            router = self.dex_contracts.get(route.dex)
            if not router:
                raise ValueError(f"DEX {route.dex} not supported or initialized")
            
            tx_hash = None
            
            if route.dex == 'uniswap_v2':
                # Create the token path
                path = [source_address, target_address]
                
                # Prepare transaction
                tx = router.functions.swapExactTokensForTokens(
                    amount_in_wei,
                    min_output,
                    path,
                    self.wallet_address,
                    deadline
                ).build_transaction({
                    'from': self.wallet_address,
                    'gas': 250000,  # Gas limit, would be estimated in a real implementation
                    'nonce': self.web3.eth.get_transaction_count(self.wallet_address),
                    'gasPrice': self.web3.eth.gas_price
                })
                
                # Sign and send transaction
                signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
                tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Wait for transaction to be mined
            if tx_hash:
                receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
                
                # Check transaction status
                if receipt['status'] == 1:
                    logger.info(f"Swap executed successfully: {self.web3.to_hex(tx_hash)}")
                    return {
                        'success': True,
                        'tx_hash': self.web3.to_hex(tx_hash),
                        'input_token': source_token,
                        'input_amount': amount,
                        'output_token': target_token,
                        'estimated_output': quote['output_amount'],
                        'gas_used': receipt['gasUsed'],
                        'block_number': receipt['blockNumber']
                    }
                else:
                    logger.error(f"Swap transaction reverted: {self.web3.to_hex(tx_hash)}")
                    return {
                        'success': False,
                        'tx_hash': self.web3.to_hex(tx_hash),
                        'error': 'Transaction reverted',
                        'receipt': receipt
                    }
            
            raise ValueError(f"Failed to execute swap on {route.dex}")
        
        except Exception as e:
            logger.error(f"Swap execution failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _ensure_token_allowance(self, token_address: str, spender_address: str, amount: int) -> None:
        """
        Ensure the router has allowance to spend tokens

