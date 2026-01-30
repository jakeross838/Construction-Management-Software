/**
 * AI Upload Button
 *
 * A wrapper around UnifiedAIUpload that can be placed anywhere in the app.
 * Automatically detects context from current page.
 */

import { UnifiedAIUpload, useUploadContext } from './UnifiedAIUpload';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface AIUploadButtonProps {
  /** Custom button text */
  label?: string;
  /** Whether to show text on mobile */
  showLabelOnMobile?: boolean;
  /** Optional job ID to associate uploads with */
  jobId?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom className */
  className?: string;
  /** Callback when upload completes */
  onComplete?: () => void;
}

export function AIUploadButton({
  label = 'AI Upload',
  showLabelOnMobile = false,
  jobId,
  variant = 'default',
  size = 'default',
  className,
  onComplete,
}: AIUploadButtonProps) {
  const contextHint = useUploadContext();

  return (
    <UnifiedAIUpload
      contextHint={contextHint}
      jobId={jobId}
      onComplete={onComplete}
      trigger={
        <Button
          variant={variant}
          size={size}
          className={className || "gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"}
        >
          <Sparkles className="h-4 w-4" />
          <span className={showLabelOnMobile ? '' : 'hidden sm:inline'}>{label}</span>
        </Button>
      }
    />
  );
}

// Re-export UnifiedAIUpload for direct use
export { UnifiedAIUpload, useUploadContext } from './UnifiedAIUpload';
