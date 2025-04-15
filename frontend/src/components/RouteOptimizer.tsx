'use client';

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useRouteOptimizer } from '@/lib/useRouteOptimizer';
import { useFaucet } from '@/lib/useFaucet';
import { TOKENS, TokenAddresses } from '@/lib/contract';
import { TokenInput } from './TokenInput';

interface RouteResult {
  path: string;
  protocol: string;
  output_amount: string;
  slippage: number;
  gas_cost: string;
  execution_time: number;
  priority_score: number;
}

type TabType = 'route' | 'faucet';

export function RouteOptimizer() {
  const [activeTab, setActiveTab] = useState<TabType>('route');
  const [inputAmount, setInputAmount] = useState<string>('1.0');
  const [inputToken, setInputToken] = useState<keyof TokenAddresses>("PYUSD");
  const [outputToken, setOutputToken] = useState<keyof TokenAddresses>("ETH");
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  const { findBestRoute, isLoading: isRouteLoading } = useRouteOptimizer();
  const { requestTokens, isLoading: isFaucetLoading } = useFaucet();

  const handleRouteOptimize = async () => {
    if (isRouteLoading) return;

    setError('');
    setSuccess('');
    setRouteResult(null);

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (inputToken === outputToken) {
      setError('Input and output tokens must be different');
      return;
    }

    try {
      const route = await findBestRoute(inputAmount, TOKENS[inputToken], TOKENS[outputToken]);
      if (route) {
        setRouteResult({
          ...route,
          priority_score: route.priority_score || 0
        });
      }
      setSuccess('Route optimization successful!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Route optimization failed';
      setError(message);
      console.error('Route optimization failed:', error);
    }
  };

  const handleMintTokens = async () => {
    setError('');
    setSuccess('');

    if (!recipientAddress) {
      setError('Please enter a recipient address');
      return;
    }

    if (!ethers.isAddress(recipientAddress)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    try {
      await requestTokens(TOKENS[inputToken], recipientAddress);
      setSuccess('Tokens minted successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mint tokens';
      setError(message);
      console.error('Token minting failed:', error);
    }
  };

  return (
    <div className="card">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('route')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'route'
              ? 'bg-[#009cde] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Route Optimizer
        </button>
        <button
          onClick={() => setActiveTab('faucet')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'faucet'
              ? 'bg-[#009cde] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Token Faucet
        </button>
      </div>

      {activeTab === 'route' ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">Route Optimizer</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <TokenInput
              label="Input Amount"
              token={inputToken}
              value={inputAmount}
              onChange={setInputAmount}
              onTokenSelect={setInputToken}
            />

            <TokenInput
              label="Output Amount"
              token={outputToken}
              value={routeResult?.output_amount || '0'}
              onChange={() => {}}
              onTokenSelect={setOutputToken}
              readOnly
            />
          </div>

          <button
            onClick={handleRouteOptimize}
            disabled={isRouteLoading}
            className="w-full mt-4 px-4 py-2 bg-[#009cde] text-white rounded-lg font-medium hover:bg-[#0070ba] focus:outline-none focus:ring-2 focus:ring-[#009cde] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRouteLoading ? 'Optimizing...' : 'Find Best Route'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded-lg">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {routeResult && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">Optimized Route</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Output</span>
                  <span className="font-medium">{routeResult.output_amount}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Protocol</span>
                  <span className="font-medium">{routeResult.protocol}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Gas Cost</span>
                  <span className="font-medium">{routeResult.gas_cost} ETH</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Execution Time</span>
                  <span className="font-medium">{routeResult.execution_time}s</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Slippage</span>
                  <span className="font-medium">{routeResult.slippage}%</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Priority Score</span>
                  <span className="font-medium">{routeResult.priority_score}</span>
                </div>

                <div className="border-t border-gray-200 my-3"></div>
                
                <div>
                  <span className="text-gray-600 block mb-2">Route Path</span>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <div className="text-sm">{routeResult.path}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">Token Faucet</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token
            </label>
            <select
              value={inputToken}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputToken(e.target.value as keyof TokenAddresses)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#009cde] focus:border-[#009cde]"
            >
              <option value="PYUSD">PYUSD</option>
              <option value="ETH">ETH</option>
              <option value="WETH">WETH</option>
              <option value="USDC">USDC</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#009cde] focus:border-[#009cde]"
              placeholder="Enter wallet address"
            />
          </div>

          <button
            onClick={handleMintTokens}
            disabled={isFaucetLoading || !recipientAddress}
            className="w-full mt-4 px-4 py-2 bg-[#009cde] text-white rounded-lg font-medium hover:bg-[#0070ba] focus:outline-none focus:ring-2 focus:ring-[#009cde] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFaucetLoading ? 'Minting...' : 'Mint Tokens'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded-lg">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 