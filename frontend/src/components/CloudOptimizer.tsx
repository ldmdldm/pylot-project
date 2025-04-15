'use client';

import { useState } from 'react';
import { TOKENS } from '@/lib/contract';

interface OptimizationResult {
  protocol: string;
  input_token: string;
  output_token: string;
  input_amount: string;
  output_amount: string;
  gas_cost: string;
  execution_time: number;
  slippage: number;
  path: string;
  priority_score: number;
}

export function CloudOptimizer() {
  const [inputAmount, setInputAmount] = useState('1.0');
  const [inputToken, setInputToken] = useState(TOKENS.PYUSD);
  const [outputToken, setOutputToken] = useState(TOKENS.ETH);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState('');

  const handleOptimize = async () => {
    if (isLoading) return;

    setError('');
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (inputToken === outputToken) {
      setError('Input and output tokens must be different');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/cloud/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputToken,
          outputToken,
          amount: inputAmount,
        }),
      });

      if (!response.ok) {
        throw new Error('Optimization failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to optimize route';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-xl font-semibold mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        Cloud Route Optimizer
      </h3>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Token
            </label>
            <select
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={TOKENS.PYUSD}>PYUSD</option>
              <option value={TOKENS.ETH}>ETH</option>
              <option value={TOKENS.WETH}>WETH</option>
              <option value={TOKENS.USDC}>USDC</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Token
            </label>
            <select
              value={outputToken}
              onChange={(e) => setOutputToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={TOKENS.ETH}>ETH</option>
              <option value={TOKENS.PYUSD}>PYUSD</option>
              <option value={TOKENS.WETH}>WETH</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleOptimize}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Optimizing...' : 'Optimize Route'}
        </button>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Optimization Results</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Output</span>
                  <span className="font-medium">{result.output_amount}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Protocol</span>
                  <span className="font-medium">{result.protocol}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Gas Cost</span>
                  <span className="font-medium">{result.gas_cost} ETH</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Execution Time</span>
                  <span className="font-medium">{result.execution_time}s</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Slippage</span>
                  <span className="font-medium">{result.slippage}%</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Priority Score</span>
                  <span className="font-medium">{result.priority_score}</span>
                </div>

                <div className="border-t border-gray-200 my-3"></div>
                
                <div>
                  <span className="text-gray-600 block mb-2">Route Path</span>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <div className="text-sm">{result.path}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
