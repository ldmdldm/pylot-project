import React from 'react';
import { Box, Flex, Button, Heading, useColorModeValue } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const Navbar = () => {
  const bg = useColorModeValue('white', 'gray.800');

  return (
    <Box bg={bg} px={4} boxShadow="sm">
      <Flex h={16} alignItems="center" justifyContent="space-between">
        <Flex alignItems="center">
          <Heading size="md" as={RouterLink} to="/">
            PYUSD Intent System
          </Heading>
        </Flex>

        <Flex alignItems="center" gap={4}>
          <Button
            as={RouterLink}
            to="/"
            variant="ghost"
            colorScheme="blue"
          >
            New Intent
          </Button>
          
          <Button
            as={RouterLink}
            to="/analytics"
            variant="ghost"
            colorScheme="blue"
          >
            Analytics
          </Button>

          <ConnectButton />
        </Flex>
      </Flex>
    </Box>
  );
};

export default Navbar;
