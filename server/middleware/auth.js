/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user/builder context
 */

const { supabase } = require('../../config');
const { AppError } = require('../core/errors');

/**
 * Middleware to require authentication
 * Validates the JWT token and attaches user/builder to req
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'No authorization token provided'));
  }

  const token = authHeader.substring(7);

  try {
    // Verify the JWT token with Supabase
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    }

    // Get user from v2_users with builder info
    const { data: user, error: userError } = await supabase
      .from('v2_users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        builder_id,
        builder:v2_builders (
          id,
          name,
          slug,
          plan,
          address,
          city,
          state,
          zip,
          phone,
          email,
          website,
          license_number,
          logo_url
        )
      `)
      .eq('id', authUser.id)
      .is('deleted_at', null)
      .single();

    if (userError || !user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'User profile not found'));
    }

    // Attach user and builder to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      builderId: user.builder_id,
    };

    req.builder = user.builder;
    req.authToken = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication failed'));
  }
}

/**
 * Middleware to optionally authenticate
 * If token present, validates and attaches user
 * If no token, continues without user
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token - continue without user
    req.user = null;
    req.builder = null;
    return next();
  }

  // Token present - validate it
  return requireAuth(req, res, next);
}

/**
 * Middleware to require specific roles
 * Must be used after requireAuth
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', `This action requires one of these roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
}

/**
 * Middleware to require owner or admin role
 */
const requireAdmin = requireRole('owner', 'admin');

/**
 * Middleware to require financial permissions
 * Allows: owner, admin, accounting, pm
 */
const requireFinancialAccess = requireRole('owner', 'admin', 'accounting', 'pm');

/**
 * Permission-based middleware factory
 * Creates middleware that checks if user has a specific permission
 */
const rolePermissions = {
  owner: {
    canViewAllJobs: true, canCreateJobs: true, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: true, canViewLeads: true, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: true, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: true,
  },
  admin: {
    canViewAllJobs: true, canCreateJobs: true, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: true, canViewLeads: true, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: true, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: true,
  },
  accounting: {
    canViewAllJobs: true, canCreateJobs: false, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: false, canViewContracts: true, canEditSchedule: false, canSubmitDailyLog: false,
    canUploadFiles: false, canViewSettings: false,
  },
  pm: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: true, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: false, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false,
  },
  supervisor: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false,
  },
  office: {
    canViewAllJobs: true, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: false,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: false, canSubmitDailyLog: false,
    canUploadFiles: false, canViewSettings: false,
  },
  field_crew: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: false,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: false, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false,
  },
};

function hasPermission(role, permission) {
  return rolePermissions[role]?.[permission] ?? false;
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!hasPermission(req.user.role, permission)) {
      return next(new AppError(403, 'FORBIDDEN', `You don't have permission to: ${permission}`));
    }

    next();
  };
}

/**
 * Helper to get builder_id filter for queries
 * Returns the builder_id from the authenticated user
 * For use in database queries to ensure tenant isolation
 */
function getBuilderFilter(req) {
  if (!req.user || !req.user.builderId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Builder context required');
  }
  return req.user.builderId;
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireFinancialAccess,
  requirePermission,
  hasPermission,
  getBuilderFilter,
};
