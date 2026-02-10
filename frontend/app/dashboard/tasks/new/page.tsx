'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useAppStore } from '@/lib/store';
import { taskApi, pricingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUSD1 } from '@/lib/utils';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { USD1_ABI, DID_REGISTRY_ABI, ESCROW_ABI, DYNAMIC_PRICING_ABI } from '@/lib/contracts/abis';
import { formatDID } from '@/lib/contracts/hooks';
import { 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Link2,
  Zap
} from 'lucide-react';
import Link from 'next/link';

export default function CreateTaskPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { agents, addTask } = useAppStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useOnChain, setUseOnChain] = useState(true);

  // Form state
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedRequesterDID, setSelectedRequesterDID] = useState<`0x${string}` | null>(null);
  const [providerDID, setProviderDID] = useState('');
  const [baseFee, setBaseFee] = useState('100');
  const [complexity, setComplexity] = useState(1);
  const [metadata, setMetadata] = useState('');
  const [priceResult, setPriceResult] = useState<{
    final_price: number;
    k_reputation: number;
    k_complexity: number;
    k_supply_demand: number;
    insurance_premium: number;
  } | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // Read Human DID from contract
  const { data: onChainHumanDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'addressToHumanDID',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const hasHumanDID = onChainHumanDID && 
    onChainHumanDID !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  // Get Agent DIDs from contract
  const { data: onChainAgentDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DIDRegistry as `0x${string}`,
    abi: DID_REGISTRY_ABI,
    functionName: 'getAgentsByHuman',
    args: hasHumanDID ? [onChainHumanDID as `0x${string}`] : undefined,
    query: { enabled: hasHumanDID },
  });

  // Check USD1 Allowance for Escrow
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
    abi: USD1_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.Escrow as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  // Calculate on-chain price
  const { data: onChainPrice } = useReadContract({
    address: CONTRACT_ADDRESSES.DynamicPricing as `0x${string}`,
    abi: DYNAMIC_PRICING_ABI,
    functionName: 'calculateFinalPrice',
    args: baseFee ? [
      parseUnits(baseFee, 6),
      BigInt(75), // Default reputation
      BigInt(complexity),
    ] : undefined,
    query: { enabled: !!baseFee && parseFloat(baseFee) > 0 },
  });

  // Approve USD1
  const { 
    writeContract: writeApprove, 
    data: approveHash, 
    isPending: isApprovePending,
  } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  // Create on-chain task
  const { 
    writeContract: writeCreateTask, 
    data: createTaskHash, 
    isPending: isCreateTaskPending,
    error: createTaskError,
  } = useWriteContract();
  const { isLoading: isCreateTaskConfirming, isSuccess: isCreateTaskSuccess } = useWaitForTransactionReceipt({ hash: createTaskHash });

  // Refetch allowance after approval
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess]);

  // Sync to backend and navigate after successful on-chain task creation
  useEffect(() => {
    const syncTask = async () => {
      if (isCreateTaskSuccess && createTaskHash && selectedRequesterDID && providerDID && baseFee) {
        try {
          // Wait a bit for transaction to be indexed
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get chain_task_id from transaction receipt logs
          const receipt = await fetch(`https://data-seed-prebsc-1-s1.binance.org:8545`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionReceipt',
              params: [createTaskHash],
              id: 1,
            }),
          }).then(res => res.json());
          
          let chainTaskId = null;
          // TaskCreated event signature: keccak256("TaskCreated(uint256,bytes32,bytes32,uint256,uint256,uint8)")
          const taskCreatedTopic = '0x'; // We'll find by matching escrow contract address
          const escrowAddress = CONTRACT_ADDRESSES.Escrow.toLowerCase();
          
          if (receipt?.result?.logs) {
            // Find the TaskCreated log from escrow contract
            for (const log of receipt.result.logs) {
              if (log.address?.toLowerCase() === escrowAddress && log.topics?.length >= 4) {
                // topics[1] is the indexed taskId
                chainTaskId = parseInt(log.topics[1], 16);
                console.log('Found chain task ID:', chainTaskId);
                break;
              }
            }
          }

          // Create a record in backend database for the on-chain task
          const task = await taskApi.create({
            requester_did: selectedRequesterDID,
            provider_did: providerDID,
            base_amount: parseFloat(baseFee),
            complexity,
            metadata: `On-chain task (tx: ${createTaskHash?.slice(0, 10)}...)`,
          });

          // Update with chain task ID if available
          if (chainTaskId !== null && task?.id) {
            try {
              const token = localStorage.getItem('clawpay-storage');
              const parsedToken = token ? JSON.parse(token)?.state?.token : '';
              
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/tasks/${task.id}/chain`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${parsedToken}`,
                },
                body: JSON.stringify({ 
                  chain_task_id: chainTaskId,
                  tx_hash: createTaskHash,
                }),
              });
              
              if (!response.ok) {
                console.error('Failed to update chain task ID:', await response.text());
              } else {
                console.log('Successfully updated chain task ID:', chainTaskId);
              }
            } catch (err) {
              console.error('Failed to update chain task ID:', err);
            }
          } else {
            console.warn('Could not find chain task ID in receipt logs');
          }
        } catch (err) {
          console.error('Failed to sync task to backend:', err);
        }
        router.push('/dashboard/tasks');
      }
    };
    syncTask();
  }, [isCreateTaskSuccess, createTaskHash]);

  const handleCalculatePrice = async () => {
    if (!baseFee) return;

    setIsCalculating(true);
    try {
      const result = await pricingApi.calculate({
        base_fee: parseFloat(baseFee),
        complexity,
        reputation_score: 75,
      });
      setPriceResult(result);
    } catch (error) {
      console.error('Price calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApprove = () => {
    const amount = priceResult ? priceResult.final_price + priceResult.insurance_premium : parseFloat(baseFee) * 2;
    writeApprove({
      address: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
      abi: USD1_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.Escrow as `0x${string}`, parseUnits(amount.toString(), 6)],
      gas: BigInt(100000),
    });
  };

  const handleOnChainSubmit = () => {
    if (!selectedRequesterDID || !providerDID || !baseFee) return;

    setError(null);
    writeCreateTask({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'createTask',
      args: [
        selectedRequesterDID,
        providerDID as `0x${string}`,
        parseUnits(baseFee, 6),
        complexity, // uint8
        `Task created at ${new Date().toISOString()}`, // metadata string
      ],
      gas: BigInt(500000), // Explicit gas limit for complex escrow operation
    });
  };

  const handleOffChainSubmit = async () => {
    const requesterDID = selectedRequesterDID || selectedAgent?.sub_did;
    if (!requesterDID || !providerDID || !baseFee) return;

    setIsLoading(true);
    setError(null);
    try {
      const task = await taskApi.create({
        requester_did: requesterDID,
        provider_did: providerDID,
        base_amount: parseFloat(baseFee),
        complexity,
        metadata,
      });
      addTask(task);
      router.push(`/dashboard/tasks/${task.id}`);
    } catch (err: any) {
      setError(err.message || 'Task creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const needsApproval = () => {
    if (!allowance || !baseFee) return true;
    const required = priceResult 
      ? (priceResult.final_price + priceResult.insurance_premium) * 1e6
      : parseFloat(baseFee) * 2 * 1e6;
    return (allowance as bigint) < BigInt(Math.ceil(required));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Task</h1>
          <p className="text-muted-foreground">Create a new escrow task</p>
        </div>
      </div>

      {/* Error Alert */}
      {(error || createTaskError) && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error || createTaskError?.message?.slice(0, 100)}
        </div>
      )}

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Task Mode</CardTitle>
          <CardDescription>Choose how to create the task</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setUseOnChain(true)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                useOnChain ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <Link2 className="h-5 w-5" />
                On-Chain Task
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Create task on blockchain with escrow. Requires USD1 approval.
              </p>
            </button>
            <button
              onClick={() => setUseOnChain(false)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                !useOnChain ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <Zap className="h-5 w-5" />
                Off-Chain Task
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Create task in database only. Faster but no escrow protection.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </div>
            <span className={s <= step ? 'font-medium' : 'text-muted-foreground'}>
              {s === 1 ? 'Select Agent DID' : s === 2 ? 'Task Details' : 'Review & Create'}
            </span>
            {s < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Agent DID */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Requester Agent DID</CardTitle>
            <CardDescription>
              {useOnChain 
                ? 'Choose an on-chain Agent DID to act as the requester'
                : 'Select an agent from your registered agents'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {useOnChain ? (
              // On-chain DID selection
              onChainAgentDIDs && (onChainAgentDIDs as `0x${string}`[]).length > 0 ? (
                <div className="space-y-2">
                  {(onChainAgentDIDs as `0x${string}`[]).map((did, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedRequesterDID(did)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        selectedRequesterDID === did ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{formatDID(did)}</span>
                        {selectedRequesterDID === did && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground break-all">{did}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No on-chain Agent DIDs found</p>
                  <Button asChild className="mt-4">
                    <Link href="/dashboard/wallet">Create Agent DID in Wallet</Link>
                  </Button>
                </div>
              )
            ) : (
              // Off-chain agent selection
              agents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No agents available</p>
                  <Button asChild className="mt-4">
                    <Link href="/dashboard/agents">Create an Agent</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {agents.filter(a => a.sub_did).map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setSelectedRequesterDID(agent.sub_did as `0x${string}`);
                      }}
                      className={`rounded-lg border p-4 text-left transition-colors hover:border-primary ${
                        selectedAgentId === agent.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{agent.name}</span>
                        <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground font-mono">
                        {formatDID(agent.sub_did as `0x${string}`)}
                      </p>
                    </button>
                  ))}
                </div>
              )
            )}

            <div className="flex justify-end">
              <Button 
                onClick={() => setStep(2)} 
                disabled={useOnChain ? !selectedRequesterDID : !selectedAgentId}
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Task Details */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
            <CardDescription>Configure the task parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Provider Agent DID</label>
              <Input
                placeholder="0x..."
                value={providerDID}
                onChange={(e) => setProviderDID(e.target.value)}
                className="font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The DID of the agent that will provide the service
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Base Fee (USD1)</label>
              <Input
                type="number"
                placeholder="100"
                value={baseFee}
                onChange={(e) => {
                  setBaseFee(e.target.value);
                  setPriceResult(null);
                }}
                min="0"
                step="1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Complexity Level</label>
              <div className="mt-2 flex gap-2">
                {[
                  { level: 1, label: 'L1 - Simple', desc: '1.0x' },
                  { level: 2, label: 'L2 - Medium', desc: '1.5x' },
                  { level: 3, label: 'L3 - Complex', desc: '2.5x' },
                ].map((c) => (
                  <button
                    key={c.level}
                    onClick={() => {
                      setComplexity(c.level);
                      setPriceResult(null);
                    }}
                    className={`flex-1 rounded-lg border p-3 text-center transition-colors ${
                      complexity === c.level ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="font-medium">{c.label}</div>
                    <div className="text-sm text-muted-foreground">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {!useOnChain && (
              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input
                  placeholder="Task description..."
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                />
              </div>
            )}

            {/* Price Preview */}
            <Button
              variant="outline"
              onClick={handleCalculatePrice}
              disabled={!baseFee || isCalculating}
              className="w-full"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                'Calculate Price'
              )}
            </Button>

            {priceResult && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Base Fee</span>
                  <span>{formatUSD1(parseFloat(baseFee))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>K_Reputation × K_Complexity × K_Supply</span>
                  <span>
                    {priceResult.k_reputation}x × {priceResult.k_complexity}x × {priceResult.k_supply_demand}x
                  </span>
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Final Price</span>
                  <span className="text-primary">{formatUSD1(priceResult.final_price)}</span>
                </div>
                {priceResult.insurance_premium > 0 && (
                  <div className="flex justify-between text-sm text-yellow-600">
                    <span>+ Insurance Premium</span>
                    <span>{formatUSD1(priceResult.insurance_premium)}</span>
                  </div>
                )}
              </div>
            )}

            {/* On-chain price preview */}
            {useOnChain && onChainPrice && (
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-blue-700">
                  On-chain calculated price: {formatUnits(onChainPrice as bigint, 6)} USD1
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!providerDID || !baseFee}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Task</CardTitle>
            <CardDescription>
              Confirm the task details before creating
              {useOnChain && ' (This will create a blockchain transaction)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <Badge variant={useOnChain ? 'default' : 'secondary'}>
                  {useOnChain ? 'On-Chain' : 'Off-Chain'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requester DID</span>
                <span className="font-mono text-sm">{formatDID(selectedRequesterDID as `0x${string}`)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider DID</span>
                <span className="font-mono text-sm">{formatDID(providerDID as `0x${string}`)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Fee</span>
                <span>{formatUSD1(parseFloat(baseFee))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Complexity</span>
                <span>L{complexity}</span>
              </div>
              {priceResult && (
                <div className="border-t pt-3 flex justify-between font-medium">
                  <span>Total to Lock</span>
                  <span className="text-primary">
                    {formatUSD1(priceResult.final_price + priceResult.insurance_premium)}
                  </span>
                </div>
              )}
            </div>

            {/* Allowance Check for On-Chain */}
            {useOnChain && (
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">USD1 Allowance</span>
                  <span className="text-sm">
                    {allowance ? Number(formatUnits(allowance as bigint, 6)).toLocaleString() : '0'} USD1
                  </span>
                </div>
                {needsApproval() && (
                  <Button 
                    onClick={handleApprove} 
                    disabled={isApprovePending || isApproveConfirming}
                    className="w-full"
                    variant="outline"
                  >
                    {isApprovePending || isApproveConfirming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isApprovePending ? 'Confirm in wallet...' : 'Approving...'}
                      </>
                    ) : (
                      'Approve USD1 for Escrow'
                    )}
                  </Button>
                )}
                {isApproveSuccess && (
                  <div className="flex items-center gap-2 text-green-600 text-sm mt-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Approval successful!
                  </div>
                )}
              </div>
            )}

            {/* Success Message */}
            {isCreateTaskSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Task created successfully! Redirecting...
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              {useOnChain ? (
                <Button 
                  onClick={handleOnChainSubmit} 
                  disabled={isCreateTaskPending || isCreateTaskConfirming || needsApproval()}
                >
                  {isCreateTaskPending || isCreateTaskConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isCreateTaskPending ? 'Confirm in wallet...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Create On-Chain Task
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleOffChainSubmit} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Task'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
