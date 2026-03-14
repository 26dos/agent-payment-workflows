'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Google login...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Google login was cancelled or failed');
      return;
    }

    if (code) {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_SUCCESS', code },
          window.location.origin
        );
        setStatus('success');
        setMessage('Login successful! This window will close...');
        setTimeout(() => window.close(), 1500);
      } else {
        setStatus('error');
        setMessage('Unable to complete login. Please close this window and try again.');
      }
    } else {
      setStatus('error');
      setMessage('No authorization code received');
    }
  }, [searchParams]);

  return (
    <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
      <CardContent className="py-12 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-xl animate-pulse" />
              <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">{message}</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/30 blur-xl" />
              <CheckCircle className="relative h-12 w-12 text-green-500" />
            </div>
            <p className="text-green-600 font-medium">{message}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/30 blur-xl" />
              <XCircle className="relative h-12 w-12 text-red-500" />
            </div>
            <p className="text-red-600 font-medium">{message}</p>
            <button
              onClick={() => window.close()}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Close this window
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingFallback() {
  return (
    <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
      <CardContent className="py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-xl animate-pulse" />
            <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={<LoadingFallback />}>
        <GoogleCallbackContent />
      </Suspense>
    </div>
  );
}
