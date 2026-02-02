-- Migration 157: Inventory Management for Material Suppliers
-- Phase 8 Integrations - Suppliers: Auto-PO from low stock, Price comparison

-- ============================================================
-- INVENTORY ITEMS TABLE
-- Tracks all inventory items with reorder points
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    builder_id UUID REFERENCES v2_builders(id),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    category TEXT,
    unit_type TEXT DEFAULT 'each',  -- each, box, pallet, sqft, lf, etc.
    current_quantity DECIMAL(12,2) DEFAULT 0,
    reorder_point DECIMAL(12,2) DEFAULT 0,  -- Trigger auto-PO when below this
    reorder_quantity DECIMAL(12,2) DEFAULT 0,  -- Quantity to order
    preferred_vendor_id UUID REFERENCES v2_vendors(id),
    cost_code_id UUID REFERENCES v2_cost_codes(id),
    location TEXT,  -- Warehouse location or job site
    last_count_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_builder ON v2_inventory_items(builder_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON v2_inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON v2_inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_vendor ON v2_inventory_items(preferred_vendor_id);
-- Use a simpler index for low stock queries (comparison done at query time)
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON v2_inventory_items(builder_id, current_quantity);

-- ============================================================
-- INVENTORY TRANSACTIONS TABLE
-- Tracks all inventory movements (received, used, adjusted, returned)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES v2_inventory_items(id) ON DELETE CASCADE,
    job_id UUID REFERENCES v2_jobs(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('received', 'used', 'adjusted', 'returned', 'transferred')),
    quantity DECIMAL(12,2) NOT NULL,  -- Positive for received/returned, negative for used
    unit_cost DECIMAL(12,4),
    total_cost DECIMAL(12,2),
    po_id UUID REFERENCES v2_purchase_orders(id),
    invoice_id UUID REFERENCES v2_invoices(id),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON v2_inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_job ON v2_inventory_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_po ON v2_inventory_transactions(po_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON v2_inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON v2_inventory_transactions(created_at);

-- ============================================================
-- VENDOR PRICES TABLE
-- Tracks pricing from different vendors for price comparison
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_vendor_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES v2_vendors(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES v2_inventory_items(id) ON DELETE CASCADE,
    sku TEXT,  -- Vendor's SKU for this item
    unit_price DECIMAL(12,4) NOT NULL,
    min_quantity DECIMAL(12,2) DEFAULT 1,  -- Minimum order quantity for this price
    effective_date DATE DEFAULT CURRENT_DATE,
    expires_at DATE,  -- NULL means no expiration
    lead_days INTEGER,  -- Estimated lead time in days
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for price queries
CREATE INDEX IF NOT EXISTS idx_vendor_prices_vendor ON v2_vendor_prices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_prices_item ON v2_vendor_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_vendor_prices_effective ON v2_vendor_prices(effective_date, expires_at);
-- Simple unique constraint (expiration checked at query time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_prices_vendor_item ON v2_vendor_prices(vendor_id, item_id, min_quantity, effective_date);

-- ============================================================
-- AUTO-PO QUEUE TABLE
-- Tracks auto-generated POs pending approval
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_auto_po_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    builder_id UUID REFERENCES v2_builders(id),
    vendor_id UUID NOT NULL REFERENCES v2_vendors(id),
    po_id UUID REFERENCES v2_purchase_orders(id),  -- Linked when PO is created
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'created')),
    items JSONB NOT NULL,  -- Array of {item_id, quantity, unit_price, item_name}
    total_amount DECIMAL(12,2) NOT NULL,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_po_queue_builder ON v2_auto_po_queue(builder_id);
CREATE INDEX IF NOT EXISTS idx_auto_po_queue_status ON v2_auto_po_queue(status);
CREATE INDEX IF NOT EXISTS idx_auto_po_queue_vendor ON v2_auto_po_queue(vendor_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update inventory quantity and create transaction
CREATE OR REPLACE FUNCTION update_inventory_quantity(
    p_item_id UUID,
    p_transaction_type TEXT,
    p_quantity DECIMAL,
    p_job_id UUID DEFAULT NULL,
    p_unit_cost DECIMAL DEFAULT NULL,
    p_po_id UUID DEFAULT NULL,
    p_invoice_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_created_by TEXT DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_quantity_change DECIMAL;
    v_total_cost DECIMAL;
BEGIN
    -- Determine quantity change (positive or negative based on type)
    CASE p_transaction_type
        WHEN 'received' THEN v_quantity_change := ABS(p_quantity);
        WHEN 'returned' THEN v_quantity_change := ABS(p_quantity);
        WHEN 'used' THEN v_quantity_change := -ABS(p_quantity);
        WHEN 'adjusted' THEN v_quantity_change := p_quantity;  -- Can be positive or negative
        WHEN 'transferred' THEN v_quantity_change := -ABS(p_quantity);
        ELSE RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
    END CASE;

    -- Calculate total cost
    v_total_cost := COALESCE(p_unit_cost, 0) * ABS(p_quantity);

    -- Create transaction record
    INSERT INTO v2_inventory_transactions (
        item_id, job_id, transaction_type, quantity, unit_cost, total_cost,
        po_id, invoice_id, notes, created_by
    ) VALUES (
        p_item_id, p_job_id, p_transaction_type, v_quantity_change, p_unit_cost, v_total_cost,
        p_po_id, p_invoice_id, p_notes, p_created_by
    ) RETURNING id INTO v_transaction_id;

    -- Update inventory quantity
    UPDATE v2_inventory_items
    SET current_quantity = current_quantity + v_quantity_change,
        updated_at = NOW()
    WHERE id = p_item_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get best price for an item across all vendors
CREATE OR REPLACE FUNCTION get_best_price(
    p_item_id UUID,
    p_quantity DECIMAL DEFAULT 1
) RETURNS TABLE (
    vendor_id UUID,
    vendor_name TEXT,
    unit_price DECIMAL,
    total_price DECIMAL,
    lead_days INTEGER,
    effective_date DATE,
    expires_at DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vp.vendor_id,
        v.name AS vendor_name,
        vp.unit_price,
        (vp.unit_price * p_quantity) AS total_price,
        vp.lead_days,
        vp.effective_date,
        vp.expires_at
    FROM v2_vendor_prices vp
    JOIN v2_vendors v ON v.id = vp.vendor_id
    WHERE vp.item_id = p_item_id
      AND vp.effective_date <= CURRENT_DATE
      AND (vp.expires_at IS NULL OR vp.expires_at > CURRENT_DATE)
      AND vp.min_quantity <= p_quantity
    ORDER BY vp.unit_price ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock items
CREATE OR REPLACE FUNCTION get_low_stock_items(
    p_builder_id UUID DEFAULT NULL
) RETURNS TABLE (
    item_id UUID,
    item_name TEXT,
    sku TEXT,
    current_quantity DECIMAL,
    reorder_point DECIMAL,
    reorder_quantity DECIMAL,
    preferred_vendor_id UUID,
    preferred_vendor_name TEXT,
    best_unit_price DECIMAL,
    estimated_cost DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id AS item_id,
        i.name AS item_name,
        i.sku,
        i.current_quantity,
        i.reorder_point,
        i.reorder_quantity,
        i.preferred_vendor_id,
        v.name AS preferred_vendor_name,
        COALESCE(
            (SELECT MIN(vp.unit_price)
             FROM v2_vendor_prices vp
             WHERE vp.item_id = i.id
               AND vp.effective_date <= CURRENT_DATE
               AND (vp.expires_at IS NULL OR vp.expires_at > CURRENT_DATE)),
            0
        ) AS best_unit_price,
        COALESCE(
            (SELECT MIN(vp.unit_price)
             FROM v2_vendor_prices vp
             WHERE vp.item_id = i.id
               AND vp.effective_date <= CURRENT_DATE
               AND (vp.expires_at IS NULL OR vp.expires_at > CURRENT_DATE)) * i.reorder_quantity,
            0
        ) AS estimated_cost
    FROM v2_inventory_items i
    LEFT JOIN v2_vendors v ON v.id = i.preferred_vendor_id
    WHERE i.current_quantity <= i.reorder_point
      AND i.reorder_point > 0
      AND (p_builder_id IS NULL OR i.builder_id = p_builder_id)
    ORDER BY (i.reorder_point - i.current_quantity) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE v2_inventory_items IS 'Material inventory items with reorder points for auto-PO generation';
COMMENT ON TABLE v2_inventory_transactions IS 'Audit trail of all inventory movements';
COMMENT ON TABLE v2_vendor_prices IS 'Price list from vendors for price comparison';
COMMENT ON TABLE v2_auto_po_queue IS 'Queue of auto-generated POs pending review';

COMMENT ON FUNCTION update_inventory_quantity IS 'Updates inventory quantity and creates transaction record';
COMMENT ON FUNCTION get_best_price IS 'Returns all vendor prices for an item, sorted by lowest price';
COMMENT ON FUNCTION get_low_stock_items IS 'Returns items below their reorder point';
