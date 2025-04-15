"""
Google Cloud Platform Blockchain RPC Integration Module.

This module provides classes and utilities for interacting with Google Cloud's 
Blockchain RPC services, specifically optimized for Ethereum networks.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional, Union

import requests
from web3 import Web3
from web3.exceptions import BadFunctionCallOutput, TransactionNotFound
from web3.middleware import geth_poa_middleware

logger = logging.getLogger(__name__)

class GCPRPCError(Exception):
    """Custom exception for GCP RPC-related errors."""
    pass

class GCPIntegration:
    """
    Integration with Google Cloud Platform's Blockchain RPC services.
    
    This class handles connections to GCP's Ethereum endpoints and provides
    methods for standard and advanced RPC calls including debug and trace methods.
    """
    
    # GCP Blockchain RPC endpoints
    MAINNET_RPC_URL = "https://eth.blockchain-data.googleapis.com"
    HOLESKY_RPC_URL = "https://eth-holesky.blockchain-data.googleapis.com"
    
    def __init__(self, 
                 network: str = "mainnet", 
                 api_key: Optional[str] = None,
                 timeout: int = 60):
        """
        Initialize the GCP Blockchain RPC integration.
        
        Args:
            network: The Ethereum network to connect to ("mainnet" or "holesky")
            api_key: Optional API key for GCP services (if required)
            timeout: Request timeout in seconds
        """
        self.network = network.lower()
        self.api_key = api_key
        self.timeout = timeout
        
        # Set the appropriate RPC URL based on the specified network
        if self.network == "mainnet":
            self.rpc_url = self.MAINNET_RPC_URL
            self.chain_id = 1
        elif self.network == "holesky":
            self.rpc_url = self.HOLESKY_RPC_URL
            self.chain_id = 17000
        else:
            raise ValueError(f"Unsupported network: {network}. Use 'mainnet' or 'holesky'.")
        
        # Add API key to URL if provided
        if self.api_key:
            self.rpc_url = f"{self.rpc_url}?key={self.api_key}"
        
        # Initialize web3 connection
        self.web3 = Web3(Web3.HTTPProvider(self.rpc_url, request_kwargs={'timeout': self.timeout}))
        
        # Add middleware for POA networks (like Holesky)
        if self.network == "holesky":
            self.web3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        logger.info(f"Initialized GCP Blockchain RPC integration for {self.network}")
        
    def is_connected(self) -> bool:
        """Check if the connection to the GCP RPC endpoint is working."""
        try:
            return self.web3.is_connected()
        except Exception as e:
            logger.error(f"Error checking connection: {str(e)}")
            return False
    
    def get_block_number(self) -> int:
        """Get the latest block number from the blockchain."""
        try:
            return self.web3.eth.block_number
        except Exception as e:
            logger.error(f"Error getting latest block number: {str(e)}")
            raise GCPRPCError(f"Failed to get latest block number: {str(e)}")
    
    def get_balance(self, address: str, block_identifier: Union[str, int] = "latest") -> int:
        """
        Get the balance of an address.
        
        Args:
            address: The Ethereum address to check
            block_identifier: Block number or "latest", "pending", "earliest"
        
        Returns:
            The balance in wei
        """
        try:
            return self.web3.eth.get_balance(address, block_identifier)
        except Exception as e:
            logger.error(f"Error getting balance for {address}: {str(e)}")
            raise GCPRPCError(f"Failed to get balance for {address}: {str(e)}")
    
    def get_transaction(self, tx_hash: str) -> Dict[str, Any]:
        """
        Get transaction details by hash.
        
        Args:
            tx_hash: The transaction hash
            
        Returns:
            Transaction details as a dictionary
        """
        try:
            return dict(self.web3.eth.get_transaction(tx_hash))
        except TransactionNotFound:
            logger.error(f"Transaction not found: {tx_hash}")
            raise GCPRPCError(f"Transaction not found: {tx_hash}")
        except Exception as e:
            logger.error(f"Error getting transaction {tx_hash}: {str(e)}")
            raise GCPRPCError(f"Failed to get transaction {tx_hash}: {str(e)}")
    
    def get_transaction_receipt(self, tx_hash: str) -> Dict[str, Any]:
        """
        Get transaction receipt by hash.
        
        Args:
            tx_hash: The transaction hash
            
        Returns:
            Transaction receipt as a dictionary
        """
        try:
            receipt = self.web3.eth.get_transaction_receipt(tx_hash)
            return dict(receipt) if receipt else None
        except Exception as e:
            logger.error(f"Error getting transaction receipt {tx_hash}: {str(e)}")
            raise GCPRPCError(f"Failed to get transaction receipt {tx_hash}: {str(e)}")
    
    def trace_transaction(self, tx_hash: str) -> Dict[str, Any]:
        """
        Execute trace_transaction RPC call.
        
        Uses GCP's free access to computationally expensive trace methods.
        
        Args:
            tx_hash: The transaction hash to trace
            
        Returns:
            Detailed trace of the transaction execution
        """
        return self._make_rpc_call("trace_transaction", [tx_hash])
    
    def debug_trace_transaction(self, tx_hash: str, tracer: str = "callTracer") -> Dict[str, Any]:
        """
        Execute debug_traceTransaction RPC call with tracer options.
        
        Uses GCP's free access to computationally expensive debug methods.
        
        Args:
            tx_hash: The transaction hash to trace
            tracer: The tracer to use (default: "callTracer")
            
        Returns:
            Detailed debug trace of the transaction execution
        """
        tracer_options = {"tracer": tracer}
        return self._make_rpc_call("debug_traceTransaction", [tx_hash, tracer_options])
    
    def trace_block(self, block_number: Union[str, int]) -> List[Dict[str, Any]]:
        """
        Execute trace_block RPC call.
        
        Args:
            block_number: Block number or "latest"
            
        Returns:
            List of traces for all transactions in the block
        """
        if isinstance(block_number, int):
            block_number = hex(block_number)
        return self._make_rpc_call("trace_block", [block_number])
    
    def execute_contract_function(self, 
                                 contract_address: str, 
                                 abi: List[Dict], 
                                 function_name: str, 
                                 *args, 
                                 **kwargs) -> Any:
        """
        Execute a read-only contract function.
        
        Args:
            contract_address: The contract address
            abi: The contract ABI
            function_name: The function name to call
            *args: Function arguments
            **kwargs: Additional options
            
        Returns:
            The function result
        """
        try:
            contract = self.web3.eth.contract(address=contract_address, abi=abi)
            function = getattr(contract.functions, function_name)
            result = function(*args).call(**kwargs)
            return result
        except BadFunctionCallOutput:
            logger.error(f"Bad function call output for {function_name}")
            raise GCPRPCError(f"Bad function call output for {function_name}")
        except Exception as e:
            logger.error(f"Error executing contract function {function_name}: {str(e)}")
            raise GCPRPCError(f"Failed to execute contract function {function_name}: {str(e)}")
    
    def _make_rpc_call(self, method: str, params: List[Any]) -> Any:
        """
        Make a custom JSON-RPC call to the GCP Blockchain RPC endpoint.
        
        Args:
            method: The RPC method name
            params: The parameters for the method
            
        Returns:
            The RPC response result
        """
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": method,
                "params": params,
                "id": int(time.time() * 1000)
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                self.rpc_url,
                headers=headers,
                data=json.dumps(payload),
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                logger.error(f"RPC call failed with status {response.status_code}: {response.text}")
                raise GCPRPCError(f"RPC call failed with status {response.status_code}")
            
            result = response.json()
            
            if "error" in result:
                logger.error(f"RPC error: {result['error']}")
                raise GCPRPCError(f"RPC error: {result['error']}")
            
            return result.get("result")
        
        except requests.exceptions.Timeout:
            logger.error(f"RPC call timed out after {self.timeout}s")
            raise GCPRPCError(f"RPC call timed out after {self.timeout}s")
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error in RPC call: {str(e)}")
            raise GCPRPCError(f"Request error in RPC call: {str(e)}")
        
        except Exception as e:
            logger.error(f"Error in RPC call: {str(e)}")
            raise GCPRPCError(f"Error in RPC call: {str(e)}")

