import { Box, VStack, Text, HStack, Stat, StatLabel, StatNumber, StatHelpText } from '@chakra-ui/react';

interface AnalyticsDashboardProps {
  gasUsed: string;
  internalTransfers: number;
  crossChainOperations: number;
  dexSwaps: number;
  executionTime: number;
  totalVolume: string;
  successRate: number;
}

export function AnalyticsDashboard({
  gasUsed,
  internalTransfers,
  crossChainOperations,
  dexSwaps,
  executionTime,
  totalVolume,
  successRate
}: AnalyticsDashboardProps) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <VStack spacing={6} align="stretch">
        <Text fontWeight="bold" fontSize="lg">Transaction Analytics</Text>
        
        <HStack spacing={4}>
          <Stat>
            <StatLabel>Gas Used</StatLabel>
            <StatNumber>{gasUsed}</StatNumber>
            <StatHelpText>ETH</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Execution Time</StatLabel>
            <StatNumber>{executionTime}s</StatNumber>
            <StatHelpText>Average</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Total Volume</StatLabel>
            <StatNumber>${totalVolume}</StatNumber>
            <StatHelpText>PYUSD</StatHelpText>
          </Stat>
        </HStack>

        <HStack spacing={4}>
          <Stat>
            <StatLabel>Internal Transfers</StatLabel>
            <StatNumber>{internalTransfers}</StatNumber>
            <StatHelpText>Operations</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Cross-Chain Operations</StatLabel>
            <StatNumber>{crossChainOperations}</StatNumber>
            <StatHelpText>Bridges</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>DEX Swaps</StatLabel>
            <StatNumber>{dexSwaps}</StatNumber>
            <StatHelpText>Transactions</StatHelpText>
          </Stat>
        </HStack>

        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Success Rate</Text>
          <Box display="flex" alignItems="center" gap={2}>
            <Box flex={1} bg="gray.100" borderRadius="md" h="4px">
              <Box
                bg={successRate > 0.9 ? "green.500" : successRate > 0.7 ? "yellow.500" : "red.500"}
                w={`${successRate * 100}%`}
                h="100%"
                borderRadius="md"
              />
            </Box>
            <Text fontSize="sm" fontWeight="medium">
              {Math.round(successRate * 100)}%
            </Text>
          </Box>
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Performance Metrics</Text>
          <VStack spacing={2} align="stretch">
            <Box>
              <Text fontSize="xs" color="gray.500">Gas Optimization</Text>
              <Text fontSize="sm" fontWeight="medium">
                {parseFloat(gasUsed) < 200000 ? "Optimal" : "High"}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500">Cross-Chain Efficiency</Text>
              <Text fontSize="sm" fontWeight="medium">
                {crossChainOperations > 0 ? "Active" : "Inactive"}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500">DEX Integration</Text>
              <Text fontSize="sm" fontWeight="medium">
                {dexSwaps > 0 ? "Active" : "Inactive"}
              </Text>
            </Box>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
} 