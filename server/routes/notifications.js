/**
 * Notifications API Routes
 * Manages notifications and user preferences
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

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
      type_preferences: {
        task_assigned: true,
        task_due: true,
        rfi_received: true,
        rfi_response: true,
        submittal_review: true,
        invoice_approved: true,
        po_approved: true,
        mention: true,
        message: true
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

module.exports = router;
