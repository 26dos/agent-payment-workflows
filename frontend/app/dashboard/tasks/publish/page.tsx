'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, usePublicClient } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { taskApiV2, agentApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUSD1 } from '@/lib/utils';
import {
  formatDID,
  useUSD1Approve,
  useUSD1Balance,
  useCreateOpenTask,
  TASK_TYPE_NAMES,
} from '@/lib/contracts/hooks';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { ESCROW_ABI } from '@/lib/contracts/abis';
import { decodeEventLog } from 'viem';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Wallet,
  Link as LinkIcon,
  Clock,
  FileText,
  Shield,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';

const TASK_TYPES = [
  { value: 0, label: 'Data Crawling', desc: 'Web scraping, data collection' },
  { value: 1, label: 'Model Inference', desc: 'AI/ML model execution' },
  { value: 2, label: 'Data Processing', desc: 'ETL, transformation' },
  { value: 3, label: 'Content Generation', desc: 'Text, image creation' },
  { value: 4, label: 'Code Execution', desc: 'Script running' },
  { value: 5, label: 'API Integration', desc: 'External API calls' },
  { value: 6, label: 'Custom', desc: 'Other task types' },
];

export default function PublishTaskPage() {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { agents, addTask, setAgents } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  // Refresh agents on page load
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await agentApi.getAll();
        setAgents(data || []);
      } catch (err) {
        console.error('Failed to load agents:', err);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    loadAgents();
  }, [setAgents]);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'form' | 'approving' | 'creating' | 'done'>('form');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Contract hooks
  const { data: usd1Balance } = useUSD1Balance(address);
  const {
    approve,
    hash: approveHash,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
    isSuccess: isApproveSuccess,
    error: approveError,
  } = useUSD1Approve();
  const {
    createOpenTask,
    hash: createHash,
    isPending: isCreatePending,
    isConfirming: isCreateConfirming,
    isSuccess: isCreateSuccess,
    error: createError,
  } = useCreateOpenTask();

  // Basic form state
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [baseFee, setBaseFee] = useState('100');
  const [complexity, setComplexity] = useState(1);
  const [taskType, setTaskType] = useState(0);

  // Time constraints
  const [acceptanceDeadline, setAcceptanceDeadline] = useState('');
  const [completionDeadline, setCompletionDeadline] = useState('');

  // Provider criteria
  const [minReputationScore, setMinReputationScore] = useState('60');
  const [requiresKYC, setRequiresKYC] = useState(false);
  const [minKYCLevel, setMinKYCLevel] = useState(0);

  // Output format
  const [fileType, setFileType] = useState('');
  const [minBytes, setMinBytes] = useState('');
  const [maxBytes, setMaxBytes] = useState('');
  const [formatFeatures, setFormatFeatures] = useState('');

  // Content validation
  const [requiredKeywords, setRequiredKeywords] = useState('');
  const [requiredFields, setRequiredFields] = useState('');
  const [minResultCount, setMinResultCount] = useState('');
  const [languageRequirement, setLanguageRequirement] = useState('');

  // Metadata
  const [metadataIPFS, setMetadataIPFS] = useState('');

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const totalAmount = parseFloat(baseFee || '0') * 1.05;
  const hasEnoughBalance = usd1Balance ? Number(usd1Balance) / 1e6 >= totalAmount : false;

  // Auto-select first agent with DID
  useEffect(() => {
    const agentWithDID = agents.find((a) => a.sub_did);
    if (agentWithDID && !selectedAgentId) {
      setSelectedAgentId(agentWithDID.id);
    }
  }, [agents, selectedAgentId]);

  // Set default deadlines
  useEffect(() => {
    const now = new Date();
    const acceptDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const completeDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    setAcceptanceDeadline(acceptDeadline.toISOString().slice(0, 16));
    setCompletionDeadline(completeDeadline.toISOString().slice(0, 16));
  }, []);

  // Handle approve success -> trigger create
  useEffect(() => {
    if (isApproveSuccess && step === 'approving' && selectedAgent?.sub_did) {
      setStep('creating');

      const metadata = metadataIPFS || JSON.stringify({
        title,
        description,
        fileType,
        formatFeatures,
        requiredKeywords,
        requiredFields,
        languageRequirement,
        taskType,
        acceptanceDeadline,
        completionDeadline,
        minReputationScore: parseInt(minReputationScore) || 0,
      });

      createOpenTask(
        selectedAgent.sub_did as `0x${string}`,
        parseFloat(baseFee),
        complexity,
        metadata
      );
    }
  }, [isApproveSuccess, step, selectedAgent, baseFee, complexity, taskType, acceptanceDeadline, completionDeadline, minReputationScore, metadataIPFS, title, description, fileType, formatFeatures, requiredKeywords, requiredFields, languageRequirement, createOpenTask]);

  // Handle create success
  useEffect(() => {
    const saveToBackend = async () => {
      if (isCreateSuccess && step === 'creating' && selectedAgent?.sub_did && createHash && publicClient) {
        try {
          // Get transaction receipt to extract chain_task_id from event
          const receipt = await publicClient.getTransactionReceipt({ hash: createHash });
          let chainTaskId: number | undefined;

          for (const log of receipt.logs) {
            try {
              const event = decodeEventLog({
                abi: ESCROW_ABI,
                data: log.data,
                topics: log.topics,
              });
              if (event.eventName === 'TaskCreated') {
                chainTaskId = Number((event.args as any).taskId);
                break;
              }
            } catch {}
          }

          const task = await taskApiV2.create({
            requester_did: selectedAgent.sub_did,
            title,
            description,
            base_amount: parseFloat(baseFee),
            complexity,
            chain_tx_hash: createHash,
            chain_task_id: chainTaskId,
            metadata: JSON.stringify({
              task_type: taskType,
              acceptance_deadline: acceptanceDeadline,
              completion_deadline: completionDeadline,
              min_reputation_score: parseInt(minReputationScore),
              requires_kyc: requiresKYC,
            }),
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
  }, [isCreateSuccess, step, selectedAgent, title, description, baseFee, complexity, createHash, addTask, router, taskType, acceptanceDeadline, completionDeadline, minReputationScore, requiresKYC, publicClient]);

  // Handle errors
  useEffect(() => {
    if (approveError) {
      setError(`Approve failed: ${approveError.message}`);
      setStep('form');
    }
    if (createError) {
      setError(`Create task failed: ${createError.message}`);
      setStep('form');
    }
  }, [approveError, createError]);

  const handleSubmit = async () => {
    if (!selectedAgent?.sub_did || !title || !baseFee || !address) return;

    setError(null);
    setStep('approving');
    approve(CONTRACT_ADDRESSES.Escrow as `0x${string}`, totalAmount);
  };

  const agentsWithDID = agents.filter((a) => a.sub_did);

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
          <h1 className="text-3xl font-bold">Publish Task</h1>
          <p className="text-muted-foreground">Create a task with detailed specifications</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          Task published successfully! Redirecting...
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
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

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Task Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Task Title *</label>
                <Input
                  placeholder="e.g., Crawl product data from e-commerce sites"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Detailed task requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Task Type *</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {TASK_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setTaskType(type.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        taskType === type.value ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Reward (USD1) *</label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={baseFee}
                    onChange={(e) => setBaseFee(e.target.value)}
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Complexity</label>
                  <div className="mt-2 flex gap-2">
                    {[1, 2, 3].map((c) => (
                      <button
                        key={c}
                        onClick={() => setComplexity(c)}
                        className={`flex-1 rounded-lg border py-2 text-center transition-colors ${
                          complexity === c ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        {c === 1 ? 'Simple' : c === 2 ? 'Medium' : 'Complex'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Constraints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Constraints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Acceptance Deadline</label>
                  <Input
                    type="datetime-local"
                    value={acceptanceDeadline}
                    onChange={(e) => setAcceptanceDeadline(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">When can agents accept this task</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Completion Deadline</label>
                  <Input
                    type="datetime-local"
                    value={completionDeadline}
                    onChange={(e) => setCompletionDeadline(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">When must the task be completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Provider Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Provider Criteria
              </CardTitle>
              <CardDescription>Set requirements for who can accept this task</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Minimum Reputation Score</label>
                <Input
                  type="number"
                  placeholder="60"
                  value={minReputationScore}
                  onChange={(e) => setMinReputationScore(e.target.value)}
                  min="0"
                  max="100"
                />
                <p className="text-xs text-muted-foreground mt-1">Only agents with this score or higher can accept</p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={requiresKYC}
                    onChange={(e) => setRequiresKYC(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Require KYC Verification</span>
                </label>
              </div>

              {requiresKYC && (
                <div>
                  <label className="text-sm font-medium">Minimum KYC Level</label>
                  <div className="mt-2 flex gap-2">
                    {['Basic', 'Standard', 'Advanced', 'Full'].map((level, idx) => (
                      <button
                        key={level}
                        onClick={() => setMinKYCLevel(idx + 1)}
                        className={`flex-1 rounded-lg border py-2 text-center text-sm transition-colors ${
                          minKYCLevel === idx + 1 ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full"
              >
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Advanced Settings
                </CardTitle>
                {showAdvanced ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </CardHeader>
            {showAdvanced && (
              <CardContent className="space-y-6">
                {/* Output Format */}
                <div>
                  <h4 className="font-medium mb-3">Output Format</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">File Type</label>
                      <Input
                        placeholder="e.g., json, csv, pdf"
                        value={fileType}
                        onChange={(e) => setFileType(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Format Features</label>
                      <Input
                        placeholder="e.g., UTF-8, schema:product"
                        value={formatFeatures}
                        onChange={(e) => setFormatFeatures(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Min Size (bytes)</label>
                      <Input
                        type="number"
                        placeholder="1024"
                        value={minBytes}
                        onChange={(e) => setMinBytes(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Size (bytes)</label>
                      <Input
                        type="number"
                        placeholder="10485760"
                        value={maxBytes}
                        onChange={(e) => setMaxBytes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Content Validation */}
                <div>
                  <h4 className="font-medium mb-3">Content Validation</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Required Keywords</label>
                      <Input
                        placeholder="keyword1, keyword2"
                        value={requiredKeywords}
                        onChange={(e) => setRequiredKeywords(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Required Fields</label>
                      <Input
                        placeholder="field1, field2"
                        value={requiredFields}
                        onChange={(e) => setRequiredFields(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Min Result Count</label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={minResultCount}
                        onChange={(e) => setMinResultCount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Language</label>
                      <Input
                        placeholder="e.g., en, zh, ja"
                        value={languageRequirement}
                        onChange={(e) => setLanguageRequirement(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* IPFS Metadata */}
                <div>
                  <label className="text-sm font-medium">IPFS Metadata CID (Optional)</label>
                  <Input
                    placeholder="QmXxx... or ipfs://..."
                    value={metadataIPFS}
                    onChange={(e) => setMetadataIPFS(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Store detailed task specification off-chain for gas efficiency
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Sidebar */}
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

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Task Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Type</span>
                  <Badge>{TASK_TYPE_NAMES[taskType]}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Base Reward</span>
                  <span>{formatUSD1(parseFloat(baseFee || '0'))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Premium (5%)</span>
                  <span>{formatUSD1(parseFloat(baseFee || '0') * 0.05)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Total to Lock</span>
                  <span className="text-primary">{formatUSD1(totalAmount)}</span>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Min Reputation</span>
                  <span>{minReputationScore || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span>KYC Required</span>
                  <span>{requiresKYC ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {/* Transaction Progress */}
              {step !== 'form' && (
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Transaction Progress</h4>
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
                  <div className="flex items-center gap-2">
                    {step === 'creating' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    ) : step === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2" />
                    )}
                    <span className="text-sm">Create Task with Spec</span>
                  </div>
                  {(approveHash || createHash) && (
                    <div className="text-xs text-muted-foreground">
                      <a
                        href={`https://bscscan.com/tx/${createHash || approveHash}`}
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

              <Button
                onClick={handleSubmit}
                disabled={!selectedAgent?.sub_did || !title || !baseFee || !hasEnoughBalance || step !== 'form'}
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
                    Published!
                  </>
                ) : (
                  <>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Publish Task
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
