'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ConnectWallet } from '@/components/ConnectWallet';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [mounted, isAuthenticated, router]);

  return <ConnectWallet />;
}
