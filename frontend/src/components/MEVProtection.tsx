import { Box, VStack, Text, Badge, Progress } from '@chakra-ui/react';

interface MEVProtectionProps {
  sandwichRisk: number;
  arbitrageRisk: number;
  protectionScore: number;
  isLoading?: boolean;
}

export function MEVProtection({
  sandwichRisk,
  arbitrageRisk,
  protectionScore,
  isLoading = false
}: MEVProtectionProps) {
  const getRiskColor = (risk: number) => {
    if (risk < 0.3) return 'green';
    if (risk < 0.7) return 'yellow';
    return 'red';
  };

  const getRiskLabel = (risk: number) => {
    if (risk < 0.3) return 'Low';
    if (risk < 0.7) return 'Medium';
    return 'High';
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <VStack spacing={4} align="stretch">
        <Text fontWeight="bold">MEV Protection</Text>
        
        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Sandwich Attack Risk</Text>
          <Box display="flex" alignItems="center" gap={2}>
            <Progress
              value={sandwichRisk * 100}
              colorScheme={getRiskColor(sandwichRisk)}
              size="sm"
              flex={1}
            />
            <Badge colorScheme={getRiskColor(sandwichRisk)}>
              {getRiskLabel(sandwichRisk)}
            </Badge>
          </Box>
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Arbitrage Risk</Text>
          <Box display="flex" alignItems="center" gap={2}>
            <Progress
              value={arbitrageRisk * 100}
              colorScheme={getRiskColor(arbitrageRisk)}
              size="sm"
              flex={1}
            />
            <Badge colorScheme={getRiskColor(arbitrageRisk)}>
              {getRiskLabel(arbitrageRisk)}
            </Badge>
          </Box>
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Protection Score</Text>
          <Box display="flex" alignItems="center" gap={2}>
            <Progress
              value={protectionScore * 100}
              colorScheme={protectionScore > 0.7 ? 'green' : 'yellow'}
              size="sm"
              flex={1}
            />
            <Badge colorScheme={protectionScore > 0.7 ? 'green' : 'yellow'}>
              {Math.round(protectionScore * 100)}%
            </Badge>
          </Box>
        </Box>

        {isLoading && (
          <Text fontSize="sm" color="gray.500" textAlign="center">
            Analyzing transaction for MEV risks...
          </Text>
        )}
      </VStack>
    </Box>
  );
} 