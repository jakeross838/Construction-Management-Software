-- Migration 128: Create compatibility views for Kind-Creation frontend
-- These views alias v2_ prefixed tables to non-prefixed names

-- Drop existing views if they exist (in reverse dependency order)
DROP VIEW IF EXISTS daily_log_inspections CASCADE;
DROP VIEW IF EXISTS daily_log_deliveries CASCADE;
DROP VIEW IF EXISTS daily_log_crew CASCADE;
DROP VIEW IF EXISTS daily_log_attachments CASCADE;
DROP VIEW IF EXISTS daily_logs CASCADE;
DROP VIEW IF EXISTS co_line_items CASCADE;
DROP VIEW IF EXISTS po_attachments CASCADE;
DROP VIEW IF EXISTS po_line_items CASCADE;
DROP VIEW IF EXISTS invoice_allocations CASCADE;
DROP VIEW IF EXISTS budget_lines CASCADE;
DROP VIEW IF EXISTS lien_releases CASCADE;
DROP VIEW IF EXISTS schedule_tasks CASCADE;
DROP VIEW IF EXISTS selections CASCADE;
DROP VIEW IF EXISTS leads CASCADE;
DROP VIEW IF EXISTS permits CASCADE;
DROP VIEW IF EXISTS expenses CASCADE;
DROP VIEW IF EXISTS employees CASCADE;
DROP VIEW IF EXISTS change_orders CASCADE;
DROP VIEW IF EXISTS draws CASCADE;
DROP VIEW IF EXISTS invoices CASCADE;
DROP VIEW IF EXISTS purchase_orders CASCADE;
DROP VIEW IF EXISTS cost_codes CASCADE;
DROP VIEW IF EXISTS vendors CASCADE;
DROP VIEW IF EXISTS jobs CASCADE;
DROP VIEW IF EXISTS vendor_aliases CASCADE;
DROP VIEW IF EXISTS estimate_templates CASCADE;
DROP VIEW IF EXISTS ai_learned_mappings CASCADE;

-- Core tables
CREATE OR REPLACE VIEW jobs AS SELECT * FROM v2_jobs;
CREATE OR REPLACE VIEW vendors AS SELECT * FROM v2_vendors;
CREATE OR REPLACE VIEW cost_codes AS SELECT * FROM v2_cost_codes;

-- Financial tables
CREATE OR REPLACE VIEW invoices AS SELECT * FROM v2_invoices;
CREATE OR REPLACE VIEW invoice_allocations AS SELECT * FROM v2_invoice_allocations;
CREATE OR REPLACE VIEW purchase_orders AS SELECT * FROM v2_purchase_orders;
CREATE OR REPLACE VIEW po_line_items AS SELECT * FROM v2_po_line_items;
CREATE OR REPLACE VIEW po_attachments AS SELECT * FROM v2_po_attachments;
CREATE OR REPLACE VIEW draws AS SELECT * FROM v2_draws;
CREATE OR REPLACE VIEW change_orders AS SELECT * FROM v2_change_orders;
CREATE OR REPLACE VIEW co_line_items AS SELECT * FROM v2_change_order_line_items;
CREATE OR REPLACE VIEW budget_lines AS SELECT * FROM v2_budget_lines;
CREATE OR REPLACE VIEW lien_releases AS SELECT * FROM v2_lien_releases;

-- Operations tables
CREATE OR REPLACE VIEW daily_logs AS SELECT * FROM v2_daily_logs;
CREATE OR REPLACE VIEW daily_log_crew AS SELECT * FROM v2_daily_log_crew;
CREATE OR REPLACE VIEW daily_log_deliveries AS SELECT * FROM v2_daily_log_deliveries;
CREATE OR REPLACE VIEW daily_log_attachments AS SELECT * FROM v2_daily_log_attachments;

-- For daily_log_inspections, map to v2_inspections if columns match, otherwise create stub
-- Check if v2_inspections has compatible columns; if not, we'll need a mapping table
CREATE OR REPLACE VIEW daily_log_inspections AS
SELECT
  id,
  daily_log_id,
  inspection_type,
  result,
  inspector,
  notes,
  created_at
FROM v2_inspections
WHERE daily_log_id IS NOT NULL;

-- Other operational tables
CREATE OR REPLACE VIEW schedule_tasks AS SELECT * FROM v2_schedule_tasks;
CREATE OR REPLACE VIEW selections AS SELECT * FROM v2_selections;
CREATE OR REPLACE VIEW leads AS SELECT * FROM v2_leads;
CREATE OR REPLACE VIEW permits AS SELECT * FROM v2_permits;
CREATE OR REPLACE VIEW expenses AS SELECT * FROM v2_expenses;
CREATE OR REPLACE VIEW employees AS SELECT * FROM v2_employees;

-- Auxiliary tables
CREATE OR REPLACE VIEW vendor_aliases AS SELECT * FROM v2_vendor_aliases;
CREATE OR REPLACE VIEW estimate_templates AS SELECT * FROM v2_estimate_templates;

-- AI learning table
CREATE OR REPLACE VIEW ai_learned_mappings AS SELECT * FROM v2_ai_learning;

-- Enable RLS-passthrough by making views security_invoker (Postgres 15+)
-- This ensures the views respect the underlying table's RLS policies
ALTER VIEW jobs SET (security_invoker = true);
ALTER VIEW vendors SET (security_invoker = true);
ALTER VIEW cost_codes SET (security_invoker = true);
ALTER VIEW invoices SET (security_invoker = true);
ALTER VIEW invoice_allocations SET (security_invoker = true);
ALTER VIEW purchase_orders SET (security_invoker = true);
ALTER VIEW po_line_items SET (security_invoker = true);
ALTER VIEW po_attachments SET (security_invoker = true);
ALTER VIEW draws SET (security_invoker = true);
ALTER VIEW change_orders SET (security_invoker = true);
ALTER VIEW co_line_items SET (security_invoker = true);
ALTER VIEW budget_lines SET (security_invoker = true);
ALTER VIEW lien_releases SET (security_invoker = true);
ALTER VIEW daily_logs SET (security_invoker = true);
ALTER VIEW daily_log_crew SET (security_invoker = true);
ALTER VIEW daily_log_deliveries SET (security_invoker = true);
ALTER VIEW daily_log_attachments SET (security_invoker = true);
ALTER VIEW daily_log_inspections SET (security_invoker = true);
ALTER VIEW schedule_tasks SET (security_invoker = true);
ALTER VIEW selections SET (security_invoker = true);
ALTER VIEW leads SET (security_invoker = true);
ALTER VIEW permits SET (security_invoker = true);
ALTER VIEW expenses SET (security_invoker = true);
ALTER VIEW employees SET (security_invoker = true);
ALTER VIEW vendor_aliases SET (security_invoker = true);
ALTER VIEW estimate_templates SET (security_invoker = true);
ALTER VIEW ai_learned_mappings SET (security_invoker = true);

-- Create INSTEAD OF triggers for INSERT/UPDATE/DELETE operations on views
-- This makes the views fully updatable

-- Jobs view triggers
CREATE OR REPLACE FUNCTION jobs_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_jobs SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION jobs_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_jobs SET
    name = NEW.name,
    client = NEW.client,
    address = NEW.address,
    status = NEW.status,
    budget_amount = NEW.budget_amount,
    contract_amount = NEW.contract_amount,
    start_date = NEW.start_date,
    end_date = NEW.end_date,
    percent_complete = NEW.percent_complete,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION jobs_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_jobs WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobs_insert ON jobs;
DROP TRIGGER IF EXISTS jobs_update ON jobs;
DROP TRIGGER IF EXISTS jobs_delete ON jobs;

CREATE TRIGGER jobs_insert INSTEAD OF INSERT ON jobs FOR EACH ROW EXECUTE FUNCTION jobs_insert_trigger();
CREATE TRIGGER jobs_update INSTEAD OF UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION jobs_update_trigger();
CREATE TRIGGER jobs_delete INSTEAD OF DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION jobs_delete_trigger();

-- Vendors view triggers
CREATE OR REPLACE FUNCTION vendors_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_vendors SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION vendors_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_vendors SET
    name = COALESCE(NEW.name, OLD.name),
    contact_name = NEW.contact_name,
    email = NEW.email,
    phone = NEW.phone,
    address = NEW.address,
    tax_id = NEW.tax_id,
    w9_on_file = NEW.w9_on_file,
    insurance_expiry = NEW.insurance_expiry,
    status = NEW.status,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION vendors_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_vendors WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendors_insert ON vendors;
DROP TRIGGER IF EXISTS vendors_update ON vendors;
DROP TRIGGER IF EXISTS vendors_delete ON vendors;

CREATE TRIGGER vendors_insert INSTEAD OF INSERT ON vendors FOR EACH ROW EXECUTE FUNCTION vendors_insert_trigger();
CREATE TRIGGER vendors_update INSTEAD OF UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION vendors_update_trigger();
CREATE TRIGGER vendors_delete INSTEAD OF DELETE ON vendors FOR EACH ROW EXECUTE FUNCTION vendors_delete_trigger();

-- Invoices view triggers
CREATE OR REPLACE FUNCTION invoices_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_invoices SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invoices_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_invoices SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    vendor_id = NEW.vendor_id,
    po_id = NEW.po_id,
    invoice_number = NEW.invoice_number,
    amount = NEW.amount,
    invoice_date = NEW.invoice_date,
    due_date = NEW.due_date,
    status = NEW.status,
    draw_id = NEW.draw_id,
    approved_at = NEW.approved_at,
    approved_by = NEW.approved_by,
    paid_at = NEW.paid_at,
    paid_by = NEW.paid_by,
    notes = NEW.notes,
    file_url = NEW.file_url,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invoices_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_invoices WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_insert ON invoices;
DROP TRIGGER IF EXISTS invoices_update ON invoices;
DROP TRIGGER IF EXISTS invoices_delete ON invoices;

CREATE TRIGGER invoices_insert INSTEAD OF INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_insert_trigger();
CREATE TRIGGER invoices_update INSTEAD OF UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_update_trigger();
CREATE TRIGGER invoices_delete INSTEAD OF DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_delete_trigger();

-- Invoice allocations view triggers
CREATE OR REPLACE FUNCTION invoice_allocations_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_invoice_allocations SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invoice_allocations_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_invoice_allocations SET
    invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id),
    cost_code_id = NEW.cost_code_id,
    amount = NEW.amount,
    description = NEW.description,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invoice_allocations_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_invoice_allocations WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_allocations_insert ON invoice_allocations;
DROP TRIGGER IF EXISTS invoice_allocations_update ON invoice_allocations;
DROP TRIGGER IF EXISTS invoice_allocations_delete ON invoice_allocations;

CREATE TRIGGER invoice_allocations_insert INSTEAD OF INSERT ON invoice_allocations FOR EACH ROW EXECUTE FUNCTION invoice_allocations_insert_trigger();
CREATE TRIGGER invoice_allocations_update INSTEAD OF UPDATE ON invoice_allocations FOR EACH ROW EXECUTE FUNCTION invoice_allocations_update_trigger();
CREATE TRIGGER invoice_allocations_delete INSTEAD OF DELETE ON invoice_allocations FOR EACH ROW EXECUTE FUNCTION invoice_allocations_delete_trigger();

-- Purchase orders view triggers
CREATE OR REPLACE FUNCTION purchase_orders_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_purchase_orders SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION purchase_orders_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_purchase_orders SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    vendor_id = NEW.vendor_id,
    po_number = NEW.po_number,
    status = NEW.status,
    total_amount = NEW.total_amount,
    invoiced_amount = NEW.invoiced_amount,
    issue_date = NEW.issue_date,
    expected_date = NEW.expected_date,
    description = NEW.description,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION purchase_orders_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_purchase_orders WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchase_orders_insert ON purchase_orders;
DROP TRIGGER IF EXISTS purchase_orders_update ON purchase_orders;
DROP TRIGGER IF EXISTS purchase_orders_delete ON purchase_orders;

CREATE TRIGGER purchase_orders_insert INSTEAD OF INSERT ON purchase_orders FOR EACH ROW EXECUTE FUNCTION purchase_orders_insert_trigger();
CREATE TRIGGER purchase_orders_update INSTEAD OF UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION purchase_orders_update_trigger();
CREATE TRIGGER purchase_orders_delete INSTEAD OF DELETE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION purchase_orders_delete_trigger();

-- PO line items view triggers
CREATE OR REPLACE FUNCTION po_line_items_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_po_line_items SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION po_line_items_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_po_line_items SET
    po_id = COALESCE(NEW.po_id, OLD.po_id),
    cost_code_id = NEW.cost_code_id,
    title = NEW.title,
    description = NEW.description,
    unit_cost = NEW.unit_cost,
    quantity = NEW.quantity,
    amount = NEW.amount,
    invoiced_amount = NEW.invoiced_amount,
    sort_order = NEW.sort_order,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION po_line_items_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_po_line_items WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS po_line_items_insert ON po_line_items;
DROP TRIGGER IF EXISTS po_line_items_update ON po_line_items;
DROP TRIGGER IF EXISTS po_line_items_delete ON po_line_items;

CREATE TRIGGER po_line_items_insert INSTEAD OF INSERT ON po_line_items FOR EACH ROW EXECUTE FUNCTION po_line_items_insert_trigger();
CREATE TRIGGER po_line_items_update INSTEAD OF UPDATE ON po_line_items FOR EACH ROW EXECUTE FUNCTION po_line_items_update_trigger();
CREATE TRIGGER po_line_items_delete INSTEAD OF DELETE ON po_line_items FOR EACH ROW EXECUTE FUNCTION po_line_items_delete_trigger();

-- Draws view triggers
CREATE OR REPLACE FUNCTION draws_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_draws SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION draws_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_draws SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    draw_number = NEW.draw_number,
    status = NEW.status,
    total_amount = NEW.total_amount,
    retainage_amount = NEW.retainage_amount,
    submitted_at = NEW.submitted_at,
    approved_at = NEW.approved_at,
    paid_at = NEW.paid_at,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION draws_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_draws WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS draws_insert ON draws;
DROP TRIGGER IF EXISTS draws_update ON draws;
DROP TRIGGER IF EXISTS draws_delete ON draws;

CREATE TRIGGER draws_insert INSTEAD OF INSERT ON draws FOR EACH ROW EXECUTE FUNCTION draws_insert_trigger();
CREATE TRIGGER draws_update INSTEAD OF UPDATE ON draws FOR EACH ROW EXECUTE FUNCTION draws_update_trigger();
CREATE TRIGGER draws_delete INSTEAD OF DELETE ON draws FOR EACH ROW EXECUTE FUNCTION draws_delete_trigger();

-- Change orders view triggers
CREATE OR REPLACE FUNCTION change_orders_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_change_orders SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION change_orders_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_change_orders SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    po_id = NEW.po_id,
    co_number = NEW.co_number,
    description = NEW.description,
    reason = NEW.reason,
    co_type = NEW.co_type,
    requested_by = NEW.requested_by,
    status = NEW.status,
    total_amount = NEW.total_amount,
    days_impact = NEW.days_impact,
    draw_id = NEW.draw_id,
    approved_at = NEW.approved_at,
    approved_by = NEW.approved_by,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION change_orders_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_change_orders WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS change_orders_insert ON change_orders;
DROP TRIGGER IF EXISTS change_orders_update ON change_orders;
DROP TRIGGER IF EXISTS change_orders_delete ON change_orders;

CREATE TRIGGER change_orders_insert INSTEAD OF INSERT ON change_orders FOR EACH ROW EXECUTE FUNCTION change_orders_insert_trigger();
CREATE TRIGGER change_orders_update INSTEAD OF UPDATE ON change_orders FOR EACH ROW EXECUTE FUNCTION change_orders_update_trigger();
CREATE TRIGGER change_orders_delete INSTEAD OF DELETE ON change_orders FOR EACH ROW EXECUTE FUNCTION change_orders_delete_trigger();

-- CO line items view triggers
CREATE OR REPLACE FUNCTION co_line_items_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_change_order_line_items SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION co_line_items_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_change_order_line_items SET
    change_order_id = COALESCE(NEW.change_order_id, OLD.change_order_id),
    cost_code_id = NEW.cost_code_id,
    description = NEW.description,
    amount = NEW.amount,
    sort_order = NEW.sort_order,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION co_line_items_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_change_order_line_items WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS co_line_items_insert ON co_line_items;
DROP TRIGGER IF EXISTS co_line_items_update ON co_line_items;
DROP TRIGGER IF EXISTS co_line_items_delete ON co_line_items;

CREATE TRIGGER co_line_items_insert INSTEAD OF INSERT ON co_line_items FOR EACH ROW EXECUTE FUNCTION co_line_items_insert_trigger();
CREATE TRIGGER co_line_items_update INSTEAD OF UPDATE ON co_line_items FOR EACH ROW EXECUTE FUNCTION co_line_items_update_trigger();
CREATE TRIGGER co_line_items_delete INSTEAD OF DELETE ON co_line_items FOR EACH ROW EXECUTE FUNCTION co_line_items_delete_trigger();

-- Budget lines view triggers
CREATE OR REPLACE FUNCTION budget_lines_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_budget_lines SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION budget_lines_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_budget_lines SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    cost_code_id = NEW.cost_code_id,
    budgeted_amount = NEW.budgeted_amount,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION budget_lines_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_budget_lines WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS budget_lines_insert ON budget_lines;
DROP TRIGGER IF EXISTS budget_lines_update ON budget_lines;
DROP TRIGGER IF EXISTS budget_lines_delete ON budget_lines;

CREATE TRIGGER budget_lines_insert INSTEAD OF INSERT ON budget_lines FOR EACH ROW EXECUTE FUNCTION budget_lines_insert_trigger();
CREATE TRIGGER budget_lines_update INSTEAD OF UPDATE ON budget_lines FOR EACH ROW EXECUTE FUNCTION budget_lines_update_trigger();
CREATE TRIGGER budget_lines_delete INSTEAD OF DELETE ON budget_lines FOR EACH ROW EXECUTE FUNCTION budget_lines_delete_trigger();

-- Lien releases view triggers
CREATE OR REPLACE FUNCTION lien_releases_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_lien_releases SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lien_releases_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_lien_releases SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    draw_id = NEW.draw_id,
    vendor_id = NEW.vendor_id,
    release_type = NEW.release_type,
    amount = NEW.amount,
    through_date = NEW.through_date,
    status = NEW.status,
    document_url = NEW.document_url,
    received_at = NEW.received_at,
    received_by = NEW.received_by,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lien_releases_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_lien_releases WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lien_releases_insert ON lien_releases;
DROP TRIGGER IF EXISTS lien_releases_update ON lien_releases;
DROP TRIGGER IF EXISTS lien_releases_delete ON lien_releases;

CREATE TRIGGER lien_releases_insert INSTEAD OF INSERT ON lien_releases FOR EACH ROW EXECUTE FUNCTION lien_releases_insert_trigger();
CREATE TRIGGER lien_releases_update INSTEAD OF UPDATE ON lien_releases FOR EACH ROW EXECUTE FUNCTION lien_releases_update_trigger();
CREATE TRIGGER lien_releases_delete INSTEAD OF DELETE ON lien_releases FOR EACH ROW EXECUTE FUNCTION lien_releases_delete_trigger();

-- Daily logs view triggers
CREATE OR REPLACE FUNCTION daily_logs_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_daily_logs SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION daily_logs_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_daily_logs SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    log_date = NEW.log_date,
    status = NEW.status,
    weather_conditions = NEW.weather_conditions,
    temperature_high = NEW.temperature_high,
    temperature_low = NEW.temperature_low,
    weather_notes = NEW.weather_notes,
    construction_phase = NEW.construction_phase,
    plan_completed = NEW.plan_completed,
    plan_variance_notes = NEW.plan_variance_notes,
    work_completed = NEW.work_completed,
    work_planned = NEW.work_planned,
    delays_issues = NEW.delays_issues,
    site_visitors = NEW.site_visitors,
    safety_notes = NEW.safety_notes,
    dumpster_exchange = NEW.dumpster_exchange,
    absent_crews = NEW.absent_crews,
    completed_at = NEW.completed_at,
    deleted_at = NEW.deleted_at,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION daily_logs_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_daily_logs WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_logs_insert ON daily_logs;
DROP TRIGGER IF EXISTS daily_logs_update ON daily_logs;
DROP TRIGGER IF EXISTS daily_logs_delete ON daily_logs;

CREATE TRIGGER daily_logs_insert INSTEAD OF INSERT ON daily_logs FOR EACH ROW EXECUTE FUNCTION daily_logs_insert_trigger();
CREATE TRIGGER daily_logs_update INSTEAD OF UPDATE ON daily_logs FOR EACH ROW EXECUTE FUNCTION daily_logs_update_trigger();
CREATE TRIGGER daily_logs_delete INSTEAD OF DELETE ON daily_logs FOR EACH ROW EXECUTE FUNCTION daily_logs_delete_trigger();

-- Daily log crew view triggers
CREATE OR REPLACE FUNCTION daily_log_crew_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_daily_log_crew SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION daily_log_crew_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_daily_log_crew WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_log_crew_insert ON daily_log_crew;
DROP TRIGGER IF EXISTS daily_log_crew_delete ON daily_log_crew;

CREATE TRIGGER daily_log_crew_insert INSTEAD OF INSERT ON daily_log_crew FOR EACH ROW EXECUTE FUNCTION daily_log_crew_insert_trigger();
CREATE TRIGGER daily_log_crew_delete INSTEAD OF DELETE ON daily_log_crew FOR EACH ROW EXECUTE FUNCTION daily_log_crew_delete_trigger();

-- Daily log deliveries view triggers
CREATE OR REPLACE FUNCTION daily_log_deliveries_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_daily_log_deliveries SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION daily_log_deliveries_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_daily_log_deliveries WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_log_deliveries_insert ON daily_log_deliveries;
DROP TRIGGER IF EXISTS daily_log_deliveries_delete ON daily_log_deliveries;

CREATE TRIGGER daily_log_deliveries_insert INSTEAD OF INSERT ON daily_log_deliveries FOR EACH ROW EXECUTE FUNCTION daily_log_deliveries_insert_trigger();
CREATE TRIGGER daily_log_deliveries_delete INSTEAD OF DELETE ON daily_log_deliveries FOR EACH ROW EXECUTE FUNCTION daily_log_deliveries_delete_trigger();

-- Daily log attachments view triggers
CREATE OR REPLACE FUNCTION daily_log_attachments_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_daily_log_attachments SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION daily_log_attachments_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_daily_log_attachments WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_log_attachments_insert ON daily_log_attachments;
DROP TRIGGER IF EXISTS daily_log_attachments_delete ON daily_log_attachments;

CREATE TRIGGER daily_log_attachments_insert INSTEAD OF INSERT ON daily_log_attachments FOR EACH ROW EXECUTE FUNCTION daily_log_attachments_insert_trigger();
CREATE TRIGGER daily_log_attachments_delete INSTEAD OF DELETE ON daily_log_attachments FOR EACH ROW EXECUTE FUNCTION daily_log_attachments_delete_trigger();

-- PO attachments view triggers
CREATE OR REPLACE FUNCTION po_attachments_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_po_attachments SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION po_attachments_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_po_attachments WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS po_attachments_insert ON po_attachments;
DROP TRIGGER IF EXISTS po_attachments_delete ON po_attachments;

CREATE TRIGGER po_attachments_insert INSTEAD OF INSERT ON po_attachments FOR EACH ROW EXECUTE FUNCTION po_attachments_insert_trigger();
CREATE TRIGGER po_attachments_delete INSTEAD OF DELETE ON po_attachments FOR EACH ROW EXECUTE FUNCTION po_attachments_delete_trigger();

-- Cost codes view triggers
CREATE OR REPLACE FUNCTION cost_codes_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_cost_codes SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cost_codes_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_cost_codes SET
    code = NEW.code,
    name = NEW.name,
    category = NEW.category,
    description = NEW.description,
    is_active = NEW.is_active,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cost_codes_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_cost_codes WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cost_codes_insert ON cost_codes;
DROP TRIGGER IF EXISTS cost_codes_update ON cost_codes;
DROP TRIGGER IF EXISTS cost_codes_delete ON cost_codes;

CREATE TRIGGER cost_codes_insert INSTEAD OF INSERT ON cost_codes FOR EACH ROW EXECUTE FUNCTION cost_codes_insert_trigger();
CREATE TRIGGER cost_codes_update INSTEAD OF UPDATE ON cost_codes FOR EACH ROW EXECUTE FUNCTION cost_codes_update_trigger();
CREATE TRIGGER cost_codes_delete INSTEAD OF DELETE ON cost_codes FOR EACH ROW EXECUTE FUNCTION cost_codes_delete_trigger();

-- Schedule tasks view triggers
CREATE OR REPLACE FUNCTION schedule_tasks_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_schedule_tasks SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION schedule_tasks_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_schedule_tasks SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    title = NEW.title,
    description = NEW.description,
    start_date = NEW.start_date,
    end_date = NEW.end_date,
    status = NEW.status,
    assigned_to = NEW.assigned_to,
    vendor_id = NEW.vendor_id,
    percent_complete = NEW.percent_complete,
    depends_on = NEW.depends_on,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION schedule_tasks_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_schedule_tasks WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_tasks_insert ON schedule_tasks;
DROP TRIGGER IF EXISTS schedule_tasks_update ON schedule_tasks;
DROP TRIGGER IF EXISTS schedule_tasks_delete ON schedule_tasks;

CREATE TRIGGER schedule_tasks_insert INSTEAD OF INSERT ON schedule_tasks FOR EACH ROW EXECUTE FUNCTION schedule_tasks_insert_trigger();
CREATE TRIGGER schedule_tasks_update INSTEAD OF UPDATE ON schedule_tasks FOR EACH ROW EXECUTE FUNCTION schedule_tasks_update_trigger();
CREATE TRIGGER schedule_tasks_delete INSTEAD OF DELETE ON schedule_tasks FOR EACH ROW EXECUTE FUNCTION schedule_tasks_delete_trigger();

-- Selections view triggers
CREATE OR REPLACE FUNCTION selections_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_selections SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION selections_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_selections SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    category = NEW.category,
    item_name = NEW.item_name,
    description = NEW.description,
    vendor_id = NEW.vendor_id,
    allowance_amount = NEW.allowance_amount,
    actual_amount = NEW.actual_amount,
    status = NEW.status,
    due_date = NEW.due_date,
    selected_at = NEW.selected_at,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION selections_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_selections WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS selections_insert ON selections;
DROP TRIGGER IF EXISTS selections_update ON selections;
DROP TRIGGER IF EXISTS selections_delete ON selections;

CREATE TRIGGER selections_insert INSTEAD OF INSERT ON selections FOR EACH ROW EXECUTE FUNCTION selections_insert_trigger();
CREATE TRIGGER selections_update INSTEAD OF UPDATE ON selections FOR EACH ROW EXECUTE FUNCTION selections_update_trigger();
CREATE TRIGGER selections_delete INSTEAD OF DELETE ON selections FOR EACH ROW EXECUTE FUNCTION selections_delete_trigger();

-- Permits view triggers
CREATE OR REPLACE FUNCTION permits_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_permits SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION permits_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_permits SET
    job_id = COALESCE(NEW.job_id, OLD.job_id),
    permit_type = NEW.permit_type,
    permit_number = NEW.permit_number,
    status = NEW.status,
    applied_date = NEW.applied_date,
    issued_date = NEW.issued_date,
    expiry_date = NEW.expiry_date,
    cost = NEW.cost,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION permits_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_permits WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permits_insert ON permits;
DROP TRIGGER IF EXISTS permits_update ON permits;
DROP TRIGGER IF EXISTS permits_delete ON permits;

CREATE TRIGGER permits_insert INSTEAD OF INSERT ON permits FOR EACH ROW EXECUTE FUNCTION permits_insert_trigger();
CREATE TRIGGER permits_update INSTEAD OF UPDATE ON permits FOR EACH ROW EXECUTE FUNCTION permits_update_trigger();
CREATE TRIGGER permits_delete INSTEAD OF DELETE ON permits FOR EACH ROW EXECUTE FUNCTION permits_delete_trigger();

-- Expenses view triggers
CREATE OR REPLACE FUNCTION expenses_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_expenses SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expenses_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_expenses SET
    job_id = NEW.job_id,
    vendor_id = NEW.vendor_id,
    cost_code_id = NEW.cost_code_id,
    amount = NEW.amount,
    expense_date = NEW.expense_date,
    description = NEW.description,
    receipt_url = NEW.receipt_url,
    status = NEW.status,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expenses_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_expenses WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_insert ON expenses;
DROP TRIGGER IF EXISTS expenses_update ON expenses;
DROP TRIGGER IF EXISTS expenses_delete ON expenses;

CREATE TRIGGER expenses_insert INSTEAD OF INSERT ON expenses FOR EACH ROW EXECUTE FUNCTION expenses_insert_trigger();
CREATE TRIGGER expenses_update INSTEAD OF UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION expenses_update_trigger();
CREATE TRIGGER expenses_delete INSTEAD OF DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION expenses_delete_trigger();

-- Employees view triggers
CREATE OR REPLACE FUNCTION employees_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_employees SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION employees_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_employees SET
    name = NEW.name,
    role = NEW.role,
    email = NEW.email,
    phone = NEW.phone,
    status = NEW.status,
    hourly_rate = NEW.hourly_rate,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION employees_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_employees WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_insert ON employees;
DROP TRIGGER IF EXISTS employees_update ON employees;
DROP TRIGGER IF EXISTS employees_delete ON employees;

CREATE TRIGGER employees_insert INSTEAD OF INSERT ON employees FOR EACH ROW EXECUTE FUNCTION employees_insert_trigger();
CREATE TRIGGER employees_update INSTEAD OF UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION employees_update_trigger();
CREATE TRIGGER employees_delete INSTEAD OF DELETE ON employees FOR EACH ROW EXECUTE FUNCTION employees_delete_trigger();

-- Leads view triggers
CREATE OR REPLACE FUNCTION leads_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_leads SELECT NEW.*;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION leads_update_trigger() RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_leads SET
    name = NEW.name,
    email = NEW.email,
    phone = NEW.phone,
    address = NEW.address,
    source = NEW.source,
    status = NEW.status,
    estimated_value = NEW.estimated_value,
    notes = NEW.notes,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION leads_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM v2_leads WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_insert ON leads;
DROP TRIGGER IF EXISTS leads_update ON leads;
DROP TRIGGER IF EXISTS leads_delete ON leads;

CREATE TRIGGER leads_insert INSTEAD OF INSERT ON leads FOR EACH ROW EXECUTE FUNCTION leads_insert_trigger();
CREATE TRIGGER leads_update INSTEAD OF UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION leads_update_trigger();
CREATE TRIGGER leads_delete INSTEAD OF DELETE ON leads FOR EACH ROW EXECUTE FUNCTION leads_delete_trigger();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vendors TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_codes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_allocations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON po_line_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON po_attachments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON draws TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON change_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON co_line_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON budget_lines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lien_releases TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_log_crew TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_log_deliveries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_log_attachments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_log_inspections TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_tasks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON selections TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON permits TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_aliases TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON estimate_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_learned_mappings TO anon, authenticated;

-- Done!
COMMENT ON VIEW jobs IS 'Compatibility view for Kind-Creation frontend - maps to v2_jobs';
COMMENT ON VIEW vendors IS 'Compatibility view for Kind-Creation frontend - maps to v2_vendors';
COMMENT ON VIEW invoices IS 'Compatibility view for Kind-Creation frontend - maps to v2_invoices';
