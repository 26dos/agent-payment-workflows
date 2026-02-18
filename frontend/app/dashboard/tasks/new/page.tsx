'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { taskApiV2, pricingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUSD1 } from '@/lib/utils';
import { formatDID, useUSD1Approve, useCreateOpenTask, useUSD1Balance } from '@/lib/contracts/hooks';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  Wallet,
  Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';

export default function CreateTaskPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { agents, addTask } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'form' | 'approving' | 'creating' | 'done'>('form');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Contract hooks
  const { data: usd1Balance } = useUSD1Balance(address);
  const { 
    approve, 
    hash: approveHash, 
    isPending: isApprovePending, 
    isConfirming: isApproveConfirming, 
    isSuccess: isApproveSuccess, 
    error: approveError 
  } = useUSD1Approve();
  const { 
    createOpenTask, 
    hash: createHash, 
    isPending: isCreatePending, 
    isConfirming: isCreateConfirming, 
    isSuccess: isCreateSuccess, 
    error: createError 
  } = useCreateOpenTask();

  // Form state
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [baseFee, setBaseFee] = useState('100');
  const [complexity, setComplexity] = useState(1);
  const [priceResult, setPriceResult] = useState<{
    final_price: number;
    k_reputation: number;
    k_complexity: number;
    k_supply_demand: number;
    insurance_premium: number;
  } | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  
  // Calculate total amount needed (base + 5% premium for open tasks)
  const totalAmount = parseFloat(baseFee || '0') * 1.05;
  const hasEnoughBalance = usd1Balance ? Number(usd1Balance) / 1e6 >= totalAmount : false;

  // Auto-select first agent with DID
  useEffect(() => {
    const agentWithDID = agents.find(a => a.sub_did);
    if (agentWithDID && !selectedAgentId) {
      setSelectedAgentId(agentWithDID.id);
    }
  }, [agents, selectedAgentId]);

  // Handle approve success -> trigger create
  useEffect(() => {
    if (isApproveSuccess && step === 'approving' && selectedAgent?.sub_did) {
      setStep('creating');
      const metadata = JSON.stringify({ title, description });
      createOpenTask(
        selectedAgent.sub_did as `0x${string}`,
        parseFloat(baseFee),
        complexity,
        metadata
      );
    }
  }, [isApproveSuccess, step, selectedAgent, title, description, baseFee, complexity, createOpenTask]);

  // Handle create success -> save to backend
  useEffect(() => {
    const saveToBackend = async () => {
      if (isCreateSuccess && step === 'creating' && selectedAgent?.sub_did) {
        setTxHash(createHash || null);
        try {
          // Save task to backend
          const task = await taskApiV2.create({
            requester_did: selectedAgent.sub_did,
            title,
            description,
            base_amount: parseFloat(baseFee),
            complexity,
            chain_tx_hash: createHash,
          });
          addTask(task);
          setStep('done');
          setSuccess(true);
          setTimeout(() => {
            router.push('/dashboard/tasks');
          }, 2000);
        } catch (err: any) {
          setError(err.message || 'Failed to save task');
          setStep('form');
        }
      }
    };
    saveToBackend();
  }, [isCreateSuccess, step, selectedAgent, title, description, baseFee, complexity, createHash, addTask, router]);

  // Handle errors
  useEffect(() => {
    if (approveError) {
      setError(`Approve failed: ${approveError.message}`);
      setStep('form');
      setIsLoading(false);
    }
    if (createError) {
      setError(`Create task failed: ${createError.message}`);
      setStep('form');
      setIsLoading(false);
    }
  }, [approveError, createError]);

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

  const handleSubmit = async () => {
    if (!selectedAgent?.sub_did || !title || !baseFee || !address) return;

    setIsLoading(true);
    setError(null);
    setStep('approving');
    
    // Step 1: Approve USD1 to Escrow contract
    // Total = baseFee + 5% premium
    approve(CONTRACT_ADDRESSES.Escrow as `0x${string}`, totalAmount);
  };

  const agentsWithDID = agents.filter(a => a.sub_did);

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
          <h1 className="text-3xl font-bold">Post a Task</h1>
          <p className="text-muted-foreground">Create an open task for the marketplace</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          Task posted successfully! Redirecting...
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Form */}
        <div className="md:col-span-2 space-y-6">
          {/* Select Agent */}
          <Card>
            <CardHeader>
              <CardTitle>Select Agent</CardTitle>
              <CardDescription>Choose which agent will post this task</CardDescription>
            </CardHeader>
            <CardContent>
              {agentsWithDID.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No agents with DID available</p>
                  <Button asChild className="mt-4">
                    <Link href="/dashboard/wallet">Create Agent DID</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {agentsWithDID.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
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
              )}
            </CardContent>
          </Card>

          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
              <CardDescription>Describe what you need done</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Task Title *</label>
                <Input
                  placeholder="e.g., Analyze transaction data"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Provide details about the task requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Reward Amount (USD1) *</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={baseFee}
                  onChange={(e) => {
                    setBaseFee(e.target.value);
                    setPriceResult(null);
                  }}
                  min="1"
                  step="1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Complexity Level</label>
                <div className="mt-2 flex gap-2">
                  {[
                    { level: 1, label: 'Simple', desc: 'Quick task, 1x multiplier' },
                    { level: 2, label: 'Medium', desc: 'Moderate effort, 1.5x' },
                    { level: 3, label: 'Complex', desc: 'Significant work, 2.5x' },
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
                      <div className="text-xs text-muted-foreground">{c.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Price & Wallet Info */}
        <div className="space-y-6">
          {/* Wallet Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {usd1Balance ? formatUSD1(Number(usd1Balance) / 1e6) : '0.00'} USD1
              </div>
              {!hasEnoughBalance && baseFee && (
                <p className="text-sm text-red-500 mt-2">
                  Need {totalAmount.toFixed(2)} USD1 (incl. 5% premium)
                </p>
              )}
            </CardContent>
          </Card>

          {/* Price Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Price Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Base Reward</span>
                  <span>{formatUSD1(parseFloat(baseFee || '0'))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Insurance Premium (5%)</span>
                  <span>{formatUSD1(parseFloat(baseFee || '0') * 0.05)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Total to Lock</span>
                  <span className="text-primary">{formatUSD1(totalAmount)}</span>
                </div>
              </div>

              {/* Transaction Progress */}
              {step !== 'form' && (
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Transaction Progress</h4>
                  
                  {/* Step 1: Approve */}
                  <div className="flex items-center gap-2">
                    {step === 'approving' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    ) : step === 'creating' || step === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2" />
                    )}
                    <span className="text-sm">Approve USD1</span>
                  </div>
                  
                  {/* Step 2: Create */}
                  <div className="flex items-center gap-2">
                    {step === 'creating' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    ) : step === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2" />
                    )}
                    <span className="text-sm">Create Task On-Chain</span>
                  </div>

                  {/* TX Hash */}
                  {(approveHash || createHash) && (
                    <div className="text-xs text-muted-foreground">
                      <a 
                        href={`https://testnet.bscscan.com/tx/${createHash || approveHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <LinkIcon className="h-3 w-3" />
                        View on BSCScan
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">How it works</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Funds locked in escrow at creation</li>
                  <li>• Task visible on marketplace</li>
                  <li>• Any agent can accept it</li>
                  <li>• Auto-payment on completion</li>
                </ul>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isLoading || !selectedAgent?.sub_did || !title || !baseFee || !hasEnoughBalance || step !== 'form'}
                className="w-full"
                size="lg"
              >
                {step === 'approving' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : step === 'creating' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : step === 'done' ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Created!
                  </>
                ) : (
                  <>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Post Task (Lock {formatUSD1(totalAmount)} USD1)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
