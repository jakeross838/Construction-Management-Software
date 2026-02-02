/**
 * Notifications API Routes
 * Manages notifications, user preferences, SMS/email/push notifications
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const notificationService = require('../services/notifications');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// NOTIFICATIONS
// ============================================================

/**
 * GET /api/notifications
 * List notifications for a user
 */
router.get('/', asyncHandler(async (req, res) => {
  const { user = 'Jake Ross', is_read, type, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('v2_notifications')
    .select('*')
    .eq('user_name', user)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (is_read !== undefined) {
    query = query.eq('is_read', is_read === 'true');
  }
  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
  const { user = 'Jake Ross' } = req.query;

  const { count, error } = await supabase
    .from('v2_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_name', user)
    .eq('is_read', false);

  if (error) throw error;
  res.json({ count: count || 0 });
}));

/**
 * POST /api/notifications
 * Create a notification
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    user_name,
    title,
    message,
    type,
    entity_type,
    entity_id,
    entity_link,
    priority
  } = req.body;

  if (!user_name || !title || !message) {
    return res.status(400).json({
      error: 'User name, title, and message are required'
    });
  }

  const { data, error } = await supabase
    .from('v2_notifications')
    .insert({
      user_name,
      title,
      message,
      type: type || 'info',
      entity_type,
      entity_id,
      entity_link,
      priority: priority || 'normal'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * POST /api/notifications/bulk
 * Create notifications for multiple users
 */
router.post('/bulk', asyncHandler(async (req, res) => {
  const { users, title, message, type, entity_type, entity_id, entity_link, priority } = req.body;

  if (!users || !users.length || !title || !message) {
    return res.status(400).json({
      error: 'Users array, title, and message are required'
    });
  }

  const notifications = users.map(user_name => ({
    user_name,
    title,
    message,
    type: type || 'info',
    entity_type,
    entity_id,
    entity_link,
    priority: priority || 'normal'
  }));

  const { data, error } = await supabase
    .from('v2_notifications')
    .insert(notifications)
    .select();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  res.json(data);
}));

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for a user
 */
router.post('/mark-all-read', asyncHandler(async (req, res) => {
  const { user = 'Jake Ross' } = req.body;

  const { error } = await supabase
    .from('v2_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('user_name', user)
    .eq('is_read', false);

  if (error) throw error;
  res.json({ success: true, message: 'All notifications marked as read' });
}));

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_notifications')
    .delete()
    .eq('id', id);

  if (error) throw error;
  res.json({ success: true, message: 'Notification deleted' });
}));

/**
 * DELETE /api/notifications/clear-all
 * Clear all notifications for a user
 */
router.delete('/clear-all/:user', asyncHandler(async (req, res) => {
  const { user } = req.params;

  const { error } = await supabase
    .from('v2_notifications')
    .delete()
    .eq('user_name', user);

  if (error) throw error;
  res.json({ success: true, message: 'All notifications cleared' });
}));

// ============================================================
// PREFERENCES
// ============================================================

/**
 * GET /api/notifications/preferences
 * Get notification preferences for a user
 */
router.get('/preferences', asyncHandler(async (req, res) => {
  const { user = 'Jake Ross' } = req.query;

  let { data, error } = await supabase
    .from('v2_notification_preferences')
    .select('*')
    .eq('user_name', user)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  // If no preferences exist, return defaults
  if (!data) {
    data = {
      user_name: user,
      email_enabled: true,
      email_frequency: 'instant',
      in_app_enabled: true,
      sms_enabled: false,
      push_enabled: false,
      phone_number: null,
      type_preferences: {
        invoice_approved: { in_app: true, email: true, sms: false, push: false },
        draw_funded: { in_app: true, email: true, sms: true, push: false },
        task_assigned: { in_app: true, email: true, sms: false, push: false },
        task_due: { in_app: true, email: false, sms: false, push: true },
        inspection_scheduled: { in_app: true, email: true, sms: true, push: false },
        rfi_received: { in_app: true, email: true, sms: false, push: false },
        rfi_response: { in_app: true, email: true, sms: false, push: false },
        submittal_review: { in_app: true, email: true, sms: false, push: false },
        po_approved: { in_app: true, email: true, sms: false, push: false },
        mention: { in_app: true, email: true, sms: false, push: false },
        message: { in_app: true, email: false, sms: false, push: true }
      },
      quiet_hours_start: null,
      quiet_hours_end: null
    };
  }

  res.json(data);
}));

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', asyncHandler(async (req, res) => {
  const {
    user_name = 'Jake Ross',
    email_enabled,
    email_frequency,
    in_app_enabled,
    sms_enabled,
    push_enabled,
    phone_number,
    type_preferences,
    quiet_hours_start,
    quiet_hours_end
  } = req.body;

  // Upsert preferences
  const { data, error } = await supabase
    .from('v2_notification_preferences')
    .upsert({
      user_name,
      email_enabled,
      email_frequency,
      in_app_enabled,
      sms_enabled,
      push_enabled,
      phone_number,
      type_preferences,
      quiet_hours_start,
      quiet_hours_end
    }, {
      onConflict: 'user_name'
    })
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * PATCH /api/notifications/preferences
 * Partial update notification preferences
 */
router.patch('/preferences', asyncHandler(async (req, res) => {
  const { user_name = 'Jake Ross', ...updates } = req.body;

  // First check if user has preferences
  const { data: existing } = await supabase
    .from('v2_notification_preferences')
    .select('*')
    .eq('user_name', user_name)
    .single();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('v2_notification_preferences')
      .update(updates)
      .eq('user_name', user_name)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } else {
    // Insert new with updates
    const { data, error } = await supabase
      .from('v2_notification_preferences')
      .insert({ user_name, ...updates })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  }
}));

// ============================================================
// NOTIFICATION LOG
// ============================================================

/**
 * GET /api/notifications/log
 * Get notification history/log
 */
router.get('/log', asyncHandler(async (req, res) => {
  const { user = 'Jake Ross', channel, status, limit = 50, offset = 0 } = req.query;

  const log = await notificationService.getNotificationLog(user, {
    channel,
    status,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json(log);
}));

/**
 * GET /api/notifications/stats
 * Get notification statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const stats = await notificationService.getNotificationStats(parseInt(days));
  stats.sms_enabled = notificationService.isSMSEnabled();

  res.json(stats);
}));

// ============================================================
// SMS ENDPOINTS
// ============================================================

/**
 * GET /api/notifications/sms/status
 * Check if SMS service is configured and enabled
 */
router.get('/sms/status', asyncHandler(async (req, res) => {
  res.json({
    enabled: notificationService.isSMSEnabled(),
    message: notificationService.isSMSEnabled()
      ? 'Twilio SMS service is configured and ready'
      : 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER env vars.'
  });
}));

/**
 * POST /api/notifications/test-sms
 * Send a test SMS message (admin only)
 */
router.post('/test-sms', asyncHandler(async (req, res) => {
  const { to, message } = req.body;

  if (!to) {
    return res.status(400).json({ error: 'Phone number (to) is required' });
  }

  // Check if SMS is enabled
  if (!notificationService.isSMSEnabled()) {
    return res.status(503).json({
      success: false,
      error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER env vars.'
    });
  }

  const testMessage = message || 'This is a test message from Ross Built Construction Management Software.';

  const result = await notificationService.sendSMS(to, testMessage);

  // Log the test
  await notificationService.logNotification({
    user_name: 'Admin',
    notification_type: 'test_sms',
    channel: 'sms',
    recipient: to,
    message: testMessage,
    status: result.success ? 'sent' : 'failed',
    error_message: result.error,
    external_id: result.sid,
    metadata: { test: true }
  });

  if (result.success) {
    res.json({
      success: true,
      message: 'Test SMS sent successfully',
      sid: result.sid
    });
  } else {
    res.status(result.error?.includes('not configured') ? 503 : 400).json({
      success: false,
      error: result.error
    });
  }
}));

/**
 * POST /api/notifications/send
 * Send notification via all configured channels based on user preferences
 */
router.post('/send', asyncHandler(async (req, res) => {
  const {
    user_id,
    user_name,
    notification_type,
    title,
    message,
    email,
    email_body,
    subject,
    entity_type,
    entity_id,
    entity_link,
    priority,
    data
  } = req.body;

  if (!user_name || !notification_type) {
    return res.status(400).json({
      error: 'user_name and notification_type are required'
    });
  }

  const result = await notificationService.notifyUser(user_id, user_name, notification_type, {
    title,
    message,
    email,
    email_body,
    subject,
    entity_type,
    entity_id,
    entity_link,
    priority,
    ...data
  });

  res.json(result);
}));

/**
 * POST /api/notifications/send-bulk
 * Send notification to multiple users
 */
router.post('/send-bulk', asyncHandler(async (req, res) => {
  const { users, notification_type, ...data } = req.body;

  if (!users || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'users array is required' });
  }
  if (!notification_type) {
    return res.status(400).json({ error: 'notification_type is required' });
  }

  const result = await notificationService.notifyUsers(users, notification_type, data);
  res.json(result);
}));

// ============================================================
// SMS TEMPLATES
// ============================================================

/**
 * GET /api/notifications/templates
 * Get all SMS templates
 */
router.get('/templates', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_sms_templates')
    .select('*')
    .order('notification_type');

  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/notifications/templates/:type
 * Get SMS template for a specific notification type
 */
router.get('/templates/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;

  const { data, error } = await supabase
    .from('v2_sms_templates')
    .select('*')
    .eq('notification_type', type)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(data);
}));

/**
 * PUT /api/notifications/templates/:type
 * Update SMS template
 */
router.put('/templates/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { template_text, is_active } = req.body;

  if (!template_text) {
    return res.status(400).json({ error: 'template_text is required' });
  }

  const { data, error } = await supabase
    .from('v2_sms_templates')
    .upsert({
      notification_type: type,
      template_text,
      is_active: is_active !== false
    }, {
      onConflict: 'notification_type'
    })
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * POST /api/notifications/templates/preview
 * Preview a rendered template
 */
router.post('/templates/preview', asyncHandler(async (req, res) => {
  const { template, data } = req.body;

  if (!template) {
    return res.status(400).json({ error: 'template is required' });
  }

  const rendered = notificationService.renderTemplate(template, data || {});
  res.json({ rendered });
}));

module.exports = router;
