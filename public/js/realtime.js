/**
 * Realtime Sync Module
 * Handles SSE connection to server and offline queue management
 */

class RealtimeSync {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.eventSource = null;
    this.listeners = new Map();
    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.clientId = null;
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;

    // Bind methods
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Connect to the SSE endpoint
   */
  connect() {
    if (this.eventSource) {
      this.disconnect();
    }

    if (!this.isOnline) {
      console.log('[Realtime] Offline - deferring connection');
      this.connectionState = 'offline';
      this.emit('connectionChange', { state: 'offline' });
      return;
    }

    this.connectionState = 'connecting';
    this.emit('connectionChange', { state: 'connecting' });

    try {
      this.eventSource = new EventSource(`${this.baseUrl}/api/realtime/events`);

      this.eventSource.onopen = () => {
        console.log('[Realtime] Connected');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.emit('connectionChange', { state: 'connected' });

        // Process offline queue
        this.processOfflineQueue();
      };

      this.eventSource.onerror = (error) => {
        console.error('[Realtime] Connection error:', error);
        this.handleConnectionError();
      };

      // Handle specific event types
      this.eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        this.clientId = data.clientId;
        console.log('[Realtime] Client ID:', this.clientId);
        this.emit('connected', data);
      });

      this.eventSource.addEventListener('ping', (event) => {
        // Heartbeat received - connection is alive
        this.emit('ping', JSON.parse(event.data));
      });

      // Invoice events
      this.eventSource.addEventListener('invoice_change', (event) => {
        this.emit('invoice_change', JSON.parse(event.data));
      });

      this.eventSource.addEventListener('invoice_update', (event) => {
        this.emit('invoice_update', JSON.parse(event.data));
      });

      // Activity events
      this.eventSource.addEventListener('activity_log', (event) => {
        this.emit('activity_log', JSON.parse(event.data));
      });

      // Draw events
      this.eventSource.addEventListener('draw_change', (event) => {
        this.emit('draw_change', JSON.parse(event.data));
      });

      this.eventSource.addEventListener('draw_update', (event) => {
        this.emit('draw_update', JSON.parse(event.data));
      });

      // Lock events
      this.eventSource.addEventListener('lock_change', (event) => {
        this.emit('lock_change', JSON.parse(event.data));
      });

      // Notification events
      this.eventSource.addEventListener('notification', (event) => {
        const data = JSON.parse(event.data);
        this.emit('notification', data);

        // Also show toast if toasts available
        if (window.toasts) {
          window.toasts.show(data.type, data.message, { details: data.details?.message });
        }
      });

    } catch (err) {
      console.error('[Realtime] Failed to connect:', err);
      this.handleConnectionError();
    }
  }

  /**
   * Handle connection errors with exponential backoff
   */
  handleConnectionError() {
    this.connectionState = 'disconnected';
    this.emit('connectionChange', { state: 'disconnected' });

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts && this.isOnline) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000
      );

      console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      this.connectionState = 'reconnecting';
      this.emit('connectionChange', {
        state: 'reconnecting',
        attempt: this.reconnectAttempts,
        nextAttemptIn: delay
      });

      setTimeout(() => this.connect(), delay);
    } else if (!this.isOnline) {
      this.connectionState = 'offline';
      this.emit('connectionChange', { state: 'offline' });
    } else {
      console.error('[Realtime] Max reconnection attempts reached');
      this.emit('connectionChange', { state: 'failed' });
    }
  }

  /**
   * Disconnect from SSE
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connectionState = 'disconnected';
    this.emit('connectionChange', { state: 'disconnected' });
  }

  /**
   * Handle browser going online
   */
  handleOnline() {
    console.log('[Realtime] Browser online');
    this.isOnline = true;
    this.reconnectAttempts = 0;
    this.connect();
  }

  /**
   * Handle browser going offline
   */
  handleOffline() {
    console.log('[Realtime] Browser offline');
    this.isOnline = false;
    this.connectionState = 'offline';
    this.emit('connectionChange', { state: 'offline' });
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[Realtime] Error in ${event} listener:`, err);
        }
      });
    }
  }

  /**
   * Queue an action for later execution when offline
   */
  queueOfflineAction(action) {
    this.offlineQueue.push({
      action,
      timestamp: Date.now()
    });
    console.log(`[Realtime] Queued offline action: ${action.type}`);

    // Save to localStorage for persistence
    this.saveOfflineQueue();
  }

  /**
   * Save offline queue to localStorage
   */
  saveOfflineQueue() {
    try {
      localStorage.setItem('realtime_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (err) {
      console.error('[Realtime] Failed to save offline queue:', err);
    }
  }

  /**
   * Load offline queue from localStorage
   */
  loadOfflineQueue() {
    try {
      const saved = localStorage.getItem('realtime_offline_queue');
      if (saved) {
        this.offlineQueue = JSON.parse(saved);
        console.log(`[Realtime] Loaded ${this.offlineQueue.length} queued actions`);
      }
    } catch (err) {
      console.error('[Realtime] Failed to load offline queue:', err);
      this.offlineQueue = [];
    }
  }

  /**
   * Process offline queue when back online
   */
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    console.log(`[Realtime] Processing ${this.offlineQueue.length} queued actions`);

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueue();

    for (const item of queue) {
      try {
        await this.executeQueuedAction(item.action);
      } catch (err) {
        console.error('[Realtime] Failed to execute queued action:', err);
        // Re-queue failed actions
        this.offlineQueue.push(item);
      }
    }

    if (this.offlineQueue.length > 0) {
      this.saveOfflineQueue();
      console.log(`[Realtime] ${this.offlineQueue.length} actions failed, re-queued`);
    }
  }

  /**
   * Execute a queued action
   */
  async executeQueuedAction(action) {
    switch (action.type) {
      case 'refresh':
        this.emit('refresh_requested', action.data);
        break;
      default:
        console.warn('[Realtime] Unknown queued action type:', action.type);
    }
  }

  /**
   * Get current connection state
   */
  getState() {
    return {
      connectionState: this.connectionState,
      clientId: this.clientId,
      isOnline: this.isOnline,
      reconnectAttempts: this.reconnectAttempts,
      queuedActions: this.offlineQueue.length
    };
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connectionState === 'connected';
  }

  /**
   * Cleanup
   */
  destroy() {
    this.disconnect();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners.clear();
  }
}

// Export singleton instance
window.realtimeSync = new RealtimeSync();

// Auto-connect when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.realtimeSync.loadOfflineQueue();
    window.realtimeSync.connect();
  });
} else {
  window.realtimeSync.loadOfflineQueue();
  window.realtimeSync.connect();
}
