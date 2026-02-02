/**
 * Slack Integration Service
 * Handles sending notifications to Slack via incoming webhooks
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Simple encryption for webhook URLs at rest
// In production, use a proper secrets manager (AWS Secrets Manager, Vault, etc.)
const ENCRYPTION_KEY = process.env.SLACK_ENCRYPTION_KEY || 'default-key-replace-in-production';
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a value (webhook URL)
 */
function encrypt(text) {
  if (!text) return null;
  try {
    // Use SHA-256 to ensure we have exactly 32 bytes for the key
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    logger.error('Encryption failed:', err);
    return text; // Fallback to plaintext if encryption fails
  }
}

/**
 * Decrypt a value (webhook URL)
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  // Check if it looks encrypted (has the iv:data format)
  if (!encryptedText.includes(':')) {
    return encryptedText; // Not encrypted, return as-is
  }
  try {
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.error('Decryption failed:', err);
    return encryptedText; // Return as-is if decryption fails
  }
}

/**
 * Send a message to Slack via incoming webhook
 * @param {string} webhookUrl - The Slack incoming webhook URL
 * @param {object} message - The Slack message payload
 * @returns {Promise<{success: boolean, status?: number, error?: string}>}
 */
async function sendSlackMessage(webhookUrl, message) {
  if (!webhookUrl) {
    return { success: false, error: 'No webhook URL provided' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      return { success: true, status: response.status };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        status: response.status,
        error: `Slack API error: ${response.status} - ${errorText}`,
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err.name === 'TimeoutError' ? 'Request timed out' : err.message,
    };
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format an invoice notification for Slack
 * @param {string} eventType - The event type (invoice_received, invoice_approved, etc.)
 * @param {object} invoice - The invoice data
 * @returns {object} Slack message payload
 */
function formatInvoiceNotification(eventType, invoice) {
  const emoji = {
    invoice_received: ':inbox_tray:',
    invoice_approved: ':white_check_mark:',
    invoice_denied: ':x:',
    invoice_in_draw: ':bank:',
    invoice_paid: ':moneybag:',
  }[eventType] || ':page_facing_up:';

  const colorMap = {
    invoice_received: '#3498db',  // Blue
    invoice_approved: '#27ae60',  // Green
    invoice_denied: '#e74c3c',    // Red
    invoice_in_draw: '#9b59b6',   // Purple
    invoice_paid: '#2ecc71',      // Bright green
  };

  const title = {
    invoice_received: 'New Invoice Received',
    invoice_approved: 'Invoice Approved',
    invoice_denied: 'Invoice Denied',
    invoice_in_draw: 'Invoice Added to Draw',
    invoice_paid: 'Invoice Paid',
  }[eventType] || 'Invoice Update';

  const fields = [
    {
      type: 'mrkdwn',
      text: `*Vendor*\n${invoice.vendor?.name || invoice.vendor_name || 'Unknown'}`,
    },
    {
      type: 'mrkdwn',
      text: `*Amount*\n${formatCurrency(invoice.amount)}`,
    },
    {
      type: 'mrkdwn',
      text: `*Job*\n${invoice.job?.name || invoice.job_name || 'Unassigned'}`,
    },
    {
      type: 'mrkdwn',
      text: `*Invoice #*\n${invoice.invoice_number || 'N/A'}`,
    },
  ];

  if (invoice.invoice_date) {
    fields.push({
      type: 'mrkdwn',
      text: `*Date*\n${formatDate(invoice.invoice_date)}`,
    });
  }

  if (eventType === 'invoice_approved' && invoice.approved_by) {
    fields.push({
      type: 'mrkdwn',
      text: `*Approved By*\n${invoice.approved_by}`,
    });
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: fields.slice(0, 2),
      },
      {
        type: 'section',
        fields: fields.slice(2, 4),
      },
      ...(fields.length > 4 ? [{
        type: 'section',
        fields: fields.slice(4),
      }] : []),
      {
        type: 'divider',
      },
    ],
    attachments: [
      {
        color: colorMap[eventType] || '#3498db',
        fallback: `${title}: ${invoice.vendor?.name || 'Unknown'} - ${formatCurrency(invoice.amount)}`,
      },
    ],
  };
}

/**
 * Format a draw notification for Slack
 * @param {string} eventType - The event type (draw_created, draw_submitted, draw_funded)
 * @param {object} draw - The draw data
 * @returns {object} Slack message payload
 */
function formatDrawNotification(eventType, draw) {
  const emoji = {
    draw_created: ':clipboard:',
    draw_submitted: ':outbox_tray:',
    draw_funded: ':money_with_wings:',
  }[eventType] || ':page_facing_up:';

  const colorMap = {
    draw_created: '#3498db',
    draw_submitted: '#f39c12',
    draw_funded: '#27ae60',
  };

  const title = {
    draw_created: 'Draw Created',
    draw_submitted: 'Draw Submitted',
    draw_funded: 'Draw Funded',
  }[eventType] || 'Draw Update';

  const fields = [
    {
      type: 'mrkdwn',
      text: `*Job*\n${draw.job?.name || draw.job_name || 'Unknown'}`,
    },
    {
      type: 'mrkdwn',
      text: `*Draw #*\n${draw.draw_number || 'N/A'}`,
    },
    {
      type: 'mrkdwn',
      text: `*Amount*\n${formatCurrency(draw.total_amount)}`,
    },
    {
      type: 'mrkdwn',
      text: `*Period End*\n${formatDate(draw.period_end)}`,
    },
  ];

  if (eventType === 'draw_funded' && draw.funded_amount) {
    fields.push({
      type: 'mrkdwn',
      text: `*Funded Amount*\n${formatCurrency(draw.funded_amount)}`,
    });
  }

  if (draw.invoice_count) {
    fields.push({
      type: 'mrkdwn',
      text: `*Invoices*\n${draw.invoice_count}`,
    });
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: fields.slice(0, 2),
      },
      {
        type: 'section',
        fields: fields.slice(2, 4),
      },
      ...(fields.length > 4 ? [{
        type: 'section',
        fields: fields.slice(4),
      }] : []),
      {
        type: 'divider',
      },
    ],
    attachments: [
      {
        color: colorMap[eventType] || '#3498db',
        fallback: `${title}: ${draw.job?.name || 'Unknown'} - Draw #${draw.draw_number} - ${formatCurrency(draw.total_amount)}`,
      },
    ],
  };
}

/**
 * Format a task notification for Slack
 * @param {string} eventType - The event type (task_assigned, task_completed)
 * @param {object} task - The task data
 * @returns {object} Slack message payload
 */
function formatTaskNotification(eventType, task) {
  const emoji = {
    task_assigned: ':dart:',
    task_completed: ':white_check_mark:',
    task_overdue: ':warning:',
  }[eventType] || ':clipboard:';

  const colorMap = {
    task_assigned: '#3498db',
    task_completed: '#27ae60',
    task_overdue: '#e74c3c',
  };

  const title = {
    task_assigned: 'Task Assigned',
    task_completed: 'Task Completed',
    task_overdue: 'Task Overdue',
  }[eventType] || 'Task Update';

  const fields = [
    {
      type: 'mrkdwn',
      text: `*Task*\n${task.title || task.name || 'Untitled'}`,
    },
  ];

  if (task.job?.name || task.job_name) {
    fields.push({
      type: 'mrkdwn',
      text: `*Job*\n${task.job?.name || task.job_name}`,
    });
  }

  if (task.assigned_to || task.assignee_name) {
    fields.push({
      type: 'mrkdwn',
      text: `*Assigned To*\n${task.assignee_name || task.assigned_to}`,
    });
  }

  if (task.due_date) {
    fields.push({
      type: 'mrkdwn',
      text: `*Due Date*\n${formatDate(task.due_date)}`,
    });
  }

  if (task.priority) {
    const priorityEmoji = {
      high: ':red_circle:',
      medium: ':large_yellow_circle:',
      low: ':large_green_circle:',
    }[task.priority.toLowerCase()] || '';
    fields.push({
      type: 'mrkdwn',
      text: `*Priority*\n${priorityEmoji} ${task.priority}`,
    });
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: fields.slice(0, 2),
      },
      ...(fields.length > 2 ? [{
        type: 'section',
        fields: fields.slice(2, 4),
      }] : []),
      ...(fields.length > 4 ? [{
        type: 'section',
        fields: fields.slice(4),
      }] : []),
      ...(task.description ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: task.description.length > 200
            ? task.description.substring(0, 200) + '...'
            : task.description,
        },
      }] : []),
      {
        type: 'divider',
      },
    ],
    attachments: [
      {
        color: colorMap[eventType] || '#3498db',
        fallback: `${title}: ${task.title || task.name || 'Untitled'}`,
      },
    ],
  };
}

/**
 * Format a PO notification for Slack
 * @param {string} eventType - The event type (po_created, po_approved)
 * @param {object} po - The purchase order data
 * @returns {object} Slack message payload
 */
function formatPONotification(eventType, po) {
  const emoji = {
    po_created: ':pencil:',
    po_approved: ':white_check_mark:',
  }[eventType] || ':page_facing_up:';

  const colorMap = {
    po_created: '#3498db',
    po_approved: '#27ae60',
  };

  const title = {
    po_created: 'Purchase Order Created',
    po_approved: 'Purchase Order Approved',
  }[eventType] || 'PO Update';

  const fields = [
    {
      type: 'mrkdwn',
      text: `*PO #*\n${po.po_number || 'N/A'}`,
    },
    {
      type: 'mrkdwn',
      text: `*Amount*\n${formatCurrency(po.total_amount)}`,
    },
    {
      type: 'mrkdwn',
      text: `*Vendor*\n${po.vendor?.name || po.vendor_name || 'Unknown'}`,
    },
    {
      type: 'mrkdwn',
      text: `*Job*\n${po.job?.name || po.job_name || 'Unknown'}`,
    },
  ];

  if (po.description) {
    fields.push({
      type: 'mrkdwn',
      text: `*Description*\n${po.description.length > 100
        ? po.description.substring(0, 100) + '...'
        : po.description}`,
    });
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: fields.slice(0, 2),
      },
      {
        type: 'section',
        fields: fields.slice(2, 4),
      },
      ...(fields.length > 4 ? [{
        type: 'section',
        fields: fields.slice(4),
      }] : []),
      {
        type: 'divider',
      },
    ],
    attachments: [
      {
        color: colorMap[eventType] || '#3498db',
        fallback: `${title}: ${po.po_number} - ${po.vendor?.name || 'Unknown'} - ${formatCurrency(po.total_amount)}`,
      },
    ],
  };
}

/**
 * Send a notification to all enabled Slack integrations for a builder
 * @param {string} builderId - The builder ID
 * @param {string} eventType - The event type
 * @param {object} data - The event data
 */
async function notifySlack(builderId, eventType, data) {
  if (!builderId) {
    logger.warn('notifySlack called without builderId');
    return;
  }

  // Get enabled integrations for this builder that have this notification type enabled
  const { data: integrations, error } = await supabase
    .from('v2_slack_integrations')
    .select('*')
    .eq('builder_id', builderId)
    .eq('enabled', true);

  if (error) {
    logger.error('Failed to fetch Slack integrations:', error);
    return;
  }

  if (!integrations?.length) {
    return;
  }

  // Format the message based on event type
  let message;
  if (eventType.startsWith('invoice_')) {
    message = formatInvoiceNotification(eventType, data);
  } else if (eventType.startsWith('draw_')) {
    message = formatDrawNotification(eventType, data);
  } else if (eventType.startsWith('task_')) {
    message = formatTaskNotification(eventType, data);
  } else if (eventType.startsWith('po_')) {
    message = formatPONotification(eventType, data);
  } else {
    // Generic message for unknown event types
    message = {
      text: `${eventType}: ${JSON.stringify(data).substring(0, 200)}`,
    };
  }

  // Send to each enabled integration
  for (const integration of integrations) {
    // Check if this notification type is enabled
    const notificationTypes = integration.notification_types || {};
    if (!notificationTypes[eventType]) {
      continue;
    }

    const webhookUrl = decrypt(integration.webhook_url);
    const result = await sendSlackMessage(webhookUrl, message);

    // Log the message
    await supabase.from('v2_slack_message_log').insert({
      integration_id: integration.id,
      event_type: eventType,
      event_id: data.id,
      message_text: JSON.stringify(message).substring(0, 5000),
      status: result.success ? 'success' : 'failed',
      response_status: result.status,
      error_message: result.error,
      sent_at: result.success ? new Date().toISOString() : null,
    });

    if (!result.success) {
      logger.error(`Failed to send Slack notification to ${integration.channel_name}:`, result.error);
    }
  }
}

/**
 * Send a test message to verify webhook configuration
 * @param {string} webhookUrl - The Slack webhook URL (already decrypted)
 * @returns {Promise<object>} Result of the test
 */
async function sendTestMessage(webhookUrl) {
  const testMessage = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':white_check_mark: Slack Integration Test',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a test message from your construction management system. If you can see this, your Slack integration is working correctly!',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Sent at ${new Date().toLocaleString()}`,
          },
        ],
      },
    ],
  };

  return sendSlackMessage(webhookUrl, testMessage);
}

module.exports = {
  sendSlackMessage,
  formatInvoiceNotification,
  formatDrawNotification,
  formatTaskNotification,
  formatPONotification,
  notifySlack,
  sendTestMessage,
  encrypt,
  decrypt,
};
