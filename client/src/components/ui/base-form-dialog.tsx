import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_MAX_HEIGHT, type DialogSize } from './dialog-sizes';

export interface BaseFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Dialog size tier */
  size?: DialogSize;
  /** Form submit handler */
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  /** Text for submit button */
  submitLabel?: string;
  /** Text for cancel button */
  cancelLabel?: string;
  /** Whether form is currently submitting */
  isSubmitting?: boolean;
  /** Whether submit button is disabled (besides isSubmitting) */
  submitDisabled?: boolean;
  /** Form content */
  children: React.ReactNode;
  /** Optional className for DialogContent */
  className?: string;
  /** Whether content should scroll (default: true for form+ sizes) */
  scrollable?: boolean;
  /** Optional footer content to render between Cancel and Submit */
  footerContent?: React.ReactNode;
}

/**
 * BaseFormDialog - Standardized wrapper for form dialogs
 *
 * Features:
 * - Consistent sizing via size prop
 * - Standard header with title/description
 * - Standard footer with Cancel (left) and Submit (right)
 * - Auto-scroll for larger content
 * - Loading state support
 *
 * @example
 * ```tsx
 * <BaseFormDialog
 *   open={open}
 *   onOpenChange={onOpenChange}
 *   title="Create Vendor"
 *   description="Add a new vendor to the system"
 *   size="form"
 *   onSubmit={handleSubmit}
 *   submitLabel="Create"
 *   isSubmitting={isPending}
 * >
 *   <div className="space-y-4">
 *     <Input ... />
 *   </div>
 * </BaseFormDialog>
 * ```
 */
export function BaseFormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'form',
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  submitDisabled = false,
  children,
  className,
  scrollable,
  footerContent,
}: BaseFormDialogProps) {
  // Default scrollable to true for larger dialogs
  const shouldScroll = scrollable ?? (size !== 'sm' && size !== 'md');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(e);
  };

  const content = (
    <div className={cn('space-y-4', !shouldScroll && 'py-4')}>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          DIALOG_SIZES[size],
          DIALOG_MAX_HEIGHT,
          'flex flex-col',
          className
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {shouldScroll ? (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="py-4">
                {content}
              </div>
            </ScrollArea>
          ) : (
            content
          )}

          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
            {footerContent}
            <Button
              type="submit"
              disabled={isSubmitting || submitDisabled}
            >
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
