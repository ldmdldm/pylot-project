"""
Base class for transaction executors in the PYLOT system.

This module provides the foundation for all transaction executors,
defining common interfaces and utility functions for blockchain
transactions across different chains and protocols.
"""

import abc
import logging
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

from web3 import Web3
from web3.types import TxParams, TxReceipt


class TransactionStatus(Enum):
    """Enum for tracking the status of a transaction."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    REVERTED = "reverted"


class TransactionExecutor(abc.ABC):
    """
    Base class for transaction executors that handle blockchain transactions.
    
    This abstract class defines the interface and common functionality for
    executing transactions across different blockchains and protocols.
    """
    
    def __init__(self, web3_provider: Web3, chain_id: int, logger: Optional[logging.Logger] = None):
        """
        Initialize the transaction executor with a web3 provider.
        
        Args:
            web3_provider: Initialized Web3 instance for blockchain interaction
            chain_id: The chain ID this executor will operate on
            logger: Optional logger for transaction logging
        """
        self.web3 = web3_provider
        self.chain_id = chain_id
        self.logger = logger or logging.getLogger(__name__)
        
    @abc.abstractmethod
    def execute(self, transaction_data: Dict[str, Any]) -> str:
        """
        Execute a transaction using the provided transaction data.
        
        Args:
            transaction_data: Dictionary containing transaction parameters
            
        Returns:
            Transaction hash as a string
            
        Raises:
            NotImplementedError: Must be implemented by subclasses
        """
        raise NotImplementedError("Subclasses must implement execute()")
    
    @abc.abstractmethod
    def estimate_gas(self, transaction_data: Dict[str, Any]) -> int:
        """
        Estimate the gas required for a transaction.
        
        Args:
            transaction_data: Dictionary containing transaction parameters
            
        Returns:
            Estimated gas as an integer
            
        Raises:
            NotImplementedError: Must be implemented by subclasses
        """
        raise NotImplementedError("Subclasses must implement estimate_gas()")
    
    def build_transaction(self, 
                         from_address: str, 
                         to_address: str, 
                         value: int = 0, 
                         data: str = "", 
                         gas_price: Optional[int] = None, 
                         gas_limit: Optional[int] = None) -> TxParams:
        """
        Build a transaction object with the provided parameters.
        
        Args:
            from_address: The sender's address
            to_address: The recipient's address
            value: Amount of native currency to send (in wei)
            data: Transaction data as a hex string
            gas_price: Gas price in wei (optional)
            gas_limit: Gas limit for the transaction (optional)
            
        Returns:
            Transaction parameters dictionary
        """
        tx_params: TxParams = {
            'from': from_address,
            'to': to_address,
            'value': value,
            'chainId': self.chain_id,
        }
        
        if data:
            tx_params['data'] = data
            
        if gas_price is not None:
            tx_params['gasPrice'] = gas_price
        else:
            # Get current gas price from the network
            tx_params['gasPrice'] = self.web3.eth.gas_price
            
        if gas_limit is not None:
            tx_params['gas'] = gas_limit
            
        return tx_params
    
    def get_transaction_status(self, tx_hash: str) -> TransactionStatus:
        """
        Get the current status of a transaction.
        
        Args:
            tx_hash: Transaction hash
            
        Returns:
            TransactionStatus enum value
        """
        try:
            tx_receipt = self.web3.eth.get_transaction_receipt(tx_hash)
            if tx_receipt is None:
                return TransactionStatus.PENDING
                
            if tx_receipt.status == 1:
                return TransactionStatus.CONFIRMED
            else:
                return TransactionStatus.REVERTED
        except Exception as e:
            self.logger.error(f"Error getting transaction status: {str(e)}")
            return TransactionStatus.FAILED
    
    def wait_for_transaction(self, tx_hash: str, timeout: int = 120) -> TxReceipt:
        """
        Wait for a transaction to be mined and return the receipt.
        
        Args:
            tx_hash: Transaction hash
            timeout: Maximum time to wait in seconds
            
        Returns:
            Transaction receipt
            
        Raises:
            TimeoutError: If transaction is not mined within the timeout period
        """
        return self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)

