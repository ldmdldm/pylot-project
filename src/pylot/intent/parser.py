from dataclasses import dataclass, field
from typing import Dict, Optional, Any, List, Union
from decimal import Decimal


@dataclass
class Intent:
    """
    Represents a user's transaction intent for PYUSD operations.
    
    Attributes:
        intent_type: Type of intent (transfer, swap, bridge)
        source_chain: Source blockchain network
        source_token: Token to be used from source chain
        amount: Amount of tokens to use in the transaction
        destination_chain: Target blockchain network (if different from source)
        destination_token: Target token to receive
        destination_address: Address to receive tokens
        options: Additional parameters for the transaction (slippage, timeout, etc.)
    """
    intent_type: str  # "transfer", "swap", or "bridge"
    source_chain: str
    source_token: str
    amount: Decimal
    destination_chain: Optional[str] = None
    destination_token: Optional[str] = None
    destination_address: Optional[str] = None
    options: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert intent to dictionary representation."""
        return {
            "intent_type": self.intent_type,
            "source_chain": self.source_chain,
            "source_token": self.source_token,
            "amount": str(self.amount),  # Convert Decimal to string for serialization
            "destination_chain": self.destination_chain,
            "destination_token": self.destination_token,
            "destination_address": self.destination_address,
            "options": self.options
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Intent':
        """Create intent from dictionary representation."""
        # Convert amount from string to Decimal
        if "amount" in data and isinstance(data["amount"], str):
            data = data.copy()  # Make a copy to avoid modifying the original
            data["amount"] = Decimal(data["amount"])
        return cls(**data)


class IntentParser:
    """
    Parser for user transaction intents related to PYUSD operations.
    Converts user inputs into structured Intent objects.
    """
    
    def parse_transfer_intent(
        self, 
        source_chain: str,
        amount: Union[Decimal, str, float],
        destination_address: str,
        token: str = "PYUSD",
        options: Dict[str, Any] = None
    ) -> Intent:
        """
        Parse a transfer intent to send tokens to another address on the same chain.
        
        Args:
            source_chain: The blockchain where the transfer occurs
            amount: Amount of tokens to transfer
            destination_address: Address to receive the tokens
            token: Token to transfer (default: PYUSD)
            options: Additional parameters like gas price preferences
            
        Returns:
            Intent object representing the transfer
        """
        amount_decimal = Decimal(str(amount)) if not isinstance(amount, Decimal) else amount
        
        return Intent(
            intent_type="transfer",
            source_chain=source_chain,
            source_token=token,
            amount=amount_decimal,
            destination_chain=source_chain,  # Same chain for transfers
            destination_token=token,  # Same token for transfers
            destination_address=destination_address,
            options=options or {}
        )
    
    def parse_swap_intent(
        self,
        source_chain: str,
        source_token: str,
        amount: Union[Decimal, str, float],
        destination_token: str,
        destination_address: Optional[str] = None,
        options: Dict[str, Any] = None
    ) -> Intent:
        """
        Parse a swap intent to exchange one token for another on the same chain.
        
        Args:
            source_chain: The blockchain where the swap occurs
            source_token: Token to swap from
            amount: Amount of source tokens to swap
            destination_token: Token to swap to
            destination_address: Address to receive swapped tokens (if different from sender)
            options: Additional parameters like slippage tolerance, minimum output
            
        Returns:
            Intent object representing the swap
        """
        amount_decimal = Decimal(str(amount)) if not isinstance(amount, Decimal) else amount
        
        return Intent(
            intent_type="swap",
            source_chain=source_chain,
            source_token=source_token,
            amount=amount_decimal,
            destination_chain=source_chain,  # Same chain for swaps
            destination_token=destination_token,
            destination_address=destination_address,
            options=options or {}
        )
    
    def parse_bridge_intent(
        self,
        source_chain: str,
        destination_chain: str,
        amount: Union[Decimal, str, float],
        destination_address: str,
        source_token: str = "PYUSD",
        destination_token: str = "PYUSD",
        options: Dict[str, Any] = None
    ) -> Intent:
        """
        Parse a bridge intent to transfer tokens across different blockchains.
        
        Args:
            source_chain: Source blockchain network
            destination_chain: Target blockchain network
            amount: Amount of tokens to bridge
            destination_address: Address to receive tokens on the destination chain
            source_token: Token to bridge from (default: PYUSD)
            destination_token: Token to receive on destination chain (default: PYUSD)
            options: Additional parameters like bridge protocol preference, fee options
            
        Returns:
            Intent object representing the bridge operation
        """
        amount_decimal = Decimal(str(amount)) if not isinstance(amount, Decimal) else amount
        
        return Intent(
            intent_type="bridge",
            source_chain=source_chain,
            source_token=source_token,
            amount=amount_decimal,
            destination_chain=destination_chain,
            destination_token=destination_token,
            destination_address=destination_address,
            options=options or {}
        )
    
    def parse_from_dict(self, data: Dict[str, Any]) -> Intent:
        """
        Parse an intent from a dictionary representation.
        
        Args:
            data: Dictionary with intent parameters
            
        Returns:
            Intent object
        """
        intent_type = data.get("intent_type")
        
        if intent_type == "transfer":
            return self.parse_transfer_intent(
                source_chain=data.get("source_chain"),
                amount=data.get("amount"),
                destination_address=data.get("destination_address"),
                token=data.get("source_token", "PYUSD"),
                options=data.get("options", {})
            )
        elif intent_type == "swap":
            return self.parse_swap_intent(
                source_chain=data.get("source_chain"),
                source_token=data.get("source_token"),
                amount=data.get("amount"),
                destination_token=data.get("destination_token"),
                destination_address=data.get("destination_address"),
                options=data.get("options", {})
            )
        elif intent_type == "bridge":
            return self.parse_bridge_intent(
                source_chain=data.get("source_chain"),
                destination_chain=data.get("destination_chain"),
                amount=data.get("amount"),
                destination_address=data.get("destination_address"),
                source_token=data.get("source_token", "PYUSD"),
                destination_token=data.get("destination_token", "PYUSD"),
                options=data.get("options", {})
            )
        else:
            raise ValueError(f"Unknown intent type: {intent_type}")

