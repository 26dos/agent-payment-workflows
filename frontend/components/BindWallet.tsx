'use client';

import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAppStore } from '@/lib/store';
import { walletApi } from '@/lib/api';
import { Wallet, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface BindWalletProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showAsModal?: boolean;
}

export function BindWallet({ onSuccess, onCancel, showAsModal = false }: BindWalletProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { user, setUser, hasWallet, isEmailUser } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = async (connector: any) => {
    setIsConnecting(true);
    setError(null);
    try {
      await connect({ connector });
    } catch (err: any) {
      console.error('Connect error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBind = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const { message } = await walletApi.getBindNonce(address);
      const signature = await signMessageAsync({ message });
      const { user: updatedUser } = await walletApi.bindWallet({
        wallet_address: address,
        message,
        signature,
      });
      
      setUser(updatedUser);
      setSuccess(true);
      
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      console.error('Bind error:', err);
      setError(err.message || 'Failed to bind wallet');
      disconnect();
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  // Already has wallet
  if (hasWallet()) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Wallet Connected</AlertTitle>
        <AlertDescription>
          Your account is connected to wallet {user?.wallet_address?.slice(0, 6)}...{user?.wallet_address?.slice(-4)}
        </AlertDescription>
      </Alert>
    );
  }

  // Not an email user
  if (!isEmailUser()) {
    return null;
  }

  const content = (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Wallet Bound Successfully!</AlertTitle>
          <AlertDescription>
            You can now perform business operations like creating tasks and transactions.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {address ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Connected Wallet</p>
                <p className="font-mono text-sm">{address}</p>
              </div>
              <Button
                className="w-full"
                onClick={handleBind}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Binding wallet...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Bind This Wallet
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => disconnect()}
                disabled={isLoading}
              >
                Choose Different Wallet
              </Button>
            </div>
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
        </>
      )}
    </>
  );

  if (showAsModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md relative">
          {onCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={onCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Wallet className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              Connect a wallet to enable business operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {content}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connect Wallet
        </CardTitle>
        <CardDescription>
          Connect a wallet to enable tasks, transactions, and other business operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {content}
      </CardContent>
    </Card>
  );
}

export function RequireWallet({ children }: { children: React.ReactNode }) {
  const { hasWallet, isEmailUser, isAuthenticated } = useAppStore();
  const [showBindModal, setShowBindModal] = useState(false);

  if (!isAuthenticated) {
    return null;
  }

  if (isEmailUser() && !hasWallet()) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Wallet Required</AlertTitle>
          <AlertDescription>
            You need to connect a wallet to perform this operation.
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={() => setShowBindModal(true)}
            >
              Connect now
            </Button>
          </AlertDescription>
        </Alert>
        {showBindModal && (
          <BindWallet
            showAsModal
            onSuccess={() => setShowBindModal(false)}
            onCancel={() => setShowBindModal(false)}
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
}
