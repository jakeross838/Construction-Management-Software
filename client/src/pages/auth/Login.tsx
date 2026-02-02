import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Mail, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, resendConfirmation, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Get redirect URL from location state or default to dashboard
  const from = (location.state as { from?: string })?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    setResendSuccess(false);

    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (signInError.message.includes('Email not confirmed')) {
        setNeedsConfirmation(true);
        setError('Please confirm your email address before signing in. Check your inbox for a confirmation link.');
      } else {
        setError(signInError.message);
      }
      return;
    }

    // Successful login - redirect
    navigate(from, { replace: true });
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setIsResending(true);
    setError(null);

    const { error: resendError } = await resendConfirmation(email);

    if (resendError) {
      setError(resendError.message);
    } else {
      setResendSuccess(true);
      setNeedsConfirmation(false);
    }

    setIsResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold text-foreground">Ross Built</span>
          </div>
          <p className="text-muted-foreground">Construction Management Platform</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {resendSuccess && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Confirmation email sent! Please check your inbox and click the confirmation link.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                    {needsConfirmation && (
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto ml-2 text-red-200 underline"
                        onClick={handleResendConfirmation}
                        disabled={isResending}
                      >
                        {isResending ? 'Sending...' : 'Resend confirmation email'}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By signing in, you agree to our{' '}
          <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
