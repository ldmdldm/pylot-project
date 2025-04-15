"""
Token Transfer Executor for ERC-20 token transfers, including PYUSD.

This module provides a specialized executor for handling token transfers
within the same blockchain. It extends the base TransactionExecutor class
and implements methods for token approvals, transfers, and balance checks.
"""

from decimal import Decimal
from typing import Dict, Optional, Tuple, Union

from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractLogicError, ValidationError
from web3.types import TxParams, TxReceipt, Wei

from pylot.execution.base import TransactionExecutor
from pylot.integrations.gcp import GCPIntegration


class TokenTransferExecutor(TransactionExecutor):
    """
    TokenTransferExecutor handles ERC-20 token transfers within the same blockchain.
    
    This executor specializes in token operations like approvals, transfers, and
    balance checks for ERC-20 tokens, with specific optimizations for PYUSD.
    """
    
    # Standard ERC-20 ABI for the methods we need
    ERC20_ABI = [
        {
            "constant": True,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        },
        {
            "constant": False,
            "inputs": [
                {"name": "_spender", "type": "address"},
                {"name": "_value", "type": "uint256"}
            ],
            "name": "approve",
            "outputs": [{"name": "", "type": "bool"}],
            "type": "function"
        },
        {
            "constant": False,
            "inputs": [
                {"name": "_to", "type": "address"},
                {"name": "_value", "type": "uint256"}
            ],
            "name": "transfer",
            "outputs": [{"name": "", "type": "bool"}],
            "type": "function"
        },
        {
            "constant": True,
            "inputs": [
                {"name": "_owner", "type": "address"},
                {"name": "_spender", "type": "address"}
            ],
            "name": "allowance",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function"
        },
        {
            "constant": False,
            "inputs": [
                {"name": "_from", "type": "address"},
                {"name": "_to", "type": "address"},
                {"name": "_value", "type": "uint256"}
            ],
            "name": "transferFrom",
            "outputs": [{"name": "", "type": "bool"}],
            "type": "function"
        },
        {
            "constant": True,
            "inputs": [],
            "name": "decimals",
            "outputs": [{"name": "", "type": "uint8"}],
            "type": "function"
        }
    ]
    
    def __init__(self, web3_provider: Union[Web3, GCPIntegration], chain_id: int):
        """
        Initialize the TokenTransferExecutor.
        
        Args:
            web3_provider: A Web3 instance or GCPIntegration for blockchain interaction
            chain_id: Chain ID of the blockchain network
        """
        super().__init__(web3_provider, chain_id)
        self.token_contracts: Dict[str, Contract] = {}
        
    def get_token_contract(self, token_address: str) -> Contract:
        """
        Get or create a contract instance for the specified token address.
        
        Args:
            token_address: Ethereum address of the ERC-20 token
            
        Returns:
            Contract instance for the token
        """
        if token_address not in self.token_contracts:
            if isinstance(self.provider, GCPIntegration):
                web3 = self.provider.get_web3_instance()
            else:
                web3 = self.provider
                
            self.token_contracts[token_address] = web3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=self.ERC20_ABI
            )
        
        return self.token_contracts[token_address]
    
    def get_token_balance(self, token_address: str, owner_address: str) -> Tuple[Decimal, int]:
        """
        Get the token balance for a specific address.
        
        Args:
            token_address: Address of the ERC-20 token
            owner_address: Address to check balance for
            
        Returns:
            Tuple of (human_readable_balance, raw_balance)
        """
        token_contract = self.get_token_contract(token_address)
        
        try:
            raw_balance = token_contract.functions.balanceOf(
                Web3.to_checksum_address(owner_address)
            ).call()
            
            decimals = token_contract.functions.decimals().call()
            human_readable = Decimal(raw_balance) / Decimal(10 ** decimals)
            
            return human_readable, raw_balance
        except (ContractLogicError, ValidationError) as e:
            self.logger.error(f"Failed to get token balance: {str(e)}")
            raise
    
    def check_allowance(
        self, token_address: str, owner_address: str, spender_address: str
    ) -> Tuple[Decimal, int]:
        """
        Check the token allowance for a spender.
        
        Args:
            token_address: Address of the ERC-20 token
            owner_address: Address of the token owner
            spender_address: Address of the spender to check allowance for
            
        Returns:
            Tuple of (human_readable_allowance, raw_allowance)
        """
        token_contract = self.get_token_contract(token_address)
        
        try:
            raw_allowance = token_contract.functions.allowance(
                Web3.to_checksum_address(owner_address),
                Web3.to_checksum_address(spender_address)
            ).call()
            
            decimals = token_contract.functions.decimals().call()
            human_readable = Decimal(raw_allowance) / Decimal(10 ** decimals)
            
            return human_readable, raw_allowance
        except (ContractLogicError, ValidationError) as e:
            self.logger.error(f"Failed to check token allowance: {str(e)}")
            raise
    
    def approve_token_spending(
        self,
        token_address: str,
        spender_address: str,
        amount: Union[int, Decimal, str],
        sender_address: str,
        private_key: Optional[str] = None,
        gas_limit: Optional[int] = None,
        gas_price: Optional[Wei] = None,
        max_priority_fee: Optional[Wei] = None,
        nonce: Optional[int] = None
    ) -> TxReceipt:
        """
        Approve a spender to use tokens on behalf of the sender.
        
        Args:
            token_address: Address of the ERC-20 token
            spender_address: Address of the spender to approve
            amount: Amount to approve (can be human readable or raw)
            sender_address: Address of the token owner
            private_key: Private key for transaction signing (if not using personal accounts)
            gas_limit: Optional custom gas limit
            gas_price: Optional custom gas price
            max_priority_fee: Optional max priority fee for EIP-1559 transactions
            nonce: Optional custom nonce for the transaction
            
        Returns:
            Transaction receipt
        """
        token_contract = self.get_token_contract(token_address)
        sender_address = Web3.to_checksum_address(sender_address)
        spender_address = Web3.to_checksum_address(spender_address)
        
        # Convert human-readable amount to raw amount if necessary
        if isinstance(amount, (Decimal, str)):
            decimals = token_contract.functions.decimals().call()
            if isinstance(amount, str):
                amount = Decimal(amount)
            raw_amount = int(amount * Decimal(10 ** decimals))
        else:
            raw_amount = amount
        
        # Prepare transaction parameters
        tx_params = self._prepare_transaction_params(
            sender_address=sender_address,
            gas_limit=gas_limit,
            gas_price=gas_price,
            max_priority_fee=max_priority_fee,
            nonce=nonce
        )
        
        # Build the approve transaction
        approve_tx = token_contract.functions.approve(
            spender_address,
            raw_amount
        ).build_transaction(tx_params)
        
        # Execute the transaction
        return self._execute_transaction(
            transaction=approve_tx,
            private_key=private_key,
            sender_address=sender_address
        )
    
    def transfer_tokens(
        self,
        token_address: str,
        recipient_address: str,
        amount: Union[int, Decimal, str],
        sender_address: str,
        private_key: Optional[str] = None,
        gas_limit: Optional[int] = None,
        gas_price: Optional[Wei] = None,
        max_priority_fee: Optional[Wei] = None,
        nonce: Optional[int] = None
    ) -> TxReceipt:
        """
        Transfer tokens from sender to recipient.
        
        Args:
            token_address: Address of the ERC-20 token
            recipient_address: Address to receive tokens
            amount: Amount to transfer (can be human readable or raw)
            sender_address: Address sending the tokens
            private_key: Private key for transaction signing (if not using personal accounts)
            gas_limit: Optional custom gas limit
            gas_price: Optional custom gas price
            max_priority_fee: Optional max priority fee for EIP-1559 transactions
            nonce: Optional custom nonce for the transaction
            
        Returns:
            Transaction receipt
        """
        token_contract = self.get_token_contract(token_address)
        sender_address = Web3.to_checksum_address(sender_address)
        recipient_address = Web3.to_checksum_address(recipient_address)
        
        # Convert human-readable amount to raw amount if necessary
        if isinstance(amount, (Decimal, str)):
            decimals = token_contract.functions.decimals().call()
            if isinstance(amount, str):
                amount = Decimal(amount)
            raw_amount = int(amount * Decimal(10 ** decimals))
        else:
            raw_amount = amount
        
        # Prepare transaction parameters
        tx_params = self._prepare_transaction_params(
            sender_address=sender_address,
            gas_limit=gas_limit,
            gas_price=gas_price,
            max_priority_fee=max_priority_fee,
            nonce=nonce
        )
        
        # Build the transfer transaction
        transfer_tx = token_contract.functions.transfer(
            recipient_address,
            raw_amount
        ).build_transaction(tx_params)
        
        # Execute the transaction
        return self._execute_transaction(
            transaction=transfer_tx,
            private_key=private_key,
            sender_address=sender_address
        )
    
    def transfer_tokens_from(
        self,
        token_address: str,
        from_address: str,
        to_address: str,
        amount: Union[int, Decimal, str],
        sender_address: str,
        private_key: Optional[str] = None,
        gas_limit: Optional[int] = None,
        gas_price: Optional[Wei] = None,
        max_priority_fee: Optional[Wei] = None,
        nonce: Optional[int] = None
    ) -> TxReceipt:
        """
        Transfer tokens from one address to another using the sender's allowance.
        
        Args:
            token_address: Address of the ERC-20 token
            from_address: Address to transfer tokens from
            to_address: Address to transfer tokens to
            amount: Amount to transfer (can be human readable or raw)
            sender_address: Address executing the transfer (must have allowance)
            private_key: Private key for transaction signing (if not using personal accounts)
            gas_limit: Optional custom gas limit
            gas_price: Optional custom gas price
            max_priority_fee: Optional max priority fee for EIP-1559 transactions
            nonce: Optional custom nonce for the transaction
            
        Returns:
            Transaction receipt
        """
        token_contract = self.get_token_contract(token_address)
        sender_address = Web3.to_checksum_address(sender_address)
        from_address = Web3.to_checksum_address(from_address)
        to_address = Web3.to_checksum_address(to_address)
        
        # Convert human-readable amount to raw amount if necessary
        if isinstance(amount, (Decimal, str)):
            decimals = token_contract.functions.decimals().call()
            if isinstance(amount, str):
                amount = Decimal(amount)
            raw_amount = int(amount * Decimal(10 ** decimals))
        else:
            raw_amount = amount
        
        # Check allowance
        _, allowance = self.check_allowance(token_address, from_address, sender_address)
        if allowance < raw_amount:
            raise ValueError(
                f"Insufficient allowance. Current: {allowance}, Required: {raw_amount}"
            )
        
        # Prepare transaction parameters
        tx_params = self._prepare_transaction_params(
            sender_address=sender_address,
            gas_limit=gas_limit,
            gas_price=gas_price,
            max_priority_fee=max_priority_fee,
            nonce=nonce
        )
        
        # Build the transferFrom transaction
        transfer_from_tx = token_contract.functions.transferFrom(
            from_address,
            to_address,
            raw_amount
        ).build_transaction(tx_params)
        
        # Execute the transaction
        return self._execute_transaction(
            transaction=transfer_from_tx,
            private_key=private_key,
            sender_address=sender_address
        )

