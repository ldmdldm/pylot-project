import React from 'react';
import { ChakraProvider, Box, Container } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, arbitrum, optimism, base } from 'wagmi/chains';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import Navbar from './components/Navbar';
import IntentForm from './components/IntentForm';
import TransactionStatus from './components/TransactionStatus';
import Analytics from './components/Analytics';

// Initialize wagmi config
const config = createConfig({
  chains: [mainnet, arbitrum, optimism, base],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
  },
});

// Initialize React Query
const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider>
        <QueryClientProvider client={queryClient}>
          <ChakraProvider>
            <Router>
              <Box minH="100vh" bg="gray.50">
                <Navbar />
                <Container maxW="container.xl" py={8}>
                  <Routes>
                    <Route path="/" element={<IntentForm />} />
                    <Route path="/status/:intentId" element={<TransactionStatus />} />
                    <Route path="/analytics" element={<Analytics />} />
                  </Routes>
                </Container>
              </Box>
            </Router>
          </ChakraProvider>
        </QueryClientProvider>
      </RainbowKitProvider>
    </WagmiProvider>
  );
}

export default App;
