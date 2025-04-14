"""
PYLOT Project Configuration

This file contains configuration settings for the PYLOT project,
including blockchain RPC endpoints, network configurations, and
settings for securely loading API keys from environment variables.
"""

import os
from enum import Enum
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from functools import lru_cache


# Load environment variables from .env file if it exists
load_dotenv()


class Network(Enum):
    """Supported blockchain networks"""
    ETHEREUM_MAINNET = "ethereum_mainnet"
    ETHEREUM_HOLESKY = "ethereum_holesky"


# GCP Blockchain RPC endpoints
BLOCKCHAIN_RPC_ENDPOINTS = {
    Network.ETHEREUM_MAINNET: "https://eth.rpc.blxrbdn.com",  # GCP RPC Mainnet
    Network.ETHEREUM_HOLESKY: "https://ethereum-holesky.rpc.blxrbdn.com",  # GCP RPC Holesky
}

# PYUSD Contract Addresses
PYUSD_ADDRESSES = {
    Network.ETHEREUM_MAINNET: "0x6c3ea9036406c282D277Dc14762a4379D5084619",  # Mainnet PYUSD
    Network.ETHEREUM_HOLESKY: "0x0000000000000000000000000000000000000000",  # Replace with testnet address
}

# Advanced RPC Methods Available on GCP
GCP_ADVANCED_METHODS = {
    'debug_traceTransaction',
    'debug_traceCall',
    'trace_block',
    'trace_transaction',
    'trace_call',
    'eth_getProof'
}


# Default gas settings
GAS_SETTINGS = {
    Network.ETHEREUM_MAINNET: {
        "default_gas_limit": 300000,
        "max_fee_per_gas": 50000000000,  # 50 gwei
        "max_priority_fee_per_gas": 1500000000,  # 1.5 gwei
    },
    Network.ETHEREUM_HOLESKY: {
        "default_gas_limit": 300000,
        "max_fee_per_gas": 30000000000,  # 30 gwei
        "max_priority_fee_per_gas": 1000000000,  # 1 gwei
    }
}


# PYUSD contract addresses
PYUSD_CONTRACTS = {
    Network.ETHEREUM_MAINNET: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
    Network.ETHEREUM_HOLESKY: "",  # Add the testnet address when available
}


# Network configurations
NETWORK_CONFIG = {
    Network.ETHEREUM_MAINNET: {
        "chain_id": 1,
        "name": "Ethereum Mainnet",
        "explorer_url": "https://etherscan.io",
        "is_testnet": False,
        "block_time": 12,  # seconds
    },
    Network.ETHEREUM_HOLESKY: {
        "chain_id": 17000,
        "name": "Ethereum Holesky",
        "explorer_url": "https://holesky.etherscan.io",
        "is_testnet": True,
        "block_time": 12,  # seconds
    },
}


def get_api_key(key_name: str) -> Optional[str]:
    """
    Securely retrieve API keys from environment variables.
    
    Args:
        key_name: The name of the API key to retrieve
        
    Returns:
        The API key value or None if not found
    """
    value = os.environ.get(key_name)
    if not value:
        print(f"Warning: {key_name} not found in environment variables.")
    return value


def get_network_config(network: Network) -> Dict[str, Any]:
    """
    Get the configuration for a specific network.
    
    Args:
        network: The network to get configuration for
        
    Returns:
        Dictionary containing network configuration
    """
    return {
        "rpc_url": BLOCKCHAIN_RPC_ENDPOINTS[network],
        "chain_id": NETWORK_CONFIG[network]["chain_id"],
        "gas_settings": GAS_SETTINGS[network],
        "pyusd_contract": PYUSD_CONTRACTS[network],
        "is_testnet": NETWORK_CONFIG[network]["is_testnet"],
        "explorer_url": NETWORK_CONFIG[network]["explorer_url"],
        "block_time": NETWORK_CONFIG[network]["block_time"],
    }


# Default network to use
DEFAULT_NETWORK = Network.ETHEREUM_HOLESKY if os.environ.get("USE_TESTNET", "true").lower() == "true" else Network.ETHEREUM_MAINNET

# Additional settings
MAX_TRANSACTION_ATTEMPTS = 3
TRANSACTION_RECEIPT_TIMEOUT = 300  # seconds
DEFAULT_SLIPPAGE_TOLERANCE = 0.005  # 0.5%
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")


class Settings(BaseSettings):
    # Environment
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Application
    PROJECT_NAME: str = "PYUSD Intent System"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # Google Cloud
    GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "pyusd-intent-system")
    GOOGLE_CLOUD_REGION: str = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
    BIGQUERY_DATASET: str = os.getenv("BIGQUERY_DATASET", "pyusd_intent_system")
    GCS_BUCKET: str = os.getenv("GCS_BUCKET", "pyusd-intent-system-analytics")
    GOOGLE_APPLICATION_CREDENTIALS: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    GOOGLE_SHEETS_DASHBOARD_ID: str = os.getenv("GOOGLE_SHEETS_DASHBOARD_ID", "")
    GOOGLE_SHEETS_TAB_NAME: str = os.getenv("GOOGLE_SHEETS_TAB_NAME", "")
    
    # Blockchain
    MAINNET_RPC_URL: str = os.getenv("MAINNET_RPC_URL", "")
    SEPOLIA_RPC_URL: str = os.getenv("SEPOLIA_RPC_URL", "")
    SEPOLIA_WSS_URL: str = os.getenv("SEPOLIA_WSS_URL", "")
    USE_TESTNET: bool = os.getenv("USE_TESTNET", "True").lower() == "true"
    PRIVATE_KEY: str = os.getenv("PRIVATE_KEY", "")
    ETHERSCAN_API_KEY: str = os.getenv("ETHERSCAN_API_KEY", "")
    ARBISCAN_API_KEY: str = os.getenv("ARBISCAN_API_KEY", "")
    OPTIMISM_API_KEY: str = os.getenv("OPTIMISM_API_KEY", "")
    TESTNET_CHAIN_ID: str = os.getenv("TESTNET_CHAIN_ID", "")
    REPORT_GAS: str = os.getenv("REPORT_GAS", "")
    
    # Contract Addresses
    PYUSD_ADDRESS: str = os.getenv("PYUSD_ADDRESS", "")
    UNISWAP_V2_ROUTER: str = os.getenv("UNISWAP_V2_ROUTER", "")
    UNISWAP_V3_ROUTER: str = os.getenv("UNISWAP_V3_ROUTER", "")
    ONEINCH_ROUTER: str = os.getenv("ONEINCH_ROUTER", "")
    CURVE_POOL: str = os.getenv("CURVE_POOL", "")
    LAYERZERO_ENDPOINT: str = os.getenv("LAYERZERO_ENDPOINT", "")
    HOP_BRIDGE: str = os.getenv("HOP_BRIDGE", "")
    STARGATE_ROUTER: str = os.getenv("STARGATE_ROUTER", "")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALLOWED_HOSTS: list = os.getenv("ALLOWED_HOSTS", "*").split(",")
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")
    
    # Rate Limiting
    RATE_LIMIT_PER_SECOND: int = int(os.getenv("RATE_LIMIT_PER_SECOND", "10"))
    
    # Monitoring
    ENABLE_METRICS: bool = os.getenv("ENABLE_METRICS", "True").lower() == "true"
    
    class Config:
        case_sensitive = True
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

# Production specific settings
class ProductionSettings(Settings):
    DEBUG: bool = False
    ALLOWED_HOSTS: list = ["api.pyusd-intent-system.cloud.goog"]
    CORS_ORIGINS: list = [
        "https://pyusd-intent-system.cloud.goog",
        "https://app.pyusd-intent-system.cloud.goog"
    ]
    
    class Config:
        env_prefix = "PROD_"

@lru_cache()
def get_production_settings() -> Optional[ProductionSettings]:
    if os.getenv("ENV") == "production":
        return ProductionSettings()
    return None

settings = get_settings()
prod_settings = get_production_settings()

