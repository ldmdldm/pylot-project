#!/usr/bin/env python3
"""
PYLOT - Intent-Based Transaction System for PYUSD
Entry point module that provides a CLI interface for expressing and executing transaction intents.
"""

import argparse
import logging
import sys
from typing import Dict, Any, Optional

from pylot.intent.parser import IntentParser, Intent
from pylot.routing.optimizer import RoutingOptimizer
from pylot.execution.base import TransactionExecutor
from pylot.execution.transfer import TokenTransferExecutor
from pylot.execution.swap import TokenSwapExecutor
from pylot.execution.bridge import BridgeExecutor
from pylot.integrations.gcp import GCPIntegration

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("pylot")


def setup_argparse() -> argparse.ArgumentParser:
    """Set up command line argument parser for PYLOT."""
    parser = argparse.ArgumentParser(
        description="PYLOT - Intent-Based Transaction System for PYUSD",
        epilog="Example: python -m pylot transfer --from ethereum --to optimism --amount 100"
    )
    
    subparsers = parser.add_subparsers(dest="intent_type", help="Type of intent to execute")
    
    # Transfer intent
    transfer_parser = subparsers.add_parser("transfer", help="Transfer PYUSD to an address")
    transfer_parser.add_argument("--from", dest="from_chain", required=True, 
                              help="Source blockchain (ethereum, optimism, arbitrum, base)")
    transfer_parser.add_argument("--to", dest="to_address", required=True, 
                              help="Destination address")
    transfer_parser.add_argument("--amount", type=float, required=True, 
                              help="Amount of PYUSD to transfer")
    
    # Swap intent
    swap_parser = subparsers.add_parser("swap", help="Swap PYUSD for another token")
    swap_parser.add_argument("--chain", required=True, 
                           help="Blockchain to execute the swap on")
    swap_parser.add_argument("--to-token", required=True, 
                           help="Token to swap PYUSD for (e.g., ETH, USDC)")
    swap_parser.add_argument("--amount", type=float, required=True, 
                           help="Amount of PYUSD to swap")
    
    # Bridge intent
    bridge_parser = subparsers.add_parser("bridge", help="Bridge PYUSD to another chain")
    bridge_parser.add_argument("--from", dest="from_chain", required=True, 
                             help="Source blockchain")
    bridge_parser.add_argument("--to", dest="to_chain", required=True, 
                             help="Destination blockchain")
    bridge_parser.add_argument("--amount", type=float, required=True, 
                             help="Amount of PYUSD to bridge")
    
    return parser


def process_intent(args: argparse.Namespace) -> Optional[Dict[str, Any]]:
    """
    Process the user's intent based on command line arguments.
    
    Args:
        args: Parsed command line arguments
        
    Returns:
        Optional dictionary with intent details or None if intent_type is not specified
    """
    if not args.intent_type:
        return None
    
    intent_parser = IntentParser()
    
    if args.intent_type == "transfer":
        intent = intent_parser.parse_transfer_intent(
            from_chain=args.from_chain,
            to_address=args.to_address,
            amount=args.amount
        )
    elif args.intent_type == "swap":
        intent = intent_parser.parse_swap_intent(
            chain=args.chain,
            to_token=args.to_token,
            amount=args.amount
        )
    elif args.intent_type == "bridge":
        intent = intent_parser.parse_bridge_intent(
            from_chain=args.from_chain,
            to_chain=args.to_chain,
            amount=args.amount
        )
    else:
        logger.error(f"Unknown intent type: {args.intent_type}")
        return None
    
    return intent.to_dict() if intent else None


def execute_intent(intent: Dict[str, Any]) -> bool:
    """
    Execute the provided intent by finding optimal route and executing transactions.
    
    Args:
        intent: Dictionary containing intent details
        
    Returns:
        True if execution was successful, False otherwise
    """
    logger.info(f"Processing intent: {intent}")
    
    # Initialize GCP Blockchain RPC integration
    gcp_integration = GCPIntegration()
    
    # Set up the routing optimizer
    optimizer = RoutingOptimizer(gcp_integration)
    
    # Find the optimal route for executing this intent
    intent_obj = Intent.from_dict(intent)
    routes = optimizer.find_optimal_routes(intent_obj)
    
    if not routes:
        logger.error("No viable routes found for this intent")
        return False
    
    # Select the best route (first one is already the best according to optimizer)
    best_route = routes[0]
    logger.info(f"Selected optimal route: {best_route}")
    
    # Initialize the appropriate executor based on intent type
    if intent["type"] == "transfer":
        executor = TokenTransferExecutor(gcp_integration)
    elif intent["type"] == "swap":
        executor = TokenSwapExecutor(gcp_integration)
    elif intent["type"] == "bridge":
        executor = BridgeExecutor(gcp_integration)
    else:
        logger.error(f"No executor available for intent type: {intent['type']}")
        return False
    
    # Execute the transaction following the selected route
    try:
        tx_result = executor.execute(best_route)
        logger.info(f"Transaction executed successfully: {tx_result}")
        return True
    except Exception as e:
        logger.error(f"Error executing transaction: {str(e)}")
        return False


def main() -> int:
    """
    Main entry point for the PYLOT application.
    
    Returns:
        Exit code (0 for success, non-zero for error)
    """
    parser = setup_argparse()
    args = parser.parse_args()
    
    if len(sys.argv) == 1:
        parser.print_help()
        return 1
    
    intent = process_intent(args)
    if not intent:
        logger.error("Failed to process intent from command line arguments")
        return 1
    
    success = execute_intent(intent)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())

