'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { taskApi } from '@/lib/api';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DID_REGISTRY_ABI } from '@/lib/contracts/abis';

export default function TasksPage() {
  const { address } = useAccount();
  const { user, tasks, setTasks } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requester');

  // Get Human DID from chain
  const { data: onChainHumanDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'addressToHumanDID',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const hasHumanDID = onChainHumanDID && onChainHumanDID !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  // Get Agent DIDs from chain
  const { data: agentDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'getAgentsByHuman',
    args: hasHumanDID ? [onChainHumanDID as `0x${string}`] : undefined,
    query: { enabled: hasHumanDID },
  });

  useEffect(() => {
    const loadTasks = async () => {
      // Use the first Agent DID to query tasks (since tasks are created with Agent DIDs)
      const queryDID = agentDIDs && (agentDIDs as `0x${string}`[]).length > 0 
        ? (agentDIDs as `0x${string}`[])[0] 
        : user?.did;
      
      if (!queryDID) {
        setIsLoading(false);
        return;
      }

      try {
        // Query tasks for all agent DIDs
        let allTasks: any[] = [];
        if (agentDIDs && (agentDIDs as `0x${string}`[]).length > 0) {
          for (const did of (agentDIDs as `0x${string}`[])) {
            const data = await taskApi.getAll(did, activeTab as 'requester' | 'provider');
            if (data) allTasks = [...allTasks, ...data];
          }
        } else if (user?.did) {
          const data = await taskApi.getAll(user.did, activeTab as 'requester' | 'provider');
          if (data) allTasks = data;
        }
        setTasks(allTasks);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [user, activeTab, setTasks, agentDIDs]);

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
