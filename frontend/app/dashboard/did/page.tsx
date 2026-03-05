'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { decodeEventLog } from 'viem';
import { PREMIUM_DID_AUCTION_ABI } from '@/lib/contracts/abis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, User, Link2, Shield, Crown, AlertTriangle, Wallet, ExternalLink, Gavel, Clock, DollarSign, Info } from 'lucide-react';
import { didApi, auctionApi, UserDIDInfo } from '@/lib/api';
import { DID_TIER_NAMES, CONTRACT_ADDRESSES } from '@/lib/config';
import { useCompleteRegistration, useRegisterOnChainDID, useWalletOnChainDID, useCreateShortDisplayIdAuction, useAuctionByDisplayId } from '@/lib/contracts/hooks';
import { useAppStore } from '@/lib/store';
import { BindWallet } from '@/components/BindWallet';

export default function DIDPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { isAuthenticated, user, hasWallet, isEmailUser } = useAppStore();
  const [didInfo, setDIDInfo] = useState<UserDIDInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayId, setDisplayId] = useState('');
  const [validation, setValidation] = useState<{ valid: boolean; available: boolean; reason: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showBindWallet, setShowBindWallet] = useState(false);

  const [auctionCreating, setAuctionCreating] = useState(false);

  // Check if display ID is a repeating pattern (豹子号) like 11111, AAAAA
  const isRepeatingPattern = (str: string): boolean => {
    if (str.length < 2) return false;
    const firstChar = str[0].toUpperCase();
    return str.toUpperCase().split('').every(c => c === firstChar);
  };

  // Check if display ID length is too short (1-3 chars not yet open)
  const isTooShort = displayId.length > 0 && displayId.length < 4;

  // Premium IDs: 4 characters OR 5+ repeating patterns (豹子号)
  // Note: 1-3 chars are blocked
  const isPremiumLength = displayId.length === 4 || (displayId.length >= 5 && isRepeatingPattern(displayId));
  
  const getAuctionPrice = (length: number, isRepeating: boolean = false): number => {
    // Repeating patterns (豹子号) use the same pricing as 4-char IDs
    if (isRepeating && length >= 5) return 10; // 5+ char repeating patterns = 10 USD1
    if (length >= 5) return 0;
    if (length === 4) return 10;
    // 1-3 chars not open, but keep pricing for reference
    if (length === 3) return 100;
    if (length === 2) return 1000;
    return 10000;
  };
  const getAuctionPriceWei = (length: number, isRepeating: boolean = false): bigint => {
    return BigInt(getAuctionPrice(length, isRepeating)) * BigInt(1e6);
  };

  const { completeRegistration, isPending, isConfirming, isSuccess } = useCompleteRegistration();
  
  // USD1 token address for auction payments
  const usd1Address = CONTRACT_ADDRESSES.USD1 as `0x${string}`;
  
  // Short Display ID auction hooks
  const {
    createAuction,
    hash: auctionTxHash,
    isPending: isAuctionPending,
    isConfirming: isAuctionConfirming,
    isSuccess: isAuctionSuccess,
    error: auctionError
  } = useCreateShortDisplayIdAuction();
  
  // Check if there's an existing auction for this display ID
  const { data: existingAuction } = useAuctionByDisplayId(isPremiumLength ? displayId : undefined);
  const hasExistingAuction = existingAuction && (existingAuction as any)[0] && BigInt((existingAuction as any)[0]) > BigInt(0);
  
  // On-chain DID registration via DualDIDRegistry contract
  const { 
    register: registerOnChain, 
    hash: onChainTxHash,
    isPending: isOnChainPending, 
    isConfirming: isOnChainConfirming, 
    isSuccess: isOnChainSuccess,
    error: onChainError 
  } = useRegisterOnChainDID();
  
  // Check if wallet already has on-chain DID in contract
  const { data: contractOnChainDID } = useWalletOnChainDID(address as `0x${string}`);
  const hasContractOnChainDID = contractOnChainDID && contractOnChainDID !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  // Load DID info for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      loadDIDInfo();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadDIDInfo = async () => {
    try {
      setLoading(true);
      const info = await didApi.getMyDIDs();
      setDIDInfo(info);
    } catch (err) {
      console.error('Failed to load DID info:', err);
    } finally {
      setLoading(false);
    }
  };

  // Validate display ID as user types
  useEffect(() => {
    if (displayId.length >= 1 && displayId.length <= 32) {
      validateDisplayId();
    } else {
      setValidation(null);
    }
  }, [displayId]);

  const validateDisplayIdFormat = (id: string): { valid: boolean; reason: string } => {
    if (id.length === 0 || id.length > 32) {
      return { valid: false, reason: 'Length must be 1-32 characters' };
    }
    for (const c of id) {
      const isDigit = c >= '0' && c <= '9';
      const isLetter = c >= 'A' && c <= 'Z';
      if (!isDigit && !isLetter) {
        return { valid: false, reason: 'Only uppercase letters (A-Z) and digits (0-9) allowed' };
      }
    }
    return { valid: true, reason: '' };
  };

  const validateDisplayId = async () => {
    try {
      setValidating(true);
      const formatCheck = validateDisplayIdFormat(displayId);
      if (!formatCheck.valid) {
        setValidation({ valid: false, available: false, reason: formatCheck.reason });
        return;
      }
      const result = await didApi.validateDisplayID(displayId);
      setValidation(result);
    } catch (err) {
      console.error('Validation failed:', err);
      const formatCheck = validateDisplayIdFormat(displayId);
      setValidation({ ...formatCheck, available: true });
    } finally {
      setValidating(false);
    }
  };

  const handleRegister = async () => {
    if (!validation?.valid || !validation?.available) return;

    try {
      setRegistering(true);
      setError(null);

      // Always register off-chain DID first (Display ID)
      // On-chain DID is created separately via blockchain transaction
      await didApi.registerOffChainDID(displayId);
      await loadDIDInfo();
      
      if (isConnected) {
        setSuccess('Display ID created successfully! You can now create your On-Chain DID to complete the dual identity setup.');
      } else {
        setSuccess('Display ID created successfully! Connect a wallet to create your On-Chain DID.');
      }
      
      setDisplayId('');
      setValidation(null);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleCreateAuction = async () => {
    console.log('handleCreateAuction called', { validation, isPremiumLength, isConnected, address, hasContractOnChainDID });
    
    if (!validation?.valid || !validation?.available || !isPremiumLength) {
      console.log('Validation failed:', { valid: validation?.valid, available: validation?.available, isPremiumLength });
      return;
    }
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }
    if (!hasContractOnChainDID) {
      setError('You need to register an on-chain Human DID first. Please go to the "On-Chain DID" section below.');
      return;
    }

    try {
      setAuctionCreating(true);
      setError(null);
      
      console.log('Calling createAuction with:', displayId, usd1Address);
      createAuction(displayId, usd1Address);
    } catch (err: any) {
      console.error('Auction creation error:', err);
      setError(err.message || 'Failed to create auction');
      setAuctionCreating(false);
    }
  };

  // Handle auction creation success
  useEffect(() => {
    const syncAndRedirect = async () => {
      if (isAuctionSuccess && auctionTxHash && displayId && publicClient) {
        const createdDisplayId = displayId;
        const auctionPrice = getAuctionPrice(createdDisplayId.length, isRepeatingPattern(createdDisplayId));
        
        try {
          // Get transaction receipt to extract chainAuctionId from AuctionCreated event
          const receipt = await publicClient.waitForTransactionReceipt({ hash: auctionTxHash });
          
          let chainAuctionId = 0;
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: PREMIUM_DID_AUCTION_ABI,
                data: log.data,
                topics: log.topics,
              });
              console.log('Decoded event:', decoded.eventName, decoded.args);
              if (decoded.eventName === 'AuctionCreated') {
                const args = decoded.args as { auctionId: bigint };
                chainAuctionId = Number(args.auctionId);
                console.log('Extracted chainAuctionId:', chainAuctionId);
                break;
              }
            } catch (decodeErr) {
              // Not the event we're looking for
              console.log('Failed to decode log:', decodeErr);
            }
          }
          
          if (chainAuctionId > 0) {
            await auctionApi.syncShortIdAuction(
              createdDisplayId,
              chainAuctionId,
              auctionPrice,
              usd1Address,
              auctionTxHash
            );
            console.log('Auction synced to backend with chainAuctionId:', chainAuctionId);
          } else {
            console.error('Failed to extract chainAuctionId from transaction receipt');
          }
        } catch (err) {
          console.error('Failed to sync auction to backend:', err);
        }
        
        setSuccess(`Auction created for "${createdDisplayId}"! The 30-minute bidding period has started. Redirecting to auction market...`);
        setDisplayId('');
        setValidation(null);
        setAuctionCreating(false);
        
        // Redirect to auction market after 2 seconds
        setTimeout(() => {
          window.location.href = `/dashboard/did/market?id=${createdDisplayId}`;
        }, 2000);
      }
    };
    
    syncAndRedirect();
  }, [isAuctionSuccess, auctionTxHash]);

  // Handle auction error
  useEffect(() => {
    if (auctionError) {
      setError(auctionError.message || 'Auction creation failed');
      setAuctionCreating(false);
    }
  }, [auctionError]);

  // Sync on-chain DID registration to backend
  useEffect(() => {
    const syncOnChainDID = async () => {
      if (isOnChainSuccess && onChainTxHash && address) {
        try {
          console.log('Syncing on-chain DID to backend...');
          // Get the DID hash from chain (contractOnChainDID should be updated now)
          const chainDIDHash = contractOnChainDID as string | undefined;
          await didApi.registerOnChainDID(address, onChainTxHash, chainDIDHash);
          console.log('On-chain DID synced to backend with hash:', chainDIDHash);
          loadDIDInfo();
        } catch (err) {
          console.error('Failed to sync on-chain DID to backend:', err);
        }
      }
    };
    syncOnChainDID();
  }, [isOnChainSuccess, onChainTxHash, address, contractOnChainDID]);

  const formatDisplayId = (input: string): string => {
    return input.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 32);
  };

  const handleDisplayIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDisplayId(e.target.value);
    setDisplayId(formatted);
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Please sign in to manage your DID.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const needsWallet = isEmailUser() && !hasWallet();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My DID</h1>
        <p className="text-muted-foreground">Manage your decentralized identity on ClawPay</p>
      </div>

      {/* Wallet binding prompt for email users */}
      {needsWallet && (
        <Alert className="border-amber-200 bg-amber-50">
          <Wallet className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Wallet Required for On-Chain DID</AlertTitle>
          <AlertDescription className="text-amber-700">
            You can create your Display ID below. To create an On-Chain DID and perform blockchain operations, 
            please connect a wallet.
            <Button
              variant="link"
              className="p-0 h-auto ml-1 text-amber-800 hover:text-amber-900"
              onClick={() => setShowBindWallet(true)}
            >
              Connect Wallet
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showBindWallet && (
        <BindWallet
          showAsModal
          onSuccess={() => {
            setShowBindWallet(false);
            loadDIDInfo();
          }}
          onCancel={() => setShowBindWallet(false)}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* On-Chain DID Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              On-Chain DID
            </CardTitle>
            <CardDescription>Your permanent on-chain identity bound to your wallet</CardDescription>
          </CardHeader>
          <CardContent>
            {didInfo?.has_on_chain && didInfo.on_chain_did ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                  <span className="text-xs text-muted-foreground">Non-transferable</span>
                  {hasContractOnChainDID && (
                    <Badge variant="outline" className="border-blue-500 text-blue-600">
                      On-Chain ✓
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">DID Hash (Database)</Label>
                  <code className="block text-xs bg-muted p-2 rounded break-all">
                    {didInfo.on_chain_did.did_hash}
                  </code>
                </div>
                {hasContractOnChainDID && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">DID Hash (Contract)</Label>
                    <code className="block text-xs bg-muted p-2 rounded break-all">
                      {contractOnChainDID}
                    </code>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                  <code className="block text-xs bg-muted p-2 rounded">
                    {didInfo.on_chain_did.wallet_address}
                  </code>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Created At</Label>
                  <p className="text-sm">{new Date(didInfo.on_chain_did.created_at).toLocaleString()}</p>
                </div>
                
                {/* On-chain registration button */}
                {isConnected && !hasContractOnChainDID && (
                  <div className="pt-4 border-t">
                    <Alert className="mb-4 border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700">
                        Your DID exists in database but not on blockchain. Click below to register on-chain.
                      </AlertDescription>
                    </Alert>
                    <Button 
                      onClick={() => registerOnChain()}
                      disabled={isOnChainPending || isOnChainConfirming}
                      className="w-full"
                    >
                      {isOnChainPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirm in Wallet...
                        </>
                      ) : isOnChainConfirming ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirming on Chain...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Register On-Chain (DualDIDRegistry)
                        </>
                      )}
                    </Button>
                    {onChainTxHash && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Tx: <a href={`https://bscscan.com/tx/${onChainTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          {onChainTxHash.slice(0, 10)}...{onChainTxHash.slice(-8)}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </p>
                    )}
                    {onChainError && (
                      <p className="text-xs text-red-500 mt-2">Error: {onChainError.message}</p>
                    )}
                    {isOnChainSuccess && (
                      <Alert className="mt-2 border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-700">
                          Successfully registered on blockchain! Refresh to see updated status.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            ) : isEmailUser() && !hasWallet() ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground mb-4">
                  {didInfo?.has_off_chain 
                    ? "You have a Display ID. Connect a wallet to create your On-Chain DID and enable full features."
                    : "Connect a wallet to create your On-Chain DID"}
                </p>
                <Button variant="outline" onClick={() => setShowBindWallet(true)}>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              </div>
            ) : didInfo?.has_off_chain && isConnected ? (
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground mb-4">
                    You have a Display ID. Create your On-Chain DID to complete the dual identity setup.
                  </p>
                </div>
                
                {/* Contract registration button */}
                <div className="space-y-3">
                  <Button 
                    onClick={() => registerOnChain()}
                    disabled={isOnChainPending || isOnChainConfirming || hasContractOnChainDID}
                    className="w-full"
                    size="lg"
                  >
                    {isOnChainPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirm in Wallet...
                      </>
                    ) : isOnChainConfirming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirming on Chain...
                      </>
                    ) : hasContractOnChainDID ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Already Registered On-Chain
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Register On-Chain DID
                      </>
                    )}
                  </Button>
                  
                  {onChainTxHash && (
                    <p className="text-xs text-center text-muted-foreground">
                      Tx: <a href={`https://bscscan.com/tx/${onChainTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        {onChainTxHash.slice(0, 10)}...{onChainTxHash.slice(-8)}
                        <ExternalLink className="inline h-3 w-3 ml-1" />
                      </a>
                    </p>
                  )}
                  
                  {onChainError && (
                    <Alert className="border-red-200 bg-red-50">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <AlertDescription className="text-red-700 text-sm">
                        {onChainError.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {isOnChainSuccess && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-700">
                        Successfully registered on blockchain! Refresh to see updated status.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                <p className="text-xs text-center text-muted-foreground">
                  This will create your On-Chain DID on the DualDIDRegistry contract and link it to your Display ID.
                </p>
              </div>
            ) : didInfo?.has_off_chain ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground mb-4">Connect your wallet to create On-Chain DID</p>
                <Button variant="outline" onClick={() => setShowBindWallet(true)}>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">
                  Register your On-Chain DID to enable auction participation and full features
                </p>
                <Button 
                  onClick={() => registerOnChain()}
                  disabled={isOnChainPending || isOnChainConfirming}
                  className="w-full max-w-xs"
                >
                  {isOnChainPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirm in Wallet...
                    </>
                  ) : isOnChainConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming on Chain...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Register On-Chain Human DID
                    </>
                  )}
                </Button>
                {onChainTxHash && (
                  <p className="text-xs text-muted-foreground">
                    Tx: <a href={`https://bscscan.com/tx/${onChainTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {onChainTxHash.slice(0, 10)}...{onChainTxHash.slice(-8)}
                      <ExternalLink className="inline h-3 w-3 ml-1" />
                    </a>
                  </p>
                )}
                {onChainError && (
                  <p className="text-xs text-red-500">Error: {onChainError.message}</p>
                )}
                {isOnChainSuccess && (
                  <Alert className="border-green-200 bg-green-50 max-w-xs mx-auto">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700">
                      On-Chain DID registered! You can now create auctions.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Off-Chain DID Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Display ID
            </CardTitle>
            <CardDescription>Your social identity displayed across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {didInfo?.has_off_chain && didInfo.off_chain_did ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-blue-500">Active</Badge>
                  {didInfo.off_chain_did.is_system_generated && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      <Crown className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {DID_TIER_NAMES[didInfo.off_chain_did.tier] || 'Normal'}
                  </Badge>
                </div>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold font-mono tracking-wider">
                    {didInfo.off_chain_did.display_id}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">DID Hash</Label>
                  <code className="block text-xs bg-muted p-2 rounded break-all">
                    {didInfo.off_chain_did.did_hash}
                  </code>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <span>
                    {didInfo.has_on_chain 
                      ? "Linked to your On-Chain DID" 
                      : "Connect a wallet to link with On-Chain DID"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-4 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="mb-4">Create your unique Display ID</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayId">Display ID</Label>
                  <div className="relative">
                    <Input
                      id="displayId"
                      value={displayId}
                      onChange={handleDisplayIdChange}
                      placeholder="HELLO123"
                      maxLength={32}
                      className="text-center text-xl font-mono tracking-wider"
                    />
                    {validating && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                    {validation && !validating && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validation.valid && validation.available ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </span>
                    )}
                  </div>
                  {/* Real-time status hints */}
                  {displayId.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Enter your desired Display ID (letters A-Z and digits 0-9)
                    </p>
                  )}
                  {isTooShort && (
                    <Alert className="border-red-200 bg-red-50 py-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700 text-xs">
                        <strong>Not Available:</strong> 1-3 character IDs are reserved and not yet open for registration. Please enter at least 4 characters.
                      </AlertDescription>
                    </Alert>
                  )}
                  {!isTooShort && displayId.length >= 4 && displayId.length < 5 && !isPremiumLength && (
                    <p className="text-xs text-muted-foreground">Checking availability...</p>
                  )}
                  {validation && !validation.valid && !isTooShort && (
                    <Alert className="border-red-200 bg-red-50 py-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700 text-xs">
                        <strong>Invalid:</strong> {validation.reason}
                      </AlertDescription>
                    </Alert>
                  )}
                  {validation && validation.valid && !validation.available && (
                    <Alert className="border-red-200 bg-red-50 py-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700 text-xs">
                        <strong>Unavailable:</strong> {validation.reason}
                      </AlertDescription>
                    </Alert>
                  )}
                  {validation?.valid && validation?.available && !isPremiumLength && displayId.length >= 5 && (
                    <Alert className="border-green-200 bg-green-50 py-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 text-xs">
                        <strong>Available for Free Registration!</strong> This Display ID can be registered immediately at no cost.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {isPremiumLength && validation?.valid && validation?.available && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <Crown className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Premium ID - Auction Required</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      {displayId.length === 4 ? (
                        <><strong>4-character IDs</strong> are premium and require an auction to acquire.</>
                      ) : isRepeatingPattern(displayId) ? (
                        <><strong>Repeating pattern IDs</strong> (like "{displayId}") are premium and require an auction.</>
                      ) : null}
                      <div className="mt-2 p-2 bg-amber-100 rounded text-sm">
                        <div className="flex justify-between">
                          <span>Starting Price:</span>
                          <span className="font-bold">{getAuctionPrice(displayId.length, isRepeatingPattern(displayId))} USD1</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span className="font-semibold">30 minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Winner:</span>
                          <span>Highest bidder</span>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Display ID Registration Rules
                  </h4>
                  <div className="space-y-2">
                    <div className="text-xs">
                      <p className="font-medium text-foreground mb-1">Allowed Characters:</p>
                      <p className="text-muted-foreground">Uppercase letters (A-Z) and digits (0-9) only</p>
                    </div>
                    <div className="text-xs">
                      <p className="font-medium text-foreground mb-1">Registration Types:</p>
                      <div className="grid gap-1 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          <span><strong>5+ characters:</strong> Free instant registration</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span><strong>4 characters:</strong> Auction required (10 USD1 starting price)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span><strong>Repeating patterns</strong> (11111, AAAAA): Auction required (10 USD1)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span><strong>1-3 characters:</strong> Not yet available (coming soon)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                {isPremiumLength ? (
                  <div className="space-y-2">
                    {hasExistingAuction ? (
                      <Alert className="border-blue-200 bg-blue-50">
                        <Gavel className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-700">
                          This Display ID already has an active auction.{' '}
                          <a href={`/dashboard/did/market?id=${displayId}`} className="underline">
                            View auction
                          </a>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Button
                        onClick={handleCreateAuction}
                        disabled={!validation?.valid || !validation?.available || auctionCreating || isAuctionPending || isAuctionConfirming || !isConnected || !hasContractOnChainDID}
                        className="w-full bg-amber-600 hover:bg-amber-700"
                      >
                        {isAuctionPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirm in Wallet...
                          </>
                        ) : isAuctionConfirming ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Auction...
                          </>
                        ) : (
                          <>
                            <Gavel className="mr-2 h-4 w-4" />
                            Start Auction ({getAuctionPrice(displayId.length, isRepeatingPattern(displayId))} USD1)
                          </>
                        )}
                      </Button>
                    )}
                    {auctionTxHash && (
                      <p className="text-xs text-center text-muted-foreground">
                        Tx: <a href={`https://bscscan.com/tx/${auctionTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          {auctionTxHash.slice(0, 10)}...{auctionTxHash.slice(-8)}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </p>
                    )}
                    {!isConnected && (
                      <p className="text-xs text-center text-amber-600">
                        Connect your wallet to start an auction
                      </p>
                    )}
                    {isConnected && !hasContractOnChainDID && (
                      <p className="text-xs text-center text-amber-600">
                        You need to register an on-chain Human DID first (see below)
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={handleRegister}
                    disabled={!validation?.valid || !validation?.available || registering}
                    className="w-full"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      'Register Display ID (Free)'
                    )}
                  </Button>
                )}

                <p className="text-xs text-center text-muted-foreground">
                  Want to browse existing auctions?{' '}
                  <a href="/dashboard/did/market" className="text-primary hover:underline">
                    View Auction Market
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DID Features */}
      <Card>
        <CardHeader>
          <CardTitle>Understanding the Dual DID System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                On-Chain DID
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Permanently bound to your wallet address</li>
                <li>• Cannot be transferred to another wallet</li>
                <li>• Serves as proof of asset ownership</li>
                <li>• Created automatically when you register</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-green-500" />
                Display ID (Off-Chain)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Your social identity across the platform</li>
                <li>• Can be transferred to other users</li>
                <li>• Alphanumeric format (e.g., HELLO123, JOHN)</li>
                <li>• Short IDs (1-4 chars) available via auction</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
