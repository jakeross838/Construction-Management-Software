import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_MAX_HEIGHT, type DialogSize } from './dialog-sizes';

export interface BaseDetailDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: React.ReactNode;
  /** Dialog size tier */
  size?: DialogSize;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Content to render in header row (e.g., badges) */
  headerContent?: React.ReactNode;
  /** Actions to render in header row (e.g., buttons) */
  headerActions?: React.ReactNode;
  /** Main scrollable content */
  children: React.ReactNode;
  /** Optional footer content (fixed at bottom) */
  footer?: React.ReactNode;
  /** Optional className for DialogContent */
  className?: string;
}

/**
 * Loading skeleton for detail dialogs
 */
function DetailLoadingSkeleton() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/**
 * BaseDetailDialog - Standardized wrapper for detail/panel dialogs
 *
 * Features:
 * - Consistent sizing via size prop
 * - Header with title, optional badges, and actions
 * - Auto-scrolling content area
 * - Optional fixed footer
 * - Built-in loading skeleton
 *
 * @example
 * ```tsx
 * <BaseDetailDialog
 *   open={open}
 *   onOpenChange={onOpenChange}
 *   title="Purchase Order Details"
 *   size="detail"
 *   isLoading={isLoading}
 *   headerContent={<Badge>Approved</Badge>}
 *   headerActions={
 *     <>
 *       <Button variant="outline" size="sm">Edit</Button>
 *       <Button variant="outline" size="sm">PDF</Button>
 *     </>
 *   }
 * >
 *   <div className="space-y-4">
 *     ...content...
 *   </div>
 * </BaseDetailDialog>
 * ```
 */
export function BaseDetailDialog({
  open,
  onOpenChange,
  title,
  size = 'detail',
  isLoading = false,
  headerContent,
  headerActions,
  children,
  footer,
  className,
}: BaseDetailDialogProps) {
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
        {isLoading ? (
          <DetailLoadingSkeleton />
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="flex-shrink-0 pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <DialogTitle className="text-xl font-semibold">
                    {title}
                  </DialogTitle>
                  {headerContent}
                </div>
                {headerActions && (
                  <div className="flex gap-2 flex-shrink-0">
                    {headerActions}
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-5 pb-4">
                {children}
              </div>
            </ScrollArea>

            {/* Optional Footer */}
            {footer && (
              <div className="flex-shrink-0 pt-4 border-t">
                {footer}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * DetailSection - Consistent section wrapper for detail dialogs
 */
export interface DetailSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function DetailSection({ title, children, className }: DetailSectionProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/**
 * DetailCard - Card wrapper for detail dialog content
 */
export interface DetailCardProps {
  children: React.ReactNode;
  className?: string;
}

export function DetailCard({ children, className }: DetailCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      {children}
    </div>
  );
}

/**
 * DetailGrid - Grid layout for detail cards
 */
export interface DetailGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function DetailGrid({ children, columns = 4, className }: DetailGridProps) {
  const colsClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[columns];

  return (
    <div className={cn('grid gap-3', colsClass, className)}>
      {children}
    </div>
  );
}

/**
 * DetailStat - Stat display for detail dialogs
 */
export interface DetailStatProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function DetailStat({ label, value, className }: DetailStatProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-3', className)}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
