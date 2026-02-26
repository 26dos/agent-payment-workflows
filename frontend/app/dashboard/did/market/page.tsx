'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Crown, Clock, TrendingUp, Gavel, DollarSign, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { auctionApi, PremiumDIDAuction, PremiumDIDStats, OffChainDID } from '@/lib/api';
import { DID_TIER_NAMES, AUCTION_TYPE_NAMES, AUCTION_STATUS_NAMES } from '@/lib/config';
import Link from 'next/link';

function TierBadge({ tier }: { tier: number }) {
  const tierColors: Record<number, string> = {
    5: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
    4: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    3: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    2: 'bg-green-500 text-white',
    1: 'bg-gray-500 text-white',
    0: 'bg-gray-300 text-gray-800',
  };

  return (
    <Badge className={tierColors[tier] || 'bg-gray-300'}>
      {DID_TIER_NAMES[tier] || 'Unknown'}
    </Badge>
  );
}

function AuctionTypeBadge({ type }: { type: number }) {
  const typeColors: Record<number, string> = {
    0: 'border-orange-500 text-orange-600',
    1: 'border-blue-500 text-blue-600',
    2: 'border-green-500 text-green-600',
  };

  return (
    <Badge variant="outline" className={typeColors[type]}>
      {AUCTION_TYPE_NAMES[type] || 'Unknown'}
    </Badge>
  );
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
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

  return (
    <span className={timeLeft === 'Ended' ? 'text-red-500' : 'text-orange-500'}>
      {timeLeft}
    </span>
  );
}

function StatusBadge({ status }: { status: number }) {
  const statusColors: Record<number, string> = {
    1: 'bg-green-500 text-white',
    2: 'bg-gray-500 text-white',
    3: 'bg-yellow-500 text-white',
    4: 'bg-blue-500 text-white',
  };

  return (
    <Badge className={statusColors[status] || 'bg-gray-300'}>
      {AUCTION_STATUS_NAMES[status] || 'Unknown'}
    </Badge>
  );
}

function AuctionCard({ auction }: { auction: PremiumDIDAuction }) {
  const isSold = auction.status === 4;
  const isEnded = new Date(auction.end_time).getTime() < Date.now();
  
  return (
    <Card className={`hover:shadow-lg transition-shadow ${isSold ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <TierBadge tier={auction.tier} />
          <div className="flex gap-1">
            {isSold && <StatusBadge status={auction.status} />}
            <AuctionTypeBadge type={auction.auction_type} />
          </div>
        </div>
        <CardTitle className="text-2xl font-mono tracking-wider text-center mt-4">
          {auction.display_id}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{isSold ? 'Final Price' : 'Current Price'}</span>
          <span className="font-bold text-lg">
            ${(isSold && auction.final_price ? auction.final_price : auction.current_price).toLocaleString()}
          </span>
        </div>

        {auction.auction_type === 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bids</span>
            <span className="font-semibold">{auction.bid_count}</span>
          </div>
        )}

        {isSold ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Winner</span>
            <span className="font-mono text-xs">
              {auction.winner_wallet ? `${auction.winner_wallet.slice(0, 6)}...${auction.winner_wallet.slice(-4)}` : '-'}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Time Left
            </span>
            <CountdownTimer endTime={auction.end_time} />
          </div>
        )}

        <Link href={`/dashboard/did/market/${auction.id}`}>
          <Button className="w-full mt-2" variant={isSold ? 'outline' : 'default'}>
            {isSold ? 'View Details' : (auction.auction_type === 0 ? 'Place Bid' : auction.auction_type === 1 ? 'Buy Now' : 'Purchase')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function PremiumDIDCard({ did }: { did: OffChainDID }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <TierBadge tier={did.tier} />
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        </div>
        <CardTitle className="text-2xl font-mono tracking-wider text-center mt-4">
          {did.display_id}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-center text-muted-foreground mb-4">
          Available for auction
        </p>
        <Button variant="outline" className="w-full" disabled>
          Coming Soon
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DIDMarketPage() {
  const { isConnected } = useAccount();
  const [stats, setStats] = useState<PremiumDIDStats | null>(null);
  const [auctions, setAuctions] = useState<PremiumDIDAuction[]>([]);
  const [premiumDIDs, setPremiumDIDs] = useState<OffChainDID[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tierFilter, setTierFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [page, tierFilter, typeFilter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [statsData, auctionsData, premiumData] = await Promise.all([
        auctionApi.getStats(),
        auctionApi.getActiveAuctions(page, 12, tierFilter || undefined, typeFilter || undefined, statusFilter || undefined),
        auctionApi.getAvailablePremiumDIDs(1, 8, tierFilter || undefined),
      ]);

      setStats(statsData);
      setAuctions(auctionsData.auctions || []);
      setTotalPages(auctionsData.total_pages || 1);
      setPremiumDIDs(premiumData.dids || []);
    } catch (err) {
      console.error('Failed to load market data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Please connect your wallet to access the premium DID market.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="h-8 w-8 text-yellow-500" />
            Premium DID Market
          </h1>
          <p className="text-muted-foreground">Discover and acquire exclusive premium DIDs</p>
        </div>
        <Link href="/dashboard/did">
          <Button variant="outline">My DID</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Premium DIDs</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_premium_dids}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Auctions</CardTitle>
              <Gavel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_auctions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.available_premium_dids}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.total_auction_volume.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Auctions</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="sold">Sold Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Tiers</SelectItem>
            <SelectItem value="5">SSS</SelectItem>
            <SelectItem value="4">SS</SelectItem>
            <SelectItem value="3">S</SelectItem>
            <SelectItem value="2">A</SelectItem>
            <SelectItem value="1">B</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="0">English Auction</SelectItem>
            <SelectItem value="1">Dutch Auction</SelectItem>
            <SelectItem value="2">Fixed Price</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="auctions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="auctions">Auctions</TabsTrigger>
          <TabsTrigger value="available">Available DIDs</TabsTrigger>
        </TabsList>

        <TabsContent value="auctions" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : auctions.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {auctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No auctions found</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : premiumDIDs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {premiumDIDs.map((did) => (
                <PremiumDIDCard key={did.id} did={did} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Crown className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No premium DIDs available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Tier Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Premium DID Tiers</CardTitle>
          <CardDescription>Rarity levels and their characteristics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <TierBadge tier={5} />
              <p className="text-sm font-semibold">SSS - Ultra Rare</p>
              <p className="text-xs text-muted-foreground">Pure 4-digit numbers, repeating patterns</p>
            </div>
            <div className="space-y-2">
              <TierBadge tier={4} />
              <p className="text-sm font-semibold">SS - Super Rare</p>
              <p className="text-xs text-muted-foreground">Sequential numbers/letters (1234-ABCD)</p>
            </div>
            <div className="space-y-2">
              <TierBadge tier={3} />
              <p className="text-sm font-semibold">S - Rare</p>
              <p className="text-xs text-muted-foreground">Low digits (0001-1999) + special words</p>
            </div>
            <div className="space-y-2">
              <TierBadge tier={2} />
              <p className="text-sm font-semibold">A - Premium</p>
              <p className="text-xs text-muted-foreground">Meaningful English words</p>
            </div>
            <div className="space-y-2">
              <TierBadge tier={1} />
              <p className="text-sm font-semibold">B - Collector</p>
              <p className="text-xs text-muted-foreground">Symmetric/mirror patterns</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
