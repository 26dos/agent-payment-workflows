import { http, createConfig } from 'wagmi';
import { bsc } from 'wagmi/chains';

// Contract addresses - update after deployment
export const CONTRACT_ADDRESSES = {
  USD1: process.env.NEXT_PUBLIC_USD1_ADDRESS || '0x0000000000000000000000000000000000000000',
  USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x0000000000000000000000000000000000000000',
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x0000000000000000000000000000000000000000',
  // Primary DID Registry with Sub-DID support
  DualDIDRegistry: process.env.NEXT_PUBLIC_DUAL_DID_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000',
  PremiumDIDAuction: process.env.NEXT_PUBLIC_PREMIUM_DID_AUCTION_ADDRESS || '0x0000000000000000000000000000000000000000',
  Reputation: process.env.NEXT_PUBLIC_REPUTATION_ADDRESS || '0x0000000000000000000000000000000000000000',
  DynamicPricing: process.env.NEXT_PUBLIC_DYNAMIC_PRICING_ADDRESS || '0x0000000000000000000000000000000000000000',
  InsurancePool: process.env.NEXT_PUBLIC_INSURANCE_POOL_ADDRESS || '0x0000000000000000000000000000000000000000',
  Escrow: process.env.NEXT_PUBLIC_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000',
  IncentiveSystem: process.env.NEXT_PUBLIC_INCENTIVE_SYSTEM_ADDRESS || '0x0000000000000000000000000000000000000000',
  TaskSpecification: process.env.NEXT_PUBLIC_TASK_SPECIFICATION_ADDRESS || '0x0000000000000000000000000000000000000000',
};

// Payment token options
export const PAYMENT_TOKENS = [
  { symbol: 'USD1', address: CONTRACT_ADDRESSES.USD1, decimals: 6 },
  { symbol: 'USDT', address: CONTRACT_ADDRESSES.USDT, decimals: 6 },
  { symbol: 'USDC', address: CONTRACT_ADDRESSES.USDC, decimals: 6 },
];

// DID Tier names
export const DID_TIER_NAMES: Record<number, string> = {
  0: 'Normal',
  1: 'B',
  2: 'A',
  3: 'S',
  4: 'SS',
  5: 'SSS',
};

// Auction type names
export const AUCTION_TYPE_NAMES: Record<number, string> = {
  0: 'English',
  1: 'Dutch',
  2: 'Fixed Price',
};

// Auction status names
export const AUCTION_STATUS_NAMES: Record<number, string> = {
  0: 'Not Started',
  1: 'Active',
  2: 'Ended',
  3: 'Cancelled',
  4: 'Sold',
};

// API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Wagmi config - BSC Mainnet
export const wagmiConfig = createConfig({
  chains: [bsc],
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org/'),
  },
});

// Chain config
export const defaultChain = bsc;
