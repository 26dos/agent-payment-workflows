'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useConnect, useSignMessage, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import Link from 'next/link';
import { publicApi, taskApiV2, agentApi, authApi } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { formatDID } from '@/lib/contracts/hooks';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { ESCROW_ABI } from '@/lib/contracts/abis';
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
  Wallet,
  Zap
} from 'lucide-react';

const statusColors: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  accepted: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
};

export default function PublicTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, token, setAuth } = useAppStore();
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptStep, setAcceptStep] = useState<'idle' | 'chain' | 'backend'>('idle');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [myAgents, setMyAgents] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  const { writeContract, data: acceptHash, isPending: isAcceptPending, error: acceptError } = useWriteContract();
  const { isLoading: isAcceptConfirming, isSuccess: isAcceptSuccess } = useWaitForTransactionReceipt({ hash: acceptHash });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadTask = async () => {
      try {
        const data = await publicApi.getTask(Number(params.id));
        setTask(data);
      } catch (error) {
        console.error('Failed to load task:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (params.id) loadTask();
  }, [params.id]);

  // Load user's agents when authenticated
  useEffect(() => {
    const loadAgents = async () => {
      if (isAuthenticated && token) {
        try {
          const data = await agentApi.getAll();
          setMyAgents(data.filter((a: any) => a.sub_did));
          if (data.length > 0 && data[0].sub_did) {
            setSelectedAgentId(data[0].id);
          }
        } catch (err) {
          console.error('Failed to load agents:', err);
        }
      }
    };
    loadAgents();
  }, [isAuthenticated, token]);

  const handleConnect = async (connector: any) => {
    setIsConnecting(true);
    setError(null);
    try {
      await connect({ connector });
    } catch (err: any) {
      console.error('Connect error:', err);
      setError(err.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignIn = async () => {
    if (!address) return;
    setIsSigningIn(true);
    setError(null);
    try {
      const { message } = await authApi.getNonce(address);
      const signature = await signMessageAsync({ message });
      const { token, user } = await authApi.login({
        wallet_address: address,
        message,
        signature,
      });
      setAuth(token, user);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAcceptTask = async () => {
    const agent = myAgents.find(a => a.id === selectedAgentId);
    if (!agent?.sub_did) {
      setError('Please select an agent with a registered DID');
      return;
    }

    if (!task?.chain_task_id && task?.chain_task_id !== 0) {
      setError('Task has no chain ID');
      return;
    }

    setIsAccepting(true);
    setAcceptStep('chain');
    setError(null);

    writeContract({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'acceptOpenTask',
      args: [BigInt(task.chain_task_id), agent.sub_did as `0x${string}`],
      gas: BigInt(500000),
    });
  };

  // Handle chain transaction success -> update backend
  useEffect(() => {
    const updateBackend = async () => {
      if (isAcceptSuccess && acceptStep === 'chain') {
        setAcceptStep('backend');
        const agent = myAgents.find(a => a.id === selectedAgentId);
        if (!agent?.sub_did) return;

        try {
          await taskApiV2.accept(Number(params.id), agent.sub_did, acceptHash);
          setSuccess(true);
          const data = await publicApi.getTask(Number(params.id));
          setTask(data);
        } catch (err: any) {
          setError(err.message || 'Failed to update backend');
        } finally {
          setIsAccepting(false);
          setAcceptStep('idle');
        }
      }
    };
    updateBackend();
  }, [isAcceptSuccess, acceptStep, myAgents, selectedAgentId, params.id, acceptHash]);

  // Handle chain transaction error
  useEffect(() => {
    if (acceptError) {
      setError(acceptError.message || 'Chain transaction failed');
      setIsAccepting(false);
      setAcceptStep('idle');
    }
  }, [acceptError]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Link href="/tasks" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Tasks
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Task not found</h2>
        </main>
      </div>
    );
  }

  const isOpenTask = task.status === 'created' && !task.provider_did;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/tasks" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Tasks
            </Link>
            <Link href="/" className="flex items-center space-x-2">
              <Zap className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">ClawPay</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Task Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {task.title || `Task #${task.id}`}
              </h1>
              <p className="text-gray-500 mt-1">
                Posted {formatDate(task.created_at)}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[task.status] || 'bg-gray-100'}`}>
              {task.status}
            </span>
          </div>

          {task.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-gray-700">{task.description}</p>
            </div>
          )}

          {/* Task Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4">
            <div>
              <p className="text-sm text-gray-500">Reward</p>
              <p className="text-xl font-bold text-green-600">${task.final_amount?.toFixed(2)}</p>
              <p className="text-xs text-gray-400">USD1</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Complexity</p>
              <p className="text-lg font-semibold">
                {task.complexity === 1 ? 'Simple' : task.complexity === 2 ? 'Medium' : 'Complex'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Requester</p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {formatDID(task.requester_did)}
              </code>
            </div>
            <div>
              <p className="text-sm text-gray-500">Provider</p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {formatDID(task.provider_did)}
              </code>
            </div>
          </div>
        </div>

        {/* Accept Task Section */}
        {isOpenTask && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Accept This Task</h2>

            {!isConnected ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Connect your wallet to accept this task</p>
                <div className="space-y-2 max-w-xs mx-auto">
                  {mounted && connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => handleConnect(connector)}
                      disabled={isConnecting}
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4 mr-2" />
                      )}
                      {connector.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : !isAuthenticated ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Wallet connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                <p className="text-gray-500 text-sm mb-4">Sign a message to verify your wallet</p>
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </button>
              </div>
            ) : myAgents.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">You need an Agent with a registered DID to accept tasks</p>
                <Link 
                  href="/dashboard/wallet"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Agent DID
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Select Agent to Accept Task
                  </label>
                  <div className="grid gap-2">
                    {myAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          selectedAgentId === agent.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Bot className="h-5 w-5 text-gray-400" />
                          <div className="text-left">
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-xs text-gray-500 font-mono">
                              {formatDID(agent.sub_did)}
                            </p>
                          </div>
                        </div>
                        {selectedAgentId === agent.id && (
                          <CheckCircle2 className="h-5 w-5 text-blue-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 text-green-600 rounded-lg">
                    <CheckCircle2 className="h-4 w-4" />
                    Task accepted successfully! You can now work on it.
                  </div>
                )}

                <button
                  onClick={handleAcceptTask}
                  disabled={isAccepting || !selectedAgentId || success}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Accepted
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-5 w-5 mr-2" />
                      Accept Task
                    </>
                  )}
                </button>

                {success && (
                  <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className="block text-center text-blue-600 hover:text-blue-700"
                  >
                    Go to Dashboard to manage this task →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Already Accepted */}
        {task.status !== 'created' && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">This task has already been {task.status}</p>
          </div>
        )}
      </main>
    </div>
  );
}
