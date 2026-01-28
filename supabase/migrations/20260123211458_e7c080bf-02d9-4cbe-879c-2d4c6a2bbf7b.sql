-- =====================================================
-- FINANCIAL MODULE DATABASE SCHEMA
-- Ross Built Construction Management System
-- =====================================================

-- =====================================================
-- 1. COST CODES TABLE
-- =====================================================
CREATE TABLE public.cost_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cost_codes ENABLE ROW LEVEL SECURITY;

-- Everyone can view cost codes
CREATE POLICY "Cost codes are viewable by everyone" 
ON public.cost_codes FOR SELECT USING (true);

-- =====================================================
-- 2. VENDORS TABLE
-- =====================================================
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  tax_id VARCHAR(20),
  insurance_expiry DATE,
  w9_on_file BOOLEAN DEFAULT false,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Everyone can view vendors
CREATE POLICY "Vendors are viewable by everyone" 
ON public.vendors FOR SELECT USING (true);

CREATE POLICY "Vendors can be inserted by anyone" 
ON public.vendors FOR INSERT WITH CHECK (true);

CREATE POLICY "Vendors can be updated by anyone" 
ON public.vendors FOR UPDATE USING (true);

-- =====================================================
-- 3. JOBS TABLE (extending existing mock structure)
-- =====================================================
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  client VARCHAR(200),
  address TEXT,
  contract_amount DECIMAL(15, 2) DEFAULT 0,
  budget_amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('pre_construction', 'active', 'on_hold', 'completed', 'closed')),
  percent_complete INTEGER DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),
  start_date DATE,
  end_date DATE,
  target_margin DECIMAL(5, 2) DEFAULT 10.00,
  retainage_percent DECIMAL(5, 2) DEFAULT 10.00,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs are viewable by everyone" 
ON public.jobs FOR SELECT USING (true);

CREATE POLICY "Jobs can be inserted by anyone" 
ON public.jobs FOR INSERT WITH CHECK (true);

CREATE POLICY "Jobs can be updated by anyone" 
ON public.jobs FOR UPDATE USING (true);

-- =====================================================
-- 4. PURCHASE ORDERS TABLE
-- =====================================================
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number VARCHAR(50) NOT NULL UNIQUE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  description TEXT,
  scope_of_work TEXT,
  original_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  change_order_amount DECIMAL(15, 2) DEFAULT 0,
  current_amount DECIMAL(15, 2) GENERATED ALWAYS AS (original_amount + change_order_amount) STORED,
  invoiced_amount DECIMAL(15, 2) DEFAULT 0,
  remaining_amount DECIMAL(15, 2) GENERATED ALWAYS AS (original_amount + change_order_amount - invoiced_amount) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "POs are viewable by everyone" 
ON public.purchase_orders FOR SELECT USING (true);

CREATE POLICY "POs can be inserted by anyone" 
ON public.purchase_orders FOR INSERT WITH CHECK (true);

CREATE POLICY "POs can be updated by anyone" 
ON public.purchase_orders FOR UPDATE USING (true);

-- =====================================================
-- 5. PURCHASE ORDER LINE ITEMS
-- =====================================================
CREATE TABLE public.po_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES public.cost_codes(id),
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  invoiced_amount DECIMAL(15, 2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PO line items are viewable by everyone" 
ON public.po_line_items FOR SELECT USING (true);

CREATE POLICY "PO line items can be inserted by anyone" 
ON public.po_line_items FOR INSERT WITH CHECK (true);

CREATE POLICY "PO line items can be updated by anyone" 
ON public.po_line_items FOR UPDATE USING (true);

CREATE POLICY "PO line items can be deleted by anyone" 
ON public.po_line_items FOR DELETE USING (true);

-- =====================================================
-- 6. DRAWS (PAY APPLICATIONS) TABLE
-- =====================================================
CREATE TABLE public.draws (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_number INTEGER NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  application_date DATE DEFAULT CURRENT_DATE,
  total_completed DECIMAL(15, 2) DEFAULT 0,
  retainage_amount DECIMAL(15, 2) DEFAULT 0,
  current_payment_due DECIMAL(15, 2) GENERATED ALWAYS AS (total_completed - retainage_amount) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'funded')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by VARCHAR(100),
  funded_at TIMESTAMP WITH TIME ZONE,
  funded_amount DECIMAL(15, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, draw_number)
);

-- Enable RLS
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Draws are viewable by everyone" 
ON public.draws FOR SELECT USING (true);

CREATE POLICY "Draws can be inserted by anyone" 
ON public.draws FOR INSERT WITH CHECK (true);

CREATE POLICY "Draws can be updated by anyone" 
ON public.draws FOR UPDATE USING (true);

-- =====================================================
-- 7. INVOICES TABLE
-- =====================================================
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  job_id UUID REFERENCES public.jobs(id),
  po_id UUID REFERENCES public.purchase_orders(id),
  draw_id UUID REFERENCES public.draws(id),
  parent_invoice_id UUID REFERENCES public.invoices(id),
  amount DECIMAL(15, 2) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  received_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'needs_approval', 'approved', 'denied', 'in_draw', 'paid')),
  pdf_url TEXT,
  stamped_pdf_url TEXT,
  ai_extracted_data JSONB,
  ai_confidence JSONB,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_reference VARCHAR(100),
  notes TEXT,
  is_credit BOOLEAN DEFAULT false,
  is_split_child BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoices are viewable by everyone" 
ON public.invoices FOR SELECT USING (true);

CREATE POLICY "Invoices can be inserted by anyone" 
ON public.invoices FOR INSERT WITH CHECK (true);

CREATE POLICY "Invoices can be updated by anyone" 
ON public.invoices FOR UPDATE USING (true);

-- =====================================================
-- 8. INVOICE ALLOCATIONS (COST CODE SPLITS)
-- =====================================================
CREATE TABLE public.invoice_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES public.cost_codes(id),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoice allocations are viewable by everyone" 
ON public.invoice_allocations FOR SELECT USING (true);

CREATE POLICY "Invoice allocations can be inserted by anyone" 
ON public.invoice_allocations FOR INSERT WITH CHECK (true);

CREATE POLICY "Invoice allocations can be updated by anyone" 
ON public.invoice_allocations FOR UPDATE USING (true);

CREATE POLICY "Invoice allocations can be deleted by anyone" 
ON public.invoice_allocations FOR DELETE USING (true);

-- =====================================================
-- 9. CHANGE ORDERS TABLE
-- =====================================================
CREATE TABLE public.change_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  co_number VARCHAR(20) NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  po_id UUID REFERENCES public.purchase_orders(id),
  description TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('addition', 'deduction', 'change', 'upgrade')),
  requested_by VARCHAR(50) CHECK (requested_by IN ('client', 'builder', 'architect')),
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  markup_percent DECIMAL(5, 2) DEFAULT 10.00,
  markup_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) GENERATED ALWAYS AS (subtotal + markup_amount) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  client_signature_required BOOLEAN DEFAULT true,
  client_signed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, co_number)
);

-- Enable RLS
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Change orders are viewable by everyone" 
ON public.change_orders FOR SELECT USING (true);

CREATE POLICY "Change orders can be inserted by anyone" 
ON public.change_orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Change orders can be updated by anyone" 
ON public.change_orders FOR UPDATE USING (true);

-- =====================================================
-- 10. CHANGE ORDER LINE ITEMS
-- =====================================================
CREATE TABLE public.co_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  change_order_id UUID NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.co_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CO line items are viewable by everyone" 
ON public.co_line_items FOR SELECT USING (true);

CREATE POLICY "CO line items can be inserted by anyone" 
ON public.co_line_items FOR INSERT WITH CHECK (true);

CREATE POLICY "CO line items can be updated by anyone" 
ON public.co_line_items FOR UPDATE USING (true);

CREATE POLICY "CO line items can be deleted by anyone" 
ON public.co_line_items FOR DELETE USING (true);

-- =====================================================
-- 11. BUDGET LINES TABLE
-- =====================================================
CREATE TABLE public.budget_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES public.cost_codes(id),
  budgeted_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, cost_code_id)
);

-- Enable RLS
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget lines are viewable by everyone" 
ON public.budget_lines FOR SELECT USING (true);

CREATE POLICY "Budget lines can be inserted by anyone" 
ON public.budget_lines FOR INSERT WITH CHECK (true);

CREATE POLICY "Budget lines can be updated by anyone" 
ON public.budget_lines FOR UPDATE USING (true);

-- =====================================================
-- 12. ACTIVITY LOG TABLE
-- =====================================================
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  user_name VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity log is viewable by everyone" 
ON public.activity_log FOR SELECT USING (true);

CREATE POLICY "Activity log can be inserted by anyone" 
ON public.activity_log FOR INSERT WITH CHECK (true);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_job_id ON public.invoices(job_id);
CREATE INDEX idx_invoices_vendor_id ON public.invoices(vendor_id);
CREATE INDEX idx_invoices_po_id ON public.invoices(po_id);
CREATE INDEX idx_invoices_draw_id ON public.invoices(draw_id);

CREATE INDEX idx_purchase_orders_job_id ON public.purchase_orders(job_id);
CREATE INDEX idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

CREATE INDEX idx_draws_job_id ON public.draws(job_id);
CREATE INDEX idx_draws_status ON public.draws(status);

CREATE INDEX idx_change_orders_job_id ON public.change_orders(job_id);
CREATE INDEX idx_change_orders_po_id ON public.change_orders(po_id);
CREATE INDEX idx_change_orders_status ON public.change_orders(status);

CREATE INDEX idx_budget_lines_job_id ON public.budget_lines(job_id);

CREATE INDEX idx_activity_log_entity ON public.activity_log(entity_type, entity_id);

-- =====================================================
-- UPDATE TIMESTAMP TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_cost_codes_updated_at BEFORE UPDATE ON public.cost_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_po_line_items_updated_at BEFORE UPDATE ON public.po_line_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_draws_updated_at BEFORE UPDATE ON public.draws FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoice_allocations_updated_at BEFORE UPDATE ON public.invoice_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_change_orders_updated_at BEFORE UPDATE ON public.change_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_co_line_items_updated_at BEFORE UPDATE ON public.co_line_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budget_lines_updated_at BEFORE UPDATE ON public.budget_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SEED DATA: COST CODES (CSI MasterFormat)
-- =====================================================
INSERT INTO public.cost_codes (code, name, category) VALUES
('01000', 'General Requirements', 'General'),
('02000', 'Site Work', 'Site'),
('03000', 'Concrete', 'Structure'),
('04000', 'Masonry', 'Structure'),
('05000', 'Metals', 'Structure'),
('06100', 'Rough Carpentry', 'Wood & Plastics'),
('06200', 'Finish Carpentry', 'Wood & Plastics'),
('07000', 'Roofing & Waterproofing', 'Thermal & Moisture'),
('08000', 'Doors & Windows', 'Openings'),
('09000', 'Drywall & Plaster', 'Finishes'),
('09300', 'Tile', 'Finishes'),
('09500', 'Ceilings', 'Finishes'),
('09600', 'Flooring', 'Finishes'),
('09900', 'Painting', 'Finishes'),
('10000', 'Specialties', 'Specialties'),
('11000', 'Equipment', 'Equipment'),
('12000', 'Furnishings', 'Furnishings'),
('13000', 'Special Construction', 'Special'),
('14000', 'Conveying Systems', 'Conveying'),
('15100', 'Plumbing', 'Mechanical'),
('15200', 'Fire Protection', 'Mechanical'),
('15500', 'HVAC', 'Mechanical'),
('16000', 'Electrical', 'Electrical'),
('17000', 'Low Voltage', 'Electrical');