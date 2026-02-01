import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationResult } from '@/lib/validation';

interface ValidationAlertProps {
  result: ValidationResult | null | undefined;
  className?: string;
  showSuccess?: boolean;
}

export function ValidationAlert({
  result,
  className,
  showSuccess = false,
}: ValidationAlertProps) {
  if (!result) return null;

  if (!result.valid && result.error) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm',
          className
        )}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{result.error}</span>
      </div>
    );
  }

  if (result.warning) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm',
          className
        )}
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{result.warning}</span>
      </div>
    );
  }

  if (showSuccess && result.valid) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm',
          className
        )}
      >
        <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>Validation passed</span>
      </div>
    );
  }

  return null;
}

/**
 * Inline validation indicator for form fields
 */
interface FieldValidationProps {
  result: ValidationResult | null | undefined;
  className?: string;
}

export function FieldValidation({ result, className }: FieldValidationProps) {
  if (!result) return null;

  if (!result.valid && result.error) {
    return (
      <p className={cn('text-sm text-destructive mt-1', className)}>
        {result.error}
      </p>
    );
  }

  if (result.warning) {
    return (
      <p className={cn('text-sm text-amber-600 dark:text-amber-400 mt-1', className)}>
        {result.warning}
      </p>
    );
  }

  return null;
}
