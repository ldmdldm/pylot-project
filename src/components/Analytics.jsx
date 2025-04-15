import React from 'react';
import {
  Box,
  Grid,
  GridItem,
  Card,
  CardBody,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  VStack,
  HStack,
  Progress,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';
import { useQuery } from 'react-query';

const Analytics = () => {
  const { data: analyticsData, isLoading } = useQuery('analytics', async () => {
    const response = await fetch('/api/analytics');
    return response.json();
  });

  const { data: recentTransactions } = useQuery('recentTransactions', async () => {
    const response = await fetch('/api/transactions/recent');
    return response.json();
  });

  if (isLoading) {
    return (
      <Box textAlign="center" py={10}>
        <Progress size="xs" isIndeterminate />
        <Text mt={4}>Loading analytics...</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Text fontSize="2xl" fontWeight="bold">
          PYUSD Analytics Dashboard
        </Text>
        <Select maxW="200px" placeholder="Time Range">
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </Select>
      </HStack>

      <Grid templateColumns="repeat(4, 1fr)" gap={6}>
        <GridItem>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Volume (24h)</StatLabel>
                <StatNumber>$1.2M</StatNumber>
                <StatHelpText>
                  <StatArrow type="increase" />
                  23.36%
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active Users</StatLabel>
                <StatNumber>2,847</StatNumber>
                <StatHelpText>
                  <StatArrow type="increase" />
                  12.5%
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Avg Gas Saved</StatLabel>
                <StatNumber>45%</StatNumber>
                <StatHelpText>
                  Compared to manual execution
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Success Rate</StatLabel>
                <StatNumber>99.8%</StatNumber>
                <StatHelpText>
                  Last 1000 transactions
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Card>
        <CardBody>
          <Text fontSize="lg" fontWeight="bold" mb={4}>
            Recent Transactions
          </Text>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Intent ID</Th>
                <Th>Type</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Time</Th>
              </Tr>
            </Thead>
            <Tbody>
              {recentTransactions?.map((tx) => (
                <Tr key={tx.id}>
                  <Td>{tx.id.slice(0, 6)}...{tx.id.slice(-4)}</Td>
                  <Td>{tx.type}</Td>
                  <Td>{tx.amount} PYUSD</Td>
                  <Td>
                    <Text color={tx.status === 'Completed' ? 'green.500' : 'orange.500'}>
                      {tx.status}
                    </Text>
                  </Td>
                  <Td>{new Date(tx.timestamp).toLocaleString()}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <Grid templateColumns="repeat(2, 1fr)" gap={6}>
        <GridItem>
          <Card>
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                Popular Routes
              </Text>
              <VStack align="stretch" spacing={3}>
                {['Ethereum → Arbitrum', 'PYUSD → ETH', 'Ethereum → Optimism'].map((route) => (
                  <HStack key={route} justify="space-between">
                    <Text>{route}</Text>
                    <Progress value={Math.random() * 100} size="sm" width="50%" />
                  </HStack>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                Gas Usage by Chain
              </Text>
              <VStack align="stretch" spacing={3}>
                {['Ethereum', 'Arbitrum', 'Optimism', 'Base'].map((chain) => (
                  <HStack key={chain} justify="space-between">
                    <Text>{chain}</Text>
                    <Progress value={Math.random() * 100} size="sm" width="50%" />
                  </HStack>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </VStack>
  );
};

export default Analytics;
