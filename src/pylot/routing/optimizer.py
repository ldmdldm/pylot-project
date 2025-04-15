"""
Routing optimizer for PYLOT intent-based transaction system.

This module contains classes for optimizing transaction routes across different
chains, bridges, and DEXs when working with PYUSD.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union
import time
from decimal import Decimal

# Define constants for different types of transaction components
class RouteType(Enum):
    DIRECT = "direct"  # Direct transfer on same chain
    SWAP = "swap"      # DEX swap
    BRIDGE = "bridge"  # Cross-chain bridge
    COMPLEX = "complex"  # Multi-step route


class ChainId(Enum):
    """Common EVM chain IDs"""
    ETHEREUM = 1
    ARBITRUM = 42161
    OPTIMISM = 10
    POLYGON = 137
    BASE = 8453


class DexProtocol(Enum):
    """Common DEX protocols"""
    UNISWAP_V2 = "uniswap_v2"
    UNISWAP_V3 = "uniswap_v3"
    SUSHISWAP = "sushiswap"
    CURVE = "curve"
    BALANCER = "balancer"
    ONEINCH = "1inch"


class BridgeProtocol(Enum):
    """Common bridge protocols"""
    STARGATE = "stargate"
    HOP = "hop"
    LAYERZERO = "layerzero"
    AXELAR = "axelar"
    CONNEXT = "connext"


@dataclass
class RouteStep:
    """Represents a single step in a multi-step transaction route"""
    step_type: RouteType
    source_chain_id: ChainId
    destination_chain_id: ChainId
    protocol: Union[DexProtocol, BridgeProtocol, None]
    token_in: str
    token_out: str
    amount_in: Decimal
    estimated_amount_out: Decimal
    estimated_gas_cost: Decimal
    estimated_execution_time: int  # in seconds


class Route:
    """
    Represents a complete transaction path from source to destination.
    
    A route consists of one or more steps that need to be executed in sequence
    to fulfill the user's intent. Each step can be a direct transfer, swap, or
    bridge operation.
    """
    
    def __init__(self, 
                 source_chain_id: ChainId,
                 destination_chain_id: ChainId,
                 steps: List[RouteStep]):
        """
        Initialize a new route.
        
        Args:
            source_chain_id: The starting chain ID
            destination_chain_id: The final chain ID
            steps: List of RouteStep objects that make up this route
        """
        self.source_chain_id = source_chain_id
        self.destination_chain_id = destination_chain_id
        self.steps = steps
        self.route_id = f"{int(time.time())}_{source_chain_id.value}_{destination_chain_id.value}"
        
        # Validate steps form a valid path
        self._validate_steps()
    
    def _validate_steps(self):
        """Ensure steps form a valid path from source to destination"""
        if not self.steps:
            raise ValueError("Route must contain at least one step")
        
        # First step should start from source chain
        if self.steps[0].source_chain_id != self.source_chain_id:
            raise ValueError(f"First step must start from {self.source_chain_id}")
        
        # Last step should end at destination chain
        if self.steps[-1].destination_chain_id != self.destination_chain_id:
            raise ValueError(f"Last step must end at {self.destination_chain_id}")
        
        # Each step should connect to the next
        for i in range(len(self.steps) - 1):
            if self.steps[i].destination_chain_id != self.steps[i+1].source_chain_id:
                raise ValueError(f"Step {i+1} doesn't connect to step {i+2}")
    
    def estimate_total_gas_cost(self) -> Decimal:
        """Calculate the total gas cost across all steps in USD value"""
        return sum(step.estimated_gas_cost for step in self.steps)
    
    def estimate_execution_time(self) -> int:
        """
        Estimate the total execution time in seconds.
        
        For bridges, this includes the finality time of transactions on
        the source chain and the confirmation time on the destination chain.
        """
        return sum(step.estimated_execution_time for step in self.steps)
    
    def estimate_total_fees(self) -> Decimal:
        """
        Calculate the total fees including gas costs, bridge fees,
        and DEX trading fees.
        """
        # Gas cost is the base fee
        total_fee = self.estimate_total_gas_cost()
        
        # Add protocol fees for each step (approximation)
        for step in self.steps:
            if step.step_type == RouteType.BRIDGE:
                # Bridge fees typically range from 0.1% to 0.5%
                bridge_fee = step.amount_in * Decimal('0.003')  # 0.3% average
                total_fee += bridge_fee
            
            elif step.step_type == RouteType.SWAP:
                # DEX fees typically range from 0.05% to 0.3%
                if step.protocol == DexProtocol.CURVE:
                    dex_fee = step.amount_in * Decimal('0.0004')  # 0.04%
                else:
                    dex_fee = step.amount_in * Decimal('0.003')  # 0.3% for most DEXes
                total_fee += dex_fee
        
        return total_fee
    
    def estimate_slippage(self) -> Decimal:
        """
        Estimate the expected slippage across all swap operations.
        
        Returns:
            Decimal: The estimated slippage as a percentage
        """
        # Basic implementation - in a real system this would calculate based on
        # liquidity data from each DEX
        total_swap_amount = Decimal('0')
        weighted_slippage = Decimal('0')
        
        for step in self.steps:
            if step.step_type == RouteType.SWAP:
                total_swap_amount += step.amount_in
                
                # Estimate slippage based on amount and protocol
                if step.protocol == DexProtocol.CURVE:
                    # Curve typically has lower slippage for stablecoins
                    step_slippage = Decimal('0.001') * step.amount_in  # 0.1%
                elif step.protocol == DexProtocol.UNISWAP_V3:
                    # Uniswap V3 has concentrated liquidity
                    step_slippage = Decimal('0.002') * step.amount_in  # 0.2%
                else:
                    # Other DEXes
                    step_slippage = Decimal('0.004') * step.amount_in  # 0.4%
                
                weighted_slippage += step_slippage
        
        if total_swap_amount == 0:
            return Decimal('0')
        
        return (weighted_slippage / total_swap_amount) * 100  # Return as percentage
    
    def to_dict(self) -> Dict:
        """Convert route to dictionary representation for serialization"""
        return {
            "route_id": self.route_id,
            "source_chain_id": self.source_chain_id.value,
            "destination_chain_id": self.destination_chain_id.value,
            "steps": [
                {
                    "step_type": step.step_type.value,
                    "source_chain_id": step.source_chain_id.value,
                    "destination_chain_id": step.destination_chain_id.value,
                    "protocol": step.protocol.value if step.protocol else None,
                    "token_in": step.token_in,
                    "token_out": step.token_out,
                    "amount_in": str(step.amount_in),
                    "estimated_amount_out": str(step.estimated_amount_out),
                    "estimated_gas_cost": str(step.estimated_gas_cost),
                    "estimated_execution_time": step.estimated_execution_time
                }
                for step in self.steps
            ],
            "total_gas_cost": str(self.estimate_total_gas_cost()),
            "total_execution_time": self.estimate_execution_time(),
            "total_fees": str(self.estimate_total_fees()),
            "estimated_slippage": str(self.estimate_slippage())
        }


class RoutingOptimizer:
    """
    Analyzes and optimizes transaction paths across different chains,
    bridges, and DEXs to find the optimal route for PYUSD transactions.
    """
    
    def __init__(self, chain_providers: Dict[ChainId, str], 
                 pyusd_addresses: Dict[ChainId, str]):
        """
        Initialize the routing optimizer.
        
        Args:
            chain_providers: Dictionary mapping chain IDs to RPC endpoints
            pyusd_addresses: Dictionary mapping chain IDs to PYUSD token addresses
        """
        self.chain_providers = chain_providers
        self.pyusd_addresses = pyusd_addresses
        self.dex_routers = self._initialize_dex_routers()
        self.bridge_routers = self._initialize_bridge_routers()
        
    def _initialize_dex_routers(self) -> Dict[Tuple[ChainId, DexProtocol], str]:
        """Initialize DEX router contract addresses for each supported chain/protocol"""
        # This would be populated with actual contract addresses
        # In a real implementation, these might be loaded from a config file
        return {
            (ChainId.ETHEREUM, DexProtocol.UNISWAP_V3): "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            (ChainId.ETHEREUM, DexProtocol.CURVE): "0x99a58482BD75cbab83b27EC03CA68fF489b5788f",
            (ChainId.ARBITRUM, DexProtocol.UNISWAP_V3): "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            # Add other supported DEXes and chains
        }
    
    def _initialize_bridge_routers(self) -> Dict[Tuple[ChainId, BridgeProtocol], str]:
        """Initialize bridge router contract addresses for each supported chain/protocol"""
        # This would be populated with actual contract addresses
        return {
            (ChainId.ETHEREUM, BridgeProtocol.STARGATE): "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
            (ChainId.ETHEREUM, BridgeProtocol.HOP): "0xb8901acB165ed027E32754E0FFe830802919727f",
            (ChainId.ARBITRUM, BridgeProtocol.STARGATE): "0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614",
            # Add other supported bridges and chains
        }
    
    def find_optimal_routes(self, 
                           source_chain_id: ChainId,
                           destination_chain_id: ChainId,
                           token_in: str,
                           token_out: str,
                           amount: Decimal,
                           optimization_criteria: str = "cost") -> List[Route]:
        """
        Find optimal routes for a transaction based on the given criteria.
        
        Args:
            source_chain_id: The chain ID where the transaction starts
            destination_chain_id: The chain ID where the transaction should end
            token_in: The input token address or symbol
            token_out: The output token address or symbol
            amount: The amount of input token
            optimization_criteria: What to optimize for ("cost", "time", "slippage")
            
        Returns:
            List[Route]: A list of possible routes, sorted by the optimization criteria
        """
        # Generate possible routes
        possible_routes = self._generate_routes(
            source_chain_id, destination_chain_id, token_in, token_out, amount
        )
        
        # Sort based on optimization criteria
        if optimization_criteria == "cost":
            possible_routes.sort(key=lambda route: route.estimate_total_fees())
        elif optimization_criteria == "time":
            possible_routes.sort(key=lambda route: route.estimate_execution_time())
        elif optimization_criteria == "slippage":
            possible_routes.sort(key=lambda route: route.estimate_slippage())
        else:
            # Default to optimizing for cost
            possible_routes.sort(key=lambda route: route.estimate_total_fees())
        
        return possible_routes
    
    def _generate_routes(self,
                        source_chain_id: ChainId,
                        destination_chain_id: ChainId,
                        token_in: str,
                        token_out: str,
                        amount: Decimal) -> List[Route]:
        """
        Generate possible routes between chains for the given tokens and amount.
        
        This method implements the core routing algorithm that considers:
        1. Direct transfers (if on same chain)
        2. Direct bridging (if PYUSD on both chains)
        3. Swap then bridge routes
        4. Bridge then swap routes
        5. Multiple bridge routes (for chains without direct bridges)
        
        Args:
            source_chain_id: The starting chain
            destination_chain_id: The destination chain
            token_in: Input token address or symbol
            token_out: Output token address or symbol
            amount: Amount of input token
            
        Returns:
            List[Route]: List of possible routes
        """
        routes = []
        
        # For demo purposes, we'll create some sample routes
        # In a real implementation, this would query on-chain data
        
        # Case 1: Same chain, might need a swap
        if source_chain_id == destination_chain_id:
            if token_in == token_out:
                # Direct transfer
                step = RouteStep(
                    step_type=RouteType.DIRECT,
                    source_chain_id=source_chain_id,
                    destination_chain_id=destination_chain_id,
                    protocol=None,
                    token_in=token_in,
                    token_out=token_out,
                    amount_in=amount,
                    estimated_amount_out=amount,
                    estimated_gas_cost=Decimal('5'),  # Example gas cost in USD
                    estimated_execution_time=15  # Seconds
                )
                routes.append(Route(source_chain_id, destination_chain_id, [step]))
            else:
                # Need a swap on the same chain
                for dex in [DexProtocol.UNISWAP_V3, DexProtocol.CURVE]:
                    # Check if this DEX is supported on this chain
                    if (source_chain_id, dex) in self.dex_routers:
                        swap_step = RouteStep(
                            step_type

