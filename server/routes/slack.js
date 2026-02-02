/**
 * Slack Integration Routes
 * Manages Slack webhook integrations for builder notifications
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const {
  sendTestMessage,
  encrypt,
  decrypt,
} = require('../services/slack');

// ============================================================
// GET SLACK INTEGRATION
// ============================================================

/**
 * GET /api/integrations/slack
 * Get the Slack integration settings for the current builder
 */
router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ integrations: [] });
  }

  const { data: integrations, error } = await supabase
    .from('v2_slack_integrations')
    .select('*')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Mask webhook URLs for security
  const maskedIntegrations = (integrations || []).map(integration => ({
    ...integration,
    webhook_url: integration.webhook_url ? '***configured***' : null,
  }));

  res.json({ integrations: maskedIntegrations });
}));

/**
 * GET /api/integrations/slack/:id
 * Get a specific Slack integration
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const { data: integration, error } = await supabase
    .from('v2_slack_integrations')
    .select('*')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (error || !integration) {
    throw new AppError('NOT_FOUND', 'Slack integration not found');
  }

  // Mask webhook URL
  integration.webhook_url = integration.webhook_url ? '***configured***' : null;

  res.json({ integration });
}));

// ============================================================
// CREATE SLACK INTEGRATION
// ============================================================

/**
 * POST /api/integrations/slack
 * Create a new Slack integration
 */
router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { webhook_url, workspace_name, channel_name, notification_types } = req.body;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  if (!webhook_url) {
    throw new AppError('VALIDATION_FAILED', 'Webhook URL is required');
  }

  // Validate webhook URL format
  if (!webhook_url.startsWith('https://hooks.slack.com/')) {
    throw new AppError('VALIDATION_FAILED', 'Invalid Slack webhook URL. URL must start with https://hooks.slack.com/');
  }

  // Encrypt the webhook URL before storing
  const encryptedUrl = encrypt(webhook_url);

  const insertData = {
    builder_id: builderId,
    webhook_url: encryptedUrl,
    workspace_name: workspace_name || null,
    channel_name: channel_name || null,
    notification_types: notification_types || {
      invoice_received: true,
      invoice_approved: true,
      invoice_denied: false,
      draw_created: true,
      draw_submitted: true,
      draw_funded: true,
      po_created: false,
      po_approved: true,
      task_assigned: true,
      task_completed: false,
      daily_summary: false,
    },
    enabled: true,
    created_by: req.user?.email || 'system',
  };

  const { data: integration, error } = await supabase
    .from('v2_slack_integrations')
    .insert(insertData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Mask the webhook URL in response
  integration.webhook_url = '***configured***';

  res.status(201).json({
    integration,
    message: 'Slack integration created successfully',
  });
}));

// ============================================================
// UPDATE SLACK INTEGRATION
// ============================================================

/**
 * PATCH /api/integrations/slack/:id
 * Update Slack integration settings
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { webhook_url, workspace_name, channel_name, notification_types, enabled } = req.body;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  // Verify the integration belongs to this builder
  const { data: existing } = await supabase
    .from('v2_slack_integrations')
    .select('id')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Slack integration not found');
  }

  const updates = {};

  if (webhook_url !== undefined) {
    if (webhook_url && !webhook_url.startsWith('https://hooks.slack.com/')) {
      throw new AppError('VALIDATION_FAILED', 'Invalid Slack webhook URL');
    }
    updates.webhook_url = webhook_url ? encrypt(webhook_url) : null;
  }

  if (workspace_name !== undefined) updates.workspace_name = workspace_name;
  if (channel_name !== undefined) updates.channel_name = channel_name;
  if (notification_types !== undefined) updates.notification_types = notification_types;
  if (enabled !== undefined) updates.enabled = enabled;

  const { data: integration, error } = await supabase
    .from('v2_slack_integrations')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Mask the webhook URL
  integration.webhook_url = integration.webhook_url ? '***configured***' : null;

  res.json({ integration });
}));

// ============================================================
// DELETE SLACK INTEGRATION
// ============================================================

/**
 * DELETE /api/integrations/slack/:id
 * Remove a Slack integration
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const { error } = await supabase
    .from('v2_slack_integrations')
    .delete()
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'Slack integration deleted' });
}));

// ============================================================
// TEST SLACK INTEGRATION
// ============================================================

/**
 * POST /api/integrations/slack/:id/test
 * Send a test message to verify the integration
 */
router.post('/:id/test', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  // Get the integration with decrypted webhook URL
  const { data: integration, error } = await supabase
    .from('v2_slack_integrations')
    .select('*')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (error || !integration) {
    throw new AppError('NOT_FOUND', 'Slack integration not found');
  }

  if (!integration.webhook_url) {
    throw new AppError('VALIDATION_FAILED', 'No webhook URL configured');
  }

  // Decrypt the webhook URL
  const webhookUrl = decrypt(integration.webhook_url);

  // Send test message
  const result = await sendTestMessage(webhookUrl);

  // Log the test message
  await supabase.from('v2_slack_message_log').insert({
    integration_id: id,
    event_type: 'test',
    message_text: 'Test message',
    status: result.success ? 'success' : 'failed',
    response_status: result.status,
    error_message: result.error,
    sent_at: result.success ? new Date().toISOString() : null,
  });

  res.json({
    success: result.success,
    message: result.success
      ? 'Test message sent successfully! Check your Slack channel.'
      : `Failed to send test message: ${result.error}`,
    status_code: result.status,
    error: result.error,
  });
}));

// ============================================================
// TEST WEBHOOK URL (without saving)
// ============================================================

/**
 * POST /api/integrations/slack/test-url
 * Test a webhook URL without saving it
 */
router.post('/test-url', asyncHandler(async (req, res) => {
  const { webhook_url } = req.body;

  if (!webhook_url) {
    throw new AppError('VALIDATION_FAILED', 'Webhook URL is required');
  }

  if (!webhook_url.startsWith('https://hooks.slack.com/')) {
    throw new AppError('VALIDATION_FAILED', 'Invalid Slack webhook URL. URL must start with https://hooks.slack.com/');
  }

  const result = await sendTestMessage(webhook_url);

  res.json({
    success: result.success,
    message: result.success
      ? 'Test message sent successfully!'
      : `Failed to send test message: ${result.error}`,
    status_code: result.status,
    error: result.error,
  });
}));

// ============================================================
// GET MESSAGE LOG
// ============================================================

/**
 * GET /api/integrations/slack/:id/messages
 * Get recent messages sent via this integration
 */
router.get('/:id/messages', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { limit = 50 } = req.query;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  // Verify the integration belongs to this builder
  const { data: integration } = await supabase
    .from('v2_slack_integrations')
    .select('id')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (!integration) {
    throw new AppError('NOT_FOUND', 'Slack integration not found');
  }

  const { data: messages, error } = await supabase
    .from('v2_slack_message_log')
    .select('*')
    .eq('integration_id', id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ messages: messages || [] });
}));

// ============================================================
// GET AVAILABLE NOTIFICATION TYPES
// ============================================================

/**
 * GET /api/integrations/slack/notification-types
 * Get list of available notification types
 */
router.get('/notification-types', asyncHandler(async (req, res) => {
  const notificationTypes = [
    { key: 'invoice_received', name: 'Invoice Received', description: 'When a new invoice is uploaded and processed' },
    { key: 'invoice_approved', name: 'Invoice Approved', description: 'When an invoice is approved' },
    { key: 'invoice_denied', name: 'Invoice Denied', description: 'When an invoice is denied' },
    { key: 'draw_created', name: 'Draw Created', description: 'When a new draw is created' },
    { key: 'draw_submitted', name: 'Draw Submitted', description: 'When a draw is submitted for payment' },
    { key: 'draw_funded', name: 'Draw Funded', description: 'When a draw is marked as funded' },
    { key: 'po_created', name: 'PO Created', description: 'When a new purchase order is created' },
    { key: 'po_approved', name: 'PO Approved', description: 'When a purchase order is approved' },
    { key: 'task_assigned', name: 'Task Assigned', description: 'When a task is assigned to someone' },
    { key: 'task_completed', name: 'Task Completed', description: 'When a task is marked complete' },
    { key: 'daily_summary', name: 'Daily Summary', description: 'Daily summary of activity (coming soon)' },
  ];

  res.json({ notification_types: notificationTypes });
}));

module.exports = router;
