import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Trash2, Ban, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Require user to type specific text to confirm (for high-risk actions) */
  confirmText?: string;
  /** If true, shows loading state while onConfirm is executing */
  isLoading?: boolean;
}

const variantConfig: Record<ConfirmVariant, {
  icon: React.ReactNode;
  iconColor: string;
  buttonClass: string;
}> = {
  danger: {
    icon: <Trash2 className="h-5 w-5" />,
    iconColor: 'text-destructive',
    buttonClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    iconColor: 'text-amber-600',
    buttonClass: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  info: {
    icon: <CheckCircle className="h-5 w-5" />,
    iconColor: 'text-primary',
    buttonClass: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  confirmText,
  isLoading = false,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [executing, setExecuting] = useState(false);

  const config = variantConfig[variant];
  const needsConfirmText = !!confirmText;
  const canConfirm = !needsConfirmText || inputValue === confirmText;
  const loading = isLoading || executing;

  const handleConfirm = async () => {
    setExecuting(true);
    try {
      await onConfirm();
      setInputValue('');
      onOpenChange(false);
    } finally {
      setExecuting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setInputValue('');
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full bg-muted', config.iconColor)}>
              {config.icon}
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {typeof description === 'string' ? (
                <p>{description}</p>
              ) : (
                description
              )}

              {needsConfirmText && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-input" className="text-foreground">
                    Type <strong>{confirmText}</strong> to confirm
                  </Label>
                  <Input
                    id="confirm-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={confirmText}
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={config.buttonClass}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for using confirm dialogs imperatively
 */
interface ConfirmOptions extends Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'> {}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
    resolve: ((confirmed: boolean) => void) | null;
  }>({
    open: false,
    options: null,
    resolve: null,
  });

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState({ open: false, options: null, resolve: null });
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState({ open: false, options: null, resolve: null });
  };

  const ConfirmDialogComponent = state.options ? (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => !open && handleCancel()}
      onConfirm={handleConfirm}
      {...state.options}
    />
  ) : null;

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}

// Pre-configured delete confirmation
interface DeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  itemType: string;
  itemName?: string;
  isLoading?: boolean;
  requireConfirmText?: boolean;
}

export function DeleteConfirm({
  open,
  onOpenChange,
  onConfirm,
  itemType,
  itemName,
  isLoading,
  requireConfirmText = false,
}: DeleteConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={`Delete ${itemType}?`}
      description={
        <div className="space-y-2">
          {itemName && (
            <p>
              You are about to delete <strong>{itemName}</strong>.
            </p>
          )}
          <p>This action cannot be undone. All associated data will be permanently removed.</p>
        </div>
      }
      confirmLabel="Delete"
      variant="danger"
      confirmText={requireConfirmText ? 'DELETE' : undefined}
      isLoading={isLoading}
    />
  );
}

// Pre-configured status change confirmation
interface StatusChangeConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  itemType: string;
  fromStatus: string;
  toStatus: string;
  isLoading?: boolean;
  warning?: string;
}

export function StatusChangeConfirm({
  open,
  onOpenChange,
  onConfirm,
  itemType,
  fromStatus,
  toStatus,
  isLoading,
  warning,
}: StatusChangeConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={`Change ${itemType} Status?`}
      description={
        <div className="space-y-2">
          <p>
            Change status from <strong>{fromStatus}</strong> to <strong>{toStatus}</strong>.
          </p>
          {warning && (
            <p className="text-amber-600">{warning}</p>
          )}
        </div>
      }
      confirmLabel="Change Status"
      variant="warning"
      isLoading={isLoading}
    />
  );
}

// Pre-configured bulk action confirmation
interface BulkActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  action: string;
  itemCount: number;
  itemType: string;
  isLoading?: boolean;
  variant?: ConfirmVariant;
}

export function BulkActionConfirm({
  open,
  onOpenChange,
  onConfirm,
  action,
  itemCount,
  itemType,
  isLoading,
  variant = 'warning',
}: BulkActionConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={`${action} ${itemCount} ${itemType}${itemCount !== 1 ? 's' : ''}?`}
      description={
        <p>
          This action will affect {itemCount} selected {itemType}{itemCount !== 1 ? 's' : ''}.
          {variant === 'danger' && ' This cannot be undone.'}
        </p>
      }
      confirmLabel={action}
      variant={variant}
      isLoading={isLoading}
    />
  );
}
