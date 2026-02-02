/**
 * Client Portal Routes
 * Handles client authentication, invitations, and portal features
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const crypto = require('crypto');

// Helper: Generate secure token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Log client activity
async function logClientActivity(clientId, action, details = {}, req = null) {
  try {
    await supabase.from('v2_client_activity').insert({
      client_id: clientId,
      action,
      details,
      ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      user_agent: req?.headers?.['user-agent'] || null
    });
  } catch (err) {
    console.error('Failed to log client activity:', err);
  }
}

// ============================================================
// BUILDER ENDPOINTS (for managing clients)
// ============================================================

/**
 * GET /api/client-portal/clients
 * List all clients for the builder
 */
router.get('/clients', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id } = req.query;

  // Require builder context for listing clients
  if (!builderId) {
    return res.json({ clients: [] });
  }

  let query = supabase
    .from('v2_clients')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ clients: data || [] });
}));

/**
 * GET /api/client-portal/clients/:id
 * Get a single client
 */
router.get('/clients/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_clients')
    .select(`
      *,
      job:v2_jobs(id, name, address, status)
    `)
    .eq('id', id);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query.single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Client not found');
  }

  // Get recent activity
  const { data: activity } = await supabase
    .from('v2_client_activity')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  res.json({
    ...data,
    activity: activity || []
  });
}));

/**
 * POST /api/client-portal/clients
 * Create a new client
 */
router.post('/clients', asyncHandler(async (req, res) => {
  const {
    job_id,
    email,
    name,
    phone,
    notes,
    portal_enabled,
    send_invitation
  } = req.body;
  const builderId = getBuilderId(req);

  if (!email || !name || !job_id) {
    throw new AppError('VALIDATION_FAILED', 'Email, name, and job are required');
  }

  // Create client
  const clientData = {
    job_id,
    email: email.toLowerCase(),
    name,
    phone,
    notes,
    portal_enabled: portal_enabled || false
  };

  if (builderId) clientData.builder_id = builderId;

  const { data: client, error } = await supabase
    .from('v2_clients')
    .insert(clientData)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('DUPLICATE', 'A client with this email already exists');
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Send invitation if requested
  if (send_invitation && portal_enabled) {
    await sendClientInvitation(client, builderId, req);
  }

  res.status(201).json({ client });
}));

/**
 * PATCH /api/client-portal/clients/:id
 * Update a client
 */
router.patch('/clients/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  const builderId = getBuilderId(req);

  delete updates.id;
  delete updates.builder_id;
  delete updates.created_at;

  let query = supabase
    .from('v2_clients')
    .update(updates)
    .eq('id', id);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Client not found');

  res.json({ client: data });
}));

/**
 * DELETE /api/client-portal/clients/:id
 * Delete a client
 */
router.delete('/clients/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_clients')
    .delete()
    .eq('id', id);

  if (builderId) query = query.eq('builder_id', builderId);

  const { error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true });
}));

/**
 * POST /api/client-portal/clients/:id/invite
 * Send/resend portal invitation
 */
router.post('/clients/:id/invite', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  // Get client
  let clientQuery = supabase
    .from('v2_clients')
    .select('*')
    .eq('id', id);

  if (builderId) clientQuery = clientQuery.eq('builder_id', builderId);

  const { data: client, error: clientError } = await clientQuery.single();

  if (clientError || !client) {
    throw new AppError('NOT_FOUND', 'Client not found');
  }

  // Generate and send invitation
  await sendClientInvitation(client, builderId, req);

  res.json({ success: true, message: 'Invitation sent' });
}));

// Helper: Send client invitation
async function sendClientInvitation(client, builderId, req) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiration

  // Create invitation record
  await supabase.from('v2_client_invitations').insert({
    builder_id: builderId,
    client_id: client.id,
    email: client.email,
    invite_token: token,
    expires_at: expiresAt.toISOString(),
    invited_by: req.headers['x-user-name'] || 'System'
  });

  // Update client with portal token
  await supabase
    .from('v2_clients')
    .update({
      portal_token: token,
      portal_token_expires_at: expiresAt.toISOString(),
      portal_enabled: true
    })
    .eq('id', client.id);

  // In production, send email here
  console.log(`[Client Portal] Invitation token for ${client.email}: ${token}`);
}

// ============================================================
// PORTAL SETTINGS
// ============================================================

/**
 * GET /api/client-portal/settings
 * Get builder's portal settings
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    // Return defaults if no builder context
    return res.json({
      settings: {
        show_budget: false,
        show_schedule: true,
        show_photos: true,
        show_documents: true,
        show_selections: true,
        show_change_orders: true,
        allow_messaging: true,
        auto_notify_photos: true,
        auto_notify_milestones: true
      }
    });
  }

  const { data, error } = await supabase
    .from('v2_client_portal_settings')
    .select('*')
    .eq('builder_id', builderId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Return defaults if no settings exist
  res.json({
    settings: data || {
      show_budget: false,
      show_schedule: true,
      show_photos: true,
      show_documents: true,
      show_selections: true,
      show_change_orders: true,
      allow_messaging: true,
      auto_notify_photos: true,
      auto_notify_milestones: true
    }
  });
}));

/**
 * PATCH /api/client-portal/settings
 * Update builder's portal settings
 */
router.patch('/settings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const updates = { ...req.body, builder_id: builderId };

  const { data, error } = await supabase
    .from('v2_client_portal_settings')
    .upsert(updates, { onConflict: 'builder_id' })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ settings: data });
}));

// ============================================================
// MESSAGES
// ============================================================

/**
 * GET /api/client-portal/messages
 * Get messages for a job
 */
router.get('/messages', asyncHandler(async (req, res) => {
  const { job_id, client_id } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_client_messages')
    .select(`
      *,
      client:v2_clients(id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (builderId) query = query.eq('builder_id', builderId);
  if (job_id) query = query.eq('job_id', job_id);
  if (client_id) query = query.eq('client_id', client_id);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ messages: data || [] });
}));

/**
 * POST /api/client-portal/messages
 * Send a message to a client
 */
router.post('/messages', asyncHandler(async (req, res) => {
  const { job_id, client_id, subject, content, attachments } = req.body;
  const builderId = getBuilderId(req);

  if (!client_id || !content) {
    throw new AppError('VALIDATION_FAILED', 'Client and content are required');
  }

  const { data, error } = await supabase
    .from('v2_client_messages')
    .insert({
      builder_id: builderId,
      job_id,
      client_id,
      subject,
      content,
      direction: 'builder_to_client',
      sender_name: req.headers['x-user-name'] || 'Builder',
      attachments: attachments || []
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json({ message: data });
}));

// ============================================================
// CLIENT-FACING ENDPOINTS (accessed via portal token)
// ============================================================

// Helper: Extract token from Authorization header or query
function getPortalToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return req.query.token || req.body?.token;
}

/**
 * POST /api/client-portal/auth/request-link
 * Client requests a magic login link (sent via email)
 */
router.post('/auth/request-link', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('VALIDATION_FAILED', 'Email is required');
  }

  // Find client by email with portal enabled
  const { data: client, error } = await supabase
    .from('v2_clients')
    .select('*, builder:v2_builders(id, name)')
    .eq('email', email.toLowerCase())
    .eq('portal_enabled', true)
    .single();

  if (error || !client) {
    // Don't reveal if email exists or not for security
    return res.json({ success: true, message: 'If an account exists, a login link will be sent' });
  }

  // Generate token and expiry
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiration

  // Update client with new token
  await supabase
    .from('v2_clients')
    .update({
      portal_token: token,
      portal_token_expires_at: expiresAt.toISOString()
    })
    .eq('id', client.id);

  // In production, send email here
  console.log(`[Client Portal] Login link for ${client.email}: /portal/login?token=${token}`);

  res.json({ success: true, message: 'If an account exists, a login link will be sent' });
}));

/**
 * POST /api/client-portal/auth/magic-link
 * Validate magic link token and return client session
 */
router.post('/auth/magic-link', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new AppError('VALIDATION_FAILED', 'Token is required');
  }

  // Find client by token
  const { data: client, error } = await supabase
    .from('v2_clients')
    .select(`
      *,
      job:v2_jobs(id, name, address, status),
      builder:v2_builders(id, name, logo_url)
    `)
    .eq('portal_token', token)
    .eq('portal_enabled', true)
    .gt('portal_token_expires_at', new Date().toISOString())
    .single();

  if (error || !client) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token');
  }

  // Update last login
  await supabase
    .from('v2_clients')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', client.id);

  // Log activity
  await logClientActivity(client.id, 'login', {}, req);

  // Generate new session token (longer expiry for active session)
  const sessionToken = generateToken();
  const sessionExpiry = new Date();
  sessionExpiry.setDate(sessionExpiry.getDate() + 30); // 30-day session

  await supabase
    .from('v2_clients')
    .update({
      portal_token: sessionToken,
      portal_token_expires_at: sessionExpiry.toISOString()
    })
    .eq('id', client.id);

  // Get portal settings
  const { data: settings } = await supabase
    .from('v2_client_portal_settings')
    .select('*')
    .eq('builder_id', client.builder_id)
    .single();

  res.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email
    },
    job: client.job,
    builder: client.builder,
    settings: settings || {},
    session_token: sessionToken
  });
}));

/**
 * GET /api/client-portal/portal/dashboard
 * Get client dashboard data
 */
router.get('/portal/dashboard', asyncHandler(async (req, res) => {
  const token = getPortalToken(req);

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Token required');
  }

  // Validate token and get client
  const { data: client, error } = await supabase
    .from('v2_clients')
    .select('*, job:v2_jobs(*)')
    .eq('portal_token', token)
    .eq('portal_enabled', true)
    .gt('portal_token_expires_at', new Date().toISOString())
    .single();

  if (error || !client) {
    throw new AppError('UNAUTHORIZED', 'Invalid session');
  }

  // Log activity
  await logClientActivity(client.id, 'view_dashboard', {}, req);

  // Get recent photos
  const { data: photos } = await supabase
    .from('v2_daily_log_photos')
    .select('*')
    .eq('job_id', client.job_id)
    .order('created_at', { ascending: false })
    .limit(12);

  // Get pending selections
  const { data: selections } = await supabase
    .from('v2_selections')
    .select('*')
    .eq('job_id', client.job_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  // Get recent messages
  const { data: messages } = await supabase
    .from('v2_client_messages')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Get milestones/schedule items
  const { data: milestones } = await supabase
    .from('v2_schedule_items')
    .select('*')
    .eq('job_id', client.job_id)
    .eq('is_milestone', true)
    .order('start_date', { ascending: true });

  res.json({
    job: client.job,
    photos: photos || [],
    pending_selections: selections || [],
    recent_messages: messages || [],
    milestones: milestones || []
  });
}));

/**
 * GET /api/client-portal/portal/photos
 * Get all job photos for client
 */
router.get('/portal/photos', asyncHandler(async (req, res) => {
  const token = getPortalToken(req);

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Token required');
  }

  // Validate token
  const { data: client, error } = await supabase
    .from('v2_clients')
    .select('id, job_id')
    .eq('portal_token', token)
    .eq('portal_enabled', true)
    .gt('portal_token_expires_at', new Date().toISOString())
    .single();

  if (error || !client) {
    throw new AppError('UNAUTHORIZED', 'Invalid session');
  }

  // Log activity
  await logClientActivity(client.id, 'view_photos', {}, req);

  const { data: photos } = await supabase
    .from('v2_daily_log_photos')
    .select('*')
    .eq('job_id', client.job_id)
    .order('created_at', { ascending: false });

  res.json({ photos: photos || [] });
}));

/**
 * GET /api/client-portal/portal/messages
 * Get client's messages
 */
router.get('/portal/messages', asyncHandler(async (req, res) => {
  const token = getPortalToken(req);

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Token required');
  }

  // Validate token
  const { data: client, error } = await supabase
    .from('v2_clients')
    .select('id')
    .eq('portal_token', token)
    .eq('portal_enabled', true)
    .gt('portal_token_expires_at', new Date().toISOString())
    .single();

  if (error || !client) {
    throw new AppError('UNAUTHORIZED', 'Invalid session');
  }

  // Log activity
  await logClientActivity(client.id, 'view_messages', {}, req);

  const { data: messages } = await supabase
    .from('v2_client_messages')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: true });

  // Mark builder messages as read
  await supabase
    .from('v2_client_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', client.id)
    .eq('direction', 'builder_to_client')
    .is('read_at', null);

  res.json({ messages: messages || [] });
}));

/**
 * POST /api/client-portal/portal/messages
 * Client sends a message to builder
 */
router.post('/portal/messages', asyncHandler(async (req, res) => {
  const token = getPortalToken(req);
  const { subject, content, attachments } = req.body;

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Token required');
  }

  // Validate token
  const { data: client, error } = await supabase
    .from('v2_clients')
    .select('*, builder_id, job_id')
    .eq('portal_token', token)
    .eq('portal_enabled', true)
    .gt('portal_token_expires_at', new Date().toISOString())
    .single();

  if (error || !client) {
    throw new AppError('UNAUTHORIZED', 'Invalid session');
  }

  if (!content) {
    throw new AppError('VALIDATION_FAILED', 'Message content is required');
  }

  const { data: message, error: msgError } = await supabase
    .from('v2_client_messages')
    .insert({
      builder_id: client.builder_id,
      job_id: client.job_id,
      client_id: client.id,
      subject,
      content,
      direction: 'client_to_builder',
      sender_name: client.name,
      attachments: attachments || []
    })
    .select()
    .single();

  if (msgError) throw new AppError('DATABASE_ERROR', msgError.message);

  // Log activity
  await logClientActivity(client.id, 'send_message', { message_id: message.id }, req);

  res.status(201).json({ message });
}));

module.exports = router;
