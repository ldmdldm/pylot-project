'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Input,
  VStack,
  Text,
  Image,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Icon,
} from '@chakra-ui/react';
import { Search2Icon } from '@chakra-ui/icons';
import { TokenAddresses } from '@/lib/contract';

interface TokenSelectorProps {
  selectedToken: keyof TokenAddresses;
  onSelect: (token: keyof TokenAddresses) => void;
  disabled?: boolean;
}

const TOKEN_DETAILS: Record<keyof TokenAddresses, { name: string; logoURI: string }> = {
  PYUSD: {
    name: "PayPal USD",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6c3ea9036406852006290770BEdFcAbA0e23A0e8/logo.png"
  },
  ETH: {
    name: "Ethereum",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png"
  },
  WETH: {
    name: "Wrapped Ether",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png"
  },
  USDC: {
    name: "USD Coin",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png"
  }
};

export function TokenSelector({ selectedToken, onSelect, disabled = false }: TokenSelectorProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = Object.entries(TOKEN_DETAILS).filter(([symbol, details]) => 
    symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    details.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box>
      <Button
        onClick={onOpen}
        variant="outline"
        width="full"
        height="60px"
        display="flex"
        justifyContent="flex-start"
        alignItems="center"
        px={4}
        disabled={disabled}
      >
        <Image
          src={TOKEN_DETAILS[selectedToken].logoURI}
          alt={selectedToken}
          boxSize="24px"
          mr={3}
          borderRadius="full"
        />
        <VStack align="flex-start" spacing={0}>
          <Text>{selectedToken}</Text>
          <Text fontSize="xs" color="gray.500">{TOKEN_DETAILS[selectedToken].name}</Text>
        </VStack>
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Select a Token</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <InputGroup mb={4}>
              <InputLeftElement>
                <Icon as={Search2Icon} />
              </InputLeftElement>
              <Input
                placeholder="Search by name or symbol"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>

            <SimpleGrid columns={1} spacing={2}>
              {filteredTokens.map(([symbol, details]) => (
                <Button
                  key={symbol}
                  variant="ghost"
                  width="full"
                  height="60px"
                  display="flex"
                  justifyContent="flex-start"
                  onClick={() => {
                    onSelect(symbol as keyof TokenAddresses);
                    onClose();
                  }}
                >
                  <Image
                    src={details.logoURI}
                    alt={symbol}
                    boxSize="24px"
                    mr={3}
                    borderRadius="full"
                  />
                  <VStack align="flex-start" spacing={0}>
                    <Text>{symbol}</Text>
                    <Text fontSize="xs" color="gray.500">{details.name}</Text>
                  </VStack>
                </Button>
              ))}
            </SimpleGrid>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
