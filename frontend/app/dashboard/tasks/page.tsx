'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DUAL_DID_REGISTRY_ABI, ESCROW_ABI } from '@/lib/contracts/abis';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const statusMap: Record<number, string> = {
  0: 'created',
  1: 'accepted',
  2: 'completed',
  3: 'disputed',
  4: 'resolved',
  5: 'cancelled',
  6: 'expired',
};

export default function TasksPage() {
  const { address: connectedWallet } = useAccount();
  const { tasks, setTasks, user } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requester');
  const publicClient = usePublicClient();

  // Use connected wallet or user's bound wallet address
  const walletAddress = connectedWallet || (user?.wallet_address as `0x${string}` | undefined);

  // Get On-Chain DID from DualDIDRegistry
  const { data: onChainDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'walletToOnChainDID',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress },
  });

  const hasOnChainDID = onChainDID && onChainDID !== ZERO_BYTES32;

  // Get Sub-DIDs (Agent DIDs) from DualDIDRegistry
  const { data: subDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'getSubDIDsByOnChainDID',
    args: hasOnChainDID ? [onChainDID as `0x${string}`] : undefined,
    query: { enabled: hasOnChainDID },
  });

  // Load tasks from chain
  const loadTasksFromChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      // Get task count
      const taskCount = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: 'taskCount',
      }) as bigint;

      if (taskCount === BigInt(0)) {
        setTasks([]);
        return;
      }

      // Collect all user Sub-DIDs from DualDIDRegistry
      const userDIDs: Set<string> = new Set();
      if (subDIDs) {
        (subDIDs as `0x${string}`[]).forEach(did => userDIDs.add(did.toLowerCase()));
      }

      // Load all tasks and filter by user DIDs
      const loadedTasks: any[] = [];
      for (let i = 0; i < Number(taskCount); i++) {
        try {
          const task = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: 'tasks',
            args: [BigInt(i)],
          }) as any;

          const requesterDID = (task[0] || task.requesterDID || '').toLowerCase();
          const providerDID = (task[1] || task.providerDID || '').toLowerCase();
          
          const isRequester = userDIDs.has(requesterDID);
          const isProvider = userDIDs.has(providerDID);

          if ((activeTab === 'requester' && isRequester) || (activeTab === 'provider' && isProvider)) {
            // Parse task data
            const baseFee = task[2] || task.baseFee;
            const finalAmount = task[3] || task.finalAmount;
            const statusNum = Number(task[6] || task.status || 0);
            const metadata = task[11] || task.metadata || '{}';
            
            let parsedMeta = {};
            try {
              parsedMeta = JSON.parse(metadata);
            } catch {}

            loadedTasks.push({
              id: i,
              requester_did: task[0] || task.requesterDID,
              provider_did: task[1] || task.providerDID,
              base_amount: Number(baseFee) / 1e6,
              final_amount: Number(finalAmount) / 1e6,
              status: statusMap[statusNum] || 'created',
              created_at: new Date(Number(task[7] || task.createdAt || 0) * 1000).toISOString(),
              ...parsedMeta,
            });
          }
        } catch (err) {
          console.error(`Failed to load task ${i}:`, err);
        }
      }

      setTasks(loadedTasks);
    } catch (error) {
      console.error('Failed to load tasks from chain:', error);
    }
  }, [publicClient, subDIDs, activeTab, setTasks]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadTasksFromChain();
      setIsLoading(false);
    };
    load();
  }, [loadTasksFromChain]);

  const filterByStatus = (status: string[]) =>
    tasks.filter((task) => status.includes(task.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage your escrow tasks</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Link>
        </Button>
      </div>

      {/* Role Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requester">As Requester</TabsTrigger>
          <TabsTrigger value="provider">As Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="requester" className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No tasks yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Create your first task to start using escrow
                </p>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/tasks/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Active Tasks */}
              {filterByStatus(['created', 'accepted']).length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold">Active Tasks</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filterByStatus(['created', 'accepted']).map((task) => (
                      <TaskCard key={task.id} task={task} isRequester />
                    ))}
                  </div>
                </div>
              )}

              {/* Disputed Tasks */}
              {filterByStatus(['disputed']).length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-destructive">Disputed Tasks</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filterByStatus(['disputed']).map((task) => (
                      <TaskCard key={task.id} task={task} isRequester />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {filterByStatus(['completed', 'resolved']).length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold">Completed Tasks</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filterByStatus(['completed', 'resolved']).map((task) => (
                      <TaskCard key={task.id} task={task} isRequester />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="provider" className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No tasks as provider</h3>
                <p className="mt-2 text-muted-foreground">
                  Tasks where you are the provider will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} isRequester={false} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
