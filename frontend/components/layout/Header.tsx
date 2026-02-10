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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">ClawPay Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* USD1 Balance */}
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
          <span className="text-sm text-muted-foreground">Balance:</span>
          <span className="font-medium">
            {mounted && balance ? formatUSD1(Number(balance.formatted)) : '0.00'} USD1
          </span>
        </div>

        {/* Reputation Score */}
        {mounted && user && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Score:</span>
            <Badge variant={user.human_score >= 75 ? 'success' : 'warning'}>
              {user.human_score}
            </Badge>
          </div>
        )}

        {/* Wallet Address */}
        {mounted && address && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium">{formatAddress(address)}</span>
          </div>
        )}
      </div>
    </header>
  );
}
