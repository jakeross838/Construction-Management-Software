/**
 * Authentication Routes
 * Handles signup, user profile, and invitations
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, validationError } = require('../core/errors');
const crypto = require('crypto');

// Helper to generate secure tokens
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/auth/signup
 * Creates a new builder organization and owner user after Supabase Auth signup
 */
router.post('/signup', asyncHandler(async (req, res) => {
  const { authUserId, email, builderName, firstName, lastName } = req.body;

  if (!authUserId || !email || !builderName) {
    throw validationError('Missing required fields: authUserId, email, builderName');
  }

  // Check if user already exists (created by database trigger)
  const { data: existingUser, error: checkError } = await supabase
    .from('v2_users')
    .select('id, builder_id')
    .eq('id', authUserId)
    .single();

  if (existingUser) {
    // User already created by trigger - return success
    return res.status(200).json({
      success: true,
      builderId: existingUser.builder_id,
      userId: existingUser.id,
      message: 'Builder account ready',
    });
  }

  // Fallback: Use the database function to create builder with owner
  const { data, error } = await supabase.rpc('create_builder_with_owner', {
    p_auth_user_id: authUserId,
    p_builder_name: builderName,
    p_email: email,
    p_first_name: firstName || null,
    p_last_name: lastName || null,
  });

  if (error) {
    console.error('Error creating builder:', error);
    throw new AppError(500, 'BUILDER_CREATE_FAILED', 'Failed to create builder account');
  }

  const result = data[0];

  res.status(201).json({
    success: true,
    builderId: result.builder_id,
    userId: result.user_id,
    message: 'Builder account created successfully',
  });
}));

/**
 * GET /api/auth/me
 * Get current user profile with builder info
 * Requires Authorization header with JWT token
 */
router.get('/me', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No authorization token provided');
  }

  const token = authHeader.substring(7);

  // Verify the JWT token with Supabase
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  // Get user from v2_users with builder info
  const { data: user, error: userError } = await supabase
    .from('v2_users')
    .select(`
      id,
      email,
      first_name,
      last_name,
      avatar_url,
      role,
      notification_preferences,
      last_login_at,
      created_at,
      builder:v2_builders (
        id,
        name,
        slug,
        logo_url,
        plan,
        plan_expires_at,
        max_active_jobs,
        max_users,
        settings
      )
    `)
    .eq('id', authUser.id)
    .is('deleted_at', null)
    .single();

  if (userError || !user) {
    // User authenticated but not in v2_users - might need to complete signup
    throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found. Please complete signup.');
  }

  // Update last login
  await supabase
    .from('v2_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', authUser.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
      role: user.role,
      notification_preferences: user.notification_preferences,
    },
    builder: user.builder,
  });
}));

/**
 * PATCH /api/auth/profile
 * Update current user's profile
 */
router.patch('/profile', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No authorization token provided');
  }

  const token = authHeader.substring(7);
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const { first_name, last_name, avatar_url, phone, notification_preferences } = req.body;

  const updates = {};
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;
  if (phone !== undefined) updates.phone = phone;
  if (notification_preferences !== undefined) updates.notification_preferences = notification_preferences;

  if (Object.keys(updates).length === 0) {
    throw validationError('No valid fields to update');
  }

  const { data: user, error } = await supabase
    .from('v2_users')
    .update(updates)
    .eq('id', authUser.id)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'UPDATE_FAILED', 'Failed to update profile');
  }

  res.json({ user });
}));

/**
 * POST /api/auth/invite
 * Invite a new user to the builder organization
 */
router.post('/invite', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No authorization token provided');
  }

  const token = authHeader.substring(7);
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  // Get the inviter's builder and check permissions
  const { data: inviter, error: inviterError } = await supabase
    .from('v2_users')
    .select('builder_id, role')
    .eq('id', authUser.id)
    .single();

  if (inviterError || !inviter) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Inviter not found');
  }

  // Only owner and admin can invite
  if (!['owner', 'admin'].includes(inviter.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Only owners and admins can invite users');
  }

  const { email, role } = req.body;

  if (!email) {
    throw validationError('Email is required');
  }

  const validRoles = ['admin', 'accounting', 'pm', 'supervisor', 'office', 'field_crew'];
  if (role && !validRoles.includes(role)) {
    throw validationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  // Check if user already exists in this builder
  const { data: existingUser } = await supabase
    .from('v2_users')
    .select('id')
    .eq('builder_id', inviter.builder_id)
    .eq('email', email)
    .is('deleted_at', null)
    .single();

  if (existingUser) {
    throw new AppError(409, 'USER_EXISTS', 'A user with this email already exists in your organization');
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await supabase
    .from('v2_user_invitations')
    .select('id')
    .eq('builder_id', inviter.builder_id)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (existingInvite) {
    throw new AppError(409, 'INVITE_EXISTS', 'A pending invitation already exists for this email');
  }

  // Create the invitation
  const inviteToken = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to accept

  const { data: invitation, error: inviteError } = await supabase
    .from('v2_user_invitations')
    .insert({
      builder_id: inviter.builder_id,
      email,
      role: role || 'member',
      invited_by: authUser.id,
      token: inviteToken,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (inviteError) {
    console.error('Error creating invitation:', inviteError);
    throw new AppError(500, 'INVITE_FAILED', 'Failed to create invitation');
  }

  // Get builder name for the invite URL
  const { data: builder } = await supabase
    .from('v2_builders')
    .select('name, slug')
    .eq('id', inviter.builder_id)
    .single();

  // TODO: Send invitation email
  // For now, return the invite URL
  const inviteUrl = `${req.protocol}://${req.get('host')}/accept-invite?token=${inviteToken}`;

  res.status(201).json({
    success: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at,
      invite_url: inviteUrl,
    },
    builder: builder?.name,
  });
}));

/**
 * POST /api/auth/accept-invite
 * Accept an invitation and create user account
 */
router.post('/accept-invite', asyncHandler(async (req, res) => {
  const { token, authUserId, firstName, lastName } = req.body;

  if (!token || !authUserId) {
    throw validationError('Token and authUserId are required');
  }

  // Use the database function to accept invitation
  const { data, error } = await supabase.rpc('accept_invitation', {
    p_auth_user_id: authUserId,
    p_token: token,
    p_first_name: firstName || null,
    p_last_name: lastName || null,
  });

  if (error) {
    console.error('Error accepting invitation:', error);
    throw new AppError(500, 'ACCEPT_FAILED', 'Failed to accept invitation');
  }

  const result = data[0];

  if (!result.success) {
    throw new AppError(400, 'INVALID_INVITE', result.message);
  }

  res.json({
    success: true,
    builderId: result.builder_id,
    message: 'Invitation accepted successfully',
  });
}));

/**
 * GET /api/auth/invitations
 * List pending invitations for the builder (admin only)
 */
router.get('/invitations', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No authorization token provided');
  }

  const token = authHeader.substring(7);
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  // Get user's builder
  const { data: user, error: userError } = await supabase
    .from('v2_users')
    .select('builder_id, role')
    .eq('id', authUser.id)
    .single();

  if (userError || !user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // Only owner and admin can view invitations
  if (!['owner', 'admin'].includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Only owners and admins can view invitations');
  }

  const { data: invitations, error } = await supabase
    .from('v2_user_invitations')
    .select(`
      id,
      email,
      role,
      expires_at,
      created_at,
      accepted_at,
      inviter:invited_by (
        first_name,
        last_name,
        email
      )
    `)
    .eq('builder_id', user.builder_id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch invitations');
  }

  res.json({ invitations });
}));

/**
 * DELETE /api/auth/invitations/:id
 * Cancel a pending invitation
 */
router.delete('/invitations/:id', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No authorization token provided');
  }

  const token = authHeader.substring(7);
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  // Get user's builder and role
  const { data: user, error: userError } = await supabase
    .from('v2_users')
    .select('builder_id, role')
    .eq('id', authUser.id)
    .single();

  if (userError || !user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (!['owner', 'admin'].includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Only owners and admins can cancel invitations');
  }

  const { error: deleteError } = await supabase
    .from('v2_user_invitations')
    .delete()
    .eq('id', req.params.id)
    .eq('builder_id', user.builder_id)
    .is('accepted_at', null);

  if (deleteError) {
    throw new AppError(500, 'DELETE_FAILED', 'Failed to cancel invitation');
  }

  res.json({ success: true, message: 'Invitation cancelled' });
}));

/**
 * GET /api/auth/team
 * List team members in the builder organization
 */
router.get('/team', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No authorization token provided');
  }

  const token = authHeader.substring(7);
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  // Get user's builder
  const { data: user, error: userError } = await supabase
    .from('v2_users')
    .select('builder_id')
    .eq('id', authUser.id)
    .single();

  if (userError || !user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const { data: team, error } = await supabase
    .from('v2_users')
    .select(`
      id,
      email,
      first_name,
      last_name,
      avatar_url,
      role,
      last_login_at,
      created_at
    `)
    .eq('builder_id', user.builder_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch team members');
  }

  res.json({ team });
}));

module.exports = router;
