'use client';

import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { Wallet, Loader2, Mail, Fingerprint, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmailAuth } from './EmailAuth';

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

type AuthView = 'main' | 'email';

export function ConnectWallet() {
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { setAuth, isAuthenticated } = useAppStore();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('main');

  // Get invite code from URL params (ref=XXXXXXXX)
  const inviteCode = searchParams.get('ref') || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (address && !isAuthenticated && !isLoading && mounted && authView === 'main') {
      handleLogin();
    }
  }, [address, isAuthenticated, isLoading, mounted, authView]);

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
        invite_code: inviteCode || undefined,
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

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    
    try {
      const { url } = await authApi.getGoogleAuthURL();
      // Open Google OAuth in a popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        url,
        'Google Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // Listen for the OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          const { code } = event.data;
          try {
            const { token, user } = await authApi.googleLogin(code);
            setAuth(token, user);
          } catch (err: any) {
            setError(err.message || 'Failed to login with Google');
          }
          popup?.close();
          window.removeEventListener('message', handleMessage);
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Poll for popup close
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setIsGoogleLoading(false);
          window.removeEventListener('message', handleMessage);
        }
      }, 500);
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || 'Failed to start Google login');
      setIsGoogleLoading(false);
    }
  };

  if (address && isAuthenticated) {
    return null;
  }

  if (!mounted) {
    return (
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-12">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-xl animate-pulse" />
              <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (authView === 'email') {
    return <EmailAuth onBack={() => setAuthView('main')} inviteCode={inviteCode} />;
  }

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/80 backdrop-blur-xl relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
      
      <CardHeader className="text-center relative">
        <div className="mx-auto mb-4 relative">
          <div className="absolute inset-0 bg-primary/30 blur-xl animate-pulse" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
            <Fingerprint className="h-8 w-8 text-background" />
          </div>
        </div>
        <CardTitle className="text-2xl gradient-text">{t('welcomeTitle')}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {t('welcomeDesc')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4 relative">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {address ? (
          <Button
            variant="glow"
            className="w-full h-12"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('signingIn')}
              </>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                {t('signInWallet')} ({address.slice(0, 6)}...{address.slice(-4)})
              </>
            )}
          </Button>
        ) : (
          <>
            <div className="space-y-3">
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  variant="outline"
                  className="w-full h-12 border-primary/30 hover:border-primary/60 hover:bg-primary/5"
                  onClick={() => handleConnect(connector)}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 h-5 w-5 text-primary" />
                  )}
                  {connector.name}
                </Button>
              ))}
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card/80 px-3 text-muted-foreground">{t('orContinue')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 border-border/50 hover:border-primary/30 hover:bg-muted/50"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {t('continueGoogle')}
              </Button>

              <Button
                variant="outline"
                className="w-full h-12 border-border/50 hover:border-primary/30"
                onClick={() => setAuthView('email')}
              >
                <Mail className="mr-2 h-5 w-5" />
                {t('continueEmail')}
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2">
          {t('walletFullAccess')}
        </p>
      </CardContent>
    </Card>
  );
}
