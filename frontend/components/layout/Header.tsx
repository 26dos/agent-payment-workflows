'use client';

import { useAccount, useBalance } from 'wagmi';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { formatAddress, formatUSD1 } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { CONTRACT_ADDRESSES } from '@/lib/config';
import { Wallet, Activity, Zap } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Header() {
  const { address } = useAccount();
  const { user } = useAppStore();
  const { data: balance } = useBalance({
    address,
    token: CONTRACT_ADDRESSES.USD1 as `0x${string}`,
  });
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-card/50 backdrop-blur-xl px-4 lg:px-6">
      {/* Left side - title with space for mobile menu button */}
      <div className="flex items-center gap-4 pl-12 lg:pl-0">
        <h1 className="text-base lg:text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary hidden sm:block" />
          <span className="gradient-text">{t('sidebar.dashboard')}</span>
        </h1>
      </div>

      {/* Right side - wallet info */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* USD1 Balance */}
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border/50 px-3 lg:px-4 py-2">
          <Zap className="h-4 w-4 text-primary hidden sm:block" />
          <span className="text-sm lg:text-base font-mono font-medium text-foreground">
            {mounted && balance ? formatUSD1(Number(balance.formatted)) : '0.00'}
          </span>
          <span className="text-xs text-muted-foreground font-medium">USD1</span>
        </div>

        {/* Reputation Score */}
        {mounted && user && (
          <div className="hidden md:flex items-center gap-2 rounded-xl bg-muted/50 border border-border/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Score</span>
            <Badge 
              variant={user.human_score >= 75 ? 'default' : 'secondary'}
              className={user.human_score >= 75 
                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
              }
            >
              {user.human_score}
            </Badge>
          </div>
        )}

        {/* Wallet Address */}
        {mounted && address && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 lg:px-4 py-2">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/50 blur-sm animate-pulse" />
              <div className="relative h-2 w-2 rounded-full bg-green-500" />
            </div>
            <Wallet className="h-4 w-4 text-primary hidden sm:block" />
            <span className="text-xs lg:text-sm font-mono font-medium text-foreground">{formatAddress(address)}</span>
          </div>
        )}

        {/* Language Switcher */}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
