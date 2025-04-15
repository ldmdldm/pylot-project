import { Box, VStack, Text, Button } from '@chakra-ui/react';
import type { Token } from '@/lib/types';

interface SwapRouteProps {
  fromToken: Token;
  toToken: Token;
  route: string[];
  expectedOutput: string;
  priceImpact: string;
  gasCost: string;
  executionTime: number;
  onSwap: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SwapRoute({
  fromToken,
  toToken,
  route,
  expectedOutput,
  priceImpact,
  gasCost,
  executionTime,
  onSwap,
  isLoading = false,
  disabled = false
}: SwapRouteProps) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <VStack spacing={3} align="stretch">
        <Text fontWeight="bold">Route Details</Text>
        
        <Box>
          <Text fontSize="sm" color="gray.600">Path:</Text>
          {route.map((step, index) => (
            <Text key={index} pl={4}>
              {index + 1}. {step}
            </Text>
          ))}
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600">Expected Output:</Text>
          <Text pl={4}>{expectedOutput} {toToken.symbol}</Text>
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600">Price Impact:</Text>
          <Text pl={4}>{priceImpact}%</Text>
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600">Gas Cost:</Text>
          <Text pl={4}>{gasCost} ETH</Text>
        </Box>

        <Box>
          <Text fontSize="sm" color="gray.600">Estimated Time:</Text>
          <Text pl={4}>{executionTime} seconds</Text>
        </Box>

        <Button
          colorScheme="blue"
          onClick={onSwap}
          isLoading={isLoading}
          isDisabled={disabled}
          loadingText="Swapping..."
        >
          Swap {fromToken.symbol} for {toToken.symbol}
        </Button>
      </VStack>
    </Box>
  );
}
