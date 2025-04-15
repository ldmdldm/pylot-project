import time
from typing import Dict, List, Optional, Tuple, Union
from decimal import Decimal
from web3 import Web3

from pylot.execution.base import TransactionExecutor
from pylot.integrations.gcp import GCPIntegration

class BridgeProtocol:
    """Enum-like class to represent supported bridge protocols"""
    STARGATE = "stargate"
    HOP = "hop"
    LAYERZERO = "layerzero"
    ACROSS = "across"
    SYNAPSE = "synapse"
    
    @classmethod
    def all(cls) -> List[str]:
        """Return a list of all supported protocols"""
        return [cls.STARGATE, cls.HOP, cls.LAYERZERO, cls.ACROSS, cls.SYNAPSE]

class Chain:
    """Enum-like class to represent supported chains"""
    ETHEREUM = "ethereum"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    BASE = "base"
    POLYGON = "polygon"
    
    @classmethod
    def all(cls) -> List[str]:
        """Return a list of all supported chains"""
        return [cls.ETHEREUM, cls.ARBITRUM, cls.OPTIMISM, cls.BASE, cls.POLYGON]

class BridgeExecutor(TransactionExecutor):
    """
    Executor for cross-chain bridge transactions involving PYUSD.
    
    This executor handles transferring PYUSD between different blockchains
    using various bridge protocols like Stargate, Hop, LayerZero, etc.
    """
    
    # Protocol router contract addresses per chain
    PROTOCOL_ROUTERS = {
        BridgeProtocol.STARGATE: {
            Chain.ETHEREUM: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
            Chain.ARBITRUM: "0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614",
            Chain.OPTIMISM: "0xB0D502E938ed5f4df2E681fE6E419ff29631d62b",
            Chain.BASE: "0x45f1fF3190159Ac2396242aE7F74e0C021f84476",
            Chain.POLYGON: "0x45A01E4e04F14f7A4a6702c74187c5F6222033cd"
        },
        BridgeProtocol.HOP: {
            Chain.ETHEREUM: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a",
            Chain.ARBITRUM: "0x3E4a3a4796d16c0Cd582C382691998f7c06420B6",
            Chain.OPTIMISM: "0x2ad09850b0CA4c7c1B33f5AcD6cBAbCaB5d6e796",
            Chain.BASE: "0x2A6303e6b99d451Df3566068EBb110708335658f",
            Chain.POLYGON: "0x8741Ba6225A6BF91f9D73531A98A89807857a2B3"
        }
    }
    
    # Chain IDs used by bridge protocols
    CHAIN_IDS = {
        Chain.ETHEREUM: 1,
        Chain.ARBITRUM: 42161,
        Chain.OPTIMISM: 10,
        Chain.BASE: 8453,
        Chain.POLYGON: 137
    }
    
    # PYUSD token addresses on different chains
    PYUSD_ADDRESSES = {
        Chain.ETHEREUM: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
        Chain.ARBITRUM: "0xfd9ac3ce15c6acb283690624687a99d351704169",
        Chain.OPTIMISM: "0xcd7169D55d8cff1183ef0e1E701e549997Cf471F",
        Chain.BASE: "0xB37B6B5685B89802EfE00116330C98c504CbD168",
        Chain.POLYGON: "0x34a13e66a0de47c3ad16f47f0d0ca3e7a2e91ee9"
    }
    
    def __init__(self, gcp_integration: GCPIntegration):
        """
        Initialize the BridgeExecutor.
        
        Args:
            gcp_integration: GCP integration instance for blockchain interactions
        """
        super().__init__(gcp_integration)
        self.protocols = BridgeProtocol.all()
    
    def get_supported_protocols(self, source_chain: str, dest_chain: str) -> List[str]:
        """
        Get list of supported bridge protocols for the given chain pair.
        
        Args:
            source_chain: Source blockchain
            dest_chain: Destination blockchain
            
        Returns:
            List of protocol names that support this chain pair
        """
        supported = []
        
        for protocol in self.protocols:
            if (source_chain in self.PROTOCOL_ROUTERS.get(protocol, {}) and 
                dest_chain in self.PROTOCOL_ROUTERS.get(protocol, {})):
                supported.append(protocol)
                
        return supported
    
    def estimate_bridge_fee(
        self, 
        protocol: str, 
        source_chain: str, 
        dest_chain: str, 
        amount: Union[int, float, Decimal]
    ) -> Dict[str, Union[int, float]]:
        """
        Estimate bridge fees for transferring PYUSD using the specified protocol.
        
        Args:
            protocol: Bridge protocol name
            source_chain: Source blockchain
            dest_chain: Destination blockchain
            amount: Amount of PYUSD to bridge
            
        Returns:
            Dictionary with fee details including protocol fee, gas fee, and total fee
        """
        if protocol not in self.protocols:
            raise ValueError(f"Unsupported bridge protocol: {protocol}")
            
        if source_chain not in self.CHAIN_IDS or dest_chain not in self.CHAIN_IDS:
            raise ValueError(f"Unsupported chain pair: {source_chain} to {dest_chain}")
        
        # Convert to wei if needed
        amount_wei = amount
        if isinstance(amount, (float, Decimal)):
            amount_wei = Web3.to_wei(amount, 'ether')
        
        # Get the web3 instance for the source chain
        web3 = self.gcp_integration.get_web3(source_chain)
        
        # Simulate fee estimation logic - this would need to be implemented 
        # with actual contract calls in a production environment
        if protocol == BridgeProtocol.STARGATE:
            # Stargate typically charges 0.06% + fixed fee
            protocol_fee = amount_wei * 0.0006
            gas_fee = self._estimate_stargate_gas(source_chain, dest_chain)
            total_fee = protocol_fee + gas_fee
            
        elif protocol == BridgeProtocol.HOP:
            # Hop typically charges 0.04% + fixed fee depending on the chain
            protocol_fee = amount_wei * 0.0004
            gas_fee = self._estimate_hop_gas(source_chain, dest_chain)
            total_fee = protocol_fee + gas_fee
            
        else:
            # Default estimation for other protocols
            protocol_fee = amount_wei * 0.001  # 0.1%
            gas_fee = 0.001 * 10**18  # 0.001 ETH equivalent
            total_fee = protocol_fee + gas_fee
            
        return {
            "protocol_fee": protocol_fee,
            "gas_fee": gas_fee,
            "total_fee": total_fee,
            "total_fee_eth": Web3.from_wei(int(total_fee), 'ether')
        }
    
    def estimate_destination_amount(
        self, 
        protocol: str, 
        source_chain: str, 
        dest_chain: str, 
        amount: Union[int, float, Decimal]
    ) -> Dict[str, Union[int, float, Decimal]]:
        """
        Estimate the amount that will be received on the destination chain.
        
        Args:
            protocol: Bridge protocol name
            source_chain: Source blockchain
            dest_chain: Destination blockchain
            amount: Amount of PYUSD to bridge
            
        Returns:
            Dictionary with amount details including fees and final amount
        """
        # Get fee estimation
        fee_data = self.estimate_bridge_fee(protocol, source_chain, dest_chain, amount)
        
        # Convert to wei if needed
        amount_wei = amount
        if isinstance(amount, (float, Decimal)):
            amount_wei = Web3.to_wei(amount, 'ether')
            
        # Calculate destination amount after fees
        dest_amount_wei = amount_wei - int(fee_data["protocol_fee"])
        
        return {
            "source_amount": amount_wei,
            "source_amount_readable": Web3.from_wei(amount_wei, 'ether'),
            "protocol_fee": fee_data["protocol_fee"],
            "destination_amount": dest_amount_wei,
            "destination_amount_readable": Web3.from_wei(dest_amount_wei, 'ether'),
            "estimated_arrival_time": self._estimate_arrival_time(protocol, source_chain, dest_chain)
        }
    
    async def execute_bridge(
        self,
        protocol: str,
        source_chain: str,
        dest_chain: str,
        amount: Union[int, float, Decimal],
        sender_address: str,
        recipient_address: str,
        private_key: str,
        gas_price_gwei: Optional[int] = None,
        max_fee_per_gas: Optional[int] = None,
        max_priority_fee_per_gas: Optional[int] = None,
        slippage_tolerance: float = 0.005  # 0.5% default slippage tolerance
    ) -> Dict:
        """
        Execute a bridge transaction to transfer PYUSD across chains.
        
        Args:
            protocol: Bridge protocol name
            source_chain: Source blockchain
            dest_chain: Destination blockchain
            amount: Amount of PYUSD to bridge
            sender_address: Address of the sender
            recipient_address: Address of the recipient on destination chain
            private_key: Private key for transaction signing
            gas_price_gwei: Optional gas price in gwei (for legacy transactions)
            max_fee_per_gas: Optional max fee per gas (for EIP-1559 transactions)
            max_priority_fee_per_gas: Optional max priority fee (for EIP-1559 transactions)
            slippage_tolerance: Slippage tolerance percentage (0.005 = 0.5%)
            
        Returns:
            Dictionary with transaction details
        """
        if protocol not in self.protocols:
            raise ValueError(f"Unsupported bridge protocol: {protocol}")
            
        # Validate chains are supported
        if source_chain not in self.CHAIN_IDS:
            raise ValueError(f"Unsupported source chain: {source_chain}")
        if dest_chain not in self.CHAIN_IDS:
            raise ValueError(f"Unsupported destination chain: {dest_chain}")
        
        # Get web3 instance for source chain
        web3 = self.gcp_integration.get_web3(source_chain)
        
        # Convert amount to wei if needed
        amount_wei = amount
        if isinstance(amount, (float, Decimal)):
            amount_wei = Web3.to_wei(amount, 'ether')
        
        # Prepare transaction parameters
        tx_params = self._prepare_bridge_tx_params(
            protocol=protocol,
            source_chain=source_chain,
            dest_chain=dest_chain,
            amount_wei=amount_wei,
            sender_address=sender_address,
            recipient_address=recipient_address,
            gas_price_gwei=gas_price_gwei,
            max_fee_per_gas=max_fee_per_gas,
            max_priority_fee_per_gas=max_priority_fee_per_gas,
            slippage_tolerance=slippage_tolerance
        )
        
        # Check token allowance and approve if needed
        await self._check_and_approve_token(
            web3=web3,
            token_address=self.PYUSD_ADDRESSES[source_chain],
            owner_address=sender_address,
            spender_address=self.PROTOCOL_ROUTERS[protocol][source_chain],
            amount=amount_wei,
            private_key=private_key
        )
        
        # Execute the bridge transaction
        tx_hash = await self._send_transaction(web3, tx_params, private_key)
        
        # Wait for transaction receipt
        receipt = await self._wait_for_transaction_receipt(web3, tx_hash)
        
        return {
            "transaction_hash": tx_hash.hex(),
            "status": "success" if receipt.status == 1 else "failed",
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "source_chain": source_chain,
            "destination_chain": dest_chain,
            "protocol": protocol,
            "amount": Web3.from_wei(amount_wei, 'ether'),
            "sender": sender_address,
            "recipient": recipient_address,
            "estimated_arrival_time": self._estimate_arrival_time(protocol, source_chain, dest_chain)
        }
    
    async def get_bridge_status(
        self,
        protocol: str,
        source_chain: str,
        dest_chain: str,
        tx_hash: str
    ) -> Dict:
        """
        Check the status of a bridge transaction.
        
        Args:
            protocol: Bridge protocol name
            source_chain: Source blockchain
            dest_chain: Destination blockchain
            tx_hash: Transaction hash of the bridge transaction
            
        Returns:
            Dictionary with status details
        """
        # Get web3 instance for source chain
        web3_source = self.gcp_integration.get_web3(source_chain)
        
        # Check source chain transaction first
        try:
            receipt = web3_source.eth.get_transaction_receipt(tx_hash)
            if not receipt or receipt.status != 1:
                return {
                    "status": "failed" if receipt else "pending",
                    "source_chain_status": "failed" if receipt and receipt.status == 0 else "pending",
                    "destination_chain_status": "not_started",
                    "tx_hash": tx_hash
                }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "tx_hash": tx_hash
            }
            
        # Protocol-specific status checking logic
        if protocol == BridgeProtocol.STARGATE:
            return await self._check_stargate_status(source_chain, dest_chain, tx_hash)
        elif protocol == BridgeProtocol.HOP:
            return await self._check_hop_status(source_chain, dest_chain, tx_hash)
        else:
            # Default status check for other protocols
            return {
                "status": "completed" if receipt.status == 1 else "failed",
                "source_chain_status": "completed" if receipt.status == 1 else "failed",
                "destination_chain_status": "unknown",
                "tx_hash": tx_hash,
                "protocol": protocol,
                "message": f"Detailed status checking not implemented for {protocol} protocol"
            }
