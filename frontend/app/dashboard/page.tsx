'use client';

import { useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { dashboardApi, agentApi, taskApi } from '@/lib/api';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { ReputationGauge } from '@/components/dashboard/ReputationGauge';
import { PricingCalculator } from '@/components/dashboard/PricingCalculator';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ArrowRight } from 'lucide-react';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DID_REGISTRY_ABI } from '@/lib/contracts/abis';

export default function DashboardPage() {
  const { address } = useAccount();
  const { user, agents, tasks, setAgents, setTasks, setDashboardStats } = useAppStore();

  // Get on-chain Human DID
  const { data: onChainHumanDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'addressToHumanDID',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Get on-chain Agent DIDs
  const { data: agentDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'getAgentsByHuman',
    args: onChainHumanDID ? [onChainHumanDID] : undefined,
    query: { enabled: !!onChainHumanDID },
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load dashboard stats
        const stats = await dashboardApi.getStats();
        setDashboardStats(stats);

        // Load agents
        const agentsData = await agentApi.getAll();
        setAgents(agentsData || []);

        // Load recent tasks using Agent DIDs from chain
        const agentDIDList = agentDIDs as `0x${string}`[] | undefined;
        if (agentDIDList && agentDIDList.length > 0) {
          const allTasks: any[] = [];
          for (const agentDID of agentDIDList) {
            try {
              const requesterTasks = await taskApi.getAll(agentDID, 'requester');
              const providerTasks = await taskApi.getAll(agentDID, 'provider');
              allTasks.push(...(requesterTasks || []), ...(providerTasks || []));
            } catch (err) {
              console.error('Failed to load tasks for agent:', agentDID, err);
            }
          }
          // Remove duplicates by id
          const uniqueTasks = allTasks.filter((task, index, self) =>
            index === self.findIndex(t => t.id === task.id)
          );
          setTasks(uniqueTasks);
        } else if (user?.did) {
          // Fallback to user.did
          const tasksData = await taskApi.getAll(user.did);
          setTasks(tasksData || []);
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };

    loadData();
  }, [user, agentDIDs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/agents">
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/tasks/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <StatsCards />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Agents & Tasks */}
        <div className="space-y-6 lg:col-span-2">
          {/* Agents Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Agents</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/agents">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground">No agents yet</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link href="/dashboard/agents">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Agent
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
