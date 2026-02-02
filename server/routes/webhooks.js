/**
 * Webhooks Management Routes
 * Handles webhook subscriptions and deliveries
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const crypto = require('crypto');

// Generate webhook secret
function generateWebhookSecret() {
  return 'whsec_' + crypto.randomBytes(24).toString('hex');
}

// Sign payload for webhook delivery
function signPayload(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return { timestamp, signature };
}

// ============================================================
// WEBHOOK EVENTS
// ============================================================

/**
 * GET /api/webhooks/events
 * List available webhook events
 */
router.get('/events', asyncHandler(async (req, res) => {
  const { data: events, error } = await supabase
    .from('v2_webhook_events')
    .select('*')
    .eq('is_active', true)
    .order('category');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ events: events || [] });
}));

// ============================================================
// WEBHOOK MANAGEMENT
// ============================================================

/**
 * GET /api/webhooks
 * List all webhooks for builder
 */
router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ webhooks: [] });
  }

  const { data: webhooks, error } = await supabase
    .from('v2_webhooks')
    .select('*')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Mask secrets
  const maskedWebhooks = (webhooks || []).map(w => ({
    ...w,
    secret: w.secret.substring(0, 10) + '...',
  }));

  res.json({ webhooks: maskedWebhooks });
}));

/**
 * GET /api/webhooks/:id
 * Get a specific webhook
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: webhook, error } = await supabase
    .from('v2_webhooks')
    .select('*')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (error || !webhook) {
    throw new AppError('NOT_FOUND', 'Webhook not found');
  }

  // Mask secret
  webhook.secret = webhook.secret.substring(0, 10) + '...';

  res.json({ webhook });
}));

/**
 * POST /api/webhooks
 * Create a new webhook subscription
 */
router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { name, url, events } = req.body;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  if (!name || !url || !events?.length) {
    throw new AppError('VALIDATION_FAILED', 'Name, URL, and events are required');
  }

  // Check feature access
  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select('plan:v2_pricing_plans(api_access)')
    .eq('builder_id', builderId)
    .in('status', ['active', 'trialing'])
    .single();

  if (!subscription?.plan?.api_access) {
    throw new AppError('FORBIDDEN', 'Webhook access requires Enterprise plan');
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Invalid URL');
  }

  // Validate events
  const { data: validEvents } = await supabase
    .from('v2_webhook_events')
    .select('name')
    .in('name', events);

  const validEventNames = validEvents?.map(e => e.name) || [];
  const invalidEvents = events.filter(e => !validEventNames.includes(e));

  if (invalidEvents.length > 0) {
    throw new AppError('VALIDATION_FAILED', `Invalid events: ${invalidEvents.join(', ')}`);
  }

  const secret = generateWebhookSecret();

  const { data: webhook, error } = await supabase
    .from('v2_webhooks')
    .insert({
      builder_id: builderId,
      name,
      url,
      secret,
      events,
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Return full secret on creation (only time it's shown)
  res.status(201).json({
    webhook,
    warning: 'Store this webhook secret securely. It will not be shown in full again.',
  });
}));

/**
 * PATCH /api/webhooks/:id
 * Update a webhook
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { name, url, events, is_active, retry_count, timeout_seconds } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (url !== undefined) {
    try {
      new URL(url);
      updates.url = url;
    } catch {
      throw new AppError('VALIDATION_FAILED', 'Invalid URL');
    }
  }
  if (events !== undefined) updates.events = events;
  if (is_active !== undefined) updates.is_active = is_active;
  if (retry_count !== undefined) updates.retry_count = retry_count;
  if (timeout_seconds !== undefined) updates.timeout_seconds = timeout_seconds;

  const { data, error } = await supabase
    .from('v2_webhooks')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Webhook not found');

  // Mask secret
  data.secret = data.secret.substring(0, 10) + '...';

  res.json({ webhook: data });
}));

/**
 * POST /api/webhooks/:id/rotate-secret
 * Rotate webhook secret
 */
router.post('/:id/rotate-secret', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const newSecret = generateWebhookSecret();

  const { data, error } = await supabase
    .from('v2_webhooks')
    .update({
      secret: newSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Webhook not found');

  res.json({
    webhook: data,
    warning: 'Store this new secret securely. It will not be shown in full again.',
  });
}));

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_webhooks')
    .delete()
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true });
}));

/**
 * POST /api/webhooks/:id/test
 * Send a test webhook
 */
router.post('/:id/test', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: webhook, error } = await supabase
    .from('v2_webhooks')
    .select('*')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (error || !webhook) {
    throw new AppError('NOT_FOUND', 'Webhook not found');
  }

  // Send test payload
  const testPayload = {
    event: 'test',
    data: {
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    },
  };

  const { timestamp, signature } = signPayload(testPayload, webhook.secret);
  const startTime = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Id': id,
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(webhook.timeout_seconds * 1000),
    });

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    // Log the delivery
    await supabase.from('v2_webhook_deliveries').insert({
      webhook_id: id,
      event_type: 'test',
      event_id: crypto.randomUUID(),
      payload: testPayload,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      response_time_ms: responseTime,
      status: response.ok ? 'success' : 'failed',
      delivered_at: new Date().toISOString(),
    });

    res.json({
      success: response.ok,
      status_code: response.status,
      response_time_ms: responseTime,
      response_body: responseBody.substring(0, 200),
    });
  } catch (err) {
    const responseTime = Date.now() - startTime;

    // Log the failed delivery
    await supabase.from('v2_webhook_deliveries').insert({
      webhook_id: id,
      event_type: 'test',
      event_id: crypto.randomUUID(),
      payload: testPayload,
      response_time_ms: responseTime,
      status: 'failed',
      error_message: err.message,
    });

    res.json({
      success: false,
      error: err.message,
      response_time_ms: responseTime,
    });
  }
}));

// ============================================================
// DELIVERY LOG
// ============================================================

/**
 * GET /api/webhooks/:id/deliveries
 * Get delivery history for a webhook
 */
router.get('/:id/deliveries', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { limit = 50 } = req.query;

  // Verify webhook belongs to builder
  const { data: webhook } = await supabase
    .from('v2_webhooks')
    .select('id')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (!webhook) {
    throw new AppError('NOT_FOUND', 'Webhook not found');
  }

  const { data: deliveries } = await supabase
    .from('v2_webhook_deliveries')
    .select('*')
    .eq('webhook_id', id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  res.json({ deliveries: deliveries || [] });
}));

/**
 * POST /api/webhooks/deliveries/:id/retry
 * Retry a failed delivery
 */
router.post('/deliveries/:id/retry', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  // Get delivery with webhook
  const { data: delivery } = await supabase
    .from('v2_webhook_deliveries')
    .select(`
      *,
      webhook:v2_webhooks(*)
    `)
    .eq('id', id)
    .single();

  if (!delivery || delivery.webhook.builder_id !== builderId) {
    throw new AppError('NOT_FOUND', 'Delivery not found');
  }

  const webhook = delivery.webhook;
  const { timestamp, signature } = signPayload(delivery.payload, webhook.secret);
  const startTime = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Id': webhook.id,
        'X-Webhook-Retry': String(delivery.attempt_number + 1),
      },
      body: JSON.stringify(delivery.payload),
      signal: AbortSignal.timeout(webhook.timeout_seconds * 1000),
    });

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    // Update delivery record
    await supabase
      .from('v2_webhook_deliveries')
      .update({
        response_status: response.status,
        response_body: responseBody.substring(0, 1000),
        response_time_ms: responseTime,
        attempt_number: delivery.attempt_number + 1,
        status: response.ok ? 'success' : 'failed',
        delivered_at: response.ok ? new Date().toISOString() : null,
        error_message: response.ok ? null : `HTTP ${response.status}`,
      })
      .eq('id', id);

    res.json({
      success: response.ok,
      status_code: response.status,
      response_time_ms: responseTime,
    });
  } catch (err) {
    const responseTime = Date.now() - startTime;

    await supabase
      .from('v2_webhook_deliveries')
      .update({
        response_time_ms: responseTime,
        attempt_number: delivery.attempt_number + 1,
        status: 'failed',
        error_message: err.message,
      })
      .eq('id', id);

    res.json({
      success: false,
      error: err.message,
      response_time_ms: responseTime,
    });
  }
}));

// ============================================================
// WEBHOOK TRIGGER SERVICE (for internal use)
// ============================================================

/**
 * Trigger webhooks for an event
 * Called by other services when events occur
 */
async function triggerWebhooks(builderId, eventType, eventId, data) {
  const { data: webhooks } = await supabase
    .from('v2_webhooks')
    .select('*')
    .eq('builder_id', builderId)
    .eq('is_active', true)
    .contains('events', [eventType]);

  if (!webhooks?.length) return;

  const payload = {
    event: eventType,
    event_id: eventId,
    created_at: new Date().toISOString(),
    data,
  };

  for (const webhook of webhooks) {
    const { timestamp, signature } = signPayload(payload, webhook.secret);
    const startTime = Date.now();

    // Create pending delivery record
    const { data: delivery } = await supabase
      .from('v2_webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: eventType,
        event_id: eventId,
        payload,
        status: 'pending',
      })
      .select()
      .single();

    // Send asynchronously
    fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Id': webhook.id,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(webhook.timeout_seconds * 1000),
    })
      .then(async (response) => {
        const responseTime = Date.now() - startTime;
        const responseBody = await response.text().catch(() => '');

        await supabase
          .from('v2_webhook_deliveries')
          .update({
            response_status: response.status,
            response_body: responseBody.substring(0, 1000),
            response_time_ms: responseTime,
            status: response.ok ? 'success' : 'failed',
            delivered_at: response.ok ? new Date().toISOString() : null,
          })
          .eq('id', delivery.id);

        // Update webhook stats
        await supabase
          .from('v2_webhooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            failure_count: response.ok ? 0 : webhook.failure_count + 1,
          })
          .eq('id', webhook.id);
      })
      .catch(async (err) => {
        const responseTime = Date.now() - startTime;

        await supabase
          .from('v2_webhook_deliveries')
          .update({
            response_time_ms: responseTime,
            status: 'failed',
            error_message: err.message,
          })
          .eq('id', delivery.id);

        await supabase
          .from('v2_webhooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            failure_count: webhook.failure_count + 1,
          })
          .eq('id', webhook.id);
      });
  }
}

// Export both router and trigger function
router.triggerWebhooks = triggerWebhooks;

module.exports = router;
