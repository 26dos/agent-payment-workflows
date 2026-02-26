'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits, formatUnits, keccak256, toHex, pad } from 'viem';
import { CONTRACT_ADDRESSES } from '../config';
import {
  USD1_ABI,
  REPUTATION_ABI,
  ESCROW_ABI,
  DYNAMIC_PRICING_ABI,
  INCENTIVE_SYSTEM_ABI,
  TASK_SPECIFICATION_ABI,
  ESCROW_EXTENDED_ABI,
  DUAL_DID_REGISTRY_ABI,
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

// DID Registry Hooks - Now using DualDIDRegistry
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function useHumanDID(address?: `0x${string}`) {
  // Use DualDIDRegistry's addressToOnChainDID
  return useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'walletToOnChainDID',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useRegisterHumanDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Use DualDIDRegistry's registerOnChainDID
  const register = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'registerOnChainDID',
      args: [],
      gas: BigInt(200000),
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error };
}

export function useAgentDIDs(humanDID?: `0x${string}`) {
  // Use DualDIDRegistry's getSubDIDsByOnChainDID
  return useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'getSubDIDsByOnChainDID',
    args: humanDID ? [humanDID] : undefined,
    query: {
      enabled: !!humanDID && humanDID !== ZERO_BYTES32,
    },
  });
}

export function useCreateAgentDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Use DualDIDRegistry's registerSubDID
  const createAgent = (agentName: string = '') => {
    const name = agentName || `Agent-${Date.now()}`;
    writeContract({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'registerSubDID',
      args: [name],
      gas: BigInt(500000),
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
      gas: BigInt(1000000),
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

// ============ Incentive System Hooks ============

export interface HumanIncentive {
  registrationPoints: bigint;
  kycPoints: bigint;
  referralPoints: bigint;
  totalPoints: bigint;
  kycLevel: number;
  invitedBy: `0x${string}`;
  inviteCount: bigint;
  registered: boolean;
  blacklisted: boolean;
  blacklistReason: number;
  blacklistedAt: bigint;
}

export interface AgentIncentive {
  registrationPoints: bigint;
  taskPoints: bigint;
  totalPoints: bigint;
  dailyTaskPoints: bigint;
  lastTaskDay: bigint;
  registered: boolean;
}

// Get human incentive data
export function useHumanIncentive(humanDID?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.IncentiveSystem as `0x${string}`,
    abi: INCENTIVE_SYSTEM_ABI,
    functionName: 'getHumanIncentive',
    args: humanDID ? [humanDID] : undefined,
    query: {
      enabled: !!humanDID && humanDID !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
}

// Get agent incentive data
export function useAgentIncentive(agentDID?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.IncentiveSystem as `0x${string}`,
    abi: INCENTIVE_SYSTEM_ABI,
    functionName: 'getAgentIncentive',
    args: agentDID ? [agentDID] : undefined,
    query: {
      enabled: !!agentDID && agentDID !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
}

// Get total human points
export function useTotalHumanPoints(humanDID?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.IncentiveSystem as `0x${string}`,
    abi: INCENTIVE_SYSTEM_ABI,
    functionName: 'getTotalHumanPoints',
    args: humanDID ? [humanDID] : undefined,
    query: {
      enabled: !!humanDID && humanDID !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  });
}

// Claim human registration bonus
export function useClaimHumanRegistrationBonus() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimBonus = (humanDID: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.IncentiveSystem as `0x${string}`,
      abi: INCENTIVE_SYSTEM_ABI,
      functionName: 'claimHumanRegistrationBonus',
      args: [humanDID],
      gas: BigInt(200000),
    });
  };

  return { claimBonus, hash, isPending, isConfirming, isSuccess, error };
}

// Claim with referral
export function useClaimWithReferral() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimWithReferral = (humanDID: `0x${string}`, inviteCode: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.IncentiveSystem as `0x${string}`,
      abi: INCENTIVE_SYSTEM_ABI,
      functionName: 'claimHumanRegistrationWithReferral',
      args: [humanDID, inviteCode],
      gas: BigInt(300000),
    });
  };

  return { claimWithReferral, hash, isPending, isConfirming, isSuccess, error };
}

// Generate invite code
export function useGenerateInviteCode() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const generateCode = (humanDID: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.IncentiveSystem as `0x${string}`,
      abi: INCENTIVE_SYSTEM_ABI,
      functionName: 'generateInviteCode',
      args: [humanDID],
      gas: BigInt(150000),
    });
  };

  return { generateCode, hash, isPending, isConfirming, isSuccess, error };
}

// Claim agent registration bonus
export function useClaimAgentRegistrationBonus() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimAgentBonus = (agentDID: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.IncentiveSystem as `0x${string}`,
      abi: INCENTIVE_SYSTEM_ABI,
      functionName: 'claimAgentRegistrationBonus',
      args: [agentDID],
      gas: BigInt(200000),
    });
  };

  return { claimAgentBonus, hash, isPending, isConfirming, isSuccess, error };
}

// KYC level names
export const KYC_LEVEL_NAMES = ['None', 'Basic', 'Standard', 'Advanced', 'Full'];

// ============ Task Specification Hooks ============

export const TASK_TYPE_NAMES = [
  'Data Crawling',
  'Model Inference',
  'Data Processing',
  'Content Generation',
  'Code Execution',
  'API Integration',
  'Custom',
];

// Create task with specification
export function useCreateTaskWithSpec() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createTaskWithSpec = (
    requesterDID: `0x${string}`,
    providerDID: `0x${string}`,
    baseFee: number,
    complexity: number,
    taskType: number,
    acceptanceDeadline: number,
    completionDeadline: number,
    minReputationScore: number,
    metadataIPFS: string
  ) => {
    const amountWithDecimals = parseUnits(baseFee.toString(), 6);
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: [...ESCROW_ABI, ...ESCROW_EXTENDED_ABI],
      functionName: 'createTaskWithSpec',
      args: [
        requesterDID,
        providerDID,
        amountWithDecimals,
        complexity,
        taskType,
        BigInt(acceptanceDeadline),
        BigInt(completionDeadline),
        BigInt(minReputationScore),
        metadataIPFS,
      ],
      gas: BigInt(1200000),
    });
  };

  return { createTaskWithSpec, hash, isPending, isConfirming, isSuccess, error };
}

// Submit task result
export function useSubmitTaskResult() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submitResult = (
    taskId: number,
    resultHash: `0x${string}`,
    formatProbeHash: `0x${string}`,
    executionProofHash: `0x${string}`,
    resultIPFS: string
  ) => {
    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: [...ESCROW_ABI, ...ESCROW_EXTENDED_ABI],
      functionName: 'submitTaskResult',
      args: [BigInt(taskId), resultHash, formatProbeHash, executionProofHash, resultIPFS],
      gas: BigInt(500000),
    });
  };

  return { submitResult, hash, isPending, isConfirming, isSuccess, error };
}

// Get task specification
export function useTaskSpecification(taskId?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.TaskSpecification as `0x${string}`,
    abi: TASK_SPECIFICATION_ABI,
    functionName: 'getSpecification',
    args: taskId ? [taskId] : undefined,
    query: {
      enabled: !!taskId,
    },
  });
}

// Get task result
export function useTaskResult(taskId?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.TaskSpecification as `0x${string}`,
    abi: TASK_SPECIFICATION_ABI,
    functionName: 'getResult',
    args: taskId ? [taskId] : undefined,
    query: {
      enabled: !!taskId,
    },
  });
}

// Validate provider for task
export function useValidateProvider(taskId?: `0x${string}`, providerDID?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.TaskSpecification as `0x${string}`,
    abi: TASK_SPECIFICATION_ABI,
    functionName: 'validateProvider',
    args: taskId && providerDID ? [taskId, providerDID] : undefined,
    query: {
      enabled: !!taskId && !!providerDID,
    },
  });
}

// ============ Dual DID Registry Hooks ============

import { PREMIUM_DID_AUCTION_ABI } from './abis';

// Register on-chain DID
export function useRegisterOnChainDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'registerOnChainDID',
      args: [],
      gas: BigInt(200000),
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error };
}

// Register off-chain DID
export function useRegisterOffChainDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = (displayId: string) => {
    writeContract({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'registerOffChainDID',
      args: [displayId],
      gas: BigInt(300000),
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error };
}

// Complete registration (both on-chain and off-chain)
export function useCompleteRegistration() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const completeRegistration = (displayId: string) => {
    writeContract({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'completeRegistration',
      args: [displayId],
      gas: BigInt(400000),
    });
  };

  return { completeRegistration, hash, isPending, isConfirming, isSuccess, error };
}

// Get my DIDs
export function useMyDIDs() {
  const { address } = useAccount();
  return useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'getMyDIDs',
    query: {
      enabled: !!address,
    },
  });
}

// Check if wallet has on-chain DID
export function useWalletOnChainDID(walletAddress?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'walletToOnChainDID',
    args: walletAddress ? [walletAddress] : undefined,
    query: {
      enabled: !!walletAddress,
    },
  });
}

// Validate display ID format
export function useValidateDisplayId(displayId?: string) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'validateDisplayIdFormat',
    args: displayId ? [displayId] : undefined,
    query: {
      enabled: !!displayId && displayId.length === 9,
    },
  });
}

// Check display ID availability
export function useDisplayIdAvailable(displayId?: string) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'isDisplayIdAvailable',
    args: displayId ? [displayId] : undefined,
    query: {
      enabled: !!displayId && displayId.length === 9,
    },
  });
}

// List DID for transfer
export function useListForTransfer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const listForTransfer = (offChainDIDHash: `0x${string}`, price: bigint, paymentToken: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'listForTransfer',
      args: [offChainDIDHash, price, paymentToken],
      gas: BigInt(200000),
    });
  };

  return { listForTransfer, hash, isPending, isConfirming, isSuccess, error };
}

// Purchase DID
export function usePurchaseDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const purchaseDID = (offChainDIDHash: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'purchaseDID',
      args: [offChainDIDHash],
      gas: BigInt(400000),
    });
  };

  return { purchaseDID, hash, isPending, isConfirming, isSuccess, error };
}

// ============ Premium DID Auction Hooks ============

// Place bid on English auction
export function usePlaceBid() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeBid = (auctionId: number, amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
      abi: PREMIUM_DID_AUCTION_ABI,
      functionName: 'placeBid',
      args: [BigInt(auctionId), amount],
      gas: BigInt(300000),
    });
  };

  return { placeBid, hash, isPending, isConfirming, isSuccess, error };
}

// Purchase Dutch auction
export function usePurchaseDutch() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const purchaseDutch = (auctionId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
      abi: PREMIUM_DID_AUCTION_ABI,
      functionName: 'purchaseDutch',
      args: [BigInt(auctionId)],
      gas: BigInt(400000),
    });
  };

  return { purchaseDutch, hash, isPending, isConfirming, isSuccess, error };
}

// Purchase fixed price
export function usePurchaseFixedPrice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const purchaseFixedPrice = (auctionId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
      abi: PREMIUM_DID_AUCTION_ABI,
      functionName: 'purchaseFixedPrice',
      args: [BigInt(auctionId)],
      gas: BigInt(400000),
    });
  };

  return { purchaseFixedPrice, hash, isPending, isConfirming, isSuccess, error };
}

// Withdraw deposit
export function useWithdrawDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdrawDeposit = (auctionId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
      abi: PREMIUM_DID_AUCTION_ABI,
      functionName: 'withdrawDeposit',
      args: [BigInt(auctionId)],
      gas: BigInt(200000),
    });
  };

  return { withdrawDeposit, hash, isPending, isConfirming, isSuccess, error };
}

// Get current Dutch price
export function useCurrentDutchPrice(auctionId?: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
    abi: PREMIUM_DID_AUCTION_ABI,
    functionName: 'getCurrentDutchPrice',
    args: auctionId !== undefined ? [BigInt(auctionId)] : undefined,
    query: {
      enabled: auctionId !== undefined,
    },
  });
}

// Get auction details
export function useAuctionDetails(auctionId?: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
    abi: PREMIUM_DID_AUCTION_ABI,
    functionName: 'getAuction',
    args: auctionId !== undefined ? [BigInt(auctionId)] : undefined,
    query: {
      enabled: auctionId !== undefined,
    },
  });
}

// Get deposit amount
export function useDepositAmount(bidderAddress?: `0x${string}`, auctionId?: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
    abi: PREMIUM_DID_AUCTION_ABI,
    functionName: 'getDeposit',
    args: bidderAddress && auctionId !== undefined ? [bidderAddress, BigInt(auctionId)] : undefined,
    query: {
      enabled: !!bidderAddress && auctionId !== undefined,
    },
  });
}

// Create short Display ID auction
export function useCreateShortDisplayIdAuction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createAuction = (displayId: string, paymentToken: `0x${string}`) => {
    writeContract({
      address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
      abi: PREMIUM_DID_AUCTION_ABI,
      functionName: 'createShortDisplayIdAuction',
      args: [displayId, paymentToken],
      gas: BigInt(500000),
    });
  };

  return { createAuction, hash, isPending, isConfirming, isSuccess, error };
}

// Finalize short Display ID auction
export function useFinalizeShortDisplayIdAuction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const finalizeAuction = (auctionId: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
      abi: PREMIUM_DID_AUCTION_ABI,
      functionName: 'finalizeShortDisplayIdAuction',
      args: [BigInt(auctionId)],
      gas: BigInt(600000),
    });
  };

  return { finalizeAuction, hash, isPending, isConfirming, isSuccess, error };
}

// Get auction by display ID
export function useAuctionByDisplayId(displayId?: string) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`,
    abi: PREMIUM_DID_AUCTION_ABI,
    functionName: 'getAuctionByDisplayId',
    args: displayId ? [displayId] : undefined,
    query: {
      enabled: !!displayId && displayId.length > 0 && displayId.length < 5,
    },
  });
}

// ERC20 Token approval hook
export function useTokenApproval(tokenAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (spender: `0x${string}`, amount: bigint) => {
    if (!tokenAddress) return;
    writeContract({
      address: tokenAddress,
      abi: [
        {
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

// ERC20 Token allowance hook
export function useTokenAllowance(tokenAddress?: `0x${string}`, owner?: `0x${string}`, spender?: `0x${string}`) {
  return useReadContract({
    address: tokenAddress,
    abi: [
      {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ],
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: !!tokenAddress && !!owner && !!spender,
    },
  });
}
