'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show anything until mounted (SSR)
  if (!mounted) {
    return <>{children}</>;
  }

  // If not connected, just show children
  if (!isConnected) {
    return <>{children}</>;
  }

  // If on wrong network, show switch prompt
  if (chainId !== bsc.id) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="mx-4 max-w-md rounded-lg border bg-card p-6 shadow-lg">
          <div className="flex items-center gap-3 text-yellow-600">
            <AlertTriangle className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Wrong Network</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            ClawPay is deployed on <strong>BSC Mainnet</strong>. Please switch your wallet to the correct network.
          </p>
          <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current:</span>
              <span className="text-red-500">Chain ID {chainId}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Required:</span>
              <span className="text-green-600">BSC Mainnet ({bsc.id})</span>
            </div>
          </div>
          <Button 
            className="mt-4 w-full" 
            onClick={() => switchChain({ chainId: bsc.id })}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Switching...
              </>
            ) : (
              'Switch to BSC Mainnet'
            )}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            If the switch fails, please manually change the network in your wallet.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
