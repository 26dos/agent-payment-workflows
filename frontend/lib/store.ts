import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  wallet_address: string;
  did: string | null;
  human_score: number;
  metadata: string;
}

interface Agent {
  id: number;
  user_id: number;
  name: string;
  sub_did: string | null;
  agent_score: number;
  daily_limit: number | null;
  single_limit: number | null;
  mandate_expiry: string | null;
  status: string;
}

interface Task {
  id: number;
  chain_task_id: number | null;
  requester_did: string;
  provider_did: string;
  base_amount: number;
  final_amount: number;
  insurance_premium: number;
  complexity: number;
  status: string;
  metadata: string;
  tx_hash: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  expiry_time: string;
}

interface DashboardStats {
  total_tasks: number;
  completed_tasks: number;
  active_tasks: number;
  disputed_tasks: number;
  total_volume: number;
  total_agents: number;
  average_task_cost: number;
  success_rate: number;
}

interface AppState {
  // Auth
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;

  // Data
  agents: Agent[];
  tasks: Task[];
  dashboardStats: DashboardStats | null;

  // Actions
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agent: Agent) => void;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  setDashboardStats: (stats: DashboardStats) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      token: null,
      user: null,
      isAuthenticated: false,
      agents: [],
      tasks: [],
      dashboardStats: null,

      // Auth actions
      setAuth: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),

      setUser: (user) => set({ user }),

      clearAuth: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          agents: [],
          tasks: [],
          dashboardStats: null,
        }),

      // Agent actions
      setAgents: (agents) => set({ agents }),
      addAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),
      updateAgent: (agent) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === agent.id ? agent : a)),
        })),

      // Task actions
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) =>
        set((state) => ({ tasks: [task, ...state.tasks] })),
      updateTask: (task) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
        })),

      // Dashboard actions
      setDashboardStats: (stats) => set({ dashboardStats: stats }),
    }),
    {
      name: 'clawpay-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
