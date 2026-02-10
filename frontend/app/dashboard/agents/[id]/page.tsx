'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bot, Save, Loader2, CheckCircle2, Link2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { agentApi } from '@/lib/api';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DID_REGISTRY_ABI } from '@/lib/contracts/abis';
import { formatDID } from '@/lib/contracts/hooks';

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
            Sub-DID Configuration
          </CardTitle>
          <CardDescription>
            Link this agent to an on-chain Agent DID. First create Agent DIDs in the Wallet page, then select one here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Available On-Chain Agent DIDs */}
          {onChainAgentDIDs && (onChainAgentDIDs as `0x${string}`[]).length > 0 ? (
            <div>
              <label className="text-sm font-medium mb-2 block">Select from On-Chain Agent DIDs</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(onChainAgentDIDs as `0x${string}`[]).map((did, i) => (
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
            </div>
          ) : (
            <div className="rounded-lg bg-yellow-50 p-4 text-yellow-700 text-sm">
              No on-chain Agent DIDs found. Go to <strong>Wallet</strong> page and create Agent DIDs first.
              <Button 
                variant="link" 
                className="p-0 h-auto ml-1" 
                onClick={() => router.push('/dashboard/wallet')}
              >
                Go to Wallet →
              </Button>
            </div>
          )}

          {/* Manual Input */}
          <div>
            <label className="text-sm font-medium">Or enter Sub-DID manually (bytes32)</label>
            <Input
              placeholder="0x..."
              value={subDid}
              onChange={(e) => setSubDid(e.target.value)}
              className="mt-1.5 font-mono text-sm"
            />
          </div>

          {/* Current DID Display */}
          {agent.sub_did && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Current Sub-DID</p>
              <p className="font-mono text-xs break-all mt-1">{agent.sub_did}</p>
            </div>
          )}

          <Button onClick={handleSaveDID} disabled={isSaving || !subDid}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Sub-DID
          </Button>
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
