'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, keccak256, toHex, pad } from 'viem';
import { CONTRACT_ADDRESSES } from '../config';
import {
  USD1_ABI,
  DID_REGISTRY_ABI,
  REPUTATION_ABI,
  ESCROW_ABI,
  DYNAMIC_PRICING_ABI,
} from './abis';

// Helper to generate a random bytes32
export function generateBytes32(): `0x${string}` {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

// Helper to convert string to bytes32
export function stringToBytes32(str: string): `0x${string}` {
  return keccak256(toHex(str));
}

// USD1 Hooks
export function useUSD1Balance(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
    abi: USD1_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useUSD1Faucet() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimFaucet = (amount: number = 10000) => {
    // USD1 has 6 decimals
    const amountWithDecimals = parseUnits(amount.toString(), 6);
    writeContract({
      address: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
      abi: USD1_ABI,
      functionName: 'faucet',
      args: [amountWithDecimals],
    });
  };

  return { claimFaucet, hash, isPending, isConfirming, isSuccess, error };
}

export function useUSD1Approve() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (spender: `0x${string}`, amount: number) => {
    const amountWithDecimals = parseUnits(amount.toString(), 6);
    writeContract({
      address: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
      abi: USD1_ABI,
      functionName: 'approve',
      args: [spender, amountWithDecimals],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

// DID Registry Hooks
export function useHumanDID(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'addressToHumanDID',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useRegisterHumanDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = (metadata: string = '') => {
    writeContract({
      address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
      abi: DID_REGISTRY_ABI,
      functionName: 'registerHumanDID',
      args: [metadata],
      gas: BigInt(200000),
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error };
}

export function useAgentDIDs(humanDID?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'getAgentsByHuman',
    args: humanDID ? [humanDID] : undefined,
    query: {
      enabled: !!humanDID && humanDID !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
}

export function useCreateAgentDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createAgent = (humanDID: `0x${string}`, agentName: string = '') => {
    const name = agentName || `Agent-${Date.now()}`;
    writeContract({
      address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
      abi: DID_REGISTRY_ABI,
      functionName: 'registerAgentDID',
      args: [humanDID, name],
      gas: BigInt(200000),
    });
  };

  return { createAgent, hash, isPending, isConfirming, isSuccess, error };
}

// Reputation Hooks
export function useReputationScore(did?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.Reputation as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: 'getScore',
    args: did ? [did] : undefined,
    query: {
      enabled: !!did && did !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
}

export function useCombinedScore(agentDID?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.Reputation as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: 'getCombinedScore',
    args: agentDID ? [agentDID] : undefined,
    query: {
      enabled: !!agentDID && agentDID !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
}

// Dynamic Pricing Hooks
export function useCalculatePrice(baseFee: number, reputationScore: number, complexity: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DynamicPricing as `0x${string}`,
    abi: DYNAMIC_PRICING_ABI,
    functionName: 'calculateFinalPrice',
    args: [
      parseUnits(baseFee.toString(), 6),
      BigInt(reputationScore),
      BigInt(complexity),
    ],
    query: {
      enabled: baseFee > 0,
    },
  });
}

// Escrow Hooks
export function useCreateEscrowTask() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createTask = (
    requesterDID: `0x${string}`,
    providerDID: `0x${string}`,
    amount: number,
    complexity: number,
    metadata: string = ''
  ) => {
    const amountWithDecimals = parseUnits(amount.toString(), 6);
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'createTask',
      args: [requesterDID, providerDID, amountWithDecimals, complexity, metadata],
      gas: BigInt(500000),
    });
  };

  return { createTask, hash, isPending, isConfirming, isSuccess, error };
}

export function useAcceptTask() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const acceptTask = (taskId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'acceptTask',
      args: [BigInt(taskId)],
    });
  };

  return { acceptTask, hash, isPending, isConfirming, isSuccess, error };
}

export function useCompleteTask() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const completeTask = (taskId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'completeTask',
      args: [BigInt(taskId)],
    });
  };

  return { completeTask, hash, isPending, isConfirming, isSuccess, error };
}

export function useRaiseDispute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const raiseDispute = (taskId: number, reason: string) => {
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'raiseDispute',
      args: [BigInt(taskId), reason],
    });
  };

  return { raiseDispute, hash, isPending, isConfirming, isSuccess, error };
}

// Batch task creation hook
export interface BatchTaskInput {
  requesterDID: `0x${string}`;
  providerDID: `0x${string}`;
  baseFee: number;
  complexity: number;
  metadata: string;
}

export function useMaxBatchSize() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
    abi: ESCROW_ABI,
    functionName: 'maxBatchSize',
  });
}

export function useCreateTasksBatch() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createTasksBatch = (tasks: BatchTaskInput[]) => {
    // Convert tasks to contract format
    const taskInputs = tasks.map(task => ({
      requesterDID: task.requesterDID,
      providerDID: task.providerDID,
      baseFee: parseUnits(task.baseFee.toString(), 6),
      complexity: task.complexity,
      metadata: task.metadata,
    }));

    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'createTasksBatch',
      args: [taskInputs],
      gas: BigInt(500000 * tasks.length), // Scale gas with batch size
    });
  };

  return { createTasksBatch, hash, isPending, isConfirming, isSuccess, error };
}

// Create open task (no specific provider, anyone can accept)
export function useCreateOpenTask() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createOpenTask = (
    requesterDID: `0x${string}`,
    amount: number,
    complexity: number,
    metadata: string = ''
  ) => {
    const amountWithDecimals = parseUnits(amount.toString(), 6);
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'createOpenTask',
      args: [requesterDID, amountWithDecimals, complexity, metadata],
      gas: BigInt(500000),
    });
  };

  return { createOpenTask, hash, isPending, isConfirming, isSuccess, error };
}

// Accept open task
export function useAcceptOpenTask() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const acceptOpenTask = (taskId: number, providerDID: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'acceptOpenTask',
      args: [BigInt(taskId), providerDID],
      gas: BigInt(300000),
    });
  };

  return { acceptOpenTask, hash, isPending, isConfirming, isSuccess, error };
}

// Record tasks batch (for traceability only, no fund transfer)
export interface RecordTaskInput {
  requesterDID: `0x${string}`;
  providerDID: `0x${string}`;
  amount: number;
  offchainId: string;
  metadata: string;
}

export function useRecordTasksBatch() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const recordTasksBatch = (tasks: RecordTaskInput[]) => {
    const taskInputs = tasks.map(task => ({
      requesterDID: task.requesterDID,
      providerDID: task.providerDID,
      amount: parseUnits(task.amount.toString(), 6),
      offchainId: task.offchainId,
      metadata: task.metadata,
    }));

    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'recordTasksBatch',
      args: [taskInputs],
      gas: BigInt(300000 * tasks.length),
    });
  };

  return { recordTasksBatch, hash, isPending, isConfirming, isSuccess, error };
}

// Get arbitration wallet address
export function useArbitrationWallet() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
    abi: ESCROW_ABI,
    functionName: 'arbitrationWallet',
  });
}

// Format helpers
export function formatUSD1(amount: bigint): string {
  return formatUnits(amount, 6);
}

export function formatDID(did: `0x${string}` | string | null | undefined): string {
  if (!did) {
    return 'Not assigned';
  }
  if (did === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return 'Not registered';
  }
  return `${did.slice(0, 10)}...${did.slice(-8)}`;
}
