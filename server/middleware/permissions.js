/**
 * Permissions Middleware
 * Role-based access control for API routes
 */

const { supabase } = require('../../config');

// Cache user permissions for performance (5 minute TTL)
const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user permissions from cache or database
 */
async function getUserPermissions(userId) {
  const cacheKey = `perms_${userId}`;
  const cached = permissionCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  const { data, error } = await supabase
    .from('v2_user_permissions')
    .select('permission_name, role_name')
    .eq('user_id', userId);

  if (error || !data) {
    return { permissions: [], role: null };
  }

  const result = {
    permissions: data.map(p => p.permission_name),
    role: data[0]?.role_name || null
  };

  permissionCache.set(cacheKey, {
    permissions: result,
    timestamp: Date.now()
  });

  return result;
}

/**
 * Clear permission cache for a user (call when role changes)
 */
function clearPermissionCache(userId) {
  permissionCache.delete(`perms_${userId}`);
}

/**
 * Middleware factory to require specific permission(s)
 * @param {string|string[]} requiredPermissions - Permission(s) required
 * @param {object} options - { requireAll: boolean } - require all permissions or any
 */
function requirePermission(requiredPermissions, options = { requireAll: false }) {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async (req, res, next) => {
    try {
      // Get user ID from auth context
      const userId = req.user?.id;

      if (!userId) {
        // No auth - allow for now (auth system handles this)
        return next();
      }

      const { permissions: userPermissions, role } = await getUserPermissions(userId);

      // Store permissions on request for use in routes
      req.userPermissions = userPermissions;
      req.userRole = role;

      // Owner role has all permissions
      if (role === 'owner') {
        return next();
      }

      // Check if user has required permission(s)
      const hasPermission = options.requireAll
        ? permissions.every(p => userPermissions.includes(p))
        : permissions.some(p => userPermissions.includes(p));

      if (!hasPermission) {
        return res.status(403).json({
          error: true,
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
          required: permissions
        });
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      // Allow request on error to not block legitimate users
      next();
    }
  };
}

/**
 * Middleware to load user permissions without requiring any specific one
 * Useful for routes that need to conditionally show/hide features
 */
async function loadPermissions(req, res, next) {
  try {
    const userId = req.user?.id;

    if (userId) {
      const { permissions, role } = await getUserPermissions(userId);
      req.userPermissions = permissions;
      req.userRole = role;
    } else {
      req.userPermissions = [];
      req.userRole = null;
    }

    next();
  } catch (err) {
    console.error('Load permissions error:', err);
    req.userPermissions = [];
    req.userRole = null;
    next();
  }
}

/**
 * Check if the current user has a specific permission
 * For use within route handlers
 */
function hasPermission(req, permission) {
  if (req.userRole === 'owner') return true;
  return req.userPermissions?.includes(permission) || false;
}

/**
 * Filter data based on user permissions
 * Returns only fields the user is allowed to see
 */
function filterByPermission(req, data, sensitiveFields, requiredPermission) {
  if (hasPermission(req, requiredPermission)) {
    return data;
  }

  // Remove sensitive fields if user doesn't have permission
  if (Array.isArray(data)) {
    return data.map(item => {
      const filtered = { ...item };
      sensitiveFields.forEach(field => delete filtered[field]);
      return filtered;
    });
  }

  const filtered = { ...data };
  sensitiveFields.forEach(field => delete filtered[field]);
  return filtered;
}

module.exports = {
  requirePermission,
  loadPermissions,
  hasPermission,
  filterByPermission,
  clearPermissionCache,
  getUserPermissions
};
