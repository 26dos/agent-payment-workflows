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
  {
    inputs: [],
    name: 'taskCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'uint256' }],
    name: 'tasks',
    outputs: [
      { name: 'requesterDID', type: 'bytes32' },
      { name: 'providerDID', type: 'bytes32' },
      { name: 'baseFee', type: 'uint256' },
      { name: 'finalAmount', type: 'uint256' },
      { name: 'insurancePremium', type: 'uint256' },
      { name: 'complexity', type: 'uint8' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'acceptedAt', type: 'uint256' },
      { name: 'completedAt', type: 'uint256' },
      { name: 'expiryTime', type: 'uint256' },
      { name: 'metadata', type: 'string' },
    ],
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

// ============ IncentiveSystem ABI ============
export const INCENTIVE_SYSTEM_ABI = [
  // Claim human registration bonus
  {
    inputs: [{ name: 'humanDID', type: 'bytes32' }],
    name: 'claimHumanRegistrationBonus',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Claim human registration with referral
  {
    inputs: [
      { name: 'humanDID', type: 'bytes32' },
      { name: 'inviteCode', type: 'bytes32' },
    ],
    name: 'claimHumanRegistrationWithReferral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Generate invite code
  {
    inputs: [{ name: 'humanDID', type: 'bytes32' }],
    name: 'generateInviteCode',
    outputs: [{ name: 'inviteCode', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Claim agent registration bonus
  {
    inputs: [{ name: 'agentDID', type: 'bytes32' }],
    name: 'claimAgentRegistrationBonus',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get human incentive data
  {
    inputs: [{ name: 'humanDID', type: 'bytes32' }],
    name: 'getHumanIncentive',
    outputs: [
      {
        components: [
          { name: 'registrationPoints', type: 'uint256' },
          { name: 'kycPoints', type: 'uint256' },
          { name: 'referralPoints', type: 'uint256' },
          { name: 'totalPoints', type: 'uint256' },
          { name: 'kycLevel', type: 'uint8' },
          { name: 'invitedBy', type: 'bytes32' },
          { name: 'inviteCount', type: 'uint256' },
          { name: 'registered', type: 'bool' },
          { name: 'blacklisted', type: 'bool' },
          { name: 'blacklistReason', type: 'uint8' },
          { name: 'blacklistedAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Get agent incentive data
  {
    inputs: [{ name: 'agentDID', type: 'bytes32' }],
    name: 'getAgentIncentive',
    outputs: [
      {
        components: [
          { name: 'registrationPoints', type: 'uint256' },
          { name: 'taskPoints', type: 'uint256' },
          { name: 'totalPoints', type: 'uint256' },
          { name: 'dailyTaskPoints', type: 'uint256' },
          { name: 'lastTaskDay', type: 'uint256' },
          { name: 'registered', type: 'bool' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Get total human points (including agents)
  {
    inputs: [{ name: 'humanDID', type: 'bytes32' }],
    name: 'getTotalHumanPoints',
    outputs: [{ name: 'totalPoints', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Check if blacklisted
  {
    inputs: [{ name: 'humanDID', type: 'bytes32' }],
    name: 'isBlacklisted',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get invite code owner
  {
    inputs: [{ name: 'inviteCode', type: 'bytes32' }],
    name: 'getInviteCodeOwner',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Calculate effective points
  {
    inputs: [
      { name: 'agentDID', type: 'bytes32' },
      { name: 'rawPoints', type: 'uint256' },
    ],
    name: 'calculateEffectivePoints',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Constants
  {
    inputs: [],
    name: 'HUMAN_REGISTRATION_POINTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'AGENT_REGISTRATION_POINTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'HUMAN_REFERRAL_INVITER_POINTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'HUMAN_REFERRAL_INVITEE_POINTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'humanDID', type: 'bytes32' },
      { indexed: false, name: 'points', type: 'uint256' },
    ],
    name: 'HumanRegistrationBonus',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'inviter', type: 'bytes32' },
      { indexed: true, name: 'invitee', type: 'bytes32' },
      { indexed: false, name: 'inviterPoints', type: 'uint256' },
      { indexed: false, name: 'inviteePoints', type: 'uint256' },
    ],
    name: 'HumanReferralBonus',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentDID', type: 'bytes32' },
      { indexed: false, name: 'points', type: 'uint256' },
      { indexed: false, name: 'effectivePoints', type: 'uint256' },
    ],
    name: 'AgentTaskBonus',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'humanDID', type: 'bytes32' },
      { indexed: false, name: 'inviteCode', type: 'bytes32' },
    ],
    name: 'InviteCodeGenerated',
    type: 'event',
  },
] as const;

// ============ TaskSpecification ABI ============
export const TASK_SPECIFICATION_ABI = [
  // Task types enum values: 0=DataCrawling, 1=ModelInference, 2=DataProcessing, 3=ContentGeneration, 4=CodeExecution, 5=APIIntegration, 6=Custom
  
  // Create simple specification
  {
    inputs: [
      { name: 'taskId', type: 'bytes32' },
      { name: 'requesterDID', type: 'bytes32' },
      { name: 'taskType', type: 'uint8' },
      { name: 'acceptanceDeadline', type: 'uint256' },
      { name: 'completionDeadline', type: 'uint256' },
      { name: 'minReputationScore', type: 'uint256' },
      { name: 'metadataIPFS', type: 'string' },
    ],
    name: 'createSimpleSpecification',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Validate provider
  {
    inputs: [
      { name: 'taskId', type: 'bytes32' },
      { name: 'providerDID', type: 'bytes32' },
    ],
    name: 'validateProvider',
    outputs: [
      { name: 'valid', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Submit result
  {
    inputs: [
      { name: 'taskId', type: 'bytes32' },
      { name: 'providerDID', type: 'bytes32' },
      { name: 'resultHash', type: 'bytes32' },
      { name: 'formatProbeHash', type: 'bytes32' },
      { name: 'executionProofHash', type: 'bytes32' },
      { name: 'resultIPFS', type: 'string' },
    ],
    name: 'submitResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get specification
  {
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    name: 'getSpecification',
    outputs: [
      {
        components: [
          { name: 'taskId', type: 'bytes32' },
          { name: 'requesterDID', type: 'bytes32' },
          { name: 'taskType', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          {
            components: [
              { name: 'acceptanceDeadline', type: 'uint256' },
              { name: 'completionDeadline', type: 'uint256' },
              { name: 'gracePeriod', type: 'uint256' },
              { name: 'requiresIntermediateResult', type: 'bool' },
              { name: 'intermediateDeadline', type: 'uint256' },
            ],
            name: 'timeConstraints',
            type: 'tuple',
          },
          {
            components: [
              { name: 'fileType', type: 'string' },
              { name: 'minBytes', type: 'uint256' },
              { name: 'maxBytes', type: 'uint256' },
              { name: 'formatFeatures', type: 'string' },
              { name: 'requiresResultHash', type: 'bool' },
              { name: 'requiresFormatProbe', type: 'bool' },
              { name: 'probeType', type: 'uint8' },
            ],
            name: 'outputFormat',
            type: 'tuple',
          },
          {
            components: [
              { name: 'requiredKeywords', type: 'string' },
              { name: 'requiredFields', type: 'string' },
              { name: 'minResultCount', type: 'uint256' },
              { name: 'maxResultCount', type: 'uint256' },
              { name: 'languageRequirement', type: 'string' },
              { name: 'minContentLength', type: 'uint256' },
              { name: 'maxContentLength', type: 'uint256' },
            ],
            name: 'contentValidation',
            type: 'tuple',
          },
          {
            components: [
              { name: 'toolRestriction', type: 'uint8' },
              { name: 'specifiedTools', type: 'string' },
              { name: 'dataSourceConstraints', type: 'string' },
              { name: 'proofType', type: 'uint8' },
              { name: 'externalVerificationAPI', type: 'string' },
              { name: 'privacyConstraints', type: 'string' },
              { name: 'resultReuse', type: 'uint8' },
              { name: 'customConstraints', type: 'string' },
            ],
            name: 'executionConstraints',
            type: 'tuple',
          },
          {
            components: [
              { name: 'minReputationScore', type: 'uint256' },
              { name: 'minCompletedTasks', type: 'uint256' },
              { name: 'requiresKYC', type: 'bool' },
              { name: 'minKYCLevel', type: 'uint8' },
            ],
            name: 'providerCriteria',
            type: 'tuple',
          },
          { name: 'metadataIPFS', type: 'string' },
          { name: 'active', type: 'bool' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Get result
  {
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    name: 'getResult',
    outputs: [
      {
        components: [
          { name: 'taskId', type: 'bytes32' },
          { name: 'providerDID', type: 'bytes32' },
          { name: 'resultHash', type: 'bytes32' },
          { name: 'formatProbeHash', type: 'bytes32' },
          { name: 'executionProofHash', type: 'bytes32' },
          { name: 'resultIPFS', type: 'string' },
          { name: 'submittedAt', type: 'uint256' },
          { name: 'verified', type: 'bool' },
          { name: 'disputed', type: 'bool' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Check periods
  {
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    name: 'isAcceptancePeriod',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    name: 'isCompletionPeriod',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    name: 'isResultOnTime',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'bytes32' },
      { indexed: true, name: 'requesterDID', type: 'bytes32' },
      { indexed: false, name: 'taskType', type: 'uint8' },
      { indexed: false, name: 'acceptanceDeadline', type: 'uint256' },
      { indexed: false, name: 'completionDeadline', type: 'uint256' },
    ],
    name: 'SpecificationCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'bytes32' },
      { indexed: true, name: 'providerDID', type: 'bytes32' },
      { indexed: false, name: 'resultHash', type: 'bytes32' },
      { indexed: false, name: 'resultIPFS', type: 'string' },
    ],
    name: 'ResultSubmitted',
    type: 'event',
  },
] as const;

// ============ Extended Escrow ABI for new functions ============
export const ESCROW_EXTENDED_ABI = [
  // Create task with specification
  {
    inputs: [
      { name: 'requesterDID', type: 'bytes32' },
      { name: 'providerDID', type: 'bytes32' },
      { name: 'baseFee', type: 'uint256' },
      { name: 'complexity', type: 'uint8' },
      { name: 'taskType', type: 'uint8' },
      { name: 'acceptanceDeadline', type: 'uint256' },
      { name: 'completionDeadline', type: 'uint256' },
      { name: 'minReputationScore', type: 'uint256' },
      { name: 'metadataIPFS', type: 'string' },
    ],
    name: 'createTaskWithSpec',
    outputs: [{ name: 'taskId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Accept open task with validation
  {
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'providerDID', type: 'bytes32' },
    ],
    name: 'acceptOpenTaskWithValidation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Submit task result
  {
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'resultHash', type: 'bytes32' },
      { name: 'formatProbeHash', type: 'bytes32' },
      { name: 'executionProofHash', type: 'bytes32' },
      { name: 'resultIPFS', type: 'string' },
    ],
    name: 'submitTaskResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Event for task with spec created
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: false, name: 'specificationId', type: 'bytes32' },
    ],
    name: 'TaskWithSpecCreated',
    type: 'event',
  },
  // Event for result submitted
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'providerDID', type: 'bytes32' },
      { indexed: false, name: 'resultHash', type: 'bytes32' },
    ],
    name: 'TaskResultSubmitted',
    type: 'event',
  },
] as const;

// ============ DualDIDRegistry ABI ============
export const DUAL_DID_REGISTRY_ABI = [
  // Register on-chain DID
  {
    inputs: [],
    name: 'registerOnChainDID',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Register off-chain DID
  {
    inputs: [{ name: 'displayId', type: 'string' }],
    name: 'registerOffChainDID',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Complete registration
  {
    inputs: [{ name: 'displayId', type: 'string' }],
    name: 'completeRegistration',
    outputs: [
      { name: 'onChainDIDHash', type: 'bytes32' },
      { name: 'offChainDIDHash', type: 'bytes32' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get my DIDs
  {
    inputs: [],
    name: 'getMyDIDs',
    outputs: [
      { name: 'onChainDIDHash', type: 'bytes32' },
      {
        name: 'onChainDID',
        type: 'tuple',
        components: [
          { name: 'id', type: 'bytes32' },
          { name: 'walletAddress', type: 'address' },
          { name: 'linkedOffChainDID', type: 'bytes32' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
      { name: 'offChainDIDHash', type: 'bytes32' },
      {
        name: 'offChainDID',
        type: 'tuple',
        components: [
          { name: 'displayId', type: 'string' },
          { name: 'tier', type: 'uint8' },
          { name: 'isSystemGenerated', type: 'bool' },
          { name: 'currentOwnerOnChainDID', type: 'bytes32' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'lastTransferredAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Validate display ID format
  {
    inputs: [{ name: 'displayId', type: 'string' }],
    name: 'validateDisplayIdFormat',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  // Check display ID availability
  {
    inputs: [{ name: 'displayId', type: 'string' }],
    name: 'isDisplayIdAvailable',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get on-chain DID by wallet
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'walletToOnChainDID',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  // List for transfer
  {
    inputs: [
      { name: 'offChainDIDHash', type: 'bytes32' },
      { name: 'price', type: 'uint256' },
      { name: 'paymentToken', type: 'address' },
    ],
    name: 'listForTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Cancel transfer listing
  {
    inputs: [{ name: 'offChainDIDHash', type: 'bytes32' }],
    name: 'cancelTransferListing',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Purchase DID
  {
    inputs: [{ name: 'offChainDIDHash', type: 'bytes32' }],
    name: 'purchaseDID',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'offChainDIDHash', type: 'bytes32' },
      { indexed: false, name: 'displayId', type: 'string' },
      { indexed: false, name: 'tier', type: 'uint8' },
      { indexed: false, name: 'isSystemGenerated', type: 'bool' },
    ],
    name: 'OffChainDIDRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'onChainDIDHash', type: 'bytes32' },
      { indexed: true, name: 'walletAddress', type: 'address' },
      { indexed: true, name: 'linkedOffChainDID', type: 'bytes32' },
    ],
    name: 'OnChainDIDRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'onChainDIDHash', type: 'bytes32' },
      { indexed: true, name: 'offChainDIDHash', type: 'bytes32' },
    ],
    name: 'DIDsLinked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'offChainDIDHash', type: 'bytes32' },
      { indexed: true, name: 'fromOnChainDID', type: 'bytes32' },
      { indexed: true, name: 'toOnChainDID', type: 'bytes32' },
      { indexed: false, name: 'price', type: 'uint256' },
    ],
    name: 'DIDTransferred',
    type: 'event',
  },
  // ============ Sub-DID Functions ============
  {
    inputs: [{ name: 'name', type: 'string' }],
    name: 'registerSubDID',
    outputs: [{ name: 'subDIDHash', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'onChainDIDHash', type: 'bytes32' }],
    name: 'getSubDIDsByOnChainDID',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subDIDHash', type: 'bytes32' }],
    name: 'getSubDID',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'bytes32' },
          { name: 'parentOnChainDID', type: 'bytes32' },
          { name: 'name', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subDIDHash', type: 'bytes32' }],
    name: 'deactivateSubDID',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'subDIDHash', type: 'bytes32' },
      { indexed: true, name: 'parentOnChainDID', type: 'bytes32' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: true, name: 'owner', type: 'address' },
    ],
    name: 'SubDIDRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'subDIDHash', type: 'bytes32' }],
    name: 'SubDIDDeactivated',
    type: 'event',
  },
] as const;

// ============ PremiumDIDAuction ABI ============
export const PREMIUM_DID_AUCTION_ABI = [
  // Create short Display ID auction (user initiated)
  {
    inputs: [
      { name: 'displayId', type: 'string' },
      { name: 'paymentToken', type: 'address' },
    ],
    name: 'createShortDisplayIdAuction',
    outputs: [{ name: 'auctionId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Finalize short Display ID auction
  {
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    name: 'finalizeShortDisplayIdAuction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get auction by display ID (for short ID auctions)
  {
    inputs: [{ name: 'displayId', type: 'string' }],
    name: 'getAuctionByDisplayId',
    outputs: [
      { name: 'auctionId', type: 'uint256' },
      {
        name: 'auction',
        type: 'tuple',
        components: [
          { name: 'offChainDIDHash', type: 'bytes32' },
          { name: 'displayId', type: 'string' },
          { name: 'tier', type: 'uint8' },
          { name: 'auctionType', type: 'uint8' },
          { name: 'startPrice', type: 'uint256' },
          { name: 'currentPrice', type: 'uint256' },
          { name: 'minIncrement', type: 'uint256' },
          { name: 'reservePrice', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'extensionTime', type: 'uint256' },
          { name: 'highestBidder', type: 'address' },
          { name: 'paymentToken', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'bidCount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Check if payment token is supported
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'supportedPaymentTokens',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Next auction ID
  {
    inputs: [],
    name: 'nextAuctionId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Place bid (English auction)
  {
    inputs: [
      { name: 'auctionId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'placeBid',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Purchase Dutch auction
  {
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    name: 'purchaseDutch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Purchase fixed price
  {
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    name: 'purchaseFixedPrice',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Finalize English auction
  {
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    name: 'finalizeEnglishAuction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Withdraw deposit
  {
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    name: 'withdrawDeposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get current Dutch price
  {
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    name: 'getCurrentDutchPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get auction
  {
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    name: 'getAuction',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'offChainDIDHash', type: 'bytes32' },
          { name: 'displayId', type: 'string' },
          { name: 'tier', type: 'uint8' },
          { name: 'auctionType', type: 'uint8' },
          { name: 'startPrice', type: 'uint256' },
          { name: 'currentPrice', type: 'uint256' },
          { name: 'minIncrement', type: 'uint256' },
          { name: 'reservePrice', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'extensionTime', type: 'uint256' },
          { name: 'highestBidder', type: 'address' },
          { name: 'paymentToken', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'bidCount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Get deposit
  {
    inputs: [
      { name: 'bidder', type: 'address' },
      { name: 'auctionId', type: 'uint256' },
    ],
    name: 'getDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'offChainDIDHash', type: 'bytes32' },
      { indexed: false, name: 'displayId', type: 'string' },
      { indexed: false, name: 'auctionType', type: 'uint8' },
      { indexed: false, name: 'startPrice', type: 'uint256' },
      { indexed: false, name: 'startTime', type: 'uint256' },
      { indexed: false, name: 'endTime', type: 'uint256' },
    ],
    name: 'AuctionCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'bidder', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'newEndTime', type: 'uint256' },
    ],
    name: 'BidPlaced',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'finalPrice', type: 'uint256' },
    ],
    name: 'AuctionEnded',
    type: 'event',
  },
] as const;
