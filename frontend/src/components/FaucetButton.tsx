import { useState } from 'react';
import { useDex } from '../lib/hooks';
import { TOKENS } from '../lib/contract';

export function FaucetButton() {
  const { account, isConnected, requestTokens, isLoading } = useDex();
  const [selectedToken, setSelectedToken] = useState(TOKENS.PYUSD);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleMint = async (token: string) => {
    if (!account || !isConnected) return;
    try {
      await requestTokens(token, account);
      // Close dropdown after successful mint
      setShowDropdown(false);
    } catch (err) {
      console.error('Failed to mint tokens:', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={!isConnected || isLoading}
        className={`
          px-4 py-2 rounded-lg font-medium
          ${isConnected
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }
          ${isLoading ? 'opacity-50 cursor-wait' : ''}
        `}
      >
        {isLoading ? 'Minting...' : 'Get Test Tokens'}
      </button>

      {showDropdown && (
        <div className="absolute mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu">
            <button
              onClick={() => handleMint(TOKENS.PYUSD)}
              className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Get 100 PYUSD
            </button>
            <button
              onClick={() => handleMint(TOKENS.USDC)}
              className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Get 100 USDC
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
