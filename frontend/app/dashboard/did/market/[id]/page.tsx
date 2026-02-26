'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, usePublicClient } from 'wagmi';
import { decodeEventLog } from 'viem';
import { PREMIUM_DID_AUCTION_ABI } from '@/lib/contracts/abis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, Crown, Clock, ArrowLeft, Gavel, TrendingDown, DollarSign, Users, CheckCircle, XCircle } from 'lucide-react';
import { auctionApi, PremiumDIDAuction, AuctionBid } from '@/lib/api';
import { DID_TIER_NAMES, AUCTION_TYPE_NAMES, AUCTION_STATUS_NAMES } from '@/lib/config';
import { usePlaceBid, usePurchaseDutch, usePurchaseFixedPrice, useTokenApproval, useTokenAllowance, useFinalizeShortDisplayIdAuction, useAuctionByDisplayId } from '@/lib/contracts/hooks';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import Link from 'next/link';

function CountdownTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Auction Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return <span>{timeLeft}</span>;
}

export default function AuctionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const auctionId = parseInt(params.id as string);

  const [auction, setAuction] = useState<PremiumDIDAuction | null>(null);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { placeBid, hash: bidHash, isPending: isBidPending, isSuccess: isBidSuccess } = usePlaceBid();
  const [lastBidAmount, setLastBidAmount] = useState<number>(0);
  const { purchaseDutch, isPending: isDutchPending, isSuccess: isDutchSuccess } = usePurchaseDutch();
  const { purchaseFixedPrice, isPending: isFixedPending, isSuccess: isFixedSuccess } = usePurchaseFixedPrice();
  const { finalizeAuction, hash: finalizeHash, isPending: isFinalizePending, isSuccess: isFinalizeSuccess, error: finalizeError } = useFinalizeShortDisplayIdAuction();
  
  // Get chain auction data for accurate endTime
  const [chainEndTime, setChainEndTime] = useState<number | null>(null);
  
  // Token approval
  const usd1Address = CONTRACT_ADDRESSES.USD1 as `0x${string}`;
  const auctionContractAddress = CONTRACT_ADDRESSES.PremiumDIDAuction as `0x${string}`;
  const { approve, isPending: isApprovePending, isSuccess: isApproveSuccess } = useTokenApproval(usd1Address);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
    usd1Address,
    address as `0x${string}`,
    auctionContractAddress
  );
  
  const hasEnoughAllowance = (amount: number) => {
    if (!allowance) return false;
    const amountWei = BigInt(Math.ceil(amount * 1e6));
    return BigInt(allowance.toString()) >= amountWei;
  };

  useEffect(() => {
    loadAuction();
  }, [auctionId]);

  useEffect(() => {
    const syncBidToBackend = async () => {
      if (isBidSuccess && bidHash && auction && lastBidAmount > 0 && publicClient) {
        try {
          // Get transaction receipt to extract newEndTime from BidPlaced event
          const receipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
          
          let newEndTime: number | undefined;
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: PREMIUM_DID_AUCTION_ABI,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === 'BidPlaced') {
                const args = decoded.args as { newEndTime: bigint };
                newEndTime = Number(args.newEndTime);
                console.log('Extracted newEndTime from BidPlaced:', newEndTime);
                break;
              }
            } catch {
              // Not the event we're looking for
            }
          }
          
          await auctionApi.recordBid(auction.id, lastBidAmount, bidHash, newEndTime);
          setSuccess('Bid placed successfully!');
          setLastBidAmount(0);
          
          // Update local chainEndTime if we got it
          if (newEndTime) {
            setChainEndTime(newEndTime * 1000);
          }
          
          loadAuction();
        } catch (err) {
          console.error('Failed to sync bid to backend:', err);
          setSuccess('Bid placed on-chain! Refreshing data...');
          loadAuction();
        }
      }
    };
    syncBidToBackend();
  }, [isBidSuccess, bidHash]);

  useEffect(() => {
    if (isDutchSuccess || isFixedSuccess) {
      setSuccess('Transaction successful!');
      loadAuction();
    }
  }, [isDutchSuccess, isFixedSuccess]);
  
  useEffect(() => {
    if (isApproveSuccess) {
      setSuccess('Approval successful! You can now place your bid.');
      refetchAllowance();
    }
  }, [isApproveSuccess]);

  // Handle finalize success
  useEffect(() => {
    const syncFinalizeToBackend = async () => {
      if (isFinalizeSuccess && finalizeHash && auction && publicClient) {
        try {
          // Get transaction receipt to extract AuctionEnded event
          const receipt = await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
          
          let winnerWallet = auction.highest_bidder || '';
          let finalPrice = auction.current_price;
          
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: PREMIUM_DID_AUCTION_ABI,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === 'AuctionEnded') {
                const args = decoded.args as { winner: string; finalPrice: bigint };
                winnerWallet = args.winner;
                finalPrice = Number(args.finalPrice) / 1e6;
                break;
              }
            } catch {
              // Not the event we're looking for
            }
          }
          
          await auctionApi.finalizeSync({
            auction_id: auction.id,
            winner_wallet: winnerWallet,
            final_price: finalPrice,
            display_id: auction.display_id,
            off_chain_did_hash: '', // Backend will calculate
            on_chain_did_hash: '', // Backend will get from DB
            tx_hash: finalizeHash,
          });
          
          setSuccess('Auction finalized! The DID has been assigned to the winner.');
          loadAuction();
        } catch (err) {
          console.error('Failed to sync finalization to backend:', err);
          setSuccess('Auction finalized on-chain! Refreshing...');
          loadAuction();
        }
      }
    };
    syncFinalizeToBackend();
  }, [isFinalizeSuccess, finalizeHash]);

  useEffect(() => {
    if (finalizeError) {
      setError(finalizeError.message || 'Failed to finalize auction');
    }
  }, [finalizeError]);

  // Fetch chain auction data for accurate endTime
  const { data: chainAuctionData } = useAuctionByDisplayId(auction?.display_id);
  
  useEffect(() => {
    if (chainAuctionData) {
      const [, auctionStruct] = chainAuctionData as [bigint, { endTime: bigint }];
      if (auctionStruct && auctionStruct.endTime) {
        setChainEndTime(Number(auctionStruct.endTime) * 1000);
      }
    }
  }, [chainAuctionData]);

  const loadAuction = async () => {
    try {
      setLoading(true);
      const [auctionData, bidsData] = await Promise.all([
        auctionApi.getAuction(auctionId),
        auctionApi.getAuctionBids(auctionId),
      ]);
      setAuction(auctionData);
      setBids(bidsData || []);
    } catch (err) {
      console.error('Failed to load auction:', err);
      setError('Failed to load auction details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    // Approve a large amount (1 million USD1) for convenience
    const approveAmount = BigInt(1000000 * 1e6);
    approve(auctionContractAddress, approveAmount);
  };

  const handlePlaceBid = async () => {
    if (!auction) return;
    
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    const minBid = auction.current_price > 0 
      ? auction.current_price + auction.min_increment 
      : auction.start_price;

    if (amount < minBid) {
      setError(`Minimum bid is $${minBid.toLocaleString()}`);
      return;
    }

    // Check allowance
    if (!hasEnoughAllowance(amount)) {
      setError('Please approve USD1 tokens first by clicking the "Approve USD1" button');
      return;
    }

    // Use chain_auction_id for contract calls, fall back to database id
    const chainAuctionId = auction.chain_auction_id || auctionId;

    try {
      setError(null);
      setLastBidAmount(amount);
      placeBid(chainAuctionId, BigInt(amount * 1e6));
    } catch (err: any) {
      setError(err.message || 'Failed to place bid');
      setLastBidAmount(0);
    }
  };

  const handleFinalize = () => {
    if (!auction) return;
    const chainAuctionId = auction.chain_auction_id || auctionId;
    try {
      setError(null);
      finalizeAuction(chainAuctionId);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize auction');
    }
  };

  const handlePurchaseDutch = () => {
    if (!auction) return;
    const chainAuctionId = auction.chain_auction_id || auctionId;
    try {
      setError(null);
      purchaseDutch(chainAuctionId);
    } catch (err: any) {
      setError(err.message || 'Failed to purchase');
    }
  };

  const handlePurchaseFixed = () => {
    if (!auction) return;
    const chainAuctionId = auction.chain_auction_id || auctionId;
    try {
      setError(null);
      purchaseFixedPrice(chainAuctionId);
    } catch (err: any) {
      setError(err.message || 'Failed to purchase');
    }
  };

  const getTierColor = (tier: number) => {
    const colors: Record<number, string> = {
      5: 'from-yellow-400 to-orange-500',
      4: 'from-purple-500 to-pink-500',
      3: 'from-blue-500 to-cyan-500',
      2: 'from-green-400 to-emerald-500',
      1: 'from-gray-400 to-gray-500',
    };
    return colors[tier] || 'from-gray-300 to-gray-400';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>Auction not found</AlertDescription>
        </Alert>
        <Link href="/dashboard/did/market">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Market
          </Button>
        </Link>
      </div>
    );
  }

  // Use chain endTime if available, otherwise use backend time
  const effectiveEndTime = chainEndTime || new Date(auction.end_time).getTime();
  const isEnded = effectiveEndTime <= Date.now();
  const isActive = auction.status === 1 && !isEnded;
  const isSold = auction.status === 4;
  const canFinalize = isEnded && auction.status === 1 && auction.bid_count > 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/did/market">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Auction Details</h1>
          <p className="text-muted-foreground">Premium DID #{auction.id}</p>
        </div>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* DID Display */}
          <Card className={`bg-gradient-to-br ${getTierColor(auction.tier)} text-white`}>
            <CardContent className="py-12 text-center">
              <Badge className="bg-white/20 text-white mb-4">
                {DID_TIER_NAMES[auction.tier]} Tier
              </Badge>
              <h2 className="text-5xl font-bold font-mono tracking-widest mb-4">
                {auction.display_id}
              </h2>
              <div className="flex items-center justify-center gap-2">
                <Crown className="h-5 w-5" />
                <span>Premium DID</span>
              </div>
            </CardContent>
          </Card>

          {/* Auction Info */}
          <Card>
            <CardHeader>
              <CardTitle>Auction Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Auction Type</Label>
                  <p className="font-semibold flex items-center gap-2">
                    {auction.auction_type === 0 && <Gavel className="h-4 w-4" />}
                    {auction.auction_type === 1 && <TrendingDown className="h-4 w-4" />}
                    {auction.auction_type === 2 && <DollarSign className="h-4 w-4" />}
                    {AUCTION_TYPE_NAMES[auction.auction_type]}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={isActive ? 'default' : 'secondary'}>
                    {isActive ? 'Active' : AUCTION_STATUS_NAMES[auction.status]}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Start Price</Label>
                  <p className="font-semibold">${auction.start_price.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Current Price</Label>
                  <p className="font-semibold text-lg">${auction.current_price.toLocaleString()}</p>
                </div>
                {auction.auction_type === 0 && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Min Increment</Label>
                      <p className="font-semibold">${auction.min_increment.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Total Bids</Label>
                      <p className="font-semibold flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {auction.bid_count}
                      </p>
                    </div>
                  </>
                )}
                {isSold ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Final Price</Label>
                      <p className="font-semibold text-lg text-green-600">
                        ${(auction.final_price || auction.current_price).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Winner</Label>
                      <p className="font-mono text-sm">
                        {auction.winner_wallet ? `${auction.winner_wallet.slice(0, 6)}...${auction.winner_wallet.slice(-4)}` : '-'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Time Remaining
                    </Label>
                    <p className="font-semibold text-lg text-orange-500">
                      <CountdownTimer endTime={chainEndTime ? new Date(chainEndTime).toISOString() : auction.end_time} />
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bid History (English Auction) */}
          {auction.auction_type === 0 && bids.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bid History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bids.map((bid, index) => (
                    <div
                      key={bid.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        index === 0 ? 'bg-green-50 border border-green-200' : 'bg-muted'
                      }`}
                    >
                      <div>
                        <p className="font-mono text-sm">
                          {bid.bidder_wallet.slice(0, 6)}...{bid.bidder_wallet.slice(-4)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(bid.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${bid.amount.toLocaleString()}</p>
                        {index === 0 && (
                          <Badge variant="outline" className="text-green-600">
                            Highest
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {auction.auction_type === 0 ? 'Place Bid' : 'Purchase'}
              </CardTitle>
              <CardDescription>
                {auction.auction_type === 0 
                  ? 'Enter your bid amount to participate'
                  : auction.auction_type === 1
                  ? 'Buy now at the current price'
                  : 'Purchase at the fixed price'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isConnected ? (
                <Alert>
                  <AlertDescription>Connect your wallet to participate</AlertDescription>
                </Alert>
              ) : canFinalize ? (
                // Auction ended with bids - show finalize button
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      Auction has ended! Winner: {auction.highest_bidder?.slice(0, 6)}...{auction.highest_bidder?.slice(-4)} with ${auction.current_price.toLocaleString()}
                    </AlertDescription>
                  </Alert>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    onClick={handleFinalize}
                    disabled={isFinalizePending}
                  >
                    {isFinalizePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Finalizing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Finalize Auction & Assign DID
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Anyone can finalize the auction. The DID will be assigned to the winner.
                  </p>
                </div>
              ) : !isActive ? (
                <Alert>
                  <AlertDescription>This auction has ended</AlertDescription>
                </Alert>
              ) : auction.auction_type === 0 ? (
                // English Auction - Bid
                <>
                  <div className="space-y-2">
                    <Label>Your Bid (USD)</Label>
                    <Input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`Min: $${(auction.current_price > 0 
                        ? auction.current_price + auction.min_increment 
                        : auction.start_price).toLocaleString()}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum bid: ${(auction.current_price > 0 
                        ? auction.current_price + auction.min_increment 
                        : auction.start_price).toLocaleString()}
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment (Full)</span>
                      <span className="font-medium">${parseFloat(bidAmount || '0').toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Full payment is required. If outbid, your payment will be automatically refunded.
                    </p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">USD1 Allowance</span>
                      <span className={allowance && BigInt(allowance.toString()) > 0n ? 'text-green-600' : 'text-amber-600'}>
                        {allowance ? `$${(Number(allowance) / 1e6).toLocaleString()}` : '$0'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Approval Button - show if allowance is insufficient */}
                  {(!allowance || !hasEnoughAllowance(parseFloat(bidAmount || '0') || auction.start_price)) && (
                    <Button 
                      className="w-full mb-2" 
                      variant="outline"
                      onClick={handleApprove}
                      disabled={isApprovePending}
                    >
                      {isApprovePending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Step 1: Approve USD1
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button 
                    className="w-full" 
                    onClick={handlePlaceBid}
                    disabled={isBidPending || !hasEnoughAllowance(parseFloat(bidAmount || '0') || auction.start_price)}
                  >
                    {isBidPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Gavel className="mr-2 h-4 w-4" />
                        {hasEnoughAllowance(parseFloat(bidAmount || '0') || auction.start_price) ? 'Place Bid' : 'Step 2: Place Bid'}
                      </>
                    )}
                  </Button>
                </>
              ) : auction.auction_type === 1 ? (
                // Dutch Auction - Buy Now
                <>
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">Current Price</p>
                    <p className="text-3xl font-bold">${auction.current_price.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Price decreases over time
                    </p>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handlePurchaseDutch}
                    disabled={isDutchPending}
                  >
                    {isDutchPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Buy Now
                      </>
                    )}
                  </Button>
                </>
              ) : (
                // Fixed Price
                <>
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">Price</p>
                    <p className="text-3xl font-bold">${auction.start_price.toLocaleString()}</p>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handlePurchaseFixed}
                    disabled={isFixedPending}
                  >
                    {isFixedPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Purchase
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Accepted: USD1, USDT, USDC</p>
              <p>• Platform fee: 5% (transfer)</p>
              <p>• Deposits are refundable if outbid</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
