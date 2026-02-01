import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertCircle,
  RefreshCw,
  Loader2,
  WifiOff,
  ServerCrash,
  ShieldAlert,
  FileX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseError, isRetryableError } from '@/lib/error-messages';

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void | Promise<void>;
  className?: string;
  variant?: 'inline' | 'card' | 'alert' | 'minimal';
  showDetails?: boolean;
}

const errorIcons: Record<string, React.ReactNode> = {
  'Connection Error': <WifiOff className="h-5 w-5" />,
  'Server Error': <ServerCrash className="h-5 w-5" />,
  'Access Denied': <ShieldAlert className="h-5 w-5" />,
  'Not Found': <FileX className="h-5 w-5" />,
};

export function ErrorDisplay({
  error,
  onRetry,
  className,
  variant = 'alert',
  showDetails = false,
}: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);

  const parsedError = parseError(error);
  const canRetry = onRetry && (parsedError.retryable ?? isRetryableError(error));
  const icon = errorIcons[parsedError.title] || <AlertCircle className="h-5 w-5" />;

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  // Get raw error details for debugging
  const errorDetails = error instanceof Error ? error.stack || error.message : String(error);

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2 text-destructive text-sm', className)}>
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>{parsedError.message}</span>
        {canRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="h-6 px-2"
          >
            {isRetrying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive',
          className
        )}
      >
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{parsedError.title}</p>
          <p className="text-sm mt-1 opacity-90">{parsedError.message}</p>
          {parsedError.action && (
            <p className="text-sm mt-1 opacity-75">{parsedError.action}</p>
          )}
        </div>
        {canRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-shrink-0"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-4">
              {icon}
            </div>
            <h3 className="font-semibold text-lg">{parsedError.title}</h3>
            <p className="text-muted-foreground mt-2 max-w-md">{parsedError.message}</p>
            {parsedError.action && (
              <p className="text-sm text-muted-foreground mt-2">{parsedError.action}</p>
            )}
            {canRetry && (
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="mt-4"
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Try Again
              </Button>
            )}
            {showDetails && errorDetails && (
              <div className="mt-4 w-full">
                <button
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showFullDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  Technical Details
                </button>
                {showFullDetails && (
                  <pre className="mt-2 p-2 rounded bg-muted text-xs text-left overflow-auto max-h-40">
                    {errorDetails}
                  </pre>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: alert variant
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{parsedError.title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <p>{parsedError.message}</p>
          {parsedError.action && (
            <p className="text-sm opacity-75">{parsedError.action}</p>
          )}
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="mt-2"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Retry
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Full page error display
 */
interface PageErrorProps {
  error: unknown;
  onRetry?: () => void | Promise<void>;
  onGoBack?: () => void;
}

export function PageError({ error, onRetry, onGoBack }: PageErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const parsedError = parseError(error);
  const canRetry = onRetry && (parsedError.retryable ?? isRetryableError(error));

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-6">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">{parsedError.title}</h1>
        <p className="text-muted-foreground mb-4">{parsedError.message}</p>
        {parsedError.action && (
          <p className="text-sm text-muted-foreground mb-6">{parsedError.action}</p>
        )}
        <div className="flex justify-center gap-3">
          {onGoBack && (
            <Button variant="outline" onClick={onGoBack}>
              Go Back
            </Button>
          )}
          {canRetry && (
            <Button onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state with optional error
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {icon && (
        <div className="mb-4 text-muted-foreground opacity-50">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
