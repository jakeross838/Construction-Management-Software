const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// Get user's notification preferences
router.get('/preferences', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const userId = req.query.user_id || 'default-user';

    let { data, error } = await supabase
      .from('v2_lead_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('builder_id', builderId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No preferences found, return defaults
      data = {
        user_id: userId,
        notify_new_lead: true,
        notify_stage_change: true,
        notify_lead_won: true,
        notify_lead_lost: true,
        notify_follow_up_due: true,
        follow_up_reminder_hours: 24,
        notify_stale_leads: true,
        stale_lead_days: 7,
        email_notifications: true,
        in_app_notifications: true,
      };
    } else if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Update user's notification preferences
router.put('/preferences', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const userId = req.body.user_id || 'default-user';
    const preferences = {
      builder_id: builderId,
      user_id: userId,
      notify_new_lead: req.body.notify_new_lead,
      notify_stage_change: req.body.notify_stage_change,
      notify_lead_won: req.body.notify_lead_won,
      notify_lead_lost: req.body.notify_lead_lost,
      notify_follow_up_due: req.body.notify_follow_up_due,
      follow_up_reminder_hours: req.body.follow_up_reminder_hours,
      notify_stale_leads: req.body.notify_stale_leads,
      stale_lead_days: req.body.stale_lead_days,
      email_notifications: req.body.email_notifications,
      in_app_notifications: req.body.in_app_notifications,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('v2_lead_notification_preferences')
      .upsert(preferences, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Get user's notifications
router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const userId = req.query.user_id || 'default-user';
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit) || 50;

    let query = supabase
      .from('v2_lead_notifications')
      .select(`
        *,
        lead:v2_leads(id, first_name, last_name, email, stage)
      `)
      .eq('user_id', userId)
      .eq('builder_id', builderId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Get unread notification count
router.get('/count', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const userId = req.query.user_id || 'default-user';

    const { count, error } = await supabase
      .from('v2_lead_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('builder_id', builderId)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ count });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Mark notification as read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v2_lead_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Mark all notifications as read
router.patch('/read-all', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const userId = req.body.user_id || 'default-user';

    const { data, error } = await supabase
      .from('v2_lead_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('builder_id', builderId)
      .eq('is_read', false)
      .select();

    if (error) throw error;
    res.json({ updated: data.length });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Create a notification (internal use)
router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const notification = {
      builder_id: builderId,
      lead_id: req.body.lead_id,
      user_id: req.body.user_id || 'default-user',
      notification_type: req.body.notification_type,
      title: req.body.title,
      message: req.body.message,
      metadata: req.body.metadata || {},
    };

    const { data, error } = await supabase
      .from('v2_lead_notifications')
      .insert(notification)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Get reminders for a lead
router.get('/reminders', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const userId = req.query.user_id || 'default-user';
    const leadId = req.query.lead_id;

    let query = supabase
      .from('v2_lead_reminders')
      .select(`
        *,
        lead:v2_leads(id, first_name, last_name, email, stage)
      `)
      .eq('user_id', userId)
      .eq('builder_id', builderId)
      .eq('is_dismissed', false)
      .order('reminder_at', { ascending: true });

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Create a reminder
router.post('/reminders', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const reminder = {
      builder_id: builderId,
      lead_id: req.body.lead_id,
      user_id: req.body.user_id || 'default-user',
      reminder_type: req.body.reminder_type || 'custom',
      reminder_at: req.body.reminder_at,
      message: req.body.message,
    };

    const { data, error } = await supabase
      .from('v2_lead_reminders')
      .insert(reminder)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Dismiss a reminder
router.patch('/reminders/:id/dismiss', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v2_lead_reminders')
      .update({
        is_dismissed: true,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error dismissing reminder:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Get due reminders (for scheduled job)
router.get('/reminders/due', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const { data, error } = await supabase
      .from('v2_lead_reminders')
      .select(`
        *,
        lead:v2_leads(id, first_name, last_name, email, stage)
      `)
      .eq('builder_id', builderId)
      .eq('is_sent', false)
      .eq('is_dismissed', false)
      .lte('reminder_at', new Date().toISOString())
      .order('reminder_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching due reminders:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Get stale leads (for alerts)
router.get('/stale-leads', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const days = parseInt(req.query.days) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('v2_leads')
      .select('*')
      .eq('builder_id', builderId)
      .not('stage', 'in', '(won,lost)')
      .lt('updated_at', cutoffDate.toISOString())
      .order('updated_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching stale leads:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Get email templates
router.get('/templates', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const { data, error } = await supabase
      .from('v2_lead_email_templates')
      .select('*')
      .eq('builder_id', builderId)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Update email template
router.put('/templates/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  try {
    const { id } = req.params;
    const template = {
      subject: req.body.subject,
      body_html: req.body.body_html,
      body_text: req.body.body_text,
      is_active: req.body.is_active,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('v2_lead_email_templates')
      .update(template)
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({ error: error.message });
  }
}));

module.exports = router;
