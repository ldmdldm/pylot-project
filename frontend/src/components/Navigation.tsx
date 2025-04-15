'use client';

import NextLink from 'next/link';
import {
  Box,
  Flex,
  Container,
  Link,
  Button,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { useAccount, useConnect } from 'wagmi';
import { metaMask } from 'wagmi/connectors';

export function Navigation() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const bgColor = useColorModeValue('brand.600', 'brand.800');

  const handleConnect = () => {
    connect({ connector: metaMask() });
  };

  return (
    <Box bg={bgColor} py={4}>
      <Container maxW="container.xl">
        <Flex justify="space-between" align="center">
          <Link as={NextLink} href="/" fontSize="2xl" fontWeight="bold" color="white">
            PYUSD DEX
          </Link>

          <HStack spacing={8}>
            <HStack spacing={6} color="white">
              <Link as={NextLink} href="/swap" _hover={{ color: 'brand.200' }}>
                Swap
              </Link>
              <Link as={NextLink} href="/optimize" _hover={{ color: 'brand.200' }}>
                Optimize
              </Link>
              <Link as={NextLink} href="/faucet" _hover={{ color: 'brand.200' }}>
                Faucet
              </Link>
            </HStack>

            {!isConnected ? (
              <Button
                onClick={handleConnect}
                colorScheme="whiteAlpha"
                size="md"
              >
                Connect Wallet
              </Button>
            ) : (
              <Button
                colorScheme="whiteAlpha"
                size="md"
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Button>
            )}
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
} 