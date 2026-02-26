'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { DUAL_DID_REGISTRY_ABI } from '@/lib/contracts/abis';
import {
  useHumanIncentive,
  useAgentIncentive,
  useTotalHumanPoints,
  useClaimHumanRegistrationBonus,
  useClaimWithReferral,
  useGenerateInviteCode,
  useClaimAgentRegistrationBonus,
  KYC_LEVEL_NAMES,
  formatDID,
} from '@/lib/contracts/hooks';
import {
  Gift,
  Award,
  Users,
  Bot,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Star,
  TrendingUp,
  AlertTriangle,
  Coins,
} from 'lucide-react';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export default function IncentivesPage() {
  const { address } = useAccount();
  const { agents } = useAppStore();
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

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

  // Contract hooks
  const { data: humanIncentive, isLoading: humanLoading, refetch: refetchHuman } = useHumanIncentive(humanDID as `0x${string}`);
  const { data: totalPoints, refetch: refetchTotal } = useTotalHumanPoints(humanDID as `0x${string}`);
  
  const { claimBonus, isPending: claimingHuman, isSuccess: claimedHuman } = useClaimHumanRegistrationBonus();
  const { claimWithReferral, isPending: claimingReferral, isSuccess: claimedReferral } = useClaimWithReferral();
  const { generateCode, isPending: generatingCode, isSuccess: codeGenerated } = useGenerateInviteCode();
  const { claimAgentBonus, isPending: claimingAgent, isSuccess: claimedAgent } = useClaimAgentRegistrationBonus();

  const handleClaimHumanBonus = () => {
    if (humanDID) {
      if (referralCode) {
        claimWithReferral(humanDID as `0x${string}`, referralCode as `0x${string}`);
      } else {
        claimBonus(humanDID as `0x${string}`);
      }
    }
  };

  const handleGenerateInviteCode = () => {
    if (humanDID) {
      generateCode(humanDID as `0x${string}`);
    }
  };

  const handleClaimAgentBonus = (agentDID: `0x${string}`) => {
    claimAgentBonus(agentDID);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshData = () => {
    refetchHuman();
    refetchTotal();
  };

  const incentive = humanIncentive as any;
  const isRegistered = incentive?.registered;
  const isBlacklisted = incentive?.blacklisted;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incentives Center</h1>
          <p className="text-muted-foreground">Track your points, referrals, and rewards</p>
        </div>
        <Button variant="outline" onClick={refreshData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Warning if blacklisted */}
      {isBlacklisted && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div>
              <p className="font-semibold text-red-600">Account Blacklisted</p>
              <p className="text-sm text-red-600">Your account has been flagged for violations. Points are frozen.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Points Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold">{totalPoints?.toString() || incentive?.totalPoints?.toString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <Gift className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registration Points</p>
                <p className="text-2xl font-bold">{incentive?.registrationPoints?.toString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Referral Points</p>
                <p className="text-2xl font-bold">{incentive?.referralPoints?.toString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-100 p-3">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">KYC Points</p>
                <p className="text-2xl font-bold">{incentive?.kycPoints?.toString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Human DID Incentives */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Human DID Incentives
            </CardTitle>
            <CardDescription>
              Claim your registration bonus and earn through referrals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Registration Status */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Registration Bonus</p>
                <p className="text-sm text-muted-foreground">+1,000 points for registration</p>
              </div>
              {isRegistered ? (
                <Badge variant="success">Claimed</Badge>
              ) : (
                <Button onClick={handleClaimHumanBonus} disabled={claimingHuman || !humanDID}>
                  {claimingHuman ? 'Claiming...' : 'Claim 1,000 Points'}
                </Button>
              )}
            </div>

            {/* Referral Code Input */}
            {!isRegistered && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Have a referral code? (Optional)</label>
                <Input
                  placeholder="Enter referral code (0x...)"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Get extra 200 points with a valid referral code</p>
              </div>
            )}

            {/* KYC Level */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium">KYC Level</p>
                <p className="text-sm text-muted-foreground">Complete verification for more points</p>
              </div>
              <Badge variant={incentive?.kycLevel > 0 ? 'info' : 'secondary'}>
                {KYC_LEVEL_NAMES[incentive?.kycLevel || 0]}
              </Badge>
            </div>

            {/* KYC Points Table */}
            <div className="border rounded-lg p-4">
              <p className="font-medium mb-2">KYC Bonus Points</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Basic (Social Media)</span><span>+1,000</span></div>
                <div className="flex justify-between"><span>Standard (+ Asset Proof)</span><span>+3,000</span></div>
                <div className="flex justify-between"><span>Advanced (+ Identity)</span><span>+6,000</span></div>
                <div className="flex justify-between"><span>Full Verification</span><span>+10,000</span></div>
              </div>
            </div>

            {/* Invites */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Invited Friends</p>
                <p className="text-sm text-muted-foreground">500 points per invite</p>
              </div>
              <span className="text-xl font-bold">{incentive?.inviteCount?.toString() || '0'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Referral System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Referral Program
            </CardTitle>
            <CardDescription>
              Invite friends to earn rewards together
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate Invite Code */}
            <div className="space-y-3">
              <p className="font-medium">Your Invite Code</p>
              {generatedCode || codeGenerated ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedCode || 'Code generated! Check transaction...'}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(generatedCode || '')}
                    disabled={!generatedCode}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateInviteCode}
                  disabled={generatingCode || !isRegistered || !humanDID}
                  className="w-full"
                >
                  {generatingCode ? 'Generating...' : 'Generate Invite Code'}
                </Button>
              )}
              {!isRegistered && (
                <p className="text-sm text-yellow-600">Claim registration bonus first to generate invite codes</p>
              )}
            </div>

            {/* Reward Structure */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="font-medium">Referral Rewards</p>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>You get (inviter)</span>
                </div>
                <span className="font-bold text-green-600">+500 points</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-blue-600" />
                  <span>Friend gets (invitee)</span>
                </div>
                <span className="font-bold text-blue-600">+200 points</span>
              </div>
            </div>

            {/* Share Instructions */}
            <div className="bg-muted rounded-lg p-4">
              <p className="font-medium mb-2">How to Invite</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Generate your unique invite code</li>
                <li>Share the code with friends</li>
                <li>Friend enters code during registration</li>
                <li>Both receive bonus points instantly</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Incentives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Task Points
          </CardTitle>
          <CardDescription>
            Each agent earns task points (1 point per completed task, max 10/day, cap 500 total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!agentDIDs || (agentDIDs as `0x${string}`[]).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No agents registered yet</p>
              <p className="text-sm">Create an agent to start earning task points</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(agentDIDs as `0x${string}`[]).map((agentDID, index) => (
                <AgentIncentiveCard
                  key={agentDID}
                  agentDID={agentDID}
                  agentName={agents[index]?.name || `Agent ${index + 1}`}
                  onClaimBonus={() => handleClaimAgentBonus(agentDID)}
                  claimingAgent={claimingAgent}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Points Value Info */}
      <Card>
        <CardHeader>
          <CardTitle>Points Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-primary" />
                <span className="font-medium">Registration Points</span>
              </div>
              <p className="text-sm text-muted-foreground">
                One-time bonus for joining the ecosystem. Represents basic participation rights.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">Task Points</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Core credential for future protocol equity. Higher value than registration points.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="font-medium">Reputation Boost</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Higher reputation = higher effective points. 90 score = 0.9x multiplier.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentIncentiveCard({
  agentDID,
  agentName,
  onClaimBonus,
  claimingAgent,
}: {
  agentDID: `0x${string}`;
  agentName: string;
  onClaimBonus: () => void;
  claimingAgent: boolean;
}) {
  const { data: incentive } = useAgentIncentive(agentDID);
  const agentIncentive = incentive as any;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border">
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-primary/10 p-2">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{agentName}</p>
          <p className="text-sm text-muted-foreground">{formatDID(agentDID)}</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Registration</p>
          <p className="font-bold">{agentIncentive?.registrationPoints?.toString() || '0'}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Task Points</p>
          <p className="font-bold">{agentIncentive?.taskPoints?.toString() || '0'} / 500</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="font-bold">{agentIncentive?.dailyTaskPoints?.toString() || '0'} / 10</p>
        </div>
        
        {!agentIncentive?.registered ? (
          <Button size="sm" onClick={onClaimBonus} disabled={claimingAgent}>
            {claimingAgent ? 'Claiming...' : 'Claim 100'}
          </Button>
        ) : (
          <Badge variant="success">Active</Badge>
        )}
      </div>
    </div>
  );
}
