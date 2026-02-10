'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { useState, type ReactNode } from 'react';
import { wagmiConfig } from '@/lib/config';
import { NetworkGuard } from '@/components/NetworkGuard';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <NetworkGuard>{children}</NetworkGuard>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
