/**
 * Email API Routes
 * Manages email templates and sending functionality
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const emailService = require('../services/email');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// EMAIL TEMPLATES
// ============================================================

/**
 * GET /api/emails/templates
 * List email templates with optional filtering
 */
router.get('/templates', asyncHandler(async (req, res) => {
  const { type, is_default, builder_id } = req.query;

  let query = supabase
    .from('v2_email_templates')
    .select('*')
    .order('template_type')
    .order('name');

  if (type) {
    query = query.eq('template_type', type);
  }
  if (is_default !== undefined) {
    query = query.eq('is_default', is_default === 'true');
  }
  if (builder_id) {
    query = query.eq('builder_id', builder_id);
  } else {
    // Include global templates (no builder_id) and builder-specific ones
    query = query.or('builder_id.is.null');
  }

  const { data, error } = await query;
  if (error) throw error;

  res.json(data);
}));

/**
 * GET /api/emails/templates/:id
 * Get a single email template
 */
router.get('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_email_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(data);
}));

/**
 * POST /api/emails/templates
 * Create a new email template
 */
router.post('/templates', asyncHandler(async (req, res) => {
  const {
    name,
    subject_template,
    body_template,
    template_type,
    variables,
    is_default,
    builder_id
  } = req.body;

  if (!name || !subject_template || !body_template || !template_type) {
    return res.status(400).json({
      error: 'Name, subject_template, body_template, and template_type are required'
    });
  }

  // Validate template_type
  const validTypes = ['invoice_notification', 'draw_submitted', 'task_assigned', 'po_approved', 'bid_request', 'custom'];
  if (!validTypes.includes(template_type)) {
    return res.status(400).json({
      error: `Invalid template_type. Must be one of: ${validTypes.join(', ')}`
    });
  }

  // If setting as default, unset other defaults of the same type
  if (is_default) {
    await supabase
      .from('v2_email_templates')
      .update({ is_default: false })
      .eq('template_type', template_type)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('v2_email_templates')
    .insert({
      name,
      subject_template,
      body_template,
      template_type,
      variables: variables || [],
      is_default: is_default || false,
      builder_id
    })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json(data);
}));

/**
 * PATCH /api/emails/templates/:id
 * Update an email template
 */
router.patch('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    subject_template,
    body_template,
    template_type,
    variables,
    is_default
  } = req.body;

  // Build update object
  const updates = {
    updated_at: new Date().toISOString()
  };

  if (name !== undefined) updates.name = name;
  if (subject_template !== undefined) updates.subject_template = subject_template;
  if (body_template !== undefined) updates.body_template = body_template;
  if (template_type !== undefined) {
    const validTypes = ['invoice_notification', 'draw_submitted', 'task_assigned', 'po_approved', 'bid_request', 'custom'];
    if (!validTypes.includes(template_type)) {
      return res.status(400).json({
        error: `Invalid template_type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    updates.template_type = template_type;
  }
  if (variables !== undefined) updates.variables = variables;
  if (is_default !== undefined) {
    updates.is_default = is_default;

    // If setting as default, unset other defaults
    if (is_default) {
      // Get the current template to know its type
      const { data: current } = await supabase
        .from('v2_email_templates')
        .select('template_type')
        .eq('id', id)
        .single();

      if (current) {
        await supabase
          .from('v2_email_templates')
          .update({ is_default: false })
          .eq('template_type', template_type || current.template_type)
          .eq('is_default', true)
          .neq('id', id);
      }
    }
  }

  const { data, error } = await supabase
    .from('v2_email_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/emails/templates/:id
 * Delete an email template
 */
router.delete('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_email_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({ success: true, message: 'Template deleted' });
}));

/**
 * POST /api/emails/templates/:id/preview
 * Preview a template with sample variables
 */
router.post('/templates/:id/preview', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { variables = {} } = req.body;

  const result = await emailService.renderTemplateById(id, variables);

  res.json({
    subject: result.subject,
    body: result.body,
    template: {
      id: result.template.id,
      name: result.template.name,
      template_type: result.template.template_type,
      variables: result.template.variables
    }
  });
}));

// ============================================================
// SEND EMAIL
// ============================================================

/**
 * POST /api/emails/send
 * Send an email (with or without template)
 */
router.post('/send', asyncHandler(async (req, res) => {
  const {
    to,
    cc,
    bcc,
    subject,
    body,
    body_html,
    attachments,
    template_id,
    template_type,
    variables,
    related_entity_type,
    related_entity_id,
    created_by = 'Jake Ross',
    builder_id
  } = req.body;

  if (!to) {
    return res.status(400).json({ error: 'Recipient email (to) is required' });
  }

  let result;

  // Use template if specified
  if (template_id || template_type) {
    result = await emailService.sendTemplatedEmail({
      templateId: template_id,
      templateType: template_type,
      variables: variables || {},
      to,
      cc,
      bcc,
      attachments,
      relatedEntityType: related_entity_type,
      relatedEntityId: related_entity_id,
      createdBy: created_by,
      builderId: builder_id
    });
  } else {
    // Direct email without template
    if (!subject || !body) {
      return res.status(400).json({
        error: 'Subject and body are required when not using a template'
      });
    }

    result = await emailService.sendEmail({
      to,
      cc,
      bcc,
      subject,
      body,
      bodyHtml: body_html,
      attachments,
      relatedEntityType: related_entity_type,
      relatedEntityId: related_entity_id,
      createdBy: created_by,
      builderId: builder_id
    });
  }

  res.json(result);
}));

/**
 * POST /api/emails/send-bulk
 * Send the same email to multiple recipients (individually)
 */
router.post('/send-bulk', asyncHandler(async (req, res) => {
  const {
    recipients,  // Array of {email, variables}
    template_id,
    template_type,
    base_variables = {},
    related_entity_type,
    related_entity_id,
    created_by = 'Jake Ross',
    builder_id
  } = req.body;

  if (!recipients || !recipients.length) {
    return res.status(400).json({ error: 'Recipients array is required' });
  }

  if (!template_id && !template_type) {
    return res.status(400).json({ error: 'Either template_id or template_type is required for bulk send' });
  }

  const results = [];
  const errors = [];

  for (const recipient of recipients) {
    try {
      const mergedVariables = {
        ...base_variables,
        ...(recipient.variables || {})
      };

      const result = await emailService.sendTemplatedEmail({
        templateId: template_id,
        templateType: template_type,
        variables: mergedVariables,
        to: recipient.email,
        relatedEntityType: related_entity_type,
        relatedEntityId: related_entity_id,
        createdBy: created_by,
        builderId: builder_id
      });

      results.push({
        email: recipient.email,
        success: true,
        emailId: result.emailId
      });
    } catch (err) {
      errors.push({
        email: recipient.email,
        success: false,
        error: err.message
      });
    }
  }

  res.json({
    total: recipients.length,
    sent: results.length,
    failed: errors.length,
    results,
    errors
  });
}));

// ============================================================
// SENT EMAILS (History)
// ============================================================

/**
 * GET /api/emails/sent
 * Get sent email history with filtering
 */
router.get('/sent', asyncHandler(async (req, res) => {
  const {
    status,
    related_entity_type,
    related_entity_id,
    created_by,
    builder_id,
    limit = 50,
    offset = 0,
    start_date,
    end_date
  } = req.query;

  let query = supabase
    .from('v2_sent_emails')
    .select(`
      *,
      template:template_id (
        id,
        name,
        template_type
      )
    `)
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (status) {
    query = query.eq('status', status);
  }
  if (related_entity_type) {
    query = query.eq('related_entity_type', related_entity_type);
  }
  if (related_entity_id) {
    query = query.eq('related_entity_id', related_entity_id);
  }
  if (created_by) {
    query = query.eq('created_by', created_by);
  }
  if (builder_id) {
    query = query.eq('builder_id', builder_id);
  }
  if (start_date) {
    query = query.gte('created_at', start_date);
  }
  if (end_date) {
    query = query.lte('created_at', end_date);
  }

  const { data, error } = await query;
  if (error) throw error;

  res.json(data);
}));

/**
 * GET /api/emails/sent/:id
 * Get a single sent email details
 */
router.get('/sent/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_sent_emails')
    .select(`
      *,
      template:template_id (
        id,
        name,
        template_type,
        subject_template,
        body_template
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Sent email not found' });
  }

  res.json(data);
}));

/**
 * POST /api/emails/sent/:id/resend
 * Resend a previously sent email
 */
router.post('/sent/:id/resend', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by = 'Jake Ross' } = req.body;

  // Get the original email
  const { data: original, error } = await supabase
    .from('v2_sent_emails')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!original) {
    return res.status(404).json({ error: 'Original email not found' });
  }

  // Resend with the same content
  const result = await emailService.sendEmail({
    to: original.to_addresses,
    cc: original.cc_addresses,
    bcc: original.bcc_addresses,
    subject: original.subject,
    body: original.body,
    bodyHtml: original.body_html,
    attachments: original.attachments,
    templateId: original.template_id,
    relatedEntityType: original.related_entity_type,
    relatedEntityId: original.related_entity_id,
    createdBy: created_by,
    builderId: original.builder_id
  });

  res.json({
    ...result,
    originalEmailId: id
  });
}));

// ============================================================
// EMAIL STATS & SETTINGS
// ============================================================

/**
 * GET /api/emails/stats
 * Get email sending statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { builder_id, days = 30 } = req.query;

  const stats = await emailService.getEmailStats(builder_id, parseInt(days));

  // Add provider status
  stats.providerConfigured = emailService.isEmailConfigured();
  stats.provider = emailService.isEmailConfigured() ? 'sendgrid' : 'none';

  res.json(stats);
}));

/**
 * GET /api/emails/settings
 * Get email settings for a builder
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const { builder_id } = req.query;

  let query = supabase
    .from('v2_email_settings')
    .select('*');

  if (builder_id) {
    query = query.eq('builder_id', builder_id);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') throw error;

  // Return default settings if none exist
  if (!data) {
    return res.json({
      provider: emailService.isEmailConfigured() ? 'sendgrid' : 'none',
      from_name: 'Ross Built Custom Homes',
      from_email: process.env.SENDGRID_FROM_EMAIL || 'noreply@rossbuilt.com',
      reply_to_email: null,
      signature_html: null,
      footer_html: null
    });
  }

  // Remove sensitive fields
  const { sendgrid_api_key_encrypted, smtp_password_encrypted, ...safeData } = data;

  res.json(safeData);
}));

/**
 * PUT /api/emails/settings
 * Update email settings
 */
router.put('/settings', asyncHandler(async (req, res) => {
  const {
    builder_id,
    provider,
    from_name,
    from_email,
    reply_to_email,
    signature_html,
    footer_html
  } = req.body;

  const updates = {
    provider: provider || 'none',
    from_name,
    from_email,
    reply_to_email,
    signature_html,
    footer_html,
    updated_at: new Date().toISOString()
  };

  if (builder_id) {
    updates.builder_id = builder_id;
  }

  const { data, error } = await supabase
    .from('v2_email_settings')
    .upsert(updates, {
      onConflict: 'builder_id'
    })
    .select()
    .single();

  if (error) throw error;

  // Remove sensitive fields
  const { sendgrid_api_key_encrypted, smtp_password_encrypted, ...safeData } = data;

  res.json(safeData);
}));

/**
 * GET /api/emails/template-types
 * Get available template types and their descriptions
 */
router.get('/template-types', (req, res) => {
  res.json([
    {
      type: 'invoice_notification',
      name: 'Invoice Notification',
      description: 'Sent when an invoice is approved or requires attention',
      defaultVariables: ['invoice_number', 'vendor_name', 'job_name', 'amount', 'approved_by', 'approved_date', 'notes', 'company_name']
    },
    {
      type: 'draw_submitted',
      name: 'Draw Submitted',
      description: 'Sent when a draw is submitted for review/payment',
      defaultVariables: ['draw_number', 'job_name', 'period_start', 'period_end', 'total_amount', 'invoice_count', 'notes', 'company_name']
    },
    {
      type: 'task_assigned',
      name: 'Task Assigned',
      description: 'Sent when a task is assigned to someone',
      defaultVariables: ['task_title', 'assignee_name', 'job_name', 'priority', 'due_date', 'description', 'company_name']
    },
    {
      type: 'po_approved',
      name: 'PO Approved',
      description: 'Sent to vendor when their PO is approved',
      defaultVariables: ['po_number', 'vendor_name', 'job_name', 'total_amount', 'approved_by', 'approved_date', 'scope_of_work', 'company_name']
    },
    {
      type: 'bid_request',
      name: 'Bid Request',
      description: 'Sent to vendors to request bids on a project',
      defaultVariables: ['bid_package_name', 'vendor_name', 'job_name', 'job_address', 'trade_category', 'due_date', 'scope_description', 'company_name']
    },
    {
      type: 'custom',
      name: 'Custom',
      description: 'Custom template for any purpose',
      defaultVariables: ['company_name']
    }
  ]);
});

module.exports = router;
