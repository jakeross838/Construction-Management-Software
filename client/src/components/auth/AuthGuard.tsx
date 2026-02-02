import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard component that protects routes requiring authentication.
 * Redirects to login if not authenticated, preserving the intended destination.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { session, isLoading, isInitialized } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Authenticated - render children
  return <>{children}</>;
}

/**
 * PublicOnlyGuard component for routes that should only be accessible when NOT authenticated.
 * Redirects to dashboard if already authenticated.
 */
export function PublicOnlyGuard({ children }: AuthGuardProps) {
  const { session, isLoading, isInitialized } = useAuth();

  // Show loading state while checking auth
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Already authenticated - redirect to dashboard
  if (session) {
    return <Navigate to="/" replace />;
  }

  // Not authenticated - render children (login/signup pages)
  return <>{children}</>;
}

export default AuthGuard;
