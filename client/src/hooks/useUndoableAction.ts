import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface UndoableActionOptions {
  /** How long to wait before action is final (ms) */
  timeout?: number;
  /** Message to show in toast */
  message: string;
  /** Function to execute the action */
  execute: () => Promise<void>;
  /** Function to undo the action */
  undo: () => Promise<void>;
  /** Callback when action is finalized (not undone) */
  onFinalize?: () => void;
}

interface UndoableState {
  isPending: boolean;
  canUndo: boolean;
  timeRemaining: number;
}

/**
 * Hook for managing undoable actions with visual countdown
 */
export function useUndoableAction() {
  const [state, setState] = useState<UndoableState>({
    isPending: false,
    canUndo: false,
    timeRemaining: 0,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const undoRef = useRef<(() => Promise<void>) | null>(null);
  const finalizeRef = useRef<(() => void) | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const execute = useCallback(async (options: UndoableActionOptions) => {
    const { timeout = 5000, message, execute: executeAction, undo, onFinalize } = options;

    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setState({
      isPending: true,
      canUndo: false,
      timeRemaining: timeout,
    });

    try {
      // Execute the action
      await executeAction();

      // Store undo function
      undoRef.current = undo;
      finalizeRef.current = onFinalize || null;

      setState({
        isPending: false,
        canUndo: true,
        timeRemaining: timeout,
      });

      // Start countdown display
      const startTime = Date.now();
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, timeout - elapsed);
        setState(s => ({ ...s, timeRemaining: remaining }));

        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      }, 100);

      // Show undo toast
      toast(message, {
        duration: timeout,
        action: {
          label: 'Undo',
          onClick: async () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);

            try {
              setState(s => ({ ...s, isPending: true, canUndo: false }));
              await undo();
              toast.success('Action undone');
            } catch (error) {
              toast.error('Failed to undo');
            } finally {
              setState({ isPending: false, canUndo: false, timeRemaining: 0 });
              undoRef.current = null;
              finalizeRef.current = null;
            }
          },
        },
      });

      // Set timeout for finalization
      timerRef.current = setTimeout(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setState({ isPending: false, canUndo: false, timeRemaining: 0 });
        undoRef.current = null;
        if (finalizeRef.current) {
          finalizeRef.current();
          finalizeRef.current = null;
        }
      }, timeout);
    } catch (error) {
      setState({ isPending: false, canUndo: false, timeRemaining: 0 });
      throw error;
    }
  }, []);

  const cancelUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setState({ isPending: false, canUndo: false, timeRemaining: 0 });
    undoRef.current = null;
    if (finalizeRef.current) {
      finalizeRef.current();
      finalizeRef.current = null;
    }
  }, []);

  const performUndo = useCallback(async () => {
    if (!undoRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    try {
      setState(s => ({ ...s, isPending: true, canUndo: false }));
      await undoRef.current();
      toast.success('Action undone');
    } catch (error) {
      toast.error('Failed to undo');
    } finally {
      setState({ isPending: false, canUndo: false, timeRemaining: 0 });
      undoRef.current = null;
      finalizeRef.current = null;
    }
  }, []);

  return {
    ...state,
    execute,
    cancelUndo,
    performUndo,
  };
}

/**
 * Simplified function to execute an undoable action
 * Shows a toast with undo button for the specified duration
 */
export async function executeWithUndo(
  message: string,
  execute: () => Promise<void>,
  undo: () => Promise<void>,
  timeout: number = 5000
): Promise<void> {
  let finalized = false;
  let undone = false;

  await execute();

  const toastId = toast(message, {
    duration: timeout,
    action: {
      label: 'Undo',
      onClick: async () => {
        if (finalized || undone) return;
        undone = true;
        try {
          await undo();
          toast.success('Action undone');
        } catch (error) {
          toast.error('Failed to undo');
        }
      },
    },
    onDismiss: () => {
      finalized = true;
    },
  });

  // Mark as finalized after timeout
  setTimeout(() => {
    finalized = true;
  }, timeout);
}

/**
 * Pre-built undoable delete action
 */
export async function undoableDelete<T>(
  itemName: string,
  deleteAction: () => Promise<T>,
  undoAction: () => Promise<void>,
  timeout: number = 5000
): Promise<T> {
  const result = await deleteAction();

  toast(`${itemName} deleted`, {
    duration: timeout,
    action: {
      label: 'Undo',
      onClick: async () => {
        try {
          await undoAction();
          toast.success(`${itemName} restored`);
        } catch (error) {
          toast.error(`Failed to restore ${itemName}`);
        }
      },
    },
  });

  return result;
}
