import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Text,
  useToast,
  Card,
  CardBody,
  Divider,
  Switch,
  NumberInput,
  NumberInputField,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi';
import { parseEther } from 'viem';
import { IntentProcessorABI } from '../contracts/abis';

const SUPPORTED_TOKENS = {
  ETH: '0x0000000000000000000000000000000000000000',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

const SUPPORTED_CHAINS = {
  'Ethereum': 1,
  'Arbitrum': 42161,
  'Optimism': 10,
  'Base': 8453,
};

const DEX_OPTIONS = [
  { name: 'Uniswap V3', id: 'uniswap' },
  { name: 'Curve', id: 'curve' },
  { name: '1inch', id: 'oneinch' },
];

const BRIDGE_OPTIONS = [
  { name: 'Stargate', id: 'stargate' },
  { name: 'Hop', id: 'hop' },
  { name: 'LayerZero', id: 'layerzero' },
];

const IntentForm = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { address } = useAccount();

  const [formData, setFormData] = useState({
    amount: '',
    targetToken: '',
    targetChain: '',
    slippageTolerance: 0.5,
    maxGasPrice: '50',
    preferredDEX: '',
    preferredBridge: '',
    requireAtomicity: true,
  });

  const { write: submitIntent, data: submitData } = useContractWrite({
    address: process.env.REACT_APP_INTENT_PROCESSOR_ADDRESS,
    abi: IntentProcessorABI,
    functionName: 'processIntent',
  });

  const { isLoading: isConfirming } = useWaitForTransaction({
    hash: submitData?.hash,
    onSuccess: () => {
      toast({
        title: 'Intent submitted successfully!',
        status: 'success',
        duration: 5000,
      });
      navigate(`/status/${submitData?.hash}`);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const intentData = {
        user: address,
        amount: parseEther(formData.amount),
        targetToken: SUPPORTED_TOKENS[formData.targetToken],
        targetChain: SUPPORTED_CHAINS[formData.targetChain],
        minAmountOut: parseEther(formData.amount) * (1 - formData.slippageTolerance / 100),
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        maxGasPrice: parseEther(formData.maxGasPrice, 'gwei'),
        dexPath: [formData.preferredDEX],
        bridgeFee: 0,
        requireAtomicity: formData.requireAtomicity,
      };

      const intentId = crypto.randomUUID();
      
      submitIntent({
        args: [intentData, intentId],
        value: formData.targetChain !== 'Ethereum' ? parseEther('0.01') : 0n, // Bridge fee
      });
    } catch (error) {
      toast({
        title: 'Error submitting intent',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit}>
          <VStack spacing={6}>
            <Text fontSize="2xl" fontWeight="bold">
              Create New Intent
            </Text>
            
            <FormControl isRequired>
              <FormLabel>Amount (PYUSD)</FormLabel>
              <NumberInput min={0}>
                <NumberInputField
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter amount"
                />
              </NumberInput>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Target Token</FormLabel>
              <Select
                value={formData.targetToken}
                onChange={(e) => setFormData({ ...formData, targetToken: e.target.value })}
                placeholder="Select target token"
              >
                {Object.keys(SUPPORTED_TOKENS).map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Target Chain</FormLabel>
              <Select
                value={formData.targetChain}
                onChange={(e) => setFormData({ ...formData, targetChain: e.target.value })}
                placeholder="Select target chain"
              >
                {Object.keys(SUPPORTED_CHAINS).map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Slippage Tolerance (%)</FormLabel>
              <Slider
                value={formData.slippageTolerance}
                onChange={(v) => setFormData({ ...formData, slippageTolerance: v })}
                min={0.1}
                max={5}
                step={0.1}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
              <Text textAlign="right" fontSize="sm">
                {formData.slippageTolerance}%
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Preferred DEX</FormLabel>
              <Select
                value={formData.preferredDEX}
                onChange={(e) => setFormData({ ...formData, preferredDEX: e.target.value })}
                placeholder="Select preferred DEX (optional)"
              >
                {DEX_OPTIONS.map((dex) => (
                  <option key={dex.id} value={dex.id}>
                    {dex.name}
                  </option>
                ))}
              </Select>
            </FormControl>

            {formData.targetChain !== 'Ethereum' && (
              <FormControl>
                <FormLabel>Preferred Bridge</FormLabel>
                <Select
                  value={formData.preferredBridge}
                  onChange={(e) => setFormData({ ...formData, preferredBridge: e.target.value })}
                  placeholder="Select preferred bridge (optional)"
                >
                  {BRIDGE_OPTIONS.map((bridge) => (
                    <option key={bridge.id} value={bridge.id}>
                      {bridge.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
            )}

            <Divider />

            <FormControl display="flex" alignItems="center">
              <FormLabel mb="0">
                Require Atomicity
              </FormLabel>
              <Switch
                isChecked={formData.requireAtomicity}
                onChange={(e) => setFormData({ ...formData, requireAtomicity: e.target.checked })}
              />
            </FormControl>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              width="full"
              isLoading={isConfirming}
              loadingText="Confirming..."
              isDisabled={!address}
            >
              Submit Intent
            </Button>
          </VStack>
        </form>
      </CardBody>
    </Card>
  );
};

export default IntentForm;
