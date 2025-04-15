import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardBody,
  VStack,
  Text,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Grid,
  GridItem,
  Badge,
  Icon,
  Divider,
  Link,
} from '@chakra-ui/react';
import { useContractRead } from 'wagmi';
import { FiCheck, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import { IntentProcessorABI } from '../contracts/abis';

const TransactionStatus = () => {
  const { intentId } = useParams();

  const { data: intentStatus, isLoading } = useContractRead({
    address: process.env.REACT_APP_INTENT_PROCESSOR_ADDRESS,
    abi: IntentProcessorABI,
    functionName: 'getIntentStatus',
    args: [intentId],
    watch: true,
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'green';
      case 'Failed':
        return 'red';
      case 'Processing':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return FiCheck;
      case 'Failed':
        return FiAlertTriangle;
      default:
        return FiLoader;
    }
  };

  if (isLoading) {
    return (
      <Box textAlign="center" py={10}>
        <Progress size="xs" isIndeterminate />
        <Text mt={4}>Loading transaction status...</Text>
      </Box>
    );
  }

  const [processed, bridgeInitiated, swapCompleted, finalAmount, status] = intentStatus || [];

  return (
    <Card>
      <CardBody>
        <VStack spacing={6} align="stretch">
          <Box textAlign="center">
            <Badge
              colorScheme={getStatusColor(status)}
              fontSize="md"
              p={2}
              borderRadius="full"
            >
              <Icon as={getStatusIcon(status)} mr={2} />
              {status}
            </Badge>
          </Box>

          <Grid templateColumns="repeat(3, 1fr)" gap={6}>
            <GridItem>
              <Stat>
                <StatLabel>Intent ID</StatLabel>
                <StatNumber fontSize="md">
                  {intentId.slice(0, 6)}...{intentId.slice(-4)}
                </StatNumber>
                <StatHelpText>
                  <Link
                    href={`https://etherscan.io/tx/${intentId}`}
                    isExternal
                    color="blue.500"
                  >
                    View on Etherscan
                  </Link>
                </StatHelpText>
              </Stat>
            </GridItem>

            <GridItem>
              <Stat>
                <StatLabel>Final Amount</StatLabel>
                <StatNumber>
                  {finalAmount ? finalAmount.toString() : '-'} PYUSD
                </StatNumber>
                <StatHelpText>After fees and slippage</StatHelpText>
              </Stat>
            </GridItem>

            <GridItem>
              <Stat>
                <StatLabel>Progress</StatLabel>
                <StatNumber>
                  {[processed, swapCompleted, bridgeInitiated].filter(Boolean).length} / 3
                </StatNumber>
                <StatHelpText>Steps completed</StatHelpText>
              </Stat>
            </GridItem>
          </Grid>

          <Divider />

          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontWeight="bold" mb={2}>
                Transaction Steps
              </Text>
              <VStack align="stretch" spacing={2}>
                <Box display="flex" alignItems="center">
                  <Icon
                    as={processed ? FiCheck : FiLoader}
                    color={processed ? 'green.500' : 'gray.500'}
                    mr={2}
                  />
                  <Text>Intent Processing</Text>
                </Box>
                <Box display="flex" alignItems="center">
                  <Icon
                    as={swapCompleted ? FiCheck : FiLoader}
                    color={swapCompleted ? 'green.500' : 'gray.500'}
                    mr={2}
                  />
                  <Text>Token Swap</Text>
                </Box>
                <Box display="flex" alignItems="center">
                  <Icon
                    as={bridgeInitiated ? FiCheck : FiLoader}
                    color={bridgeInitiated ? 'green.500' : 'gray.500'}
                    mr={2}
                  />
                  <Text>Bridge Transfer</Text>
                </Box>
              </VStack>
            </Box>
          </VStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default TransactionStatus;
