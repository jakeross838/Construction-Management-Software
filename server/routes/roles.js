/**
 * Roles Management Routes
 * API for managing user roles and permissions
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const { requirePermission, clearPermissionCache } = require('../middleware/permissions');

// ============================================================
// ROLES
// ============================================================

/**
 * GET /api/roles
 * List all available roles
 */
router.get('/', asyncHandler(async (req, res) => {
  const { data: roles, error } = await supabase
    .from('v2_roles')
    .select('*')
    .order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ roles });
}));

/**
 * GET /api/roles/:id
 * Get role with its permissions
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: role, error } = await supabase
    .from('v2_roles')
    .select(`
      *,
      permissions:v2_role_permissions(
        permission:v2_permissions(id, name, display_name, category)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!role) throw new AppError('NOT_FOUND', 'Role not found');

  // Flatten permissions
  role.permissions = role.permissions?.map(rp => rp.permission) || [];

  res.json({ role });
}));

// ============================================================
// PERMISSIONS
// ============================================================

/**
 * GET /api/roles/permissions/all
 * List all available permissions grouped by category
 */
router.get('/permissions/all', asyncHandler(async (req, res) => {
  const { data: permissions, error } = await supabase
    .from('v2_permissions')
    .select('*')
    .order('category')
    .order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Group by category
  const grouped = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  res.json({ permissions, grouped });
}));

// ============================================================
// TEAM MANAGEMENT
// ============================================================

/**
 * GET /api/roles/team
 * List team members with their roles
 */
router.get('/team/members', requirePermission('team.view'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_users')
    .select(`
      id,
      email,
      first_name,
      last_name,
      role:v2_roles(id, name, display_name),
      created_at,
      last_sign_in_at
    `)
    .order('created_at', { ascending: false });

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data: members, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ members });
}));

/**
 * PATCH /api/roles/team/:userId/role
 * Update a team member's role
 */
router.patch('/team/:userId/role', requirePermission('team.manage'), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role_id } = req.body;
  const builderId = getBuilderId(req);

  if (!role_id) {
    throw new AppError('VALIDATION_FAILED', 'role_id is required');
  }

  // Verify the role exists
  const { data: role, error: roleError } = await supabase
    .from('v2_roles')
    .select('id, name')
    .eq('id', role_id)
    .single();

  if (roleError || !role) {
    throw new AppError('NOT_FOUND', 'Role not found');
  }

  // Prevent changing owner role for the last owner
  if (role.name !== 'owner') {
    const { data: currentUser } = await supabase
      .from('v2_users')
      .select('role:v2_roles(name)')
      .eq('id', userId)
      .single();

    if (currentUser?.role?.name === 'owner') {
      // Check if this is the last owner
      let ownerQuery = supabase
        .from('v2_users')
        .select('id', { count: 'exact', head: true })
        .eq('role_id', (await supabase.from('v2_roles').select('id').eq('name', 'owner').single()).data?.id);

      if (builderId) {
        ownerQuery = ownerQuery.eq('builder_id', builderId);
      }

      const { count } = await ownerQuery;

      if (count <= 1) {
        throw new AppError('VALIDATION_FAILED', 'Cannot change role of the last owner');
      }
    }
  }

  // Update the user's role
  let updateQuery = supabase
    .from('v2_users')
    .update({ role_id })
    .eq('id', userId);

  if (builderId) {
    updateQuery = updateQuery.eq('builder_id', builderId);
  }

  const { data: updatedUser, error: updateError } = await updateQuery
    .select(`
      id,
      email,
      first_name,
      last_name,
      role:v2_roles(id, name, display_name)
    `)
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);
  if (!updatedUser) throw new AppError('NOT_FOUND', 'User not found');

  // Clear permission cache for this user
  clearPermissionCache(userId);

  res.json({ user: updatedUser });
}));

/**
 * POST /api/roles/team/invite
 * Invite a new team member
 */
router.post('/team/invite', requirePermission('team.invite'), asyncHandler(async (req, res) => {
  const { email, first_name, last_name, role_id } = req.body;
  const builderId = getBuilderId(req);

  if (!email) {
    throw new AppError('VALIDATION_FAILED', 'email is required');
  }

  // Get default role if not specified
  let finalRoleId = role_id;
  if (!finalRoleId) {
    const { data: defaultRole } = await supabase
      .from('v2_roles')
      .select('id')
      .eq('name', 'field_worker')
      .single();
    finalRoleId = defaultRole?.id;
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('v2_users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    throw new AppError('DUPLICATE', 'A user with this email already exists');
  }

  // Create pending invitation
  const { data: invitation, error } = await supabase
    .from('v2_team_invitations')
    .insert({
      builder_id: builderId,
      email: email.toLowerCase(),
      first_name,
      last_name,
      role_id: finalRoleId,
      invited_by: req.user?.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    })
    .select(`
      *,
      role:v2_roles(name, display_name)
    `)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('DUPLICATE', 'An invitation has already been sent to this email');
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // TODO: Send invitation email

  res.status(201).json({ invitation });
}));

/**
 * DELETE /api/roles/team/:userId
 * Remove a team member
 */
router.delete('/team/:userId', requirePermission('team.remove'), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const builderId = getBuilderId(req);

  // Can't remove yourself
  if (req.user?.id === userId) {
    throw new AppError('VALIDATION_FAILED', 'Cannot remove yourself from the team');
  }

  // Check if this is the last owner
  const { data: user } = await supabase
    .from('v2_users')
    .select('role:v2_roles(name)')
    .eq('id', userId)
    .single();

  if (user?.role?.name === 'owner') {
    let ownerQuery = supabase
      .from('v2_users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', (await supabase.from('v2_roles').select('id').eq('name', 'owner').single()).data?.id);

    if (builderId) {
      ownerQuery = ownerQuery.eq('builder_id', builderId);
    }

    const { count } = await ownerQuery;

    if (count <= 1) {
      throw new AppError('VALIDATION_FAILED', 'Cannot remove the last owner');
    }
  }

  // Soft delete the user (or remove from builder)
  let deleteQuery = supabase
    .from('v2_users')
    .update({
      deleted_at: new Date().toISOString(),
      builder_id: null // Remove from builder
    })
    .eq('id', userId);

  if (builderId) {
    deleteQuery = deleteQuery.eq('builder_id', builderId);
  }

  const { error } = await deleteQuery;

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Clear permission cache
  clearPermissionCache(userId);

  res.json({ success: true });
}));

/**
 * GET /api/roles/me/permissions
 * Get current user's permissions
 */
router.get('/me/permissions', asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.json({ permissions: [], role: null });
  }

  const { data, error } = await supabase
    .from('v2_user_permissions')
    .select('permission_name, role_name, role_display_name')
    .eq('user_id', userId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const permissions = data?.map(p => p.permission_name) || [];
  const role = data?.[0] ? {
    name: data[0].role_name,
    display_name: data[0].role_display_name
  } : null;

  res.json({ permissions, role });
}));

module.exports = router;
