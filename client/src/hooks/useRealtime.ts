import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type RealtimeEventType =
  | 'connected'
  | 'ping'
  | 'notification'
  | 'invoice_change'
  | 'invoice_update'
  | 'draw_change'
  | 'draw_update'
  | 'activity_log'
  | 'lock_change';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  data: T;
}

export interface NotificationEvent {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: {
    title?: string;
    entityType?: string;
    entityId?: string;
    link?: string;
    action?: string;
    performedBy?: string;
  };
  timestamp: string;
}

export interface InvoiceChangeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  invoice: {
    id: string;
    invoice_number?: string;
    status?: string;
    vendor_id?: string;
    job_id?: string;
  };
  previous?: unknown;
  timestamp: string;
}

export interface DrawChangeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  draw: {
    id: string;
    draw_number?: number;
    status?: string;
    job_id?: string;
  };
  previous?: unknown;
  timestamp: string;
}

interface UseRealtimeOptions {
  enabled?: boolean;
  onNotification?: (event: NotificationEvent) => void;
  onInvoiceChange?: (event: InvoiceChangeEvent) => void;
  onDrawChange?: (event: DrawChangeEvent) => void;
  showToasts?: boolean;
}

/**
 * Hook to connect to real-time Server-Sent Events stream
 * Automatically shows toast notifications and invalidates queries
 */
export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    enabled = true,
    onNotification,
    onInvoiceChange,
    onDrawChange,
    showToasts = true,
  } = options;

  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      const es = new EventSource('/api/realtime/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log('[Realtime] SSE connection established');
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        console.log(`[Realtime] Connection error, reconnecting in ${delay}ms...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabled) connect();
        }, delay);
      };

      // Handle connected event
      es.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        console.log('[Realtime] Connected with client ID:', data.clientId);
      });

      // Handle ping (heartbeat)
      es.addEventListener('ping', () => {
        setLastPing(new Date());
      });

      // Handle notifications - show toasts
      es.addEventListener('notification', (e) => {
        const event: NotificationEvent = JSON.parse(e.data);

        if (showToasts) {
          const toastFn = {
            success: toast.success,
            error: toast.error,
            warning: toast.warning,
            info: toast.info,
          }[event.type] || toast.info;

          toastFn(event.message, {
            description: event.details?.title,
            action: event.details?.link ? {
              label: 'View',
              onClick: () => {
                if (event.details?.link) {
                  window.location.href = event.details.link;
                }
              },
            } : undefined,
          });
        }

        onNotification?.(event);

        // Invalidate notifications query
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      });

      // Handle invoice changes
      es.addEventListener('invoice_change', (e) => {
        const event: InvoiceChangeEvent = JSON.parse(e.data);

        // Invalidate invoice queries
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['invoice', event.invoice.id] });

        onInvoiceChange?.(event);
      });

      es.addEventListener('invoice_update', (e) => {
        const event = JSON.parse(e.data);

        if (showToasts && event.action) {
          const messages: Record<string, string> = {
            approved: `Invoice approved`,
            denied: `Invoice denied`,
            paid: `Invoice marked as paid`,
            submitted: `Invoice submitted for approval`,
          };

          const message = messages[event.action] || `Invoice ${event.action}`;
          toast.info(message, {
            description: event.invoice?.invoice_number,
          });
        }

        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['invoice', event.invoice?.id] });
      });

      // Handle draw changes
      es.addEventListener('draw_change', (e) => {
        const event: DrawChangeEvent = JSON.parse(e.data);

        queryClient.invalidateQueries({ queryKey: ['draws'] });
        queryClient.invalidateQueries({ queryKey: ['draw', event.draw.id] });

        onDrawChange?.(event);
      });

      es.addEventListener('draw_update', (e) => {
        const event = JSON.parse(e.data);

        if (showToasts && event.action) {
          const messages: Record<string, string> = {
            approved: `Draw #${event.draw?.draw_number} approved`,
            submitted: `Draw #${event.draw?.draw_number} submitted`,
            funded: `Draw #${event.draw?.draw_number} funded`,
          };

          const message = messages[event.action] || `Draw ${event.action}`;
          toast.info(message);
        }

        queryClient.invalidateQueries({ queryKey: ['draws'] });
        queryClient.invalidateQueries({ queryKey: ['draw', event.draw?.id] });
      });

      // Handle activity log
      es.addEventListener('activity_log', () => {
        queryClient.invalidateQueries({ queryKey: ['invoice-activity'] });
      });

      // Handle lock changes
      es.addEventListener('lock_change', (e) => {
        const event = JSON.parse(e.data);
        queryClient.invalidateQueries({ queryKey: ['entity-lock', event.entityType, event.entityId] });
      });

    } catch (err) {
      console.error('[Realtime] Failed to connect:', err);
    }
  }, [enabled, queryClient, onNotification, onInvoiceChange, onDrawChange, showToasts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    console.log('[Realtime] Disconnected');
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastPing,
    connect,
    disconnect,
  };
}

export default useRealtime;
