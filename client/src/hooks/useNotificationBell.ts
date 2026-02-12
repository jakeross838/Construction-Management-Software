import { useState, useEffect, useCallback, useRef } from 'react';
import type { NotificationEvent, InvoiceChangeEvent, DrawChangeEvent } from './useRealtime';

export interface BellNotification {
  id: string;
  message: string;
  type: 'invoice' | 'draw' | 'notification' | 'activity';
  severity: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
  read: boolean;
  link?: string;
}

const STORAGE_KEY = 'cms_bell_notifications';
const MAX_NOTIFICATIONS = 20;

function loadFromStorage(): BellNotification[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveToStorage(notifications: BellNotification[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // Ignore storage errors
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Hook that powers the notification bell in the header.
 * Listens to SSE events and stores notifications in React state + sessionStorage.
 * Does not require a backend API -- purely client-side notification collection.
 */
export function useNotificationBell() {
  const [notifications, setNotifications] = useState<BellNotification[]>(loadFromStorage);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);

  const addNotification = useCallback((notif: Omit<BellNotification, 'id' | 'read'>) => {
    setNotifications((prev) => {
      const newNotif: BellNotification = {
        ...notif,
        id: generateId(),
        read: false,
      };
      const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Connect to SSE for notification events
  useEffect(() => {
    function connect() {
      if (eventSourceRef.current?.readyState === EventSource.OPEN) {
        return;
      }

      try {
        const es = new EventSource('/api/realtime/events');
        eventSourceRef.current = es;

        es.onopen = () => {
          reconnectAttempts.current = 0;
        };

        es.onerror = () => {
          es.close();
          eventSourceRef.current = null;

          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };

        // Handle notification events
        es.addEventListener('notification', (e) => {
          const event: NotificationEvent = JSON.parse(e.data);
          addNotification({
            message: event.message,
            type: 'notification',
            severity: event.type,
            timestamp: event.timestamp || new Date().toISOString(),
            link: event.details?.link,
          });
        });

        // Handle invoice updates
        es.addEventListener('invoice_update', (e) => {
          const event = JSON.parse(e.data);
          const messages: Record<string, string> = {
            approved: 'Invoice approved',
            denied: 'Invoice denied',
            paid: 'Invoice marked as paid',
            submitted: 'Invoice submitted for approval',
          };
          const message = messages[event.action] || `Invoice ${event.action}`;
          const invoiceLabel = event.invoice?.invoice_number
            ? ` - ${event.invoice.invoice_number}`
            : '';

          addNotification({
            message: `${message}${invoiceLabel}`,
            type: 'invoice',
            severity: event.action === 'denied' ? 'warning' : 'info',
            timestamp: event.timestamp || new Date().toISOString(),
            link: event.invoice?.id ? `/invoices/${event.invoice.id}` : '/invoices',
          });
        });

        // Handle invoice changes (INSERT/DELETE)
        es.addEventListener('invoice_change', (e) => {
          const event: InvoiceChangeEvent = JSON.parse(e.data);
          if (event.type === 'INSERT') {
            addNotification({
              message: `New invoice created${event.invoice.invoice_number ? ` - ${event.invoice.invoice_number}` : ''}`,
              type: 'invoice',
              severity: 'info',
              timestamp: event.timestamp || new Date().toISOString(),
              link: `/invoices/${event.invoice.id}`,
            });
          } else if (event.type === 'DELETE') {
            addNotification({
              message: `Invoice deleted${event.invoice.invoice_number ? ` - ${event.invoice.invoice_number}` : ''}`,
              type: 'invoice',
              severity: 'warning',
              timestamp: event.timestamp || new Date().toISOString(),
              link: '/invoices',
            });
          }
        });

        // Handle draw updates
        es.addEventListener('draw_update', (e) => {
          const event = JSON.parse(e.data);
          const messages: Record<string, string> = {
            approved: `Draw #${event.draw?.draw_number} approved`,
            submitted: `Draw #${event.draw?.draw_number} submitted`,
            funded: `Draw #${event.draw?.draw_number} funded`,
          };
          const message = messages[event.action] || `Draw ${event.action}`;

          addNotification({
            message,
            type: 'draw',
            severity: 'info',
            timestamp: event.timestamp || new Date().toISOString(),
            link: event.draw?.id ? `/draws/${event.draw.id}` : '/draws',
          });
        });

        // Handle draw changes (INSERT/DELETE)
        es.addEventListener('draw_change', (e) => {
          const event: DrawChangeEvent = JSON.parse(e.data);
          if (event.type === 'INSERT') {
            addNotification({
              message: `New draw created${event.draw.draw_number ? ` - Draw #${event.draw.draw_number}` : ''}`,
              type: 'draw',
              severity: 'info',
              timestamp: event.timestamp || new Date().toISOString(),
              link: `/draws/${event.draw.id}`,
            });
          }
        });

        // Handle activity log
        es.addEventListener('activity_log', (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.message) {
              addNotification({
                message: event.message,
                type: 'activity',
                severity: 'info',
                timestamp: event.timestamp || new Date().toISOString(),
                link: event.link,
              });
            }
          } catch {
            // activity_log events may not always have parseable notification data
          }
        });
      } catch {
        // Failed to connect -- will be retried
      }
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [addNotification]);

  return {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
    clearAll,
  };
}

export default useNotificationBell;
