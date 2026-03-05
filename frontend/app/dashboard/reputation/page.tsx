'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { ReputationGauge } from '@/components/dashboard/ReputationGauge';
import { getScoreColor } from '@/lib/utils';
import { Award, TrendingUp, TrendingDown, Activity, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DUAL_DID_REGISTRY_ABI, REPUTATION_ABI, ESCROW_ABI } from '@/lib/contracts/abis';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const statusMap: Record<number, string> = {
  0: 'created', 1: 'accepted', 2: 'completed',
  3: 'disputed', 4: 'resolved', 5: 'cancelled', 6: 'expired',
};

export default function ReputationPage() {
  const { address } = useAccount();
  const { user, agents, dashboardStats, setDashboardStats } = useAppStore();
  const [onChainScores, setOnChainScores] = useState<{ requester: number; provider: number } | null>(null);
  const [isLoadingScores, setIsLoadingScores] = useState(false);
  const publicClient = usePublicClient();

  // Get On-Chain DID from DualDIDRegistry
  const { data: humanDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'walletToOnChainDID',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const hasOnChainDID = humanDID && humanDID !== ZERO_BYTES32;

  // Get Sub-DIDs (Agent DIDs) from DualDIDRegistry
  const { data: agentDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'getSubDIDsByOnChainDID',
    args: hasOnChainDID ? [humanDID as `0x${string}`] : undefined,
    query: { enabled: hasOnChainDID },
  });

  // Fetch on-chain scores
  useEffect(() => {
    const fetchScores = async () => {
      if (!agentDIDs || (agentDIDs as `0x${string}`[]).length === 0) return;
      
      setIsLoadingScores(true);
      try {
        const scores: number[] = [];
        for (const agentDID of agentDIDs as `0x${string}`[]) {
          const response = await fetch('https://bsc-dataseed.binance.org/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [{
                to: CONTRACT_ADDRESSES.Reputation,
                data: `0x42527f5b${agentDID.slice(2)}`, // agentScores(bytes32)
              }, 'latest'],
              id: 1,
            }),
          }).then(res => res.json());
          
          if (response?.result) {
            const score = parseInt(response.result, 16) / 100;
            scores.push(score);
          }
        }
        
        if (scores.length >= 2) {
          setOnChainScores({ requester: scores[0], provider: scores[1] });
        } else if (scores.length === 1) {
          setOnChainScores({ requester: scores[0], provider: scores[0] });
        }
      } catch (err) {
        console.error('Failed to fetch on-chain scores:', err);
      } finally {
        setIsLoadingScores(false);
      }
    };
    
    fetchScores();
  }, [agentDIDs]);

  // Load task stats from chain
  const loadTaskStats = useCallback(async () => {
    if (!publicClient || !agentDIDs) return;

    try {
      const taskCount = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: 'taskCount',
      }) as bigint;

      if (taskCount === BigInt(0)) {
        setDashboardStats({ total_tasks: 0, completed_tasks: 0, active_tasks: 0, disputed_tasks: 0, total_volume: 0, total_agents: 0, average_task_cost: 0, success_rate: 0 });
        return;
      }

      const userDIDs: Set<string> = new Set();
      (agentDIDs as `0x${string}`[]).forEach(did => userDIDs.add(did.toLowerCase()));

      let totalTasks = 0, completedTasks = 0, disputedTasks = 0;
      for (let i = 0; i < Number(taskCount); i++) {
        try {
          const task = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: 'tasks',
            args: [BigInt(i)],
          }) as any;

          const requesterDID = (task[0] || '').toLowerCase();
          const providerDID = (task[1] || '').toLowerCase();

          if (userDIDs.has(requesterDID) || userDIDs.has(providerDID)) {
            totalTasks++;
            const statusNum = Number(task[6] || 0);
            if (statusNum === 2) completedTasks++;
            if (statusNum === 3) disputedTasks++;
          }
        } catch {}
      }

      setDashboardStats({
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        active_tasks: totalTasks - completedTasks - disputedTasks,
        disputed_tasks: disputedTasks,
        total_volume: 0,
        total_agents: (agentDIDs as `0x${string}`[]).length,
        average_task_cost: 0,
        success_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      });
    } catch (error) {
      console.error('Failed to load task stats:', error);
    }
  }, [publicClient, agentDIDs, setDashboardStats]);

  useEffect(() => {
    loadTaskStats();
  }, [loadTaskStats]);

  // Use on-chain scores if available, otherwise fall back to backend
  const humanScore = user?.human_score || 75;
  const avgAgentScore = onChainScores
    ? (onChainScores.requester + onChainScores.provider) / 2
    : agents.length > 0
      ? agents.reduce((sum, a) => sum + a.agent_score, 0) / agents.length
      : 75;
  const finalScore = humanScore * 0.7 + avgAgentScore * 0.3;

  const getTier = (score: number) => {
    if (score >= 90) return { name: 'Premium', color: 'success', discount: '20% discount' };
    if (score >= 60) return { name: 'Standard', color: 'info', discount: 'Normal pricing' };
    if (score >= 40) return { name: 'Risk', color: 'warning', discount: '20% penalty' };
    return { name: 'Critical', color: 'destructive', discount: '50% penalty' };
  };

  const tier = getTier(finalScore);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reputation</h1>
        <p className="text-muted-foreground">Monitor your reputation scores and history</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Gauge */}
        <div className="lg:col-span-1">
          <ReputationGauge />
        </div>

        {/* Score Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Tier */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Current Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant={tier.color as any} className="text-lg px-4 py-1">
                    {tier.name}
                  </Badge>
                  <p className="mt-2 text-muted-foreground">{tier.discount}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold">{finalScore.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">Final Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <CardDescription>
                Final Score = (Human Score × 70%) + (Agent Avg × 30%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Human Score */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Human Score (70%)</p>
                    <p className="text-sm text-muted-foreground">
                      Financial credibility & compliance
                    </p>
                  </div>
                </div>
                <span className={`text-2xl font-bold ${getScoreColor(humanScore)}`}>
                  {humanScore}
                </span>
              </div>

              {/* Agent Average */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Agent Average (30%)</p>
                    <p className="text-sm text-muted-foreground">
                      Task performance & reliability
                      {onChainScores && (
                        <span className="ml-2 text-green-600">(On-chain)</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${getScoreColor(avgAgentScore)}`}>
                    {avgAgentScore.toFixed(1)}
                  </span>
                  {isLoadingScores && (
                    <RefreshCw className="h-4 w-4 animate-spin inline ml-2" />
                  )}
                </div>
              </div>
              
              {/* On-chain Agent Scores */}
              {onChainScores && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 rounded-lg border bg-green-50">
                    <p className="text-sm text-muted-foreground">Requester Agent</p>
                    <p className="text-xl font-bold text-green-600">{onChainScores.requester.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-blue-50">
                    <p className="text-sm text-muted-foreground">Provider Agent</p>
                    <p className="text-xl font-bold text-blue-600">{onChainScores.provider.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Individual Agent Scores */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Scores</CardTitle>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No agents yet</p>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </div>
                      <span className={`text-xl font-bold ${getScoreColor(agent.agent_score)}`}>
                        {agent.agent_score}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Factors Affecting Score */}
      <Card>
        <CardHeader>
          <CardTitle>Factors Affecting Your Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                <span className="font-medium">Positive Factors</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Successful task completions</li>
                <li>• Long-term USD1 holdings</li>
                <li>• Low dispute rate</li>
                <li>• Verified identity (World ID)</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-red-600">
                <TrendingDown className="h-5 w-5" />
                <span className="font-medium">Negative Factors</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Failed or disputed tasks</li>
                <li>• Late deliveries</li>
                <li>• Arbitration losses</li>
                <li>• Low fund deposits</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Recovery Tips</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Complete tasks successfully</li>
                <li>• Maintain consistent activity</li>
                <li>• Avoid disputes when possible</li>
                <li>• Keep USD1 balance healthy</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-3xl font-bold">{dashboardStats?.total_tasks || 0}</p>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-3xl font-bold text-green-600">
                {dashboardStats?.completed_tasks || 0}
              </p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-3xl font-bold text-red-600">
                {dashboardStats?.disputed_tasks || 0}
              </p>
              <p className="text-sm text-muted-foreground">Disputed</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-3xl font-bold">
                {dashboardStats?.success_rate?.toFixed(1) || 0}%
              </p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
