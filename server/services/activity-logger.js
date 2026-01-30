/**
 * Activity Logger Service
 * Centralized activity logging for invoices and other entities
 */

const { supabase } = require('../../config');

/**
 * Log invoice activity
 */
async function logInvoiceActivity(invoiceId, action, performedBy, details = {}) {
  await supabase.from('v2_invoice_activity').insert({
    invoice_id: invoiceId,
    action,
    performed_by: performedBy,
    details
  });
}

/**
 * Log PO activity
 */
async function logPOActivity(poId, action, performedBy, details = {}) {
  await supabase.from('v2_po_activity').insert({
    po_id: poId,
    action,
    performed_by: performedBy,
    details
  });
}

module.exports = {
  logInvoiceActivity,
  logPOActivity
};

