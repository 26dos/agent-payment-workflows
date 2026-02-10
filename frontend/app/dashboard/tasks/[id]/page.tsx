'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { taskApi } from '@/lib/api';
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

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
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

  useEffect(() => {
    const loadTask = async () => {
      try {
        const data = await taskApi.getOne(Number(params.id));
        
        // If task has chain_task_id, sync status from blockchain
        if (data?.chain_task_id) {
          try {
            const receipt = await fetch('https://data-seed-prebsc-1-s1.binance.org:8545', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{
                  to: CONTRACT_ADDRESSES.Escrow,
                  data: `0x1d65e77e${data.chain_task_id.toString(16).padStart(64, '0')}`,
                }, 'latest'],
                id: 1,
              }),
            }).then(res => res.json());
            
            if (receipt?.result && receipt.result !== '0x') {
              // Parse status from response
              // Task struct: offset, requesterDID, providerDID, baseFee, finalAmount, protocolFee, complexity, status, ...
              // Each field is 32 bytes = 64 hex chars. Status is at index 7 (0-indexed)
              const result = receipt.result.slice(2); // Remove 0x
              // status is at position 7: 7 * 64 = 448 characters offset
              const statusHex = result.slice(448, 512);
              const onChainStatus = parseInt(statusHex, 16);
              console.log('Raw status hex:', statusHex, 'Parsed:', onChainStatus);
              
              // Map on-chain status to backend status
              const statusMap: Record<number, string> = {
                0: 'created',
                1: 'accepted',
                2: 'completed',
                3: 'disputed',
                4: 'resolved',
                5: 'cancelled',
              };
              
              const mappedStatus = statusMap[onChainStatus];
              console.log('On-chain status:', onChainStatus, '->', mappedStatus, 'Backend status:', data.status);
              
              // If backend status differs, sync it
              if (mappedStatus && mappedStatus !== data.status) {
                console.log('Syncing status from blockchain:', mappedStatus);
                if (mappedStatus === 'accepted') {
                  await taskApi.accept(Number(params.id));
                } else if (mappedStatus === 'completed') {
                  await taskApi.complete(Number(params.id));
                } else if (mappedStatus === 'disputed') {
                  await taskApi.dispute(Number(params.id), { raised_by_did: '', reason: 'Synced from blockchain' });
                } else if (mappedStatus === 'cancelled') {
                  await taskApi.cancel(Number(params.id));
                }
                data.status = mappedStatus;
              }
            }
          } catch (syncErr) {
            console.error('Failed to sync on-chain status:', syncErr);
          }
        }
        
        setTask(data);
      } catch (error) {
        console.error('Failed to load task:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (params.id) loadTask();
  }, [params.id]);

  useEffect(() => {
    const syncAndReload = async () => {
      if (isAcceptSuccess && task?.id) {
        // Sync accepted status to backend
        try {
          await taskApi.accept(Number(task.id));
          console.log('Synced accepted status to backend');
        } catch (err) {
          console.error('Failed to sync accept status:', err);
        }
      }
      
      if (isCompleteSuccess && task?.id) {
        // Sync completed status to backend
        try {
          await taskApi.complete(Number(task.id));
          console.log('Synced completed status to backend');
        } catch (err) {
          console.error('Failed to sync complete status:', err);
        }
      }
      
      if (isDisputeSuccess && task?.id) {
        // Sync disputed status to backend
        try {
          await taskApi.dispute(Number(task.id), { raised_by_did: '', reason: disputeReason });
          console.log('Synced dispute status to backend');
        } catch (err) {
          console.error('Failed to sync dispute status:', err);
        }
      }
      
      // Reload task data
      if (isAcceptSuccess || isCompleteSuccess || isDisputeSuccess) {
        const data = await taskApi.getOne(Number(params.id));
        setTask(data);
      }
    };
    syncAndReload();
  }, [isAcceptSuccess, isCompleteSuccess, isDisputeSuccess]);

  const handleAcceptTask = async () => {
    if (!task?.chain_task_id) {
      // Off-chain task: update via API
      try {
        await taskApi.accept(Number(params.id));
        const data = await taskApi.getOne(Number(params.id));
        setTask(data);
      } catch (error) {
        console.error('Failed to accept task:', error);
      }
      return;
    }
    
    // On-chain task
    writeAccept({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'acceptTask',
      args: [BigInt(task.chain_task_id)],
      gas: BigInt(200000),
    });
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) {
      alert('Please enter a reason for the dispute');
      return;
    }
    
    if (!task?.chain_task_id) {
      // Off-chain task: update via API
      try {
        await taskApi.dispute(Number(params.id), { raised_by_did: '', reason: disputeReason });
        const data = await taskApi.getOne(Number(params.id));
        setTask(data);
        setDisputeReason('');
      } catch (error) {
        console.error('Failed to raise dispute:', error);
      }
      return;
    }
    
    // On-chain task
    writeDispute({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'raiseDispute',
      args: [BigInt(task.chain_task_id), disputeReason],
      gas: BigInt(300000),
    });
  };

  const handleCompleteTask = async () => {
    if (!task?.chain_task_id) {
      // Off-chain task: update via API
      try {
        await taskApi.complete(Number(params.id));
        const data = await taskApi.getOne(Number(params.id));
        setTask(data);
      } catch (error) {
        console.error('Failed to complete task:', error);
      }
      return;
    }
    
    // On-chain task - needs high gas for transfers + reputation update + dynamic pricing
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
