import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Home, AlertCircle, Mail } from 'lucide-react';
import { useValidateMagicLink, PortalSession } from '@/hooks/useClientPortal';

const PortalLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateMagicLink = useValidateMagicLink();

  // If token is present, validate it
  useEffect(() => {
    if (token) {
      validateMagicLink.mutate(token, {
        onSuccess: (session: PortalSession) => {
          // Store session in localStorage
          localStorage.setItem('portal_session', JSON.stringify(session));
          // Redirect to portal dashboard
          navigate('/portal/dashboard');
        },
        onError: (err) => {
          setError((err as Error).message || 'Invalid or expired link');
        },
      });
    }
  }, [token]);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      const response = await fetch('/api/client-portal/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send login link');
      }

      setRequestSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Validating token state
  if (token && validateMagicLink.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Verifying your access...</p>
              <p className="text-sm text-muted-foreground">Please wait while we log you in</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Access Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                setError(null);
                navigate('/portal/login');
              }}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success - link sent
  if (requestSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We've sent a login link to <strong>{email}</strong>. Click the link in the email to access your project portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              The link will expire in 24 hours. If you don't see the email, check your spam folder.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setRequestSent(false);
                setEmail('');
              }}
            >
              Use a different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default - login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Home className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Client Portal</CardTitle>
          <CardDescription>
            Enter your email to receive a secure login link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequestAccess} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Send Login Link
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            You'll receive an email with a secure link to access your project dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalLogin;
