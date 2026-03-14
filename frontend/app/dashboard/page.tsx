'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useReadContract, usePublicClient, useConnect } from 'wagmi';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import { agentApi } from '@/lib/api';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { ReputationGauge } from '@/components/dashboard/ReputationGauge';
import { PricingCalculator } from '@/components/dashboard/PricingCalculator';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BindWallet } from '@/components/BindWallet';
import Link from 'next/link';
import { Plus, ArrowRight, AlertCircle, Wallet } from 'lucide-react';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DUAL_DID_REGISTRY_ABI, ESCROW_ABI } from '@/lib/contracts/abis';

const statusMap: Record<number, string> = {
  0: 'created', 1: 'accepted', 2: 'completed',
  3: 'disputed', 4: 'resolved', 5: 'cancelled', 6: 'expired',
};

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export default function DashboardPage() {
  const { address: connectedWallet, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { user, agents, tasks, setAgents, setTasks, setDashboardStats, hasWallet, isEmailUser } = useAppStore();
  const [showBindWallet, setShowBindWallet] = useState(false);
  const publicClient = usePublicClient();
  const t = useTranslations();

  // Email user with bound wallet but not connected
  const needsWalletConnection = isEmailUser() && hasWallet() && !isConnected;

  // Use connected wallet or user's bound wallet address
  const walletAddress = connectedWallet || (user?.wallet_address as `0x${string}` | undefined);

  // Get on-chain DID from DualDIDRegistry
  const { data: onChainHumanDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'walletToOnChainDID',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress },
  });

  const hasOnChainDID = onChainHumanDID && onChainHumanDID !== ZERO_BYTES32;

  // Get Sub-DIDs (Agent DIDs) from DualDIDRegistry
  const { data: agentDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'getSubDIDsByOnChainDID',
    args: hasOnChainDID ? [onChainHumanDID as `0x${string}`] : undefined,
    query: { enabled: hasOnChainDID },
  });

  // Load tasks from chain
  const loadTasksFromChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      const taskCount = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: 'taskCount',
      }) as bigint;

      if (taskCount === BigInt(0)) {
        setTasks([]);
        return;
      }

      const userDIDs: Set<string> = new Set();
      if (agentDIDs) {
        (agentDIDs as `0x${string}`[]).forEach(did => userDIDs.add(did.toLowerCase()));
      }

      const loadedTasks: any[] = [];
      for (let i = 0; i < Number(taskCount); i++) {
        try {
          const task = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: 'tasks',
            args: [BigInt(i)],
          }) as any;

          const requesterDID = (task[0] || '').toLowerCase();
          const providerDID = (task[1] || '').toLowerCase();

          if (userDIDs.has(requesterDID) || userDIDs.has(providerDID)) {
            const baseFee = task[2] || task.baseFee;
            const finalAmount = task[3] || task.finalAmount;
            const statusNum = Number(task[6] || 0);
            const metadata = task[11] || '{}';

            let parsedMeta = {};
            try { parsedMeta = JSON.parse(metadata); } catch {}

            loadedTasks.push({
              id: i,
              requester_did: task[0],
              provider_did: task[1],
              base_amount: Number(baseFee) / 1e6,
              final_amount: Number(finalAmount) / 1e6,
              status: statusMap[statusNum] || 'created',
              created_at: new Date(Number(task[7] || 0) * 1000).toISOString(),
              ...parsedMeta,
            });
          }
        } catch (err) {
          console.error(`Failed to load task ${i}:`, err);
        }
      }
      setTasks(loadedTasks);

      // Calculate stats from loaded tasks
      const completedTasks = loadedTasks.filter(t => t.status === 'completed').length;
      const activeTasks = loadedTasks.filter(t => ['created', 'accepted'].includes(t.status)).length;
      const disputedTasks = loadedTasks.filter(t => t.status === 'disputed').length;
      const totalVolume = loadedTasks.reduce((sum, t) => sum + (t.base_amount || 0), 0);

      setDashboardStats({
        total_tasks: loadedTasks.length,
        completed_tasks: completedTasks,
        active_tasks: activeTasks,
        disputed_tasks: disputedTasks,
        total_volume: totalVolume,
        total_agents: agentDIDs ? (agentDIDs as `0x${string}`[]).length : 0,
        average_task_cost: loadedTasks.length > 0 ? totalVolume / loadedTasks.length : 0,
        success_rate: loadedTasks.length > 0 ? (completedTasks / loadedTasks.length) * 100 : 0,
      });
    } catch (error) {
      console.error('Failed to load tasks from chain:', error);
    }
  }, [publicClient, agentDIDs, setTasks, setDashboardStats]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load agents
        const agentsData = await agentApi.getAll();
        setAgents(agentsData || []);

        // Load tasks from chain (this also updates stats)
        await loadTasksFromChain();
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };

    loadData();
  }, [user, agentDIDs, loadTasksFromChain]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/agents">
              <Plus className="mr-2 h-4 w-4" />
              {t('dashboard.newAgent')}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/tasks/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('dashboard.createTask')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Wallet binding prompt for email users without wallet */}
      {isEmailUser() && !hasWallet() && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">{t('dashboard.bindWalletTitle')}</AlertTitle>
          <AlertDescription className="text-amber-700">
            {t('dashboard.bindWalletDesc')}
            <Button
              variant="link"
              className="p-0 h-auto ml-1 text-amber-800 hover:text-amber-900"
              onClick={() => setShowBindWallet(true)}
            >
              <Wallet className="h-4 w-4 mr-1" />
              {t('dashboard.bindWalletNow')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Connect wallet prompt for email users with bound wallet */}
      {needsWalletConnection && (
        <Alert className="border-blue-200 bg-blue-50">
          <Wallet className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">{t('dashboard.connectWalletTitle')}</AlertTitle>
          <AlertDescription className="text-blue-700">
            {t('dashboard.connectWalletDesc')}
            <div className="flex gap-2 mt-2">
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  size="sm"
                  onClick={() => connect({ connector })}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  {connector.name}
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showBindWallet && (
        <BindWallet
          showAsModal
          onSuccess={() => setShowBindWallet(false)}
          onCancel={() => setShowBindWallet(false)}
        />
      )}

      {/* Stats Overview */}
      <StatsCards />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Agents & Tasks */}
        <div className="space-y-6 lg:col-span-2">
          {/* Agents Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('dashboard.yourAgents')}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/agents">
                  {t('dashboard.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground">{t('dashboard.noAgentsYet')}</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link href="/dashboard/agents">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('dashboard.createFirstAgent')}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {agents.slice(0, 4).map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Tasks</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/tasks">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground">No tasks yet</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link href="/dashboard/tasks/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Task
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {tasks.slice(0, 4).map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Reputation & Pricing */}
        <div className="space-y-6">
          <ReputationGauge />
          <PricingCalculator />
        </div>
      </div>
    </div>
  );
}
