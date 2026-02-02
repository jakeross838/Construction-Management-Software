/**
 * Xero Integration Routes
 * Handles OAuth, sync, and entity mapping
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const crypto = require('crypto');

// Xero OAuth configuration
const XERO_CONFIG = {
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUri: process.env.XERO_REDIRECT_URI || 'http://localhost:3001/api/xero/callback',
  scopes: 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access',
};

// Xero API URLs
const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_API_URL = 'https://api.xero.com/api.xro/2.0';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

// ============================================================
// OAUTH FLOW
// ============================================================

/**
 * GET /api/xero/connect
 * Initiate OAuth flow
 */
router.get('/connect', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store state
  await supabase.from('v2_xero_connections').upsert({
    builder_id: builderId,
    tenant_id: 'pending',
    oauth_state: state,
  }, { onConflict: 'builder_id' });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: XERO_CONFIG.clientId,
    redirect_uri: XERO_CONFIG.redirectUri,
    response_type: 'code',
    scope: XERO_CONFIG.scopes,
    state: `${builderId}:${state}`,
  });

  const authUrl = `${XERO_AUTH_URL}?${params}`;
  res.redirect(authUrl);
}));

/**
 * GET /api/xero/callback
 * OAuth callback
 */
router.get('/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[Xero] OAuth error:', error);
    return res.redirect('/settings?xero_error=' + encodeURIComponent(error));
  }

  if (!code || !state) {
    throw new AppError('VALIDATION_FAILED', 'Missing required OAuth parameters');
  }

  const [builderId, stateToken] = state.split(':');

  // Verify state token
  const { data: connection, error: connError } = await supabase
    .from('v2_xero_connections')
    .select('oauth_state')
    .eq('builder_id', builderId)
    .single();

  if (connError || !connection || connection.oauth_state !== stateToken) {
    throw new AppError('UNAUTHORIZED', 'Invalid state token');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${XERO_CONFIG.clientId}:${XERO_CONFIG.clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: XERO_CONFIG.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    console.error('[Xero] Token exchange failed:', errorData);
    throw new AppError('INTEGRATION_ERROR', 'Failed to connect to Xero');
  }

  const tokens = await tokenResponse.json();

  // Get tenant connections
  const connectionsResponse = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  const connections = await connectionsResponse.json();
  const tenant = connections[0]; // Use first tenant

  if (!tenant) {
    throw new AppError('INTEGRATION_ERROR', 'No Xero organization found');
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase.from('v2_xero_connections').update({
    tenant_id: tenant.tenantId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    id_token: tokens.id_token,
    token_expires_at: expiresAt.toISOString(),
    organization_name: tenant.tenantName,
    oauth_state: null,
    updated_at: new Date().toISOString(),
  }).eq('builder_id', builderId);

  // Create default settings
  await supabase.from('v2_xero_settings').upsert({
    builder_id: builderId,
  }, { onConflict: 'builder_id' });

  res.redirect('/settings?xero_connected=true');
}));

/**
 * POST /api/xero/disconnect
 */
router.post('/disconnect', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  await supabase.from('v2_xero_connections').delete().eq('builder_id', builderId);
  await Promise.all([
    supabase.from('v2_xero_entity_map').delete().eq('builder_id', builderId),
    supabase.from('v2_xero_account_mappings').delete().eq('builder_id', builderId),
    supabase.from('v2_xero_settings').delete().eq('builder_id', builderId),
  ]);

  res.json({ success: true });
}));

// ============================================================
// CONNECTION STATUS & SETTINGS
// ============================================================

/**
 * GET /api/xero/status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ connected: false });
  }

  const { data: connection } = await supabase
    .from('v2_xero_connections')
    .select('tenant_id, organization_name, last_sync_at, sync_enabled, token_expires_at')
    .eq('builder_id', builderId)
    .single();

  if (!connection || connection.tenant_id === 'pending') {
    return res.json({ connected: false });
  }

  const tokenValid = connection.token_expires_at && new Date(connection.token_expires_at) > new Date();

  res.json({
    connected: true,
    organizationName: connection.organization_name,
    tenantId: connection.tenant_id,
    lastSyncAt: connection.last_sync_at,
    syncEnabled: connection.sync_enabled,
    tokenValid,
    needsReauth: !tokenValid,
  });
}));

/**
 * GET /api/xero/settings
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ settings: null });
  }

  const { data: settings } = await supabase
    .from('v2_xero_settings')
    .select('*')
    .eq('builder_id', builderId)
    .single();

  res.json({ settings: settings || null });
}));

/**
 * PATCH /api/xero/settings
 */
router.patch('/settings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const updates = { ...req.body, builder_id: builderId, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_xero_settings')
    .upsert(updates, { onConflict: 'builder_id' })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ settings: data });
}));

// ============================================================
// ACCOUNT MAPPINGS
// ============================================================

/**
 * GET /api/xero/accounts
 */
router.get('/accounts', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const connection = await getValidConnection(builderId);

  const accounts = await xeroApiRequest(
    connection,
    'GET',
    '/Accounts',
    { where: 'Type=="EXPENSE" OR Type=="DIRECTCOSTS"' }
  );

  res.json({ accounts: accounts?.Accounts || [] });
}));

/**
 * GET /api/xero/tracking-categories
 */
router.get('/tracking-categories', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const connection = await getValidConnection(builderId);

  const categories = await xeroApiRequest(connection, 'GET', '/TrackingCategories');

  res.json({ categories: categories?.TrackingCategories || [] });
}));

/**
 * GET /api/xero/mappings
 */
router.get('/mappings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  const { data } = await supabase
    .from('v2_xero_account_mappings')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('builder_id', builderId);

  res.json({ mappings: data || [] });
}));

/**
 * POST /api/xero/mappings
 */
router.post('/mappings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { cost_code_id, xero_account_id, xero_account_code, xero_account_name, xero_tracking_category_id, xero_tracking_option_id } = req.body;

  const { data, error } = await supabase
    .from('v2_xero_account_mappings')
    .upsert({
      builder_id: builderId,
      cost_code_id,
      xero_account_id,
      xero_account_code,
      xero_account_name,
      xero_tracking_category_id,
      xero_tracking_option_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'builder_id, cost_code_id' })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ mapping: data });
}));

// ============================================================
// SYNC OPERATIONS
// ============================================================

/**
 * POST /api/xero/sync/contacts
 * Sync vendors to Xero as Contacts
 */
router.post('/sync/contacts', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const connection = await getValidConnection(builderId);

  const { data: syncLog } = await supabase
    .from('v2_xero_sync_log')
    .insert({
      builder_id: builderId,
      sync_type: 'entity',
      entity_type: 'contact',
      direction: 'push',
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  let created = 0, updated = 0, failed = 0;
  const errors = [];

  try {
    const { data: vendors } = await supabase
      .from('v2_vendors')
      .select('*')
      .eq('builder_id', builderId);

    const { data: mappings } = await supabase
      .from('v2_xero_entity_map')
      .select('local_id, xero_id')
      .eq('builder_id', builderId)
      .eq('entity_type', 'contact');

    const mappingMap = new Map(mappings?.map(m => [m.local_id, m]) || []);

    for (const vendor of vendors || []) {
      try {
        const existing = mappingMap.get(vendor.id);

        const xeroContact = {
          Name: vendor.name,
          EmailAddress: vendor.email,
          Phones: vendor.phone ? [{ PhoneType: 'DEFAULT', PhoneNumber: vendor.phone }] : [],
          IsSupplier: true,
        };

        if (existing) {
          xeroContact.ContactID = existing.xero_id;
          const result = await xeroApiRequest(connection, 'POST', '/Contacts', { Contacts: [xeroContact] });

          await supabase
            .from('v2_xero_entity_map')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('builder_id', builderId)
            .eq('entity_type', 'contact')
            .eq('local_id', vendor.id);

          updated++;
        } else {
          const result = await xeroApiRequest(connection, 'POST', '/Contacts', { Contacts: [xeroContact] });
          const createdContact = result.Contacts?.[0];

          if (createdContact?.ContactID) {
            await supabase.from('v2_xero_entity_map').insert({
              builder_id: builderId,
              entity_type: 'contact',
              local_id: vendor.id,
              xero_id: createdContact.ContactID,
              last_synced_at: new Date().toISOString(),
            });
          }

          created++;
        }
      } catch (err) {
        failed++;
        errors.push({ vendor_id: vendor.id, vendor_name: vendor.name, error: err.message });
      }
    }

    await supabase
      .from('v2_xero_sync_log')
      .update({
        status: 'success',
        records_processed: (vendors || []).length,
        records_created: created,
        records_updated: updated,
        records_failed: failed,
        error_details: errors.length > 0 ? { errors } : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    res.json({ success: true, created, updated, failed, errors });
  } catch (err) {
    await supabase
      .from('v2_xero_sync_log')
      .update({
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    throw err;
  }
}));

/**
 * POST /api/xero/sync/invoice/:id
 * Sync invoice as Bill in Xero
 */
router.post('/sync/invoice/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const connection = await getValidConnection(builderId);

  const { data: invoice, error: invError } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      vendor:v2_vendors(*),
      allocations:v2_invoice_allocations(*, cost_code:v2_cost_codes(*))
    `)
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (invError || !invoice) {
    throw new AppError('NOT_FOUND', 'Invoice not found');
  }

  // Get vendor mapping
  const { data: vendorMapping } = await supabase
    .from('v2_xero_entity_map')
    .select('xero_id')
    .eq('builder_id', builderId)
    .eq('entity_type', 'contact')
    .eq('local_id', invoice.vendor_id)
    .single();

  if (!vendorMapping) {
    throw new AppError('VALIDATION_FAILED', 'Vendor not synced to Xero. Sync contacts first.');
  }

  // Get account mappings
  const { data: accountMappings } = await supabase
    .from('v2_xero_account_mappings')
    .select('*')
    .eq('builder_id', builderId);

  const accountMap = new Map(accountMappings?.map(m => [m.cost_code_id, m]) || []);

  const { data: settings } = await supabase
    .from('v2_xero_settings')
    .select('default_expense_account_code')
    .eq('builder_id', builderId)
    .single();

  // Build Bill (Invoice in Xero)
  const lineItems = (invoice.allocations || []).map((alloc) => {
    const mapping = accountMap.get(alloc.cost_code_id);
    return {
      Description: alloc.cost_code?.name || alloc.notes || '',
      Quantity: 1,
      UnitAmount: alloc.amount,
      AccountCode: mapping?.xero_account_code || settings?.default_expense_account_code || '400',
      Tracking: mapping?.xero_tracking_option_id ? [{
        TrackingCategoryID: mapping.xero_tracking_category_id,
        TrackingOptionID: mapping.xero_tracking_option_id,
      }] : undefined,
    };
  });

  if (lineItems.length === 0) {
    lineItems.push({
      Description: invoice.description || 'Invoice',
      Quantity: 1,
      UnitAmount: invoice.amount,
      AccountCode: settings?.default_expense_account_code || '400',
    });
  }

  const xeroBill = {
    Type: 'ACCPAY',  // Accounts Payable = Bill
    Contact: { ContactID: vendorMapping.xero_id },
    Date: invoice.invoice_date,
    DueDate: invoice.due_date,
    Reference: invoice.invoice_number,
    LineItems: lineItems,
    Status: 'AUTHORISED',
  };

  // Check if already synced
  const { data: existingMapping } = await supabase
    .from('v2_xero_entity_map')
    .select('xero_id')
    .eq('builder_id', builderId)
    .eq('entity_type', 'bill')
    .eq('local_id', id)
    .single();

  let result;
  if (existingMapping) {
    xeroBill.InvoiceID = existingMapping.xero_id;
    result = await xeroApiRequest(connection, 'POST', '/Invoices', { Invoices: [xeroBill] });

    await supabase
      .from('v2_xero_entity_map')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('builder_id', builderId)
      .eq('entity_type', 'bill')
      .eq('local_id', id);
  } else {
    result = await xeroApiRequest(connection, 'POST', '/Invoices', { Invoices: [xeroBill] });
    const createdBill = result.Invoices?.[0];

    if (createdBill?.InvoiceID) {
      await supabase.from('v2_xero_entity_map').insert({
        builder_id: builderId,
        entity_type: 'bill',
        local_id: id,
        xero_id: createdBill.InvoiceID,
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  res.json({ success: true, xero_bill_id: result.Invoices?.[0]?.InvoiceID });
}));

/**
 * GET /api/xero/sync/log
 */
router.get('/sync/log', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { limit = 50 } = req.query;

  const { data } = await supabase
    .from('v2_xero_sync_log')
    .select('*')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  res.json({ logs: data || [] });
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getValidConnection(builderId) {
  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  const { data: connection, error } = await supabase
    .from('v2_xero_connections')
    .select('*')
    .eq('builder_id', builderId)
    .single();

  if (error || !connection || connection.tenant_id === 'pending') {
    throw new AppError('NOT_FOUND', 'Xero not connected');
  }

  // Check if token needs refresh
  const tokenExpiry = new Date(connection.token_expires_at);
  const now = new Date();

  if (tokenExpiry <= now) {
    const refreshResponse = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${XERO_CONFIG.clientId}:${XERO_CONFIG.clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      throw new AppError('INTEGRATION_ERROR', 'Xero token refresh failed. Please reconnect.');
    }

    const tokens = await refreshResponse.json();
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('v2_xero_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('builder_id', builderId);

    connection.access_token = tokens.access_token;
    connection.refresh_token = tokens.refresh_token;
    connection.token_expires_at = newExpiry.toISOString();
  }

  return connection;
}

async function xeroApiRequest(connection, method, path, body = null) {
  let url = `${XERO_API_URL}${path}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Xero-tenant-id': connection.tenant_id,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (method === 'GET' && body?.where) {
    url += `?where=${encodeURIComponent(body.where)}`;
  } else if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Xero] API Error:', errorData);
    throw new AppError('INTEGRATION_ERROR', errorData.Message || 'Xero API error');
  }

  return response.json();
}

module.exports = router;
