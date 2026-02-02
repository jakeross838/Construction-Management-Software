-- Migration 149: User Roles & Permissions System
-- Implements role-based access control for the application

-- ============================================================
-- ROLES TABLE
-- Defines available roles in the system
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,  -- System roles can't be deleted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO v2_roles (name, display_name, description, is_system) VALUES
  ('owner', 'Owner', 'Full access to all features and settings', true),
  ('admin', 'Administrator', 'Full access except billing and company deletion', true),
  ('project_manager', 'Project Manager', 'Manage jobs, budgets, invoices, and team', true),
  ('superintendent', 'Superintendent', 'Field operations, daily logs, inspections, punch lists', true),
  ('accountant', 'Accountant', 'Financial data, invoices, draws, reports (read-only for operations)', true),
  ('field_worker', 'Field Worker', 'Daily logs, photos, time entry only', true),
  ('client', 'Client', 'Client portal access only', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PERMISSIONS TABLE
-- Defines granular permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,  -- jobs, invoices, financial, admin, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert permissions by category
INSERT INTO v2_permissions (name, display_name, category, description) VALUES
  -- Jobs
  ('jobs.view', 'View Jobs', 'jobs', 'View job list and details'),
  ('jobs.create', 'Create Jobs', 'jobs', 'Create new jobs'),
  ('jobs.edit', 'Edit Jobs', 'jobs', 'Edit job details'),
  ('jobs.delete', 'Delete Jobs', 'jobs', 'Archive/delete jobs'),
  ('jobs.budget', 'Manage Budget', 'jobs', 'View and edit job budgets'),

  -- Invoices
  ('invoices.view', 'View Invoices', 'invoices', 'View invoice list and details'),
  ('invoices.create', 'Create Invoices', 'invoices', 'Upload and create invoices'),
  ('invoices.edit', 'Edit Invoices', 'invoices', 'Edit invoice details'),
  ('invoices.approve', 'Approve Invoices', 'invoices', 'Approve invoices for payment'),
  ('invoices.delete', 'Delete Invoices', 'invoices', 'Delete invoices'),

  -- Purchase Orders
  ('pos.view', 'View POs', 'purchase_orders', 'View purchase orders'),
  ('pos.create', 'Create POs', 'purchase_orders', 'Create purchase orders'),
  ('pos.edit', 'Edit POs', 'purchase_orders', 'Edit purchase orders'),
  ('pos.approve', 'Approve POs', 'purchase_orders', 'Approve purchase orders'),

  -- Draws
  ('draws.view', 'View Draws', 'draws', 'View draw requests'),
  ('draws.create', 'Create Draws', 'draws', 'Create draw requests'),
  ('draws.submit', 'Submit Draws', 'draws', 'Submit draws for funding'),
  ('draws.fund', 'Mark Draws Funded', 'draws', 'Mark draws as funded'),

  -- Change Orders
  ('change_orders.view', 'View Change Orders', 'change_orders', 'View change orders'),
  ('change_orders.create', 'Create Change Orders', 'change_orders', 'Create change orders'),
  ('change_orders.approve', 'Approve Change Orders', 'change_orders', 'Approve change orders'),

  -- Daily Logs
  ('daily_logs.view', 'View Daily Logs', 'field', 'View daily logs'),
  ('daily_logs.create', 'Create Daily Logs', 'field', 'Create daily logs'),
  ('daily_logs.edit', 'Edit Daily Logs', 'field', 'Edit daily logs'),

  -- Photos
  ('photos.view', 'View Photos', 'field', 'View project photos'),
  ('photos.upload', 'Upload Photos', 'field', 'Upload photos'),
  ('photos.delete', 'Delete Photos', 'field', 'Delete photos'),

  -- Inspections
  ('inspections.view', 'View Inspections', 'field', 'View inspections'),
  ('inspections.create', 'Create Inspections', 'field', 'Schedule and create inspections'),
  ('inspections.complete', 'Complete Inspections', 'field', 'Mark inspections complete'),

  -- Punch Lists
  ('punch_lists.view', 'View Punch Lists', 'field', 'View punch lists'),
  ('punch_lists.create', 'Create Punch Lists', 'field', 'Create punch list items'),
  ('punch_lists.complete', 'Complete Punch Items', 'field', 'Mark punch items complete'),

  -- Vendors
  ('vendors.view', 'View Vendors', 'vendors', 'View vendor list'),
  ('vendors.create', 'Create Vendors', 'vendors', 'Create new vendors'),
  ('vendors.edit', 'Edit Vendors', 'vendors', 'Edit vendor details'),

  -- Reports
  ('reports.view', 'View Reports', 'reports', 'View all reports'),
  ('reports.export', 'Export Reports', 'reports', 'Export reports to Excel/PDF'),
  ('reports.financial', 'Financial Reports', 'reports', 'View financial reports'),

  -- Team
  ('team.view', 'View Team', 'team', 'View team members'),
  ('team.invite', 'Invite Team', 'team', 'Invite new team members'),
  ('team.manage', 'Manage Team', 'team', 'Edit team member roles'),
  ('team.remove', 'Remove Team', 'team', 'Remove team members'),

  -- Settings
  ('settings.view', 'View Settings', 'admin', 'View company settings'),
  ('settings.edit', 'Edit Settings', 'admin', 'Edit company settings'),
  ('settings.billing', 'Manage Billing', 'admin', 'Manage subscription and billing'),
  ('settings.integrations', 'Manage Integrations', 'admin', 'Configure QuickBooks, Xero, etc.'),
  ('settings.api', 'Manage API', 'admin', 'Manage API keys and webhooks')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ROLE PERMISSIONS MAPPING
-- Maps which permissions each role has
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES v2_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES v2_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Helper function to grant permissions to a role
CREATE OR REPLACE FUNCTION grant_permissions_to_role(p_role_name TEXT, p_permissions TEXT[])
RETURNS void AS $$
DECLARE
  v_role_id UUID;
  v_perm TEXT;
BEGIN
  SELECT id INTO v_role_id FROM v2_roles WHERE name = p_role_name;
  IF v_role_id IS NULL THEN RETURN; END IF;

  FOREACH v_perm IN ARRAY p_permissions LOOP
    INSERT INTO v2_role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM v2_permissions WHERE name = v_perm
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to Owner (everything)
SELECT grant_permissions_to_role('owner', ARRAY(SELECT name FROM v2_permissions));

-- Grant permissions to Admin (everything except billing)
SELECT grant_permissions_to_role('admin', ARRAY(
  SELECT name FROM v2_permissions WHERE name NOT IN ('settings.billing')
));

-- Grant permissions to Project Manager
SELECT grant_permissions_to_role('project_manager', ARRAY[
  'jobs.view', 'jobs.create', 'jobs.edit', 'jobs.budget',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.approve',
  'pos.view', 'pos.create', 'pos.edit', 'pos.approve',
  'draws.view', 'draws.create', 'draws.submit',
  'change_orders.view', 'change_orders.create', 'change_orders.approve',
  'daily_logs.view', 'daily_logs.create', 'daily_logs.edit',
  'photos.view', 'photos.upload',
  'inspections.view', 'inspections.create', 'inspections.complete',
  'punch_lists.view', 'punch_lists.create', 'punch_lists.complete',
  'vendors.view', 'vendors.create', 'vendors.edit',
  'reports.view', 'reports.export', 'reports.financial',
  'team.view'
]);

-- Grant permissions to Superintendent
SELECT grant_permissions_to_role('superintendent', ARRAY[
  'jobs.view',
  'invoices.view',
  'pos.view',
  'daily_logs.view', 'daily_logs.create', 'daily_logs.edit',
  'photos.view', 'photos.upload', 'photos.delete',
  'inspections.view', 'inspections.create', 'inspections.complete',
  'punch_lists.view', 'punch_lists.create', 'punch_lists.complete',
  'vendors.view',
  'reports.view',
  'team.view'
]);

-- Grant permissions to Accountant
SELECT grant_permissions_to_role('accountant', ARRAY[
  'jobs.view', 'jobs.budget',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.approve',
  'pos.view',
  'draws.view', 'draws.create', 'draws.submit', 'draws.fund',
  'change_orders.view',
  'vendors.view', 'vendors.create', 'vendors.edit',
  'reports.view', 'reports.export', 'reports.financial'
]);

-- Grant permissions to Field Worker
SELECT grant_permissions_to_role('field_worker', ARRAY[
  'jobs.view',
  'daily_logs.view', 'daily_logs.create',
  'photos.view', 'photos.upload',
  'punch_lists.view', 'punch_lists.complete'
]);

-- ============================================================
-- UPDATE USERS TABLE
-- Add role reference to users
-- ============================================================

ALTER TABLE v2_users
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES v2_roles(id);

-- Set default role for existing users (owner for now)
UPDATE v2_users
SET role_id = (SELECT id FROM v2_roles WHERE name = 'owner')
WHERE role_id IS NULL;

-- ============================================================
-- USER PERMISSIONS VIEW
-- Easy way to check user permissions
-- ============================================================

CREATE OR REPLACE VIEW v2_user_permissions AS
SELECT
  u.id as user_id,
  u.email,
  r.name as role_name,
  r.display_name as role_display_name,
  p.name as permission_name,
  p.category as permission_category
FROM v2_users u
JOIN v2_roles r ON r.id = u.role_id
JOIN v2_role_permissions rp ON rp.role_id = r.id
JOIN v2_permissions p ON p.id = rp.permission_id;

-- ============================================================
-- HELPER FUNCTION: Check if user has permission
-- ============================================================

CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM v2_user_permissions
    WHERE user_id = p_user_id AND permission_name = p_permission
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON v2_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON v2_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON v2_users(role_id);
