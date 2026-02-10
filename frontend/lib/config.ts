import { http, createConfig } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';

// Contract addresses - update after deployment
export const CONTRACT_ADDRESSES = {
  USD1: process.env.NEXT_PUBLIC_USD1_ADDRESS || '0x0000000000000000000000000000000000000000',
  DIDRegistry: process.env.NEXT_PUBLIC_DID_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000',
  Reputation: process.env.NEXT_PUBLIC_REPUTATION_ADDRESS || '0x0000000000000000000000000000000000000000',
  DynamicPricing: process.env.NEXT_PUBLIC_DYNAMIC_PRICING_ADDRESS || '0x0000000000000000000000000000000000000000',
  InsurancePool: process.env.NEXT_PUBLIC_INSURANCE_POOL_ADDRESS || '0x0000000000000000000000000000000000000000',
  Escrow: process.env.NEXT_PUBLIC_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000',
};

// API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Wagmi config - simplified for demo
export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
  },
});

// Chain config
export const defaultChain = bscTestnet;
