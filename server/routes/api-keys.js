/**
 * API Keys Management Routes
 * Handles API key CRUD and validation
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const crypto = require('crypto');

// Generate a secure API key
function generateApiKey() {
  const prefix = 'rba_'; // Ross Built API
  const key = crypto.randomBytes(32).toString('hex');
  return prefix + key;
}

// Hash API key for storage
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ============================================================
// API KEY MANAGEMENT
// ============================================================

/**
 * GET /api/api-keys
 * List all API keys for builder
 */
router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ keys: [] });
  }

  const { data: keys, error } = await supabase
    .from('v2_api_keys')
    .select(`
      id,
      name,
      key_prefix,
      scopes,
      rate_limit,
      last_used_at,
      request_count,
      expires_at,
      is_active,
      created_at,
      revoked_at,
      created_by:v2_users(id, email, first_name, last_name)
    `)
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ keys: keys || [] });
}));

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { name, scopes = ['read'], expires_in_days } = req.body;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  if (!name) {
    throw new AppError('VALIDATION_FAILED', 'Name is required');
  }

  // Check feature access (API access requires Enterprise plan)
  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select('plan:v2_pricing_plans(api_access)')
    .eq('builder_id', builderId)
    .in('status', ['active', 'trialing'])
    .single();

  if (!subscription?.plan?.api_access) {
    throw new AppError('FORBIDDEN', 'API access requires Enterprise plan');
  }

  // Generate key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12) + '...';

  // Calculate expiry
  let expiresAt = null;
  if (expires_in_days) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);
  }

  const { data: newKey, error } = await supabase
    .from('v2_api_keys')
    .insert({
      builder_id: builderId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes,
      expires_at: expiresAt?.toISOString(),
    })
    .select('id, name, key_prefix, scopes, rate_limit, expires_at, created_at')
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Return the key ONCE - it won't be retrievable again
  res.status(201).json({
    key: newKey,
    api_key: apiKey,  // Only shown once!
    warning: 'Store this API key securely. It will not be shown again.',
  });
}));

/**
 * PATCH /api/api-keys/:id
 * Update an API key
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { name, scopes, rate_limit, is_active } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (scopes !== undefined) updates.scopes = scopes;
  if (rate_limit !== undefined) updates.rate_limit = rate_limit;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('v2_api_keys')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'API key not found');

  res.json({ key: data });
}));

/**
 * DELETE /api/api-keys/:id
 * Revoke an API key
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true });
}));

/**
 * GET /api/api-keys/:id/usage
 * Get API key usage statistics
 */
router.get('/:id/usage', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { days = 7 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  // Get request stats
  const { data: requests } = await supabase
    .from('v2_api_requests')
    .select('method, endpoint, status_code, created_at')
    .eq('api_key_id', id)
    .eq('builder_id', builderId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(1000);

  // Calculate stats
  const totalRequests = requests?.length || 0;
  const successRequests = requests?.filter(r => r.status_code >= 200 && r.status_code < 300).length || 0;
  const errorRequests = requests?.filter(r => r.status_code >= 400).length || 0;

  // Group by endpoint
  const byEndpoint = requests?.reduce((acc, r) => {
    const key = `${r.method} ${r.endpoint}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}) || {};

  // Group by day
  const byDay = requests?.reduce((acc, r) => {
    const day = new Date(r.created_at).toISOString().split('T')[0];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {}) || {};

  res.json({
    usage: {
      total_requests: totalRequests,
      success_requests: successRequests,
      error_requests: errorRequests,
      by_endpoint: byEndpoint,
      by_day: byDay,
    },
  });
}));

module.exports = router;
