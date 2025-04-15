'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { metaMask } from 'wagmi/connectors';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const handleConnect = async () => {
    try {
      if (isConnected) {
        await disconnectAsync();
        return;
      }
      await connectAsync({ connector: metaMask() });
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="px-4 py-2 font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
    >
      {isConnecting ? (
        'Connecting...'
      ) : isConnected && address ? (
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full" />
          {formatAddress(address)}
        </span>
      ) : (
        'Connect Wallet'
      )}
    </button>
  );
}
