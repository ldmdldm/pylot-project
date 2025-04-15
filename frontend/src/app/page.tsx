'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { 
  VStack, 
  Container, 
  Heading, 
  Text, 
  Box, 
  useColorModeValue,
  Button,
  Icon,
  useToast,
  NumberInput,
  NumberInputField,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { TokenSelector } from '@/components/TokenSelector';
import { FeaturePanel } from '@/components/FeaturePanel';
import { SwapRoute } from '@/components/SwapRoute';
import { Navigation } from '@/components/Navigation';
import { optimizeRoute } from '@/lib/api';
import type { Token, OptimizationResult } from '@/lib/types';
import { ArrowDownIcon } from '@heroicons/react/24/solid';

export default function Home() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const [inputToken, setInputToken] = useState<Token | null>(null);
  const [outputToken, setOutputToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleConnect = () => {
    connect({ connector: metaMask() });
  };

  const handleOptimize = async () => {
    if (!inputToken || !outputToken || !amount || !address) return;

    setIsLoading(true);
    try {
      const result = await optimizeRoute({
        inputToken,
        outputToken,
        amount,
        slippage: 0.5,
        recipient: address,
      });
      setOptimizationResult(result);
      toast({
        title: 'Route optimized',
        description: 'Found the best swap route for your trade',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Optimization failed',
        description: error instanceof Error ? error.message : 'Failed to optimize route',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navigation />
      <Container maxW="container.md" py={8}>
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Heading as="h1" size="xl" mb={2} color="brand.600">
              PYUSD Intent System
            </Heading>
            <Text color="gray.600" fontSize="lg">
              Swap tokens with optimized routes and minimal slippage
            </Text>
          </Box>

          <Box
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            p={6}
            shadow="sm"
          >
            {isConnected ? (
              <VStack spacing={6} align="stretch">
                <FormControl>
                  <FormLabel>Amount</FormLabel>
                  <NumberInput value={amount} onChange={(value) => setAmount(value)}>
                    <NumberInputField placeholder="Enter amount" />
                  </NumberInput>
                </FormControl>

                <TokenSelector
                  label="From"
                  value={inputToken}
                  onChange={setInputToken}
                />
                
                <Box textAlign="center">
                  <Button
                    size="sm"
                    variant="ghost"
                    rounded="full"
                    onClick={() => {
                      const temp = inputToken;
                      setInputToken(outputToken);
                      setOutputToken(temp);
                    }}
                  >
                    <Icon as={ArrowDownIcon} boxSize={5} />
                  </Button>
                </Box>

                <TokenSelector
                  label="To"
                  value={outputToken}
                  onChange={setOutputToken}
                />

                <FeaturePanel 
                  title="Optimization Features"
                  description="Advanced routing and slippage protection"
                  icon="info"
                />
                
                <Button
                  colorScheme="brand"
                  size="lg"
                  isLoading={isLoading}
                  onClick={handleOptimize}
                  isDisabled={!inputToken || !outputToken || !amount}
                >
                  Find Best Route
                </Button>

                {optimizationResult && (
                  <Box mt={4}>
                    <SwapRoute
                      fromToken={inputToken}
                      toToken={outputToken}
                      route={optimizationResult.route.steps}
                      expectedOutput={optimizationResult.route.expectedOutput}
                      priceImpact={optimizationResult.route.priceImpact}
                      gasCost={optimizationResult.route.gasEstimate}
                      executionTime={optimizationResult.analytics.executionTime}
                      onSwap={handleOptimize}
                    />
                  </Box>
                )}
              </VStack>
            ) : (
              <VStack spacing={4} py={8}>
                <Text fontSize="xl" color="gray.600">
                  Connect your wallet to start swapping
                </Text>
                <Button size="lg" colorScheme="brand" onClick={handleConnect}>
                  Connect Wallet
                </Button>
              </VStack>
            )}
          </Box>
        </VStack>
      </Container>
    </>
  );
}
