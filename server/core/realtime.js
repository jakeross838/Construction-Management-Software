/**
 * Realtime Sync Module
 * Handles Supabase Realtime subscriptions and broadcasts
 */

const { supabase, SSE_HEARTBEAT_MS } = require('../../config');
const logger = require('../utils/logger');

// Store active subscriptions
const subscriptions = new Map();

// Store connected clients (for SSE)
const clients = new Map();

// ============================================================
// SERVER-SENT EVENTS (SSE) FOR FRONTEND
// ============================================================

/**
 * SSE connection handler
 * @param {Request} req
 * @param {Response} res
 */
function sseHandler(req, res) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Evict oldest connections if at limit (prevent Chrome 6-connection exhaustion)
  const MAX_SSE_CLIENTS = 4;
  while (clients.size >= MAX_SSE_CLIENTS) {
    const oldestKey = clients.keys().next().value;
    const oldest = clients.get(oldestKey);
    if (oldest && oldest.res) {
      try { oldest.res.end(); } catch (_) { /* ignore */ }
    }
    clients.delete(oldestKey);
    logger.info('SSE client evicted (limit reached)', { component: 'sse', clientId: oldestKey, totalClients: clients.size });
  }

  // Generate client ID
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Store client connection
  clients.set(clientId, {
    res,
    connectedAt: new Date(),
    lastPing: new Date()
  });

  logger.info('SSE client connected', { component: 'sse', clientId, totalClients: clients.size });

  // Send initial connection event
  sendToClient(clientId, 'connected', { clientId, timestamp: new Date().toISOString() });

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (clients.has(clientId)) {
      sendToClient(clientId, 'ping', { timestamp: new Date().toISOString() });
      clients.get(clientId).lastPing = new Date();
    }
  }, SSE_HEARTBEAT_MS);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    logger.info('SSE client disconnected', { component: 'sse', clientId, totalClients: clients.size });
  });
}

/**
 * Send event to specific client
 */
function sendToClient(clientId, event, data) {
  const client = clients.get(clientId);
  if (client && client.res) {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

/**
 * Broadcast event to all connected clients
 */
function broadcast(event, data) {
  const payload = JSON.stringify(data);
  clients.forEach((client, clientId) => {
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      logger.error('Failed to send SSE event', { component: 'sse', clientId, error: err.message });
      clients.delete(clientId);
    }
  });
}

/**
 * Broadcast to clients except one (used to exclude sender)
 */
function broadcastExcept(event, data, excludeClientId) {
  const payload = JSON.stringify(data);
  clients.forEach((client, clientId) => {
    if (clientId === excludeClientId) return;
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      logger.error('Failed to send SSE event', { component: 'sse', clientId, error: err.message });
      clients.delete(clientId);
    }
  });
}

// ============================================================
// SUPABASE REALTIME SUBSCRIPTIONS
// ============================================================

/**
 * Initialize Supabase Realtime subscriptions
 */
function initializeRealtimeSubscriptions() {
  logger.info('Initializing Supabase realtime subscriptions', { component: 'realtime' });

  // Subscribe to invoice changes
  const invoiceChannel = supabase
    .channel('invoice-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'v2_invoices'
      },
      (payload) => handleInvoiceChange(payload)
    )
    .subscribe((status) => {
      logger.info('Invoice subscription status', { component: 'realtime', status });
    });

  subscriptions.set('invoices', invoiceChannel);

  // Subscribe to activity log
  const activityChannel = supabase
    .channel('activity-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'v2_invoice_activity'
      },
      (payload) => handleActivityLog(payload)
    )
    .subscribe((status) => {
      logger.info('Activity subscription status', { component: 'realtime', status });
    });

  subscriptions.set('activity', activityChannel);

  // Subscribe to draw changes
  const drawChannel = supabase
    .channel('draw-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'v2_draws'
      },
      (payload) => handleDrawChange(payload)
    )
    .subscribe((status) => {
      logger.info('Draw subscription status', { component: 'realtime', status });
    });

  subscriptions.set('draws', drawChannel);

  // Subscribe to lock changes
  const lockChannel = supabase
    .channel('lock-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'v2_entity_locks'
      },
      (payload) => handleLockChange(payload)
    )
    .subscribe((status) => {
      logger.info('Lock subscription status', { component: 'realtime', status });
    });

  subscriptions.set('locks', lockChannel);

  logger.info('All realtime subscriptions initialized', { component: 'realtime' });
}

/**
 * Handle invoice change event
 */
function handleInvoiceChange(payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  logger.debug('Invoice change event', { component: 'realtime', eventType, invoiceId: newRecord?.id || oldRecord?.id });

  broadcast('invoice_change', {
    type: eventType,
    invoice: newRecord || oldRecord,
    previous: oldRecord,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle activity log event
 */
function handleActivityLog(payload) {
  const { new: activity } = payload;

  logger.debug('Activity logged', { component: 'realtime', action: activity.action, invoiceId: activity.invoice_id });

  broadcast('activity_log', {
    activity,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle draw change event
 */
function handleDrawChange(payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  logger.debug('Draw change event', { component: 'realtime', eventType, drawId: newRecord?.id || oldRecord?.id });

  broadcast('draw_change', {
    type: eventType,
    draw: newRecord || oldRecord,
    previous: oldRecord,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle lock change event
 */
function handleLockChange(payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const lock = newRecord || oldRecord;

  logger.debug('Lock change event', { component: 'realtime', eventType, entityType: lock.entity_type, entityId: lock.entity_id });

  broadcast('lock_change', {
    type: eventType,
    entityType: lock.entity_type,
    entityId: lock.entity_id,
    lockedBy: lock.locked_by,
    expiresAt: lock.expires_at,
    timestamp: new Date().toISOString()
  });
}

// ============================================================
// MANUAL BROADCAST HELPERS
// ============================================================

/**
 * Broadcast invoice update (call after API operations)
 */
function broadcastInvoiceUpdate(invoice, action, performedBy) {
  broadcast('invoice_update', {
    action,
    invoice,
    performedBy,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast draw update
 */
function broadcastDrawUpdate(draw, action, performedBy) {
  broadcast('draw_update', {
    action,
    draw,
    performedBy,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast toast notification to all clients
 */
function broadcastNotification(type, message, details = {}) {
  broadcast('notification', {
    type, // success, error, warning, info
    message,
    details,
    timestamp: new Date().toISOString()
  });
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Cleanup all subscriptions (for graceful shutdown)
 */
async function cleanup() {
  logger.info('Cleaning up realtime subscriptions', { component: 'realtime' });

  for (const [name, channel] of subscriptions) {
    try {
      await supabase.removeChannel(channel);
      logger.debug('Removed channel', { component: 'realtime', channel: name });
    } catch (err) {
      logger.error('Failed to remove channel', { component: 'realtime', channel: name, error: err.message });
    }
  }

  subscriptions.clear();

  // Close all SSE connections
  clients.forEach((client, clientId) => {
    try {
      client.res.end();
    } catch (err) {
      // Ignore
    }
  });
  clients.clear();

  logger.info('Realtime cleanup complete', { component: 'realtime' });
}

/**
 * Get connection stats
 */
function getStats() {
  return {
    connectedClients: clients.size,
    activeSubscriptions: subscriptions.size,
    subscriptionNames: Array.from(subscriptions.keys())
  };
}

module.exports = {
  sseHandler,
  broadcast,
  broadcastExcept,
  sendToClient,
  initializeRealtimeSubscriptions,
  broadcastInvoiceUpdate,
  broadcastDrawUpdate,
  broadcastNotification,
  cleanup,
  getStats
};
