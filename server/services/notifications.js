/**
 * Notifications Service
 * Handles sending notifications via multiple channels (SMS, Email, Push, In-App)
 * Twilio integration for SMS with graceful fallback when credentials unavailable
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');

// Twilio client (lazy-loaded)
let twilioClient = null;
let twilioEnabled = false;
let twilioPhoneNumber = null;

/**
 * Initialize Twilio client if credentials are available
 */
function initTwilio() {
  if (twilioClient !== null) return; // Already initialized

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && authToken && twilioPhoneNumber) {
    try {
      const twilio = require('twilio');
      twilioClient = twilio(accountSid, authToken);
      twilioEnabled = true;
      logger.info('Twilio SMS service initialized successfully');
    } catch (err) {
      logger.warn('Failed to initialize Twilio client:', err.message);
      twilioEnabled = false;
    }
  } else {
    logger.info('Twilio credentials not configured - SMS notifications disabled');
    twilioEnabled = false;
  }
}

// Initialize on module load
initTwilio();

/**
 * Check if SMS is available
 */
function isSMSEnabled() {
  return twilioEnabled;
}

/**
 * Send SMS via Twilio
 * @param {string} to - Phone number (E.164 format preferred, e.g., +1234567890)
 * @param {string} message - SMS message text (max 1600 characters)
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendSMS(to, message) {
  if (!twilioEnabled) {
    logger.warn('SMS not sent - Twilio not configured', { to: to.slice(-4) }); // Log last 4 digits only
    return {
      success: false,
      error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER env vars.'
    };
  }

  // Validate phone number format
  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format' };
  }

  // Truncate message if too long (SMS limit is 1600 chars for concatenated messages)
  const truncatedMessage = message.length > 1600
    ? message.substring(0, 1597) + '...'
    : message;

  try {
    const result = await twilioClient.messages.create({
      body: truncatedMessage,
      from: twilioPhoneNumber,
      to: formattedPhone
    });

    logger.info('SMS sent successfully', {
      sid: result.sid,
      to: formattedPhone.slice(-4),
      status: result.status
    });

    return {
      success: true,
      sid: result.sid,
      status: result.status
    };
  } catch (err) {
    logger.error('SMS send failed:', err.message);
    return {
      success: false,
      error: err.message,
      code: err.code
    };
  }
}

/**
 * Format phone number to E.164 format
 * Handles common US formats
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +, assume it's already E.164
  if (cleaned.startsWith('+')) {
    return cleaned.length >= 11 ? cleaned : null;
  }

  // US numbers: add +1 if 10 digits
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }

  // US numbers: add + if 11 digits starting with 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned;
  }

  // Already has country code but no +
  if (cleaned.length >= 11) {
    return '+' + cleaned;
  }

  return null;
}

/**
 * Send email notification (placeholder - integrate with SendGrid, SES, etc.)
 * @param {string} to - Email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (can be HTML)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendEmail(to, subject, body) {
  // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
  logger.info('Email notification (placeholder)', { to, subject });

  return {
    success: false,
    error: 'Email service not yet implemented. Configure SendGrid or AWS SES.'
  };
}

/**
 * Send push notification (placeholder - integrate with FCM, APNs, etc.)
 * @param {string} userId - User ID to send push to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendPush(userId, title, body) {
  // TODO: Integrate with push service (Firebase Cloud Messaging, APNs, etc.)
  logger.info('Push notification (placeholder)', { userId, title });

  return {
    success: false,
    error: 'Push notifications not yet implemented. Configure FCM or APNs.'
  };
}

/**
 * Log a notification attempt to the database
 */
async function logNotification(details) {
  const {
    builder_id,
    user_id,
    user_name,
    notification_type,
    channel,
    recipient,
    subject,
    message,
    status,
    error_message,
    external_id,
    metadata
  } = details;

  try {
    const { data, error } = await supabase
      .from('v2_notification_log')
      .insert({
        builder_id,
        user_id,
        user_name,
        notification_type,
        channel,
        recipient,
        subject,
        message,
        status: status || 'pending',
        sent_at: status === 'sent' || status === 'delivered' ? new Date().toISOString() : null,
        error_message,
        external_id,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    logger.error('Failed to log notification:', err.message);
    return null;
  }
}

/**
 * Update notification log status
 */
async function updateNotificationLog(logId, updates) {
  try {
    const { data, error } = await supabase
      .from('v2_notification_log')
      .update(updates)
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    logger.error('Failed to update notification log:', err.message);
    return null;
  }
}

/**
 * Get user's notification preferences
 */
async function getUserPreferences(userName) {
  try {
    const { data, error } = await supabase
      .from('v2_notification_preferences')
      .select('*')
      .eq('user_name', userName)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Return defaults if no preferences exist
    if (!data) {
      return {
        user_name: userName,
        email_enabled: true,
        sms_enabled: false,
        push_enabled: false,
        in_app_enabled: true,
        phone_number: null,
        email_frequency: 'instant',
        type_preferences: {
          invoice_approved: { in_app: true, email: true, sms: false, push: false },
          draw_funded: { in_app: true, email: true, sms: true, push: false },
          task_assigned: { in_app: true, email: true, sms: false, push: false },
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

    return data;
  } catch (err) {
    logger.error('Failed to get user preferences:', err.message);
    return null;
  }
}

/**
 * Get SMS template for a notification type
 */
async function getSMSTemplate(notificationType) {
  try {
    const { data, error } = await supabase
      .from('v2_sms_templates')
      .select('template_text')
      .eq('notification_type', notificationType)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.template_text || null;
  } catch (err) {
    logger.error('Failed to get SMS template:', err.message);
    return null;
  }
}

/**
 * Render template with variables
 * @param {string} template - Template with {{variable}} placeholders
 * @param {object} data - Key-value pairs for replacement
 */
function renderTemplate(template, data) {
  if (!template) return null;

  let rendered = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(placeholder, String(value ?? ''));
  }
  return rendered;
}

/**
 * Check if we're in quiet hours for the user
 */
function isQuietHours(preferences) {
  if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  const start = preferences.quiet_hours_start;
  const end = preferences.quiet_hours_end;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  return currentTime >= start && currentTime < end;
}

/**
 * Main notification function - sends via appropriate channels based on user preferences
 * @param {string} userId - User ID (optional)
 * @param {string} userName - User name (required)
 * @param {string} notificationType - Type of notification (invoice_approved, draw_funded, etc.)
 * @param {object} data - Data for template rendering and context
 * @returns {Promise<{channels: object, success: boolean}>}
 */
async function notifyUser(userId, userName, notificationType, data = {}) {
  const results = {
    channels: {},
    success: false
  };

  // Get user preferences
  const preferences = await getUserPreferences(userName);
  if (!preferences) {
    logger.warn('Could not get preferences for user:', userName);
    return results;
  }

  // Check quiet hours (skip non-urgent during quiet hours)
  if (isQuietHours(preferences) && data.priority !== 'urgent') {
    logger.info('Skipping notification during quiet hours', { userName, notificationType });
    return results;
  }

  // Get type-specific preferences (or use global settings)
  const typePrefs = preferences.type_preferences?.[notificationType] || {
    in_app: preferences.in_app_enabled,
    email: preferences.email_enabled,
    sms: preferences.sms_enabled,
    push: preferences.push_enabled
  };

  // Common metadata for logging
  const metadata = {
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    job_id: data.job_id,
    ...data.metadata
  };

  // 1. In-App Notification
  if (typePrefs.in_app !== false) {
    try {
      const { error } = await supabase
        .from('v2_notifications')
        .insert({
          user_name: userName,
          title: data.title || notificationType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          message: data.message || '',
          type: notificationType,
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          entity_link: data.entity_link,
          priority: data.priority || 'normal'
        });

      results.channels.in_app = !error;
      if (!error) results.success = true;
    } catch (err) {
      results.channels.in_app = false;
    }
  }

  // 2. SMS Notification
  if (typePrefs.sms && preferences.sms_enabled && preferences.phone_number) {
    const template = await getSMSTemplate(notificationType);
    const smsMessage = template
      ? renderTemplate(template, data)
      : data.message || `Ross Built: ${notificationType.replace(/_/g, ' ')}`;

    const smsResult = await sendSMS(preferences.phone_number, smsMessage);

    await logNotification({
      user_id: userId,
      user_name: userName,
      notification_type: notificationType,
      channel: 'sms',
      recipient: preferences.phone_number,
      message: smsMessage,
      status: smsResult.success ? 'sent' : 'failed',
      error_message: smsResult.error,
      external_id: smsResult.sid,
      metadata
    });

    results.channels.sms = smsResult.success;
    if (smsResult.success) results.success = true;
  }

  // 3. Email Notification
  if (typePrefs.email && preferences.email_enabled && data.email) {
    const emailResult = await sendEmail(
      data.email,
      data.subject || data.title || notificationType.replace(/_/g, ' '),
      data.email_body || data.message || ''
    );

    await logNotification({
      user_id: userId,
      user_name: userName,
      notification_type: notificationType,
      channel: 'email',
      recipient: data.email,
      subject: data.subject || data.title,
      message: data.email_body || data.message,
      status: emailResult.success ? 'sent' : 'failed',
      error_message: emailResult.error,
      metadata
    });

    results.channels.email = emailResult.success;
    if (emailResult.success) results.success = true;
  }

  // 4. Push Notification
  if (typePrefs.push && preferences.push_enabled && userId) {
    const pushResult = await sendPush(
      userId,
      data.title || notificationType.replace(/_/g, ' '),
      data.message || ''
    );

    await logNotification({
      user_id: userId,
      user_name: userName,
      notification_type: notificationType,
      channel: 'push',
      recipient: userId,
      message: data.message,
      status: pushResult.success ? 'sent' : 'failed',
      error_message: pushResult.error,
      metadata
    });

    results.channels.push = pushResult.success;
    if (pushResult.success) results.success = true;
  }

  return results;
}

/**
 * Notify multiple users
 * @param {Array<{userId?: string, userName: string}>} users - Array of users
 * @param {string} notificationType - Type of notification
 * @param {object} data - Data for template and context
 */
async function notifyUsers(users, notificationType, data = {}) {
  const results = await Promise.all(
    users.map(user => notifyUser(user.userId, user.userName, notificationType, data))
  );

  return {
    total: users.length,
    successful: results.filter(r => r.success).length,
    results
  };
}

/**
 * Get notification log for a user
 */
async function getNotificationLog(userName, options = {}) {
  const { limit = 50, offset = 0, channel, status } = options;

  let query = supabase
    .from('v2_notification_log')
    .select('*')
    .eq('user_name', userName)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (channel) query = query.eq('channel', channel);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get notification statistics
 */
async function getNotificationStats(days = 30) {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const { data, error } = await supabase
    .from('v2_notification_log')
    .select('channel, status')
    .gte('created_at', sinceDate.toISOString());

  if (error) throw error;

  const stats = {
    total: data.length,
    by_channel: {},
    by_status: {},
    success_rate: 0
  };

  for (const row of data) {
    stats.by_channel[row.channel] = (stats.by_channel[row.channel] || 0) + 1;
    stats.by_status[row.status] = (stats.by_status[row.status] || 0) + 1;
  }

  const successful = (stats.by_status.sent || 0) + (stats.by_status.delivered || 0);
  stats.success_rate = stats.total > 0 ? (successful / stats.total * 100).toFixed(1) : 0;

  return stats;
}

module.exports = {
  // Core functions
  sendSMS,
  sendEmail,
  sendPush,
  notifyUser,
  notifyUsers,

  // Logging
  logNotification,
  updateNotificationLog,
  getNotificationLog,
  getNotificationStats,

  // Preferences
  getUserPreferences,

  // Templates
  getSMSTemplate,
  renderTemplate,

  // Utilities
  formatPhoneNumber,
  isSMSEnabled,
  isQuietHours
};
