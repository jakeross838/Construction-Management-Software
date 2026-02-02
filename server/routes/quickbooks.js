/**
 * QuickBooks Online Integration Routes
 * Handles OAuth, sync, and entity mapping
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const crypto = require('crypto');

// QuickBooks OAuth configuration
const QBO_CONFIG = {
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  redirectUri: process.env.QBO_REDIRECT_URI || 'http://localhost:3001/api/quickbooks/callback',
  environment: process.env.QBO_ENVIRONMENT || 'sandbox', // sandbox or production
  scopes: 'com.intuit.quickbooks.accounting openid profile email',
};

// QuickBooks API base URLs
const QBO_BASE_URL = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
};

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

// ============================================================
// OAUTH FLOW
// ============================================================

/**
 * GET /api/quickbooks/connect
 * Initiate OAuth flow - redirect to QuickBooks authorization
 */
router.get('/connect', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in session or database for verification
  await supabase.from('v2_quickbooks_connections').upsert({
    builder_id: builderId,
    realm_id: 'pending',  // Will be updated on callback
    oauth_state: state,
  }, { onConflict: 'builder_id' });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: QBO_CONFIG.clientId,
    redirect_uri: QBO_CONFIG.redirectUri,
    response_type: 'code',
    scope: QBO_CONFIG.scopes,
    state: `${builderId}:${state}`,
  });

  const authUrl = `${QBO_AUTH_URL}?${params}`;
  res.redirect(authUrl);
}));

/**
 * GET /api/quickbooks/callback
 * OAuth callback - exchange code for tokens
 */
router.get('/callback', asyncHandler(async (req, res) => {
  const { code, state, realmId, error } = req.query;

  if (error) {
    console.error('[QBO] OAuth error:', error);
    return res.redirect('/settings?qbo_error=' + encodeURIComponent(error));
  }

  if (!code || !state || !realmId) {
    throw new AppError('VALIDATION_FAILED', 'Missing required OAuth parameters');
  }

  // Parse state to get builder_id
  const [builderId, stateToken] = state.split(':');

  // Verify state token
  const { data: connection, error: connError } = await supabase
    .from('v2_quickbooks_connections')
    .select('oauth_state')
    .eq('builder_id', builderId)
    .single();

  if (connError || !connection || connection.oauth_state !== stateToken) {
    throw new AppError('UNAUTHORIZED', 'Invalid state token');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${QBO_CONFIG.clientId}:${QBO_CONFIG.clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: QBO_CONFIG.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    console.error('[QBO] Token exchange failed:', errorData);
    throw new AppError('INTEGRATION_ERROR', 'Failed to connect to QuickBooks');
  }

  const tokens = await tokenResponse.json();

  // Get company info
  const companyInfo = await getCompanyInfo(realmId, tokens.access_token);

  // Save connection
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase.from('v2_quickbooks_connections').update({
    realm_id: realmId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt.toISOString(),
    company_name: companyInfo?.CompanyName || null,
    is_sandbox: QBO_CONFIG.environment === 'sandbox',
    oauth_state: null,  // Clear state
    updated_at: new Date().toISOString(),
  }).eq('builder_id', builderId);

  // Create default settings if not exists
  await supabase.from('v2_quickbooks_settings').upsert({
    builder_id: builderId,
  }, { onConflict: 'builder_id' });

  // Redirect to settings with success
  res.redirect('/settings?qbo_connected=true');
}));

/**
 * POST /api/quickbooks/disconnect
 * Disconnect QuickBooks integration
 */
router.post('/disconnect', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  const { error } = await supabase
    .from('v2_quickbooks_connections')
    .delete()
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Also delete related data
  await Promise.all([
    supabase.from('v2_quickbooks_entity_map').delete().eq('builder_id', builderId),
    supabase.from('v2_quickbooks_account_mappings').delete().eq('builder_id', builderId),
    supabase.from('v2_quickbooks_settings').delete().eq('builder_id', builderId),
  ]);

  res.json({ success: true });
}));

// ============================================================
// CONNECTION STATUS & SETTINGS
// ============================================================

/**
 * GET /api/quickbooks/status
 * Get QuickBooks connection status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ connected: false });
  }

  const { data: connection } = await supabase
    .from('v2_quickbooks_connections')
    .select('realm_id, company_name, is_sandbox, last_sync_at, sync_enabled, token_expires_at')
    .eq('builder_id', builderId)
    .single();

  if (!connection || connection.realm_id === 'pending') {
    return res.json({ connected: false });
  }

  // Check if token is valid
  const tokenValid = connection.token_expires_at && new Date(connection.token_expires_at) > new Date();

  res.json({
    connected: true,
    companyName: connection.company_name,
    realmId: connection.realm_id,
    isSandbox: connection.is_sandbox,
    lastSyncAt: connection.last_sync_at,
    syncEnabled: connection.sync_enabled,
    tokenValid,
    needsReauth: !tokenValid,
  });
}));

/**
 * GET /api/quickbooks/settings
 * Get QuickBooks sync settings
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ settings: null });
  }

  const { data: settings } = await supabase
    .from('v2_quickbooks_settings')
    .select('*')
    .eq('builder_id', builderId)
    .single();

  res.json({ settings: settings || null });
}));

/**
 * PATCH /api/quickbooks/settings
 * Update QuickBooks sync settings
 */
router.patch('/settings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const updates = { ...req.body, builder_id: builderId, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_quickbooks_settings')
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
 * GET /api/quickbooks/accounts
 * Get QuickBooks accounts for mapping
 */
router.get('/accounts', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const connection = await getValidConnection(builderId);

  const accounts = await qboApiRequest(
    connection,
    'GET',
    `/v3/company/${connection.realm_id}/query`,
    { query: "SELECT * FROM Account WHERE AccountType IN ('Expense', 'Other Expense', 'Cost of Goods Sold') MAXRESULTS 1000" }
  );

  res.json({ accounts: accounts?.QueryResponse?.Account || [] });
}));

/**
 * GET /api/quickbooks/classes
 * Get QuickBooks classes for job mapping
 */
router.get('/classes', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const connection = await getValidConnection(builderId);

  const classes = await qboApiRequest(
    connection,
    'GET',
    `/v3/company/${connection.realm_id}/query`,
    { query: "SELECT * FROM Class MAXRESULTS 1000" }
  );

  res.json({ classes: classes?.QueryResponse?.Class || [] });
}));

/**
 * GET /api/quickbooks/mappings
 * Get cost code to QBO account mappings
 */
router.get('/mappings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  const { data } = await supabase
    .from('v2_quickbooks_account_mappings')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('builder_id', builderId);

  res.json({ mappings: data || [] });
}));

/**
 * POST /api/quickbooks/mappings
 * Create or update account mapping
 */
router.post('/mappings', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { cost_code_id, qbo_expense_account_id, qbo_expense_account_name, qbo_class_id, qbo_class_name } = req.body;

  const { data, error } = await supabase
    .from('v2_quickbooks_account_mappings')
    .upsert({
      builder_id: builderId,
      cost_code_id,
      qbo_expense_account_id,
      qbo_expense_account_name,
      qbo_class_id,
      qbo_class_name,
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
 * POST /api/quickbooks/sync/vendors
 * Sync vendors to QuickBooks
 */
router.post('/sync/vendors', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const connection = await getValidConnection(builderId);

  // Create sync log
  const { data: syncLog } = await supabase
    .from('v2_quickbooks_sync_log')
    .insert({
      builder_id: builderId,
      sync_type: 'entity',
      entity_type: 'vendor',
      direction: 'push',
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  let created = 0, updated = 0, failed = 0;
  const errors = [];

  try {
    // Get local vendors
    const { data: vendors } = await supabase
      .from('v2_vendors')
      .select('*')
      .eq('builder_id', builderId);

    // Get existing mappings
    const { data: mappings } = await supabase
      .from('v2_quickbooks_entity_map')
      .select('local_id, qbo_id, qbo_sync_token')
      .eq('builder_id', builderId)
      .eq('entity_type', 'vendor');

    const mappingMap = new Map(mappings?.map(m => [m.local_id, m]) || []);

    for (const vendor of vendors || []) {
      try {
        const existing = mappingMap.get(vendor.id);

        const qboVendor = {
          DisplayName: vendor.name,
          PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
          PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
        };

        if (existing) {
          // Update existing vendor
          qboVendor.Id = existing.qbo_id;
          qboVendor.SyncToken = existing.qbo_sync_token;

          const result = await qboApiRequest(
            connection,
            'POST',
            `/v3/company/${connection.realm_id}/vendor`,
            qboVendor
          );

          // Update mapping
          await supabase
            .from('v2_quickbooks_entity_map')
            .update({
              qbo_sync_token: result.Vendor.SyncToken,
              last_synced_at: new Date().toISOString(),
            })
            .eq('builder_id', builderId)
            .eq('entity_type', 'vendor')
            .eq('local_id', vendor.id);

          updated++;
        } else {
          // Create new vendor
          const result = await qboApiRequest(
            connection,
            'POST',
            `/v3/company/${connection.realm_id}/vendor`,
            qboVendor
          );

          // Create mapping
          await supabase.from('v2_quickbooks_entity_map').insert({
            builder_id: builderId,
            entity_type: 'vendor',
            local_id: vendor.id,
            qbo_id: result.Vendor.Id,
            qbo_sync_token: result.Vendor.SyncToken,
            last_synced_at: new Date().toISOString(),
          });

          created++;
        }
      } catch (err) {
        failed++;
        errors.push({ vendor_id: vendor.id, vendor_name: vendor.name, error: err.message });
      }
    }

    // Update sync log
    await supabase
      .from('v2_quickbooks_sync_log')
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
      .from('v2_quickbooks_sync_log')
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
 * POST /api/quickbooks/sync/invoice/:id
 * Sync a specific invoice as a Bill in QuickBooks
 */
router.post('/sync/invoice/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const connection = await getValidConnection(builderId);

  // Get invoice with allocations
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

  // Get vendor QBO mapping
  const { data: vendorMapping } = await supabase
    .from('v2_quickbooks_entity_map')
    .select('qbo_id')
    .eq('builder_id', builderId)
    .eq('entity_type', 'vendor')
    .eq('local_id', invoice.vendor_id)
    .single();

  if (!vendorMapping) {
    throw new AppError('VALIDATION_FAILED', 'Vendor not synced to QuickBooks. Sync vendors first.');
  }

  // Get account mappings for line items
  const { data: accountMappings } = await supabase
    .from('v2_quickbooks_account_mappings')
    .select('*')
    .eq('builder_id', builderId);

  const accountMap = new Map(accountMappings?.map(m => [m.cost_code_id, m]) || []);

  // Get settings for default account
  const { data: settings } = await supabase
    .from('v2_quickbooks_settings')
    .select('default_expense_account_id')
    .eq('builder_id', builderId)
    .single();

  // Build Bill object
  const lines = (invoice.allocations || []).map((alloc, index) => {
    const mapping = accountMap.get(alloc.cost_code_id);
    return {
      Id: String(index + 1),
      Amount: alloc.amount,
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: {
        AccountRef: {
          value: mapping?.qbo_expense_account_id || settings?.default_expense_account_id || '1',
        },
        ClassRef: mapping?.qbo_class_id ? { value: mapping.qbo_class_id } : undefined,
      },
      Description: alloc.cost_code?.name || alloc.notes || '',
    };
  });

  // If no allocations, create single line
  if (lines.length === 0) {
    lines.push({
      Id: '1',
      Amount: invoice.amount,
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: settings?.default_expense_account_id || '1' },
      },
      Description: invoice.description || '',
    });
  }

  const qboBill = {
    VendorRef: { value: vendorMapping.qbo_id },
    TxnDate: invoice.invoice_date,
    DueDate: invoice.due_date,
    DocNumber: invoice.invoice_number,
    Line: lines,
  };

  // Check if already synced
  const { data: existingMapping } = await supabase
    .from('v2_quickbooks_entity_map')
    .select('qbo_id, qbo_sync_token')
    .eq('builder_id', builderId)
    .eq('entity_type', 'bill')
    .eq('local_id', id)
    .single();

  let result;
  if (existingMapping) {
    qboBill.Id = existingMapping.qbo_id;
    qboBill.SyncToken = existingMapping.qbo_sync_token;
    result = await qboApiRequest(connection, 'POST', `/v3/company/${connection.realm_id}/bill`, qboBill);

    await supabase
      .from('v2_quickbooks_entity_map')
      .update({
        qbo_sync_token: result.Bill.SyncToken,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', existingMapping.id);
  } else {
    result = await qboApiRequest(connection, 'POST', `/v3/company/${connection.realm_id}/bill`, qboBill);

    await supabase.from('v2_quickbooks_entity_map').insert({
      builder_id: builderId,
      entity_type: 'bill',
      local_id: id,
      qbo_id: result.Bill.Id,
      qbo_sync_token: result.Bill.SyncToken,
      last_synced_at: new Date().toISOString(),
    });
  }

  res.json({ success: true, qbo_bill_id: result.Bill.Id });
}));

/**
 * GET /api/quickbooks/sync/log
 * Get sync history
 */
router.get('/sync/log', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { limit = 50 } = req.query;

  const { data } = await supabase
    .from('v2_quickbooks_sync_log')
    .select('*')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  res.json({ logs: data || [] });
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get valid QBO connection with refreshed token if needed
 */
async function getValidConnection(builderId) {
  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  const { data: connection, error } = await supabase
    .from('v2_quickbooks_connections')
    .select('*')
    .eq('builder_id', builderId)
    .single();

  if (error || !connection || connection.realm_id === 'pending') {
    throw new AppError('NOT_FOUND', 'QuickBooks not connected');
  }

  // Check if token needs refresh
  const tokenExpiry = new Date(connection.token_expires_at);
  const now = new Date();

  if (tokenExpiry <= now) {
    // Refresh token
    const refreshResponse = await fetch(QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${QBO_CONFIG.clientId}:${QBO_CONFIG.clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      throw new AppError('INTEGRATION_ERROR', 'QuickBooks token refresh failed. Please reconnect.');
    }

    const tokens = await refreshResponse.json();
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('v2_quickbooks_connections')
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

/**
 * Make authenticated QBO API request
 */
async function qboApiRequest(connection, method, path, body = null) {
  const baseUrl = QBO_BASE_URL[connection.is_sandbox ? 'sandbox' : 'production'];
  let url = `${baseUrl}${path}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (method === 'GET' && body?.query) {
    url += `?query=${encodeURIComponent(body.query)}`;
  } else if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[QBO] API Error:', errorData);
    throw new AppError('INTEGRATION_ERROR', errorData.Fault?.Error?.[0]?.Message || 'QuickBooks API error');
  }

  return response.json();
}

/**
 * Get company info from QBO
 */
async function getCompanyInfo(realmId, accessToken) {
  const baseUrl = QBO_BASE_URL[QBO_CONFIG.environment];
  const response = await fetch(
    `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data.CompanyInfo;
}

module.exports = router;
