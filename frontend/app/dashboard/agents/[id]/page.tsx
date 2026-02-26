'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Bot, Save, Loader2, CheckCircle2, Link2, Plus, Info, ExternalLink, Shield } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { agentApi } from '@/lib/api';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DUAL_DID_REGISTRY_ABI } from '@/lib/contracts/abis';
import { formatDID } from '@/lib/contracts/hooks';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

interface Agent {
  id: number;
  name: string;
  sub_did: string | null;
  agent_score: number;
  daily_limit: number | null;
  single_limit: number | null;
  mandate_expiry: string | null;
  status: string;
  created_at: string;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
  const { token } = useAppStore();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [dailyLimit, setDailyLimit] = useState('');
  const [singleLimit, setSingleLimit] = useState('');
  const [mandateExpiry, setMandateExpiry] = useState('');
  const [subDid, setSubDid] = useState('');

  const agentId = params.id as string;

  // Read On-Chain DID from DualDIDRegistry contract
  const { data: onChainHumanDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'walletToOnChainDID',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Check if user has On-Chain DID
  const hasHumanDID = onChainHumanDID && onChainHumanDID !== ZERO_BYTES32;

  // Create Sub-DID on-chain (DualDIDRegistry)
  const {
    writeContract: writeCreateSubDID,
    data: createSubDIDTxHash,
    isPending: isCreatingSubDID,
    error: createSubDIDError,
  } = useWriteContract();
  
  const { 
    isLoading: isConfirmingSubDID, 
    isSuccess: isSubDIDCreated 
  } = useWaitForTransactionReceipt({ hash: createSubDIDTxHash });

  // Get Sub-DIDs from DualDIDRegistry
  const { data: subDIDs, refetch: refetchSubDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'getSubDIDsByOnChainDID',
    args: hasHumanDID ? [onChainHumanDID as `0x${string}`] : undefined,
    query: { enabled: hasHumanDID },
  });

  // Handle Sub-DID creation
  const handleCreateSubDID = () => {
    if (!hasHumanDID || !agent) return;
    
    const agentName = agent.name || `Agent-${agentId}`;
    writeCreateSubDID({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'registerSubDID',
      args: [agentName],
      gas: BigInt(500000),
    });
  };

  // Auto-bind newly created Sub-DID to this agent
  useEffect(() => {
    if (isSubDIDCreated && createSubDIDTxHash) {
      const bindSubDID = async () => {
        // Wait for blockchain to index, then refetch
        await new Promise(resolve => setTimeout(resolve, 5000));
        const result = await refetchSubDIDs();
        const updatedSubDIDs = result.data as `0x${string}`[] | undefined;
        if (updatedSubDIDs && updatedSubDIDs.length > 0) {
          const latestSubDID = updatedSubDIDs[updatedSubDIDs.length - 1];
          try {
            await agentApi.update(Number(agentId), { sub_did: latestSubDID });
            setSuccess('Sub-DID created and bound successfully!');
            fetchAgent();
          } catch (err) {
            console.error('Failed to bind Sub-DID:', err);
            setError('Sub-DID created but failed to bind to agent. Please refresh and try manual binding.');
          }
        } else {
          setError('Sub-DID created on chain but could not fetch. Please refresh the page.');
        }
      };
      bindSubDID();
    }
  }, [isSubDIDCreated, createSubDIDTxHash]);


  useEffect(() => {
    if (agentId && token) {
      fetchAgent();
    }
  }, [agentId, token]);

  const fetchAgent = async () => {
    try {
      setIsLoading(true);
      const data = await agentApi.getOne(parseInt(agentId));
      setAgent(data);
      // Populate form
      setDailyLimit(data.daily_limit?.toString() || '');
      setSingleLimit(data.single_limit?.toString() || '');
      setSubDid(data.sub_did || '');
      if (data.mandate_expiry) {
        // Format date for input
        const date = new Date(data.mandate_expiry);
        setMandateExpiry(date.toISOString().slice(0, 16));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load agent');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMandate = async () => {
    if (!dailyLimit || !singleLimit || !mandateExpiry) {
      setError('Please fill in all mandate fields');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await agentApi.updateMandate(parseInt(agentId), {
        daily_limit: parseFloat(dailyLimit),
        single_limit: parseFloat(singleLimit),
        expiry: new Date(mandateExpiry).toISOString(),
      });
      setSuccess('Mandate updated successfully');
      fetchAgent();
    } catch (err: any) {
      setError(err.message || 'Failed to update mandate');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDID = async () => {
    if (!subDid) {
      setError('Please select or enter a Sub-DID');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await agentApi.updateDID(parseInt(agentId), subDid);
      setSuccess('Sub-DID updated successfully');
      fetchAgent();
    } catch (err: any) {
      setError(err.message || 'Failed to update Sub-DID');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectDID = (did: `0x${string}`) => {
    setSubDid(did);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Agent not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/agents')}>
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/agents')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Configure Agent</h1>
          <p className="text-muted-foreground">Manage agent settings and mandates</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-500/10 p-4 text-green-600 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Agent Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>{agent.name}</CardTitle>
              <CardDescription>Created {new Date(agent.created_at).toLocaleDateString()}</CardDescription>
            </div>
            <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
              {agent.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Agent ID:</span>
              <span className="ml-2 font-medium">{agent.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Agent Score:</span>
              <span className="ml-2 font-medium">{agent.agent_score}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-DID Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Agent Sub-DID (On-Chain)
          </CardTitle>
          <CardDescription>
            Create an on-chain Agent DID and bind it to this agent. This requires a wallet transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Sub-DID Display */}
          {agent.sub_did ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">Sub-DID Bound</span>
              </div>
              <p className="font-mono text-lg font-bold text-green-800 break-all">
                {formatDID(agent.sub_did as `0x${string}`)}
              </p>
              <p className="text-xs text-green-600 mt-2">
                This on-chain Agent DID is linked to {agent.name}
              </p>
            </div>
          ) : (
            <>
              {/* Prerequisites Check */}
              {!address ? (
                <Alert className="border-amber-200 bg-amber-50">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    Please connect your wallet to create an Agent DID.
                  </AlertDescription>
                </Alert>
              ) : !hasHumanDID ? (
                <Alert className="border-amber-200 bg-amber-50">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    You need an On-Chain DID first. Go to{' '}
                    <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/dashboard/wallet')}>
                      Wallet page
                    </Button>{' '}
                    to register your On-Chain DID (DualDIDRegistry).
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* User has DualDIDRegistry On-Chain DID - can create Sub-DID */}
                  <Alert className="border-blue-200 bg-blue-50">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700">
                      Click the button below to create an on-chain Sub-DID (Agent DID) for <strong>{agent.name}</strong>. 
                      This will call the DualDIDRegistry contract and automatically bind the new DID to this agent.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Your On-Chain DID (Parent)</p>
                    <p className="font-mono text-sm break-all">{formatDID(onChainHumanDID as `0x${string}`)}</p>
                  </div>

                  {/* Create Button */}
                  <Button 
                    onClick={handleCreateSubDID}
                    disabled={isCreatingSubDID || isConfirmingSubDID}
                    className="w-full"
                    size="lg"
                  >
                    {isCreatingSubDID ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirm in Wallet...
                      </>
                    ) : isConfirmingSubDID ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Sub-DID on Chain...
                      </>
                    ) : (
                      <>
                        <Bot className="mr-2 h-4 w-4" />
                        Create Sub-DID (Agent DID) On-Chain
                      </>
                    )}
                  </Button>

                  {/* Transaction Hash */}
                  {createSubDIDTxHash && (
                    <p className="text-xs text-center text-muted-foreground">
                      Tx:{' '}
                      <a 
                        href={`https://testnet.bscscan.com/tx/${createSubDIDTxHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-500 hover:underline"
                      >
                        {createSubDIDTxHash.slice(0, 10)}...{createSubDIDTxHash.slice(-8)}
                        <ExternalLink className="inline h-3 w-3 ml-1" />
                      </a>
                    </p>
                  )}

                  {/* Error */}
                  {createSubDIDError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-700 text-sm">
                        {createSubDIDError.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Success */}
                  {isSubDIDCreated && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-700">
                        Sub-DID created successfully! Binding to this agent...
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          )}

          {/* Existing Sub-DIDs - Manual Selection */}
          {!agent.sub_did && subDIDs && (subDIDs as `0x${string}`[]).length > 0 && (
            <div className="border-t pt-4 mt-4">
              <label className="text-sm font-medium mb-2 block">
                Or bind an existing Sub-DID
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(subDIDs as `0x${string}`[]).map((did, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                      subDid === did ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => handleSelectDID(did)}
                  >
                    <div className="font-mono text-sm break-all">{formatDID(did)}</div>
                    {subDid === did && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                    )}
                  </div>
                ))}
              </div>
              {subDid && (
                <Button 
                  onClick={handleSaveDID} 
                  disabled={isSaving} 
                  className="w-full mt-3"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Binding...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Bind Selected DID
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Change Sub-DID (if already has one) */}
          {agent.sub_did && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-2">Change Sub-DID</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter DID (0x...)"
                  value={subDid !== agent.sub_did ? subDid : ''}
                  onChange={(e) => setSubDid(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  onClick={handleSaveDID} 
                  disabled={isSaving || !subDid || subDid === agent.sub_did}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mandate Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Mandate Settings</CardTitle>
          <CardDescription>
            Configure spending limits and authorization period for this agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Daily Limit (USD1)</label>
              <Input
                type="number"
                placeholder="10000"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Maximum amount the agent can spend per day
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Single Transaction Limit (USD1)</label>
              <Input
                type="number"
                placeholder="1000"
                value={singleLimit}
                onChange={(e) => setSingleLimit(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Maximum amount per transaction
              </p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Mandate Expiry</label>
            <Input
              type="datetime-local"
              value={mandateExpiry}
              onChange={(e) => setMandateExpiry(e.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The date and time when this mandate expires
            </p>
          </div>
          <Button onClick={handleSaveMandate} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Mandate
          </Button>
        </CardContent>
      </Card>

      {/* Current Settings Summary */}
      {(agent.daily_limit || agent.single_limit || agent.mandate_expiry) && (
        <Card>
          <CardHeader>
            <CardTitle>Current Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Daily Limit</p>
                <p className="text-xl font-bold">
                  {agent.daily_limit ? `$${agent.daily_limit.toLocaleString()}` : 'Not set'}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Single Limit</p>
                <p className="text-xl font-bold">
                  {agent.single_limit ? `$${agent.single_limit.toLocaleString()}` : 'Not set'}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Expires</p>
                <p className="text-xl font-bold">
                  {agent.mandate_expiry 
                    ? new Date(agent.mandate_expiry).toLocaleDateString() 
                    : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
