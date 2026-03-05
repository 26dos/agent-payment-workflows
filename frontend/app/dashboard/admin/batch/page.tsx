'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { batchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUSD1 } from '@/lib/utils';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { 
  useRecordTasksBatch, 
  useMaxBatchSize, 
  useArbitrationWallet,
  RecordTaskInput
} from '@/lib/contracts/hooks';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Link2,
  RefreshCw,
  Settings,
  Play,
  Clock,
  Hash,
  Wallet,
  FileText
} from 'lucide-react';
import Link from 'next/link';

interface Task {
  id: number;
  title: string;
  requester_did: string;
  provider_did: string | null;
  base_amount: number;
  final_amount: number;
  complexity: number;
  description: string;
  status: string;
  created_at: string;
}

interface BatchConfig {
  id: number;
  task_count: number;
  interval_minutes: number;
  auto_enabled: boolean;
  last_batch_at: string | null;
  updated_at: string;
}

export default function BatchChainPage() {
  const { address, isConnected } = useAccount();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [config, setConfig] = useState<BatchConfig | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

  // Config form state
  const [taskCount, setTaskCount] = useState(10);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [autoEnabled, setAutoEnabled] = useState(false);

  // Contract hooks - use recordTasksBatch (no funds involved, just recording)
  const { data: maxBatchSize } = useMaxBatchSize();
  const { data: arbitrationWallet } = useArbitrationWallet();
  const { 
    recordTasksBatch, 
    hash: batchHash, 
    isPending: isBatching, 
    isConfirming: isBatchConfirming,
    isSuccess: isBatchSuccess,
    error: batchError 
  } = useRecordTasksBatch();

  // Check if connected wallet is authorized (arbitration wallet or contract owner)
  const isAuthorized = address && (
    arbitrationWallet === address || 
    address.toLowerCase() === '0xd68cc5807d9573a17b731dd7a056fe9da3cfbca9' // Default owner
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (config) {
      setTaskCount(config.task_count);
      setIntervalMinutes(config.interval_minutes);
      setAutoEnabled(config.auto_enabled);
    }
  }, [config]);

  // Handle batch success
  useEffect(() => {
    if (isBatchSuccess && batchHash) {
      setSuccess(`Tasks recorded on blockchain! TX: ${batchHash?.slice(0, 16)}...`);
      setTriggering(false);
      // Update backend to mark tasks as recorded on-chain with tx hash
      markTasksAsOnChain(batchHash);
      setSelectedTasks([]);
      loadData();
    }
  }, [isBatchSuccess, batchHash]);

  // Handle errors
  useEffect(() => {
    if (batchError) {
      setError(`Record failed: ${batchError.message}`);
      setTriggering(false);
    }
  }, [batchError]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await batchApi.getPending();
      setTasks(data.tasks || []);
      setPendingCount(data.count || 0);
      setConfig(data.config);
    } catch (err: any) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const markTasksAsOnChain = async (txHash: string) => {
    try {
      const taskIds = selectedTasks.length > 0 ? selectedTasks : tasks.map(t => t.id);
      await batchApi.markOnChain(taskIds, txHash);
    } catch (err) {
      console.error('Failed to mark tasks as on-chain:', err);
    }
  };

  const getSelectedTasksData = (): Task[] => {
    if (selectedTasks.length > 0) {
      return tasks.filter(t => selectedTasks.includes(t.id));
    }
    return tasks;
  };

  const calculateTotalAmount = (): number => {
    return getSelectedTasksData().reduce((sum, t) => sum + (t.final_amount || t.base_amount || 0), 0);
  };

  const submitBatchToChain = () => {
    const tasksToSubmit = getSelectedTasksData();
    
    // Convert tasks to RecordTaskInput format (no fund transfer, just recording)
    const recordInputs: RecordTaskInput[] = tasksToSubmit.map(task => ({
      requesterDID: task.requester_did as `0x${string}`,
      providerDID: (task.provider_did || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
      amount: task.final_amount || task.base_amount || 0,
      offchainId: task.id.toString(),
      metadata: JSON.stringify({
        title: task.title,
        description: task.description,
        status: task.status,
        created_at: task.created_at
      })
    }));

    recordTasksBatch(recordInputs);
  };

  const handleTriggerBatch = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!isAuthorized) {
      setError('Only the arbitration wallet or contract owner can record tasks on-chain');
      return;
    }

    const tasksToSubmit = getSelectedTasksData();
    const limit = maxBatchSize ? Number(maxBatchSize) : 10;
    
    if (tasksToSubmit.length > limit) {
      setError(`Cannot record more than ${limit} tasks at once. Please select fewer tasks.`);
      return;
    }

    if (tasksToSubmit.length === 0) {
      setError('No tasks to record');
      return;
    }

    setError(null);
    setTriggering(true);

    // Directly submit to chain - no approval needed since no funds are transferred
    submitBatchToChain();
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      await batchApi.updateConfig({
        task_count: taskCount,
        interval_minutes: intervalMinutes,
        auto_enabled: autoEnabled,
      });
      setSuccess('Configuration saved!');
      await loadData();
    } catch (err: any) {
      setError('Failed to save config: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasks.map(t => t.id));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Record On-Chain</h1>
            <p className="text-muted-foreground">Record completed tasks to blockchain for traceability</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">×</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">×</button>
        </div>
      )}

      {/* Wallet Status */}
      {!isConnected && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-4 text-yellow-700 border border-yellow-200">
          <Wallet className="h-5 w-5" />
          <span>Please connect your wallet to record tasks on-chain</span>
        </div>
      )}

      {isConnected && !isAuthorized && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 p-4 text-orange-700 border border-orange-200">
          <AlertCircle className="h-5 w-5" />
          <span>Only the arbitration wallet or contract owner can record tasks. Current wallet: {address?.slice(0, 10)}...</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Hash className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-gray-500 text-sm">Pending Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedTasks.length}</p>
                <p className="text-gray-500 text-sm">Selected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Settings className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{maxBatchSize ? Number(maxBatchSize) : 10}</p>
                <p className="text-gray-500 text-sm">Max Batch (Contract)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{formatDate(config?.last_batch_at || null)}</p>
                <p className="text-gray-500 text-sm">Last Batch</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-mono">
                  {arbitrationWallet ? `${String(arbitrationWallet).slice(0, 10)}...` : 'Not Set'}
                </p>
                <p className="text-gray-500 text-sm">Arbitration Wallet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Task List */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Tasks</CardTitle>
                  <CardDescription>Tasks waiting to be batched on-chain</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedTasks.length === tasks.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button 
                    onClick={handleTriggerBatch} 
                    disabled={triggering || tasks.length === 0 || !isConnected || !isAuthorized || isBatching}
                    size="sm"
                  >
                    {isBatching || isBatchConfirming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Recording to Chain...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Record On-Chain {selectedTasks.length > 0 ? `(${selectedTasks.length})` : '(All)'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending tasks</p>
                  <p className="text-sm">All tasks have been batched or are already on-chain</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div 
                      key={task.id}
                      onClick={() => toggleTaskSelection(task.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTasks.includes(task.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <div>
                          <p className="font-medium">{task.title || `Task #${task.id}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.requester_did?.slice(0, 12)}... • {formatDate(task.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">{formatUSD1(task.final_amount)}</p>
                        <Badge variant={task.status === 'completed' ? 'success' : 'secondary'}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Configuration */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Batch Configuration</CardTitle>
              <CardDescription>Auto-batch settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Task Count Trigger</label>
                <Input
                  type="number"
                  value={taskCount}
                  onChange={(e) => setTaskCount(Number(e.target.value))}
                  min="1"
                  max="100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-batch when this many tasks are pending
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Interval (minutes)</label>
                <Input
                  type="number"
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  min="1"
                  max="1440"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-batch after this interval
                </p>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Auto-batch Enabled</label>
                <button
                  onClick={() => setAutoEnabled(!autoEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoEnabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <Button 
                onClick={handleSaveConfig} 
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>

              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">How Record On-Chain Works</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Completed tasks are recorded on-chain</li>
                  <li>• No fund transfer (already settled)</li>
                  <li>• For traceability and auditing</li>
                  <li>• Only arbitration wallet can record</li>
                  <li>• Max {maxBatchSize ? Number(maxBatchSize) : 10} tasks per batch</li>
                </ul>
              </div>

              {/* Transaction Info */}
              {batchHash && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">Recent Transaction</h4>
                  <div className="text-xs">
                    <a 
                      href={`https://bscscan.com/tx/${batchHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      {batchHash.slice(0, 20)}...
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
