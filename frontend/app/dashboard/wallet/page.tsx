'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { bscTestnet } from 'wagmi/chains';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { formatAddress } from '@/lib/utils';
import { userApi } from '@/lib/api';
import { 
  USD1_ABI, 
  DUAL_DID_REGISTRY_ABI,
  ESCROW_ABI 
} from '@/lib/contracts/abis';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
import { formatDID } from '@/lib/contracts/hooks';
import { 
  Wallet, 
  ArrowDownLeft, 
  Copy, 
  ExternalLink, 
  Loader2, 
  UserCircle, 
  Bot, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  AlertTriangle,
  Scale
} from 'lucide-react';

export default function WalletPage() {
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { user, setUser } = useAppStore();
  const [faucetAmount, setFaucetAmount] = useState('10000');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [approveAmount, setApproveAmount] = useState('100000');

  const isWrongNetwork = chainId !== bscTestnet.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  // USD1 Balance
  const { data: balance, refetch: refetchBalance } = useBalance({
    address,
    token: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
  });

  // BNB Balance
  const { data: bnbBalance } = useBalance({ address });

  // Read On-Chain DID from DualDIDRegistry
  const { data: onChainHumanDID, refetch: refetchHumanDID } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'walletToOnChainDID',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Check if On-Chain DID is valid (not zero)
  const hasHumanDID = onChainHumanDID && onChainHumanDID !== ZERO_BYTES32;

  // Get Sub-DIDs (Agent DIDs) from DualDIDRegistry
  const { data: agentDIDs, refetch: refetchAgentDIDs } = useReadContract({
    address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
    abi: DUAL_DID_REGISTRY_ABI,
    functionName: 'getSubDIDsByOnChainDID',
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

  // ===== Transaction Hooks =====
  
  // Faucet
  const { 
    writeContract: writeFaucet, 
    data: faucetHash, 
    isPending: isFaucetPending,
    error: faucetError 
  } = useWriteContract();
  const { isLoading: isFaucetConfirming, isSuccess: isFaucetSuccess } = useWaitForTransactionReceipt({ hash: faucetHash });

  // Register Human DID
  const { 
    writeContract: writeRegisterDID, 
    data: registerHash, 
    isPending: isRegisterPending,
    error: registerError 
  } = useWriteContract();
  const { isLoading: isRegisterConfirming, isSuccess: isRegisterSuccess } = useWaitForTransactionReceipt({ hash: registerHash });

  // Create Agent DID
  const { 
    writeContract: writeCreateAgent, 
    data: createAgentHash, 
    isPending: isCreateAgentPending,
    error: createAgentError 
  } = useWriteContract();
  const { isLoading: isCreateAgentConfirming, isSuccess: isCreateAgentSuccess } = useWaitForTransactionReceipt({ hash: createAgentHash });

  // Create Mandate
  const { 
    writeContract: writeMandate, 
    data: mandateHash, 
    isPending: isMandatePending,
    error: mandateError 
  } = useWriteContract();
  const { isLoading: isMandateConfirming, isSuccess: isMandateSuccess } = useWaitForTransactionReceipt({ hash: mandateHash });

  // Approve USD1
  const { 
    writeContract: writeApprove, 
    data: approveHash, 
    isPending: isApprovePending,
    error: approveError 
  } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  // State for mandate creation
  const [selectedAgentForMandate, setSelectedAgentForMandate] = useState<string>('');
  const [mandateDailyLimit, setMandateDailyLimit] = useState('10000');
  const [mandateSingleLimit, setMandateSingleLimit] = useState('1000');

  // State for dispute resolution
  const [disputeTaskId, setDisputeTaskId] = useState('');
  const [requesterPercent, setRequesterPercent] = useState('50');

  // Resolve Dispute
  const { 
    writeContract: writeResolveDispute, 
    data: resolveDisputeHash, 
    isPending: isResolveDisputePending,
    error: resolveDisputeError 
  } = useWriteContract();
  const { isLoading: isResolveDisputeConfirming, isSuccess: isResolveDisputeSuccess } = useWaitForTransactionReceipt({ hash: resolveDisputeHash });

  // ===== Handlers =====

  const handleFaucet = () => {
    if (!faucetAmount) return;
    writeFaucet({
      address: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
      abi: USD1_ABI,
      functionName: 'faucet',
      args: [parseUnits(faucetAmount, 6)],
    });
  };

  const handleRegisterHumanDID = async () => {
    // Use DualDIDRegistry's registerOnChainDID (no args needed)
    writeRegisterDID({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      functionName: 'registerOnChainDID',
      args: [],
      gas: BigInt(200000),
    });
  };

  const handleCreateAgentDID = () => {
    if (!hasHumanDID) return;
    // Use DualDIDRegistry's registerSubDID (only needs name)
    const agentName = `Agent-${Date.now()}`;
    writeCreateAgent({
      address: CONTRACT_ADDRESSES.DualDIDRegistry as `0x${string}`,
      abi: DUAL_DID_REGISTRY_ABI,
      gas: BigInt(500000),
      functionName: 'registerSubDID',
      args: [agentName],
    });
  };

  const handleCreateMandate = () => {
    // Mandate functionality is not available in DualDIDRegistry
    // This feature has been deprecated
    console.warn('Mandate creation is not supported in DualDIDRegistry');
  };

  const handleApprove = () => {
    if (!approveAmount) return;
    writeApprove({
      address: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
      abi: USD1_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.Escrow as `0x${string}`, parseUnits(approveAmount, 6)],
      gas: BigInt(100000),
    });
  };

  const copyAddress = () => {
    if (address) {
      window.prompt('Copy address:', address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResolveDispute = () => {
    if (!disputeTaskId || requesterPercent === '') return;
    writeResolveDispute({
      address: CONTRACT_ADDRESSES.Escrow as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'resolveDispute',
      args: [BigInt(disputeTaskId), Number(requesterPercent)],
      gas: BigInt(500000),
    });
  };

  // Refetch data after successful transactions
  useEffect(() => {
    if (isFaucetSuccess) {
      refetchBalance();
    }
  }, [isFaucetSuccess]);

  useEffect(() => {
    if (isRegisterSuccess) {
      // Refetch the DID from chain, then update backend
      refetchHumanDID().then((result) => {
        const newDID = result.data as `0x${string}`;
        if (newDID && newDID !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          userApi.updateDID(newDID).then(() => {
            setUser({ ...user!, did: newDID });
          }).catch(console.error);
        }
      });
    }
  }, [isRegisterSuccess]);

  useEffect(() => {
    if (isCreateAgentSuccess) {
      refetchAgentDIDs();
    }
  }, [isCreateAgentSuccess]);

  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Network Warning */}
      {isWrongNetwork && (
        <div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-medium">Wrong Network Detected</p>
                <p className="text-sm">Please switch to BSC Testnet (Chain ID: 97) to use ClawPay</p>
              </div>
            </div>
            <Button 
              onClick={() => switchChain({ chainId: bscTestnet.id })}
              disabled={isSwitching}
              size="sm"
            >
              {isSwitching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Switch Network
            </Button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold">Wallet & On-Chain Identity</h1>
        <p className="text-muted-foreground">Manage your funds, DID and on-chain interactions</p>
      </div>

      {/* Main Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">USD1 Balance</p>
              <p className="mt-1 text-4xl font-bold">
                {balance ? Number(balance.formatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} USD1
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <Wallet className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>

          {/* Wallet Address */}
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-background/50 p-3">
            <span className="font-mono text-sm flex-1 truncate">{address}</span>
            <Button variant="ghost" size="icon" onClick={copyAddress}>
              <Copy className="h-4 w-4" />
            </Button>
            {copied && <span className="text-xs text-green-600">Copied!</span>}
          </div>

          {/* DID Info */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Human DID (On-Chain)</p>
              <p className="font-mono text-sm">
                {hasHumanDID ? formatDID(onChainHumanDID as `0x${string}`) : 'Not registered'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Agent DIDs</p>
              <p className="text-sm font-medium">{agentDIDs?.length || 0} registered</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step 1: Get USD1 Tokens */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 1</Badge>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5" />
                Get USD1 Tokens
              </CardTitle>
            </div>
            <CardDescription>Claim test tokens from the faucet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount (USD1)</label>
              <Input
                type="number"
                value={faucetAmount}
                onChange={(e) => setFaucetAmount(e.target.value)}
                placeholder="10000"
                max="100000"
              />
            </div>

            <Button
              onClick={handleFaucet}
              disabled={isFaucetPending || isFaucetConfirming || !faucetAmount}
              className="w-full"
            >
              {isFaucetPending || isFaucetConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isFaucetPending ? 'Confirm in wallet...' : 'Processing...'}
                </>
              ) : (
                <>
                  <ArrowDownLeft className="mr-2 h-4 w-4" />
                  Claim {faucetAmount} USD1
                </>
              )}
            </Button>

            {isFaucetSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Successfully received {faucetAmount} USD1!
              </div>
            )}
            {faucetError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {faucetError.message.slice(0, 100)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Register Human DID */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 2</Badge>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                Register Human DID
              </CardTitle>
            </div>
            <CardDescription>Create your on-chain identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasHumanDID ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Human DID registered!
                </div>
                <div 
                  className="rounded-lg bg-muted p-3 cursor-pointer hover:bg-muted/80 transition-colors group"
                  onClick={() => {
                    window.prompt('Copy DID:', onChainHumanDID as string);
                    alert(`Copied: ${onChainHumanDID}`);
                  }}
                  title="Click to copy full DID"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Your DID (click to copy)</p>
                      <p className="font-mono text-xs break-all">{onChainHumanDID as string}</p>
                    </div>
                    <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  A unique bytes32 identifier will be generated and registered on-chain.
                </p>
                <Button
                  onClick={handleRegisterHumanDID}
                  disabled={isRegisterPending || isRegisterConfirming}
                  className="w-full"
                >
                  {isRegisterPending || isRegisterConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isRegisterPending ? 'Confirm in wallet...' : 'Registering...'}
                    </>
                  ) : (
                    <>
                      <UserCircle className="mr-2 h-4 w-4" />
                      Register Human DID
                    </>
                  )}
                </Button>
              </>
            )}

            {isRegisterSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                DID registered successfully!
              </div>
            )}
            {registerError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {registerError.message.slice(0, 100)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Create Agent DID */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 3</Badge>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Create Agent DID
              </CardTitle>
            </div>
            <CardDescription>Register an AI agent identity on-chain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasHumanDID ? (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Please register your Human DID first
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Registered Agent DIDs</p>
                  <p className="text-2xl font-bold">{agentDIDs?.length || 0}</p>
                </div>

                {agentDIDs && agentDIDs.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {(agentDIDs as `0x${string}`[]).map((did, i) => (
                      <div 
                        key={i} 
                        className="rounded bg-muted/50 p-2 cursor-pointer hover:bg-muted transition-colors group"
                        onClick={() => {
                          window.prompt('Copy DID:', did);
                          alert(`Copied: ${did}`);
                        }}
                        title={`Click to copy full DID: ${did}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xs break-all">{formatDID(did)}</p>
                          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={handleCreateAgentDID}
                  disabled={isCreateAgentPending || isCreateAgentConfirming}
                  className="w-full"
                >
                  {isCreateAgentPending || isCreateAgentConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isCreateAgentPending ? 'Confirm in wallet...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Bot className="mr-2 h-4 w-4" />
                      Create New Agent DID
                    </>
                  )}
                </Button>
              </>
            )}

            {isCreateAgentSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Agent DID created successfully!
              </div>
            )}
            {createAgentError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {createAgentError.message.slice(0, 100)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3.5: Create Mandate */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-yellow-50">Step 3.5</Badge>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Create Mandate (Required!)
              </CardTitle>
            </div>
            <CardDescription>Authorize your Agent to spend USD1. This is required before creating tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!agentDIDs || agentDIDs.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Please create an Agent DID first
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Agent DID</label>
                  <select
                    className="w-full rounded-md border p-2 text-sm"
                    value={selectedAgentForMandate}
                    onChange={(e) => setSelectedAgentForMandate(e.target.value)}
                  >
                    <option value="">Select an Agent...</option>
                    {(agentDIDs as `0x${string}`[]).map((did, i) => (
                      <option key={i} value={did}>{formatDID(did)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Daily Limit (USD1)</label>
                    <Input
                      type="number"
                      value={mandateDailyLimit}
                      onChange={(e) => setMandateDailyLimit(e.target.value)}
                      placeholder="10000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Single Tx Limit (USD1)</label>
                    <Input
                      type="number"
                      value={mandateSingleLimit}
                      onChange={(e) => setMandateSingleLimit(e.target.value)}
                      placeholder="1000"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCreateMandate}
                  disabled={!selectedAgentForMandate || isMandatePending || isMandateConfirming}
                  className="w-full"
                  variant="default"
                >
                  {isMandatePending || isMandateConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isMandatePending ? 'Confirm in wallet...' : 'Creating mandate...'}
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Create Mandate
                    </>
                  )}
                </Button>
              </>
            )}

            {isMandateSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Mandate created successfully! Your Agent can now create tasks.
              </div>
            )}
            {mandateError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {mandateError.message.slice(0, 100)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Approve Escrow */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 4</Badge>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Approve Escrow
              </CardTitle>
            </div>
            <CardDescription>Authorize the escrow contract to use your USD1</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Current Allowance</p>
              <p className="text-2xl font-bold">
                {allowance ? Number(formatUnits(allowance as bigint, 6)).toLocaleString() : '0'} USD1
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Approve Amount (USD1)</label>
              <Input
                type="number"
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
                placeholder="100000"
              />
            </div>

            <Button
              onClick={handleApprove}
              disabled={isApprovePending || isApproveConfirming || !approveAmount}
              className="w-full"
            >
              {isApprovePending || isApproveConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isApprovePending ? 'Confirm in wallet...' : 'Approving...'}
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Approve {approveAmount} USD1
                </>
              )}
            </Button>

            {isApproveSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Approval successful!
              </div>
            )}
            {approveError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {approveError.message.slice(0, 100)}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Escrow contract: {formatAddress(CONTRACT_ADDRESSES.Escrow, 8)}
            </p>
          </CardContent>
        </Card>

        {/* Step 5: Resolve Dispute (Owner Only) */}
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700">Admin</Badge>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-orange-600" />
                Resolve Dispute
              </CardTitle>
            </div>
            <CardDescription>Arbitrate disputed tasks (Contract Owner only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-orange-100/50 p-3 text-sm text-orange-700">
              <p className="font-medium">How it works:</p>
              <ul className="mt-1 list-disc list-inside text-xs space-y-1">
                <li>requesterPercent = 100: Full refund to Requester, Provider penalized</li>
                <li>requesterPercent = 0: Full payment to Provider, Requester penalized</li>
                <li>requesterPercent = 50: Split 50/50, no penalty</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Chain Task ID</label>
              <Input
                type="number"
                value={disputeTaskId}
                onChange={(e) => setDisputeTaskId(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Requester Percent (0-100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={requesterPercent}
                onChange={(e) => setRequesterPercent(e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">
                % of escrowed funds returned to Requester
              </p>
            </div>

            <Button
              onClick={handleResolveDispute}
              disabled={!disputeTaskId || requesterPercent === '' || isResolveDisputePending || isResolveDisputeConfirming}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {isResolveDisputePending || isResolveDisputeConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isResolveDisputePending ? 'Confirm in wallet...' : 'Resolving...'}
                </>
              ) : (
                <>
                  <Scale className="mr-2 h-4 w-4" />
                  Resolve Dispute
                </>
              )}
            </Button>

            {isResolveDisputeSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Dispute resolved successfully! Reputation scores updated.
              </div>
            )}
            {resolveDisputeError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {resolveDisputeError.message.slice(0, 150)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Native Balance & Links */}
      <Card>
        <CardHeader>
          <CardTitle>Network Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">BNB Balance</p>
              <p className="text-xl font-bold">
                {bnbBalance ? Number(bnbBalance.formatted).toFixed(4) : '0.0000'} BNB
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Network</p>
              <p className="text-xl font-bold">BSC Testnet</p>
            </div>
            <div className="rounded-lg bg-muted p-4 flex flex-col justify-between">
              <p className="text-sm text-muted-foreground">Need BNB?</p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a
                  href="https://testnet.bnbchain.org/faucet-smart"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  BNB Faucet <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Addresses */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Addresses</CardTitle>
          <CardDescription>Deployed on BSC Testnet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            {[
              { name: 'USD1', address: CONTRACT_ADDRESSES.USD1 },
              { name: 'DualDID Registry', address: CONTRACT_ADDRESSES.DualDIDRegistry },
              { name: 'Reputation', address: CONTRACT_ADDRESSES.Reputation },
              { name: 'Dynamic Pricing', address: CONTRACT_ADDRESSES.DynamicPricing },
              { name: 'Insurance Pool', address: CONTRACT_ADDRESSES.InsurancePool },
              { name: 'Escrow', address: CONTRACT_ADDRESSES.Escrow },
            ].map((contract) => (
              <div key={contract.name} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-muted-foreground">{contract.name}</span>
                <a
                  href={`https://testnet.bscscan.com/address/${contract.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {formatAddress(contract.address, 6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
