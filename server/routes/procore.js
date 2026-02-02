/**
 * Procore Integration Routes
 * Handles OAuth flow, connection management, and sync operations
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

const {
  getAuthorizationUrl,
  storeOAuthState,
  verifyOAuthState,
  exchangeCodeForTokens,
  saveTokens,
  getValidConnection,
  getCurrentCompany,
  disconnect,
  procoreApiRequest,
} = require('../integrations/procore/auth');

const {
  syncJobs,
  syncVendors,
  syncRFIs,
  syncSubmittals,
  fullSync,
} = require('../integrations/procore/sync');

// ============================================================
// OAUTH FLOW
// ============================================================

/**
 * GET /api/integrations/procore/auth-url
 * Get the OAuth authorization URL for connecting Procore
 */
router.get('/auth-url', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const { url, state } = getAuthorizationUrl(builderId);

  // Store state for verification during callback
  await storeOAuthState(builderId, state);

  res.json({ url });
}));

/**
 * GET /api/integrations/procore/connect
 * Redirect to Procore authorization
 */
router.get('/connect', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const { url, state } = getAuthorizationUrl(builderId);

  // Store state for verification during callback
  await storeOAuthState(builderId, state);

  res.redirect(url);
}));

/**
 * GET /api/integrations/procore/callback
 * OAuth callback handler - exchanges code for tokens
 */
router.get('/callback', asyncHandler(async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('[Procore] OAuth error:', error, error_description);
    return res.redirect(`/settings?procore_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code || !state) {
    return res.redirect('/settings?procore_error=Missing+authorization+parameters');
  }

  // Parse state to extract builder_id
  const [builderId, stateToken] = state.split(':');

  if (!builderId || !stateToken) {
    return res.redirect('/settings?procore_error=Invalid+state+parameter');
  }

  // Verify state token
  const isValid = await verifyOAuthState(builderId, stateToken);
  if (!isValid) {
    return res.redirect('/settings?procore_error=State+verification+failed');
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get company info
    const company = await getCurrentCompany(tokens.access_token);

    // Save tokens and company info
    await saveTokens(builderId, tokens, company.id, company.name);

    console.log(`[Procore] Successfully connected for builder ${builderId}, company: ${company.name}`);

    // Redirect with success
    res.redirect('/settings?procore_connected=true');

  } catch (err) {
    console.error('[Procore] Callback error:', err);
    res.redirect(`/settings?procore_error=${encodeURIComponent(err.message)}`);
  }
}));

/**
 * POST /api/integrations/procore/disconnect
 * Disconnect Procore integration
 */
router.post('/disconnect', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  await disconnect(builderId);

  res.json({ success: true, message: 'Procore disconnected' });
}));

// ============================================================
// CONNECTION STATUS
// ============================================================

/**
 * GET /api/integrations/procore/status
 * Get current Procore connection status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ connected: false });
  }

  const { data: integration } = await supabase
    .from('v2_procore_integrations')
    .select('company_id, company_name, enabled, last_sync_at, token_expires_at, sync_settings')
    .eq('builder_id', builderId)
    .single();

  if (!integration || integration.company_id === 'pending') {
    return res.json({ connected: false });
  }

  // Check if token is valid
  const tokenValid = integration.token_expires_at && new Date(integration.token_expires_at) > new Date();

  res.json({
    connected: true,
    companyId: integration.company_id,
    companyName: integration.company_name,
    enabled: integration.enabled,
    lastSyncAt: integration.last_sync_at,
    syncSettings: integration.sync_settings,
    tokenValid,
    needsReauth: !tokenValid,
  });
}));

/**
 * PATCH /api/integrations/procore/settings
 * Update Procore sync settings
 */
router.patch('/settings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const { sync_settings, enabled } = req.body;

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (sync_settings !== undefined) {
    updates.sync_settings = sync_settings;
  }
  if (enabled !== undefined) {
    updates.enabled = enabled;
  }

  const { data, error } = await supabase
    .from('v2_procore_integrations')
    .update(updates)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({ settings: data });
}));

// ============================================================
// SYNC OPERATIONS
// ============================================================

/**
 * POST /api/integrations/procore/sync
 * Trigger a sync operation
 */
router.post('/sync', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const { type = 'full', job_id } = req.body;

  let result;

  switch (type) {
    case 'jobs':
      result = await syncJobs(builderId);
      break;
    case 'vendors':
      result = await syncVendors(builderId);
      break;
    case 'rfis':
      result = await syncRFIs(builderId, job_id);
      break;
    case 'submittals':
      result = await syncSubmittals(builderId, job_id);
      break;
    case 'full':
    default:
      result = await fullSync(builderId);
      break;
  }

  res.json({
    success: true,
    type,
    result,
  });
}));

/**
 * POST /api/integrations/procore/sync/jobs
 * Sync jobs/projects from Procore
 */
router.post('/sync/jobs', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const result = await syncJobs(builderId);
  res.json({ success: true, ...result });
}));

/**
 * POST /api/integrations/procore/sync/vendors
 * Sync vendors from Procore
 */
router.post('/sync/vendors', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const result = await syncVendors(builderId);
  res.json({ success: true, ...result });
}));

/**
 * POST /api/integrations/procore/sync/rfis
 * Sync RFIs from Procore
 */
router.post('/sync/rfis', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id } = req.body;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const result = await syncRFIs(builderId, job_id);
  res.json({ success: true, ...result });
}));

/**
 * POST /api/integrations/procore/sync/submittals
 * Sync submittals from Procore
 */
router.post('/sync/submittals', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id } = req.body;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const result = await syncSubmittals(builderId, job_id);
  res.json({ success: true, ...result });
}));

// ============================================================
// SYNC LOG
// ============================================================

/**
 * GET /api/integrations/procore/log
 * Get sync history
 */
router.get('/log', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { limit = 50, type } = req.query;

  if (!builderId) {
    return res.json({ logs: [] });
  }

  let query = supabase
    .from('v2_procore_sync_log')
    .select('*')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (type) {
    query = query.eq('sync_type', type);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({ logs: data || [] });
}));

/**
 * GET /api/integrations/procore/mappings
 * Get entity mappings for debugging/display
 */
router.get('/mappings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { entity_type, limit = 100 } = req.query;

  if (!builderId) {
    return res.json({ mappings: [] });
  }

  let query = supabase
    .from('v2_procore_entity_map')
    .select('*')
    .eq('builder_id', builderId)
    .order('last_synced_at', { ascending: false })
    .limit(parseInt(limit));

  if (entity_type) {
    query = query.eq('entity_type', entity_type);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({ mappings: data || [] });
}));

// ============================================================
// PROCORE DATA ACCESS (passthrough endpoints for exploration)
// ============================================================

/**
 * GET /api/integrations/procore/projects
 * Get projects directly from Procore (for debugging/exploration)
 */
router.get('/projects', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const connection = await getValidConnection(builderId);

  const projects = await procoreApiRequest(
    connection,
    'GET',
    '/rest/v1.0/projects',
    null,
    { company_id: connection.company_id, per_page: 100 }
  );

  res.json({ projects });
}));

/**
 * GET /api/integrations/procore/company
 * Get company info from Procore
 */
router.get('/company', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  const connection = await getValidConnection(builderId);

  const company = await procoreApiRequest(
    connection,
    'GET',
    `/rest/v1.0/companies/${connection.company_id}`
  );

  res.json({ company });
}));

module.exports = router;
