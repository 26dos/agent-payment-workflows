'use client';

import { useAccount, useBalance } from 'wagmi';
import { useState, useEffect } from 'react';
import { formatAddress, formatUSD1 } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { CONTRACT_ADDRESSES } from '@/lib/config';

export function Header() {
  const { address } = useAccount();
  const { user } = useAppStore();
  const { data: balance } = useBalance({
    address,
    token: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      {/* Left side - title with space for mobile menu button */}
      <div className="flex items-center gap-4 pl-12 lg:pl-0">
        <h1 className="text-base lg:text-lg font-semibold truncate">ClawID Dashboard</h1>
      </div>

      {/* Right side - wallet info */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* USD1 Balance - hide label on mobile */}
        <div className="flex items-center gap-1 lg:gap-2 rounded-lg bg-muted px-2 lg:px-3 py-1.5">
          <span className="hidden sm:inline text-sm text-muted-foreground">Balance:</span>
          <span className="text-sm lg:text-base font-medium">
            {mounted && balance ? formatUSD1(Number(balance.formatted)) : '0.00'}
          </span>
          <span className="text-xs text-muted-foreground">USD1</span>
        </div>

        {/* Reputation Score - hide on small screens */}
        {mounted && user && (
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Score:</span>
            <Badge variant={user.human_score >= 75 ? 'success' : 'warning'}>
              {user.human_score}
            </Badge>
          </div>
        )}

        {/* Wallet Address - shorter on mobile */}
        {mounted && address && (
          <div className="flex items-center gap-1 lg:gap-2 rounded-lg border px-2 lg:px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-xs lg:text-sm font-medium">{formatAddress(address)}</span>
          </div>
        )}
      </div>
    </header>
  );
}
