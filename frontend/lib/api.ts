import { API_BASE_URL } from './config';
import { useAppStore } from './store';

// API client with auth
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = useAppStore.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleError(response: Response): Promise<never> {
    let message = 'Request failed';
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }
}

export const api = new ApiClient(API_BASE_URL);

// API endpoints
export const authApi = {
  // Wallet auth
  getNonce: (walletAddress: string) =>
    api.get<{ message: string; nonce: number }>(`/auth/nonce?wallet_address=${walletAddress}`),

  login: (data: { wallet_address: string; message: string; signature: string; invite_code?: string }) =>
    api.post<{ token: string; user: any }>('/auth/login', data),

  // Email auth
  sendVerificationCode: (email: string, type: 'register' | 'login' | 'reset_password' = 'register') =>
    api.post<{ message: string; code?: string }>('/auth/email/send-code', { email, type }),

  emailRegister: (data: { email: string; password: string; code: string; display_id?: string; invite_code?: string }) =>
    api.post<{ token: string; user: any; message: string }>('/auth/email/register', data),

  emailLogin: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: any }>('/auth/email/login', data),

  emailLoginWithCode: (data: { email: string; code: string }) =>
    api.post<{ token: string; user: any }>('/auth/email/login-with-code', data),

  // Google OAuth
  getGoogleAuthURL: () =>
    api.get<{ url: string }>('/auth/google/url'),

  googleLogin: (code: string) =>
    api.post<{ token: string; user: any }>('/auth/google', { code }),
};

export const walletApi = {
  getBindNonce: (walletAddress: string) =>
    api.get<{ message: string; nonce: number }>(`/wallet/bind/nonce?wallet_address=${walletAddress}`),

  bindWallet: (data: { wallet_address: string; message: string; signature: string }) =>
    api.post<{ message: string; user: any }>('/wallet/bind', data),
};

export const userApi = {
  getProfile: () => api.get<any>('/user/profile'),
  updateDID: (did: string) => api.put('/user/did', { did }),
};

export const agentApi = {
  getAll: () => api.get<any[]>('/agents'),
  getOne: (id: number) => api.get<any>(`/agents/${id}`),
  create: (name: string) => api.post<any>('/agents', { name }),
  updateMandate: (id: number, data: { daily_limit: number; single_limit: number; expiry: string }) =>
    api.put(`/agents/${id}/mandate`, data),
  updateDID: (id: number, subDid: string) => api.put(`/agents/${id}/did`, { sub_did: subDid }),
};

export const taskApi = {
  getAll: (did: string, role: 'requester' | 'provider' = 'requester') =>
    api.get<any[]>(`/tasks?did=${did}&role=${role}`),
  getOne: (id: number) => api.get<any>(`/tasks/${id}`),
  create: (data: {
    requester_did: string;
    provider_did: string;
    base_amount: number;
    complexity: number;
    metadata?: string;
  }) => api.post<any>('/tasks', data),
  accept: (id: number) => api.put(`/tasks/${id}/accept`),
  complete: (id: number) => api.put(`/tasks/${id}/complete`),
  cancel: (id: number) => api.put(`/tasks/${id}/cancel`),
  dispute: (id: number, data: { raised_by_did: string; reason: string }) =>
    api.put(`/tasks/${id}/dispute`, data),
  updateChain: (id: number, data: { chain_task_id: number; tx_hash: string }) =>
    api.put(`/tasks/${id}/chain`, data),
};

export const pricingApi = {
  calculate: (data: { base_fee: number; complexity: number; reputation_score?: number }) =>
    api.post<{
      base_fee: number;
      final_price: number;
      k_reputation: number;
      k_complexity: number;
      k_supply_demand: number;
      insurance_premium: number;
    }>('/pricing/calculate', data),
};

export const dashboardApi = {
  getStats: () => api.get<any>('/dashboard/stats'),
};

// Public API (no auth required)
export const publicApi = {
  getTasks: (limit = 50, offset = 0) =>
    fetch(`${API_BASE_URL}/public/tasks?limit=${limit}&offset=${offset}`).then(res => res.json()),
  getTask: (id: number) =>
    fetch(`${API_BASE_URL}/public/tasks/${id}`).then(res => res.json()),
  getAgents: (limit = 50, offset = 0) =>
    fetch(`${API_BASE_URL}/public/agents?limit=${limit}&offset=${offset}`).then(res => res.json()),
  getAgent: (id: number) =>
    fetch(`${API_BASE_URL}/public/agents/${id}`).then(res => res.json()),
};

// Batch chain API
export const batchApi = {
  getPending: () => api.get<any>('/batch/pending'),
  trigger: (taskIds?: number[]) => api.post<any>('/batch/trigger', taskIds ? { task_ids: taskIds } : {}),
  markOnChain: (taskIds: number[], txHash: string) => 
    api.post<any>('/batch/mark-onchain', { task_ids: taskIds, tx_hash: txHash }),
  getConfig: () => api.get<any>('/batch/config'),
  updateConfig: (data: { task_count: number; interval_minutes: number; auto_enabled: boolean }) =>
    api.put('/batch/config', data),
};

// Update task API for marketplace
export const taskApiV2 = {
  create: (data: {
    requester_did: string;
    title: string;
    description: string;
    base_amount: number;
    complexity: number;
    chain_tx_hash?: string;
    chain_task_id?: number;
    metadata?: string;
  }) => api.post<any>('/tasks', data),
  accept: (id: number, providerDid: string, txHash?: string) => api.put(`/tasks/${id}/accept`, { provider_did: providerDid, tx_hash: txHash }),
};

// Incentive system API
export const incentiveApi = {
  // Get incentive constants
  getConstants: () => api.get<{
    human_registration_points: number;
    agent_registration_points: number;
    human_referral_inviter_points: number;
    human_referral_invitee_points: number;
    task_completion_points: number;
    max_daily_task_points: number;
    max_total_agent_task_points: number;
    kyc_basic_points: number;
    kyc_standard_points: number;
    kyc_advanced_points: number;
    kyc_full_points: number;
  }>('/incentives/constants'),

  // Get human incentive data
  getHumanIncentive: (did: string) => api.get<{
    human_did: string;
    registration_points: number;
    kyc_points: number;
    referral_points: number;
    total_points: number;
    kyc_level: number;
    invited_by: string | null;
    invite_count: number;
    invite_code: string | null;
    registered: boolean;
    blacklisted: boolean;
  }>(`/incentives/human?did=${did}`),

  // Get agent incentive data
  getAgentIncentive: (did: string) => api.get<{
    agent_did: string;
    registration_points: number;
    task_points: number;
    total_points: number;
    daily_task_points: number;
    registered: boolean;
  }>(`/incentives/agent?did=${did}`),

  // Get incentive summary for current user
  getSummary: () => api.get<{
    human_did: string;
    human_points: number;
    total_agent_points: number;
    total_points: number;
    kyc_level: number;
    invite_count: number;
    blacklisted: boolean;
    agents: any[];
  }>('/incentives/summary'),

  // Claim human registration bonus
  claimHumanBonus: (humanDid: string, inviteCode?: string) =>
    api.post<any>('/incentives/claim-human', {
      human_did: humanDid,
      invite_code: inviteCode,
    }),

  // Claim agent registration bonus
  claimAgentBonus: (agentDid: string, humanDid: string) =>
    api.post<any>('/incentives/claim-agent', {
      agent_did: agentDid,
      human_did: humanDid,
    }),

  // Generate invite code
  generateInviteCode: (humanDid: string) =>
    api.post<{ invite_code: string; human_did: string }>('/incentives/generate-invite', {
      human_did: humanDid,
    }),

  // Record task completion (called by backend automatically)
  recordCompletion: (agentDid: string, taskId: number) =>
    api.post<any>('/incentives/record-completion', {
      agent_did: agentDid,
      task_id: taskId,
    }),

  // Get referral leaderboard
  getReferralLeaderboard: (limit = 20) =>
    api.get<any[]>(`/incentives/leaderboard/referrals?limit=${limit}`),

  // Get points leaderboard
  getPointsLeaderboard: (limit = 20, includeAgents = false) =>
    api.get<any[]>(`/incentives/leaderboard/points?limit=${limit}&include_agents=${includeAgents}`),
};

// Task specification API
export const specificationApi = {
  // Create task specification
  create: (data: {
    task_id: number;
    task_type: number;
    acceptance_deadline?: string;
    completion_deadline?: string;
    grace_period?: number;
    min_reputation_score?: number;
    min_completed_tasks?: number;
    requires_kyc?: boolean;
    min_kyc_level?: number;
    file_type?: string;
    min_bytes?: number;
    max_bytes?: number;
    format_features?: string;
    required_keywords?: string;
    required_fields?: string;
    min_result_count?: number;
    language_requirement?: string;
    metadata_ipfs?: string;
  }) => api.post<any>('/specifications', data),

  // Get task specification
  get: (taskId: number) => api.get<any>(`/specifications/${taskId}`),

  // Validate provider for task
  validateProvider: (taskId: number, providerDid: string) =>
    api.post<{ valid: boolean; reason: string }>('/specifications/validate', {
      task_id: taskId,
      provider_did: providerDid,
    }),
};

// Task results API
export const resultsApi = {
  // Submit task result
  submit: (data: {
    task_id: number;
    provider_did: string;
    result_hash: string;
    format_probe_hash?: string;
    execution_proof_hash?: string;
    result_ipfs?: string;
  }) => api.post<any>('/results', data),

  // Get task result
  get: (taskId: number) => api.get<any>(`/results/${taskId}`),
};

// ============ Dual DID System API ============

export interface OffChainDID {
  id: number;
  display_id: string;
  did_hash: string;
  tier: number;
  is_system_generated: boolean;
  current_owner_on_chain_id?: string;
  last_transferred_at?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnChainDID {
  id: number;
  did_hash: string;
  wallet_address: string;
  linked_off_chain_id?: string;
  active: boolean;
  created_at: string;
}

export interface UserDIDInfo {
  on_chain_did?: OnChainDID;
  off_chain_did?: OffChainDID;
  has_on_chain: boolean;
  has_off_chain: boolean;
}

export interface DIDTransferListing {
  id: number;
  off_chain_did_hash: string;
  seller_wallet: string;
  price: number;
  payment_token: string;
  active: boolean;
  listed_at: string;
}

export const didApi = {
  // Register on-chain DID
  registerOnChainDID: (walletAddress?: string, txHash?: string, didHash?: string) =>
    api.post<OnChainDID>('/dids/on-chain', { wallet_address: walletAddress, tx_hash: txHash, did_hash: didHash }),

  // Register off-chain DID
  registerOffChainDID: (displayId: string) =>
    api.post<OffChainDID>('/dids/off-chain', { display_id: displayId }),

  // Complete registration (both on-chain and off-chain)
  completeRegistration: (displayId: string) =>
    api.post<UserDIDInfo>('/dids/complete', { display_id: displayId }),

  // Get my DIDs
  getMyDIDs: () => api.get<UserDIDInfo>('/dids/my'),

  // Validate display ID
  validateDisplayID: (displayId: string) =>
    api.get<{ 
      valid: boolean; 
      available: boolean; 
      reason: string; 
      is_premium: boolean;
      is_five_digit: boolean;
      registration_type: 'free' | 'auction' | 'invite_reward';
    }>(`/dids/validate?display_id=${displayId}`),

  // Get off-chain DID by display ID
  getOffChainDID: (displayId: string) => api.get<OffChainDID>(`/dids/off-chain/${displayId}`),

  // Get invite progress
  getInviteProgress: () => 
    api.get<{ 
      invite_count: number; 
      required_invites: number; 
      eligible: boolean; 
      five_digit_claimed: boolean;
    }>('/dids/invite-progress'),

  // Claim 5-digit DID
  claimFiveDigitDID: () =>
    api.post<{ success: boolean; display_id: string; did_hash: string }>('/dids/claim-five-digit'),

  // Get my invite code
  getInviteCode: () =>
    api.get<{ invite_code: string; invite_link: string }>('/dids/invite-code'),
};

// DID Transfer API
export const didTransferApi = {
  // List DID for transfer
  listForTransfer: (displayId: string, price: number, paymentToken: string) =>
    api.post<DIDTransferListing>('/transfers/list', {
      display_id: displayId,
      price,
      payment_token: paymentToken,
    }),

  // Cancel transfer listing
  cancelListing: (displayId: string) => api.delete(`/transfers/${displayId}`),

  // Get active listings
  getListings: (page = 1, pageSize = 20) =>
    api.get<{
      listings: DIDTransferListing[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>(`/transfers?page=${page}&page_size=${pageSize}`),
};

// ============ Premium DID Auction API ============

export interface PremiumDIDAuction {
  id: number;
  chain_auction_id?: number;
  off_chain_did_hash: string;
  display_id: string;
  tier: number;
  auction_type: number;
  start_price: number;
  current_price: number;
  min_increment: number;
  reserve_price: number;
  start_time: string;
  end_time: string;
  highest_bidder?: string;
  payment_token: string;
  status: number;
  bid_count: number;
  winner_wallet?: string;
  final_price?: number;
  tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface AuctionBid {
  id: number;
  auction_id: number;
  bidder_wallet: string;
  amount: number;
  deposit_amount: number;
  tx_hash: string;
  created_at: string;
}

export interface PremiumDIDStats {
  total_premium_dids: number;
  sold_premium_dids: number;
  available_premium_dids: number;
  active_auctions: number;
  total_auction_volume: number;
  tier_counts: Record<string, number>;
}

export const auctionApi = {
  // Get auctions (supports status filter: "active", "sold", "all")
  getActiveAuctions: (page = 1, pageSize = 20, tier?: string, auctionType?: string, status?: string) => {
    let url = `/auctions?page=${page}&page_size=${pageSize}`;
    if (tier) url += `&tier=${tier}`;
    if (auctionType) url += `&auction_type=${auctionType}`;
    if (status) url += `&status=${status}`;
    return api.get<{
      auctions: PremiumDIDAuction[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>(url);
  },

  // Get auction stats
  getStats: () => api.get<PremiumDIDStats>('/auctions/stats'),

  // Get available premium DIDs
  getAvailablePremiumDIDs: (page = 1, pageSize = 20, tier?: string) => {
    let url = `/auctions/premium-dids?page=${page}&page_size=${pageSize}`;
    if (tier) url += `&tier=${tier}`;
    return api.get<{
      dids: OffChainDID[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>(url);
  },

  // Get auction by ID
  getAuction: (auctionId: number) => api.get<PremiumDIDAuction>(`/auctions/${auctionId}`),

  // Get auction bids
  getAuctionBids: (auctionId: number) => api.get<AuctionBid[]>(`/auctions/${auctionId}/bids`),

  // Record bid (after on-chain transaction)
  recordBid: (auctionId: number, amount: number, txHash: string, newEndTime?: number) =>
    api.post<AuctionBid>('/auctions/bid', {
      auction_id: auctionId,
      amount,
      tx_hash: txHash,
      new_end_time: newEndTime,
    }),

  // Sync short ID auction from chain to backend
  syncShortIdAuction: (displayId: string, chainAuctionId: number, startPrice: number, paymentToken: string, txHash: string) =>
    api.post<PremiumDIDAuction>('/auctions/sync-short-id', {
      display_id: displayId,
      chain_auction_id: chainAuctionId,
      start_price: startPrice,
      payment_token: paymentToken,
      tx_hash: txHash,
    }),

  // Sync auction finalization to backend
  finalizeSync: (data: {
    auction_id: number;
    winner_wallet: string;
    final_price: number;
    display_id: string;
    off_chain_did_hash: string;
    on_chain_did_hash: string;
    tx_hash: string;
  }) => api.post<{ message: string }>('/auctions/finalize-sync', data),
};

// Admin DID API
export const adminDidApi = {
  // Create premium DID
  createPremiumDID: (displayId: string, tier: number) =>
    api.post<OffChainDID>('/admin/dids/premium', { display_id: displayId, tier }),

  // Create premium DIDs batch
  createPremiumDIDsBatch: (dids: { display_id: string; tier: number }[]) =>
    api.post<{ created: number; failed: number }>('/admin/dids/premium/batch', { dids }),

  // Create auction
  createAuction: (data: {
    display_id: string;
    auction_type: number;
    start_price: number;
    min_increment?: number;
    duration?: number;
    payment_token: string;
  }) => api.post<PremiumDIDAuction>('/admin/dids/auctions', data),

  // Cancel auction
  cancelAuction: (auctionId: number) => api.delete(`/admin/dids/auctions/${auctionId}`),
};
