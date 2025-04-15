import { http, createConfig } from 'wagmi';
import { mainnet } from 'viem/chains';
import { metaMask } from 'wagmi/connectors';

const infuraKey = process.env.NEXT_PUBLIC_INFURA_API_KEY;

export const config = createConfig({
  chains: [mainnet],
  connectors: [
    metaMask(),
  ],
  transports: {
    [mainnet.id]: http(`https://mainnet.infura.io/v3/${infuraKey}`),
  },
});
