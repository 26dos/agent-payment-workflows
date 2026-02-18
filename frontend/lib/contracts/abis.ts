// Contract ABIs for ClawPay

export const USD1_ABI = [
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'faucet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const DID_REGISTRY_ABI = [
  {
    inputs: [{ name: 'metadata', type: 'string' }],
    name: 'registerHumanDID',
    outputs: [{ name: 'did', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'humanDID', type: 'bytes32' },
      { name: 'agentName', type: 'string' },
    ],
    name: 'registerAgentDID',
    outputs: [{ name: 'agentDID', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'getHumanDIDByAddress',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'addressToHumanDID',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'humanDID', type: 'bytes32' }],
    name: 'getAgentsByHuman',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentDID', type: 'bytes32' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'singleLimit', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
    ],
    name: 'createMandate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentDID', type: 'bytes32' }],
    name: 'getMandate',
    outputs: [
      {
        components: [
          { name: 'dailyLimit', type: 'uint256' },
          { name: 'singleLimit', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
          { name: 'dailySpent', type: 'uint256' },
          { name: 'lastResetDay', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentDID', type: 'bytes32' }],
    name: 'getHumanForAgent',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const REPUTATION_ABI = [
  {
    inputs: [{ name: 'did', type: 'bytes32' }],
    name: 'getScore',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentDID', type: 'bytes32' }],
    name: 'getCombinedScore',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ESCROW_ABI = [
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'requesterDID', type: 'bytes32' },
      { indexed: true, name: 'providerDID', type: 'bytes32' },
      { indexed: false, name: 'baseFee', type: 'uint256' },
      { indexed: false, name: 'finalAmount', type: 'uint256' },
      { indexed: false, name: 'complexity', type: 'uint8' },
    ],
    name: 'TaskCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: false, name: 'providerPayment', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
    ],
    name: 'TaskCompleted',
    type: 'event',
  },
  // Functions
  {
    inputs: [
      { name: 'requesterDID', type: 'bytes32' },
      { name: 'providerDID', type: 'bytes32' },
      { name: 'baseFee', type: 'uint256' },
      { name: 'complexity', type: 'uint8' },
      { name: 'metadata', type: 'string' },
    ],
    name: 'createTask',
    outputs: [{ name: 'taskId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'acceptTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'completeTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'cancelTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    name: 'raiseDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'requesterPercent', type: 'uint8' },
    ],
    name: 'resolveDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'getTask',
    outputs: [
      {
        components: [
          { name: 'requesterDID', type: 'bytes32' },
          { name: 'providerDID', type: 'bytes32' },
          { name: 'amount', type: 'uint256' },
          { name: 'finalAmount', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'completedAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'taskCounter',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Batch task creation
  {
    inputs: [
      {
        components: [
          { name: 'requesterDID', type: 'bytes32' },
          { name: 'providerDID', type: 'bytes32' },
          { name: 'baseFee', type: 'uint256' },
          { name: 'complexity', type: 'uint8' },
          { name: 'metadata', type: 'string' },
        ],
        name: 'taskInputs',
        type: 'tuple[]',
      },
    ],
    name: 'createTasksBatch',
    outputs: [{ name: 'taskIds', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxBatchSize',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // BatchTasksCreated event
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'taskIds', type: 'uint256[]' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'totalAmount', type: 'uint256' },
      { indexed: false, name: 'taskCount', type: 'uint256' },
    ],
    name: 'BatchTasksCreated',
    type: 'event',
  },
  // Open task creation (no specific provider)
  {
    inputs: [
      { name: 'requesterDID', type: 'bytes32' },
      { name: 'baseFee', type: 'uint256' },
      { name: 'complexity', type: 'uint8' },
      { name: 'metadata', type: 'string' },
    ],
    name: 'createOpenTask',
    outputs: [{ name: 'taskId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Accept open task
  {
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'providerDID', type: 'bytes32' },
    ],
    name: 'acceptOpenTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Record tasks batch (for traceability only)
  {
    inputs: [
      {
        components: [
          { name: 'requesterDID', type: 'bytes32' },
          { name: 'providerDID', type: 'bytes32' },
          { name: 'amount', type: 'uint256' },
          { name: 'offchainId', type: 'string' },
          { name: 'metadata', type: 'string' },
        ],
        name: 'taskInputs',
        type: 'tuple[]',
      },
    ],
    name: 'recordTasksBatch',
    outputs: [{ name: 'taskIds', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Auto resolve dispute
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'autoResolveDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Auto complete overdue
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'autoCompleteOverdue',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // TaskRecorded event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'requesterDID', type: 'bytes32' },
      { indexed: true, name: 'providerDID', type: 'bytes32' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'offchainId', type: 'string' },
    ],
    name: 'TaskRecorded',
    type: 'event',
  },
  // AutoArbitrationTriggered event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: false, name: 'requesterPercent', type: 'uint8' },
      { indexed: false, name: 'reason', type: 'string' },
    ],
    name: 'AutoArbitrationTriggered',
    type: 'event',
  },
  // Admin functions
  {
    inputs: [{ name: '_wallet', type: 'address' }],
    name: 'setArbitrationWallet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'arbitrationWallet',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'disputeTimeout',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'completionTimeout',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const INSURANCE_POOL_ABI = [
  {
    inputs: [],
    name: 'getPoolBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const DYNAMIC_PRICING_ABI = [
  {
    inputs: [
      { name: 'baseFee', type: 'uint256' },
      { name: 'reputationScore', type: 'uint256' },
      { name: 'complexity', type: 'uint256' },
    ],
    name: 'calculateFinalPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
