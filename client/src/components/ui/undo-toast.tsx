import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, Undo2, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoToastProps {
  message: string;
  duration?: number;
  onUndo: () => Promise<void>;
  onDismiss?: () => void;
  onExpire?: () => void;
}

export function UndoToast({
  message,
  duration = 5000,
  onUndo,
  onDismiss,
  onExpire,
}: UndoToastProps) {
  const [visible, setVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undone, setUndone] = useState(false);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const countdown = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, duration - elapsed);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(countdown);
        setVisible(false);
        onExpire?.();
      }
    }, 50);

    return () => clearInterval(countdown);
  }, [duration, onExpire]);

  const handleUndo = async () => {
    if (isUndoing || undone) return;

    setIsUndoing(true);
    try {
      await onUndo();
      setUndone(true);
      // Keep visible briefly to show success
      setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 1000);
    } catch (error) {
      setIsUndoing(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const progressPercent = (timeRemaining / duration) * 100;

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80 rounded-lg shadow-lg border',
        'bg-card text-card-foreground',
        'animate-in slide-in-from-right-full fade-in duration-300'
      )}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-100 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="p-4 pr-10">
        <div className="flex items-start gap-3">
          {undone ? (
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <Undo2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {undone ? 'Action undone' : message}
            </p>
            {!undone && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.ceil(timeRemaining / 1000)}s to undo
              </p>
            )}
          </div>
        </div>

        {!undone && (
          <div className="flex justify-end mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleUndo}
              disabled={isUndoing}
              className="gap-2"
            >
              {isUndoing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Undo2 className="h-3 w-3" />
              )}
              Undo
            </Button>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Toast manager for showing multiple toasts
interface ToastItem {
  id: string;
  message: string;
  duration: number;
  onUndo: () => Promise<void>;
  onExpire?: () => void;
}

let toastCounter = 0;
let listeners: Set<(toasts: ToastItem[]) => void> = new Set();
let toastsState: ToastItem[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener([...toastsState]));
}

export function showUndoToast(
  message: string,
  onUndo: () => Promise<void>,
  options?: { duration?: number; onExpire?: () => void }
) {
  const id = `undo-toast-${++toastCounter}`;
  const toast: ToastItem = {
    id,
    message,
    duration: options?.duration || 5000,
    onUndo,
    onExpire: options?.onExpire,
  };

  toastsState = [...toastsState, toast];
  notifyListeners();

  return () => {
    toastsState = toastsState.filter(t => t.id !== id);
    notifyListeners();
  };
}

export function UndoToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (newToasts: ToastItem[]) => setToasts(newToasts);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const handleDismiss = (id: string) => {
    toastsState = toastsState.filter(t => t.id !== id);
    notifyListeners();
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            transform: `translateY(-${index * 8}px)`,
            zIndex: 50 - index,
          }}
        >
          <UndoToast
            message={toast.message}
            duration={toast.duration}
            onUndo={async () => {
              await toast.onUndo();
              handleDismiss(toast.id);
            }}
            onDismiss={() => handleDismiss(toast.id)}
            onExpire={() => {
              toast.onExpire?.();
              handleDismiss(toast.id);
            }}
          />
        </div>
      ))}
    </div>,
    document.body
  );
}
