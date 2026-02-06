/**
 * Email Service
 * Handles email sending with provider abstraction and template rendering
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');

// Check if SendGrid is configured
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
let sgMail = null;

if (SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
    logger.info('SendGrid email provider configured');
  } catch (err) {
    logger.warn('SendGrid package not installed. Email sending will be logged only.');
  }
}

/**
 * Simple template rendering with Handlebars-like syntax
 * Supports {{variable}} and {{#if variable}}...{{/if}} blocks
 */
function renderTemplate(template, variables = {}) {
  let rendered = template;

  // Handle conditional blocks: {{#if variable}}content{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  rendered = rendered.replace(conditionalRegex, (match, varName, content) => {
    const value = variables[varName];
    if (value && value !== '' && value !== null && value !== undefined) {
      return content;
    }
    return '';
  });

  // Handle variable substitution: {{variable}}
  const variableRegex = /\{\{(\w+)\}\}/g;
  rendered = rendered.replace(variableRegex, (match, varName) => {
    const value = variables[varName];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return '';
  });

  return rendered.trim();
}

/**
 * Render a template by ID with given variables
 */
async function renderTemplateById(templateId, variables = {}) {
  const { data: template, error } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error || !template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return {
    subject: renderTemplate(template.subject_template, variables),
    body: renderTemplate(template.body_template, variables),
    template
  };
}

/**
 * Get default template by type
 */
async function getDefaultTemplate(templateType) {
  const { data, error } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('template_type', templateType)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

/**
 * Send email via configured provider
 * Falls back to logging if no provider is configured
 */
async function sendEmail({
  to,
  cc = [],
  bcc = [],
  subject,
  body,
  bodyHtml,
  attachments = [],
  from,
  replyTo,
  templateId = null,
  relatedEntityType = null,
  relatedEntityId = null,
  createdBy = 'System',
  builderId = null
}) {
  // Normalize to array
  const toAddresses = Array.isArray(to) ? to : [to];
  const ccAddresses = Array.isArray(cc) ? cc : (cc ? [cc] : []);
  const bccAddresses = Array.isArray(bcc) ? bcc : (bcc ? [bcc] : []);

  // Validate
  if (!toAddresses.length || !toAddresses[0]) {
    throw new Error('At least one recipient email is required');
  }
  if (!subject) {
    throw new Error('Email subject is required');
  }
  if (!body && !bodyHtml) {
    throw new Error('Email body is required');
  }

  // Create sent email record
  const { data: sentEmail, error: insertError } = await supabase
    .from('v2_sent_emails')
    .insert({
      builder_id: builderId,
      template_id: templateId,
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      bcc_addresses: bccAddresses,
      subject,
      body,
      body_html: bodyHtml,
      attachments,
      status: 'pending',
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      created_by: createdBy
    })
    .select()
    .single();

  if (insertError) {
    logger.error('Failed to create sent email record:', insertError);
    throw insertError;
  }

  // Try to send via SendGrid if configured
  if (sgMail && SENDGRID_API_KEY) {
    try {
      const msg = {
        to: toAddresses,
        cc: ccAddresses.length ? ccAddresses : undefined,
        bcc: bccAddresses.length ? bccAddresses : undefined,
        from: from || process.env.SENDGRID_FROM_EMAIL || process.env.NOREPLY_EMAIL || 'noreply@example.com',
        replyTo: replyTo,
        subject,
        text: body,
        html: bodyHtml || body.replace(/\n/g, '<br>'),
        attachments: attachments.map(att => ({
          filename: att.name,
          content: att.content, // Base64 encoded content
          type: att.type,
          disposition: 'attachment'
        })).filter(att => att.content) // Only include attachments with content
      };

      const [response] = await sgMail.send(msg);

      // Update status to sent
      await supabase
        .from('v2_sent_emails')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: response?.headers?.['x-message-id'] || null
        })
        .eq('id', sentEmail.id);

      logger.info(`Email sent successfully to ${toAddresses.join(', ')}`);

      return {
        success: true,
        emailId: sentEmail.id,
        messageId: response?.headers?.['x-message-id'],
        provider: 'sendgrid'
      };
    } catch (sendError) {
      // Update status to failed
      await supabase
        .from('v2_sent_emails')
        .update({
          status: 'failed',
          error_message: sendError.message
        })
        .eq('id', sentEmail.id);

      logger.error('SendGrid send failed:', sendError);
      throw sendError;
    }
  }

  // No email provider configured - log and mark as sent (for development)
  logger.info('='.repeat(60));
  logger.info('EMAIL (No provider configured - logged only)');
  logger.info('='.repeat(60));
  logger.info(`To: ${toAddresses.join(', ')}`);
  if (ccAddresses.length) logger.info(`CC: ${ccAddresses.join(', ')}`);
  if (bccAddresses.length) logger.info(`BCC: ${bccAddresses.join(', ')}`);
  logger.info(`Subject: ${subject}`);
  logger.info('-'.repeat(60));
  logger.info(body);
  logger.info('='.repeat(60));

  // Mark as sent for development/testing purposes
  await supabase
    .from('v2_sent_emails')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: 'No email provider configured - logged only'
    })
    .eq('id', sentEmail.id);

  return {
    success: true,
    emailId: sentEmail.id,
    messageId: null,
    provider: 'none',
    logged: true
  };
}

/**
 * Send email using a template
 */
async function sendTemplatedEmail({
  templateId,
  templateType,
  variables = {},
  to,
  cc,
  bcc,
  attachments,
  relatedEntityType,
  relatedEntityId,
  createdBy,
  builderId
}) {
  let template;

  if (templateId) {
    const { data, error } = await supabase
      .from('v2_email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      throw new Error(`Template not found: ${templateId}`);
    }
    template = data;
  } else if (templateType) {
    template = await getDefaultTemplate(templateType);
    if (!template) {
      throw new Error(`No default template found for type: ${templateType}`);
    }
  } else {
    throw new Error('Either templateId or templateType is required');
  }

  const subject = renderTemplate(template.subject_template, variables);
  const body = renderTemplate(template.body_template, variables);

  return sendEmail({
    to,
    cc,
    bcc,
    subject,
    body,
    attachments,
    templateId: template.id,
    relatedEntityType,
    relatedEntityId,
    createdBy,
    builderId
  });
}

/**
 * Get email sending statistics
 */
async function getEmailStats(builderId = null, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('v2_sent_emails')
    .select('status, created_at')
    .gte('created_at', startDate.toISOString());

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const stats = {
    total: data.length,
    sent: data.filter(e => e.status === 'sent').length,
    delivered: data.filter(e => e.status === 'delivered').length,
    failed: data.filter(e => e.status === 'failed').length,
    bounced: data.filter(e => e.status === 'bounced').length,
    pending: data.filter(e => e.status === 'pending').length,
    opened: data.filter(e => e.status === 'opened').length
  };

  stats.deliveryRate = stats.total > 0
    ? ((stats.sent + stats.delivered) / stats.total * 100).toFixed(1)
    : 0;

  return stats;
}

/**
 * Check if email provider is configured
 */
function isEmailConfigured() {
  return !!(SENDGRID_API_KEY && sgMail);
}

module.exports = {
  sendEmail,
  sendTemplatedEmail,
  renderTemplate,
  renderTemplateById,
  getDefaultTemplate,
  getEmailStats,
  isEmailConfigured
};
