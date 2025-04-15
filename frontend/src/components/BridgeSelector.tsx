import { useState } from 'react';
import { Box, VStack, Text, Button, Select } from '@chakra-ui/react';

interface BridgeSelectorProps {
  onBridgeSelect: (bridge: string) => void;
  onChainSelect: (chain: string) => void;
  disabled?: boolean;
}

const SUPPORTED_BRIDGES = [
  { id: 'hop', name: 'Hop Protocol' },
  { id: 'layerzero', name: 'LayerZero' },
  { id: 'stargate', name: 'Stargate' }
];

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'optimism', name: 'Optimism' }
];

export function BridgeSelector({ onBridgeSelect, onChainSelect, disabled = false }: BridgeSelectorProps) {
  const [selectedBridge, setSelectedBridge] = useState('');
  const [selectedChain, setSelectedChain] = useState('');

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <VStack spacing={4} align="stretch">
        <Text fontWeight="bold">Cross-Chain Bridge</Text>
        
        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Select Bridge</Text>
          <Select
            value={selectedBridge}
            onChange={(e) => {
              setSelectedBridge(e.target.value);
              onBridgeSelect(e.target.value);
            }}
            disabled={disabled}
          >
            <option value="">Choose a bridge</option>
            {SUPPORTED_BRIDGES.map((bridge) => (
              <option key={bridge.id} value={bridge.id}>
                {bridge.name}
              </option>
            ))}
          </Select>
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Target Chain</Text>
          <Select
            value={selectedChain}
            onChange={(e) => {
              setSelectedChain(e.target.value);
              onChainSelect(e.target.value);
            }}
            disabled={disabled || !selectedBridge}
          >
            <option value="">Choose a chain</option>
            {SUPPORTED_CHAINS.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </Select>
        </Box>

        {selectedBridge && selectedChain && (
          <Box p={4} bg="blue.50" borderRadius="md">
            <Text fontSize="sm">
              Using {SUPPORTED_BRIDGES.find(b => b.id === selectedBridge)?.name} to bridge to {SUPPORTED_CHAINS.find(c => c.id === selectedChain)?.name}
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
} 