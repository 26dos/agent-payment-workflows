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

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
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
      throw new Error(`API Error: ${response.status}`);
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
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}

export const api = new ApiClient(API_BASE_URL);

// API endpoints
export const authApi = {
  getNonce: (walletAddress: string) =>
    api.get<{ message: string; nonce: number }>(`/auth/nonce?wallet_address=${walletAddress}`),

  login: (data: { wallet_address: string; message: string; signature: string }) =>
    api.post<{ token: string; user: any }>('/auth/login', data),
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
  }) => api.post<any>('/tasks', data),
  accept: (id: number, providerDid: string) => api.put(`/tasks/${id}/accept`, { provider_did: providerDid }),
};
