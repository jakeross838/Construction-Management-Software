/**
 * Procore OAuth 2.0 Authentication Module
 * Handles authorization flow, token management, and API requests
 */

const { supabase } = require('../../../config');
const { AppError } = require('../../core/errors');
const crypto = require('crypto');

// Procore OAuth configuration
const PROCORE_CONFIG = {
  clientId: process.env.PROCORE_CLIENT_ID,
  clientSecret: process.env.PROCORE_CLIENT_SECRET,
  redirectUri: process.env.PROCORE_REDIRECT_URI || 'http://localhost:3001/api/integrations/procore/callback',
  // Scopes for construction management sync
  scopes: [
    'read',
    'write',
    'company_directory',
    'projects',
    'submittals',
    'rfis',
    'documents'
  ].join(' '),
};

// Procore API endpoints
const PROCORE_URLS = {
  authorize: 'https://login.procore.com/oauth/authorize',
  token: 'https://login.procore.com/oauth/token',
  api: 'https://api.procore.com',
  sandbox: 'https://sandbox.procore.com',
};

/**
 * Generate the OAuth authorization URL
 * @param {string} builderId - The builder ID for state tracking
 * @returns {string} The authorization URL
 */
function getAuthorizationUrl(builderId) {
  if (!PROCORE_CONFIG.clientId) {
    throw new AppError('CONFIGURATION_ERROR', 'Procore client ID not configured');
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  const stateData = `${builderId}:${state}`;

  const params = new URLSearchParams({
    client_id: PROCORE_CONFIG.clientId,
    redirect_uri: PROCORE_CONFIG.redirectUri,
    response_type: 'code',
    scope: PROCORE_CONFIG.scopes,
    state: stateData,
  });

  return {
    url: `${PROCORE_URLS.authorize}?${params}`,
    state: state,
  };
}

/**
 * Store OAuth state for verification during callback
 * @param {string} builderId - The builder ID
 * @param {string} state - The state token
 */
async function storeOAuthState(builderId, state) {
  // Upsert to handle reconnection scenarios
  const { error } = await supabase
    .from('v2_procore_integrations')
    .upsert({
      builder_id: builderId,
      company_id: 'pending',
      access_token: state,  // Temporarily store state here
      enabled: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'builder_id' });

  if (error) {
    throw new AppError('DATABASE_ERROR', 'Failed to store OAuth state');
  }
}

/**
 * Verify OAuth state during callback
 * @param {string} builderId - The builder ID
 * @param {string} state - The state token to verify
 * @returns {boolean} True if state is valid
 */
async function verifyOAuthState(builderId, state) {
  const { data, error } = await supabase
    .from('v2_procore_integrations')
    .select('access_token')
    .eq('builder_id', builderId)
    .eq('company_id', 'pending')
    .single();

  if (error || !data) {
    return false;
  }

  return data.access_token === state;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - The authorization code from callback
 * @returns {Object} Token response
 */
async function exchangeCodeForTokens(code) {
  if (!PROCORE_CONFIG.clientId || !PROCORE_CONFIG.clientSecret) {
    throw new AppError('CONFIGURATION_ERROR', 'Procore credentials not configured');
  }

  const response = await fetch(PROCORE_URLS.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: PROCORE_CONFIG.redirectUri,
      client_id: PROCORE_CONFIG.clientId,
      client_secret: PROCORE_CONFIG.clientSecret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Procore] Token exchange failed:', errorData);
    throw new AppError('INTEGRATION_ERROR', 'Failed to exchange authorization code');
  }

  return response.json();
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken - The refresh token
 * @returns {Object} New token response
 */
async function refreshAccessToken(refreshToken) {
  if (!PROCORE_CONFIG.clientId || !PROCORE_CONFIG.clientSecret) {
    throw new AppError('CONFIGURATION_ERROR', 'Procore credentials not configured');
  }

  const response = await fetch(PROCORE_URLS.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: PROCORE_CONFIG.clientId,
      client_secret: PROCORE_CONFIG.clientSecret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Procore] Token refresh failed:', errorData);
    throw new AppError('INTEGRATION_ERROR', 'Failed to refresh Procore token. Please reconnect.');
  }

  return response.json();
}

/**
 * Save tokens to database
 * @param {string} builderId - The builder ID
 * @param {Object} tokens - Token response from Procore
 * @param {string} companyId - Procore company ID
 * @param {string} companyName - Procore company name
 */
async function saveTokens(builderId, tokens, companyId, companyName) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const { error } = await supabase
    .from('v2_procore_integrations')
    .update({
      company_id: companyId,
      company_name: companyName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('builder_id', builderId);

  if (error) {
    throw new AppError('DATABASE_ERROR', 'Failed to save Procore tokens');
  }
}

/**
 * Get a valid connection with refreshed token if needed
 * @param {string} builderId - The builder ID
 * @returns {Object} Connection with valid access token
 */
async function getValidConnection(builderId) {
  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  const { data: connection, error } = await supabase
    .from('v2_procore_integrations')
    .select('*')
    .eq('builder_id', builderId)
    .single();

  if (error || !connection || connection.company_id === 'pending') {
    throw new AppError('NOT_FOUND', 'Procore not connected');
  }

  if (!connection.enabled) {
    throw new AppError('INTEGRATION_DISABLED', 'Procore integration is disabled');
  }

  // Check if token needs refresh (with 5-minute buffer)
  const tokenExpiry = new Date(connection.token_expires_at);
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  const now = new Date();

  if (tokenExpiry <= new Date(now.getTime() + bufferTime)) {
    console.log('[Procore] Refreshing expired token for builder:', builderId);

    const tokens = await refreshAccessToken(connection.refresh_token);
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('v2_procore_integrations')
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
 * Make an authenticated API request to Procore
 * @param {Object} connection - Valid connection object
 * @param {string} method - HTTP method
 * @param {string} path - API endpoint path
 * @param {Object} body - Request body (for POST/PATCH)
 * @param {Object} queryParams - URL query parameters
 * @returns {Object} API response data
 */
async function procoreApiRequest(connection, method, path, body = null, queryParams = null) {
  let url = `${PROCORE_URLS.api}${path}`;

  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params}`;
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Procore-Company-Id': connection.company_id,
    },
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Procore] API Error:', response.status, errorData);

    if (response.status === 401) {
      throw new AppError('UNAUTHORIZED', 'Procore authentication expired. Please reconnect.');
    }
    if (response.status === 403) {
      throw new AppError('FORBIDDEN', 'Insufficient permissions in Procore');
    }
    if (response.status === 404) {
      throw new AppError('NOT_FOUND', 'Resource not found in Procore');
    }
    if (response.status === 429) {
      throw new AppError('RATE_LIMITED', 'Procore API rate limit exceeded');
    }

    throw new AppError('INTEGRATION_ERROR', errorData.errors?.[0]?.message || 'Procore API error');
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Get the current user's company from Procore
 * @param {string} accessToken - Valid access token
 * @returns {Object} Company info
 */
async function getCurrentCompany(accessToken) {
  const response = await fetch(`${PROCORE_URLS.api}/rest/v1.0/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new AppError('INTEGRATION_ERROR', 'Failed to get Procore user info');
  }

  const user = await response.json();

  // Get the first company (or primary company)
  const companiesResponse = await fetch(`${PROCORE_URLS.api}/rest/v1.0/companies`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!companiesResponse.ok) {
    throw new AppError('INTEGRATION_ERROR', 'Failed to get Procore companies');
  }

  const companies = await companiesResponse.json();

  // Return first company or throw if none
  if (!companies || companies.length === 0) {
    throw new AppError('INTEGRATION_ERROR', 'No Procore company found for this account');
  }

  return {
    id: String(companies[0].id),
    name: companies[0].name,
    user: {
      id: user.id,
      email: user.login,
      name: user.name,
    },
  };
}

/**
 * Disconnect Procore integration
 * @param {string} builderId - The builder ID
 */
async function disconnect(builderId) {
  // Delete integration and related data
  const { data: integration } = await supabase
    .from('v2_procore_integrations')
    .select('id')
    .eq('builder_id', builderId)
    .single();

  if (integration) {
    // Delete webhooks
    await supabase
      .from('v2_procore_webhooks')
      .delete()
      .eq('builder_id', builderId);

    // Delete entity mappings
    await supabase
      .from('v2_procore_entity_map')
      .delete()
      .eq('builder_id', builderId);

    // Delete sync logs (keep for audit? or delete?)
    // For now, keep sync logs for historical audit

    // Delete integration
    await supabase
      .from('v2_procore_integrations')
      .delete()
      .eq('builder_id', builderId);
  }
}

module.exports = {
  PROCORE_CONFIG,
  PROCORE_URLS,
  getAuthorizationUrl,
  storeOAuthState,
  verifyOAuthState,
  exchangeCodeForTokens,
  refreshAccessToken,
  saveTokens,
  getValidConnection,
  procoreApiRequest,
  getCurrentCompany,
  disconnect,
};
