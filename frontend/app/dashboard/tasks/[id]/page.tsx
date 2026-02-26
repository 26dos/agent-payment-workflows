'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Loader2, 
  Clock, 
  DollarSign, 
  User, 
  Bot,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { ESCROW_ABI } from '@/lib/contracts/abis';
import { formatDID } from '@/lib/contracts/hooks';

const statusColors: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  accepted: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  resolved: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  created: <Clock className="h-4 w-4" />,
  accepted: <PlayCircle className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  disputed: <AlertTriangle className="h-4 w-4" />,
  resolved: <CheckCircle2 className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

const statusMap: Record<number, string> = {
  0: 'created', 1: 'accepted', 2: 'completed',
  3: 'disputed', 4: 'resolved', 5: 'cancelled', 6: 'expired',
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Accept Task
  const { 
    writeContract: writeAccept, 
    data: acceptHash, 
    isPending: isAcceptPending 
  } = useWriteContract();
  const { isLoading: isAcceptConfirming, isSuccess: isAcceptSuccess } = useWaitForTransactionReceipt({ hash: acceptHash });

  // Complete Task
  const { 
    writeContract: writeComplete, 
    data: completeHash, 
    isPending: isCompletePending 
  } = useWriteContract();
  const { isLoading: isCompleteConfirming, isSuccess: isCompleteSuccess } = useWaitForTransactionReceipt({ hash: completeHash });

  // Raise Dispute
  const { 
    writeContract: writeDispute, 
    data: disputeHash, 
    isPending: isDisputePending 
  } = useWriteContract();
  const { isLoading: isDisputeConfirming, isSuccess: isDisputeSuccess } = useWaitForTransactionReceipt({ hash: disputeHash });
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load task directly from blockchain
  useEffect(() => {
    const loadTaskFromChain = async () => {
      if (!publicClient || !params.id) return;

      try {
        const taskId = Number(params.id);
        
        // First check if task exists
        const taskCount = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: 'taskCount',
        }) as bigint;

        if (taskId >= Number(taskCount)) {
          setTask(null);
          setIsLoading(false);
          return;
        }

        // Load task from chain
        const chainTask = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: 'tasks',
          args: [BigInt(taskId)],
        }) as any;

        const baseFee = chainTask[2] || chainTask.baseFee;
        const finalAmount = chainTask[3] || chainTask.finalAmount;
        const statusNum = Number(chainTask[6] || 0);
        const createdAt = Number(chainTask[7] || 0);
        const acceptedAt = Number(chainTask[8] || 0);
        const completedAt = Number(chainTask[9] || 0);
        const metadata = chainTask[11] || '{}';

        let parsedMeta: any = {};
        try { parsedMeta = JSON.parse(metadata); } catch {}

        setTask({
          id: taskId,
          chain_task_id: taskId,
          requester_did: chainTask[0],
          provider_did: chainTask[1],
          base_amount: Number(baseFee) / 1e6,
          final_amount: Number(finalAmount) / 1e6,
          complexity: Number(chainTask[5] || 1),
          status: statusMap[statusNum] || 'created',
          created_at: createdAt > 0 ? new Date(createdAt * 1000).toISOString() : new Date().toISOString(),
          accepted_at: acceptedAt > 0 ? new Date(acceptedAt * 1000).toISOString() : null,
          completed_at: completedAt > 0 ? new Date(completedAt * 1000).toISOString() : null,
          metadata: metadata,
          ...parsedMeta,
        });
      } catch (error) {
        console.error('Failed to load task from chain:', error);
        setTask(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadTaskFromChain();
  }, [params.id, publicClient]);

  // Reload task after successful transactions
  useEffect(() => {
    const reloadTask = async () => {
      if (!publicClient || !params.id) return;
      if (!isAcceptSuccess && !isCompleteSuccess && !isDisputeSuccess) return;

      // Wait a bit for blockchain to update
      await new Promise(resolve => setTimeout(resolve, 2000));

      const taskId = Number(params.id);
      try {
        const chainTask = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: 'tasks',
          args: [BigInt(taskId)],
        }) as any;

        const statusNum = Number(chainTask[6] || 0);
        setTask((prev: any) => prev ? { ...prev, status: statusMap[statusNum] || prev.status } : null);
      } catch (err) {
        console.error('Failed to reload task:', err);
      }
    };

    reloadTask();
  }, [isAcceptSuccess, isCompleteSuccess, isDisputeSuccess, params.id, publicClient]);

  const handleAcceptTask = async () => {
    if (task?.chain_task_id === undefined) return;
    
    writeAccept({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'acceptTask',
      args: [BigInt(task.chain_task_id)],
      gas: BigInt(500000),
    });
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) {
      alert('Please enter a reason for the dispute');
      return;
    }
    
    if (task?.chain_task_id === undefined) return;
    
    writeDispute({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'raiseDispute',
      args: [BigInt(task.chain_task_id), disputeReason],
      gas: BigInt(500000),
    });
  };

  const handleCompleteTask = async () => {
    if (task?.chain_task_id === undefined) return;
    
    writeComplete({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'completeTask',
      args: [BigInt(task.chain_task_id)],
      gas: BigInt(1000000),
    });
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Task not found</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Task #{task.id}</h1>
          <p className="text-muted-foreground">
            Created {new Date(task.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge className={`ml-auto ${statusColors[task.status] || 'bg-gray-100'}`}>
          {statusIcons[task.status]}
          <span className="ml-1 capitalize">{task.status}</span>
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Task Details */}
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Requester DID</span>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {formatDID(task.requester_did)}
              </code>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bot className="h-4 w-4" />
                <span>Provider DID</span>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {formatDID(task.provider_did)}
              </code>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Base Amount</span>
              </div>
              <span className="font-semibold">${task.base_amount?.toFixed(2)} USD1</span>
            </div>

            {task.final_amount && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Final Amount</span>
                </div>
                <span className="font-semibold">${task.final_amount?.toFixed(2)} USD1</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Complexity</span>
              <Badge variant="outline">Level {task.complexity}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Chain Task ID</span>
              {task.chain_task_id ? (
                <code className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">#{task.chain_task_id}</code>
              ) : (
                <Badge variant="outline" className="text-yellow-600">Not linked</Badge>
              )}
            </div>

            {task.metadata && (
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground">Metadata</span>
                <p className="mt-1 text-sm">{task.metadata}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Available actions for this task</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.status === 'created' && (
              <Button 
                onClick={handleAcceptTask}
                disabled={isAcceptPending || isAcceptConfirming}
                className="w-full"
              >
                {isAcceptPending || isAcceptConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isAcceptPending ? 'Confirm in wallet...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Accept Task
                  </>
                )}
              </Button>
            )}

            {task.status === 'accepted' && (
              <>
                <Button 
                  onClick={handleCompleteTask}
                  disabled={isCompletePending || isCompleteConfirming}
                  className="w-full"
                >
                  {isCompletePending || isCompleteConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isCompletePending ? 'Confirm in wallet...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Task
                    </>
                  )}
                </Button>
                
                {/* Raise Dispute Section */}
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Or raise a dispute:</p>
                  <input
                    type="text"
                    placeholder="Enter dispute reason..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm mb-2"
                  />
                  <Button 
                    onClick={handleRaiseDispute}
                    disabled={isDisputePending || isDisputeConfirming || !disputeReason.trim()}
                    variant="destructive"
                    className="w-full"
                  >
                    {isDisputePending || isDisputeConfirming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isDisputePending ? 'Confirm in wallet...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Raise Dispute
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {task.status === 'completed' && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Task completed successfully!</span>
              </div>
            )}

            {task.status === 'disputed' && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span>This task is under dispute</span>
              </div>
            )}

            {isAcceptSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Task accepted successfully!
              </div>
            )}

            {isCompleteSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Task completed successfully!
              </div>
            )}

            {isDisputeSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Dispute raised successfully!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <div>
                <p className="font-medium">Created</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(task.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {task.accepted_at && (
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <div>
                  <p className="font-medium">Accepted</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(task.accepted_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {task.completed_at && (
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium">Completed</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(task.completed_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
