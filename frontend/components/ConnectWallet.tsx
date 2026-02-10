'use client';

import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { Wallet, Loader2 } from 'lucide-react';

export function ConnectWallet() {
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { setAuth, isAuthenticated } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-login when wallet connected
  useEffect(() => {
    if (address && !isAuthenticated && !isLoading && mounted) {
      handleLogin();
    }
  }, [address, isAuthenticated, isLoading, mounted]);

  const handleConnect = async (connector: any) => {
    setIsConnecting(true);
    setError(null);
    try {
      await connect({ connector });
    } catch (err: any) {
      console.error('Connect error:', err);
      setError(err.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogin = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const { message } = await authApi.getNonce(address);
      const signature = await signMessageAsync({ message });
      const { token, user } = await authApi.login({
        wallet_address: address,
        message,
        signature,
      });
      setAuth(token, user);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      disconnect();
    } finally {
      setIsLoading(false);
    }
  };

  if (address && isAuthenticated) {
    return null;
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Wallet className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Welcome to ClawPay</CardTitle>
          <CardDescription>
            Connect your wallet to access the Agentic Settlement Protocol
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {address ? (
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Sign in ({address.slice(0, 6)}...{address.slice(-4)})
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  variant="outline"
                  className="w-full"
                  onClick={() => handleConnect(connector)}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 h-4 w-4" />
                  )}
                  {connector.name}
                </Button>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            By connecting, you agree to sign a message to verify your wallet ownership.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
