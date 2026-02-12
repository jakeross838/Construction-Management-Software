const { supabase } = require('../../config');
const logger = require('../utils/logger');

async function updateDrawTotal(drawId) {
  try {
    // Get allocations from the new draw_allocations table
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId);

    const invoiceTotal = (drawAllocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Get CO billings
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('amount')
      .eq('draw_id', drawId);

    const coTotal = (coBillings || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    await supabase.from('v2_draws').update({ total_amount: invoiceTotal + coTotal }).eq('id', drawId);
  } catch (err) {
    logger.error('Error updating draw total', { component: 'draw', error: err.message });
  }
}

// Helper: Get or create draft draw for a job
// Returns the draft draw, creating one if it doesn't exist
async function getOrCreateDraftDraw(jobId, createdBy = 'System') {
  try {
    // Try to find existing draft draw for this job
    const { data: existingDraft } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .single();

    if (existingDraft) {
      return existingDraft;
    }

    // No draft exists, create a new one
    // Get next draw number for this job and previous draw's period_end
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('draw_number, period_end')
      .eq('job_id', jobId)
      .order('draw_number', { ascending: false })
      .limit(1);

    const nextNumber = (draws?.[0]?.draw_number || 0) + 1;

    // Calculate period_start: day after previous draw's period_end, or today if first draw
    let periodStart = new Date().toISOString().split('T')[0];
    if (draws?.[0]?.period_end) {
      const prevEnd = new Date(draws[0].period_end);
      prevEnd.setDate(prevEnd.getDate() + 1);
      periodStart = prevEnd.toISOString().split('T')[0];
    }

    // Create new draft draw
    const { data: newDraw, error } = await supabase
      .from('v2_draws')
      .insert({
        job_id: jobId,
        draw_number: nextNumber,
        status: 'draft',
        period_start: periodStart,
        period_end: new Date().toISOString().split('T')[0],
        total_amount: 0
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logDrawActivity(newDraw.id, 'created', createdBy, { auto_created: true });

    logger.info('Auto-created draw', { component: 'draw', drawNumber: nextNumber, jobId });
    return newDraw;
  } catch (err) {
    logger.error('Error getting/creating draft draw', { component: 'draw', error: err.message });
    throw err;
  }
}

// Helper: Log draw activity
async function logDrawActivity(drawId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_draw_activity').insert({
      draw_id: drawId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    logger.error('Error logging draw activity', { component: 'draw', error: err.message });
  }
}

// Helper: Add invoice to draw (creates draw_allocations from invoice_allocations)
async function addInvoiceToDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get invoice allocations
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('cost_code_id, amount, notes')
      .eq('invoice_id', invoiceId);

    if (!allocations || allocations.length === 0) {
      throw new Error('Invoice has no allocations');
    }

    // Link invoice to draw
    const { error: linkError } = await supabase
      .from('v2_draw_invoices')
      .insert({ draw_id: drawId, invoice_id: invoiceId });

    if (linkError && !linkError.message?.includes('duplicate')) {
      throw linkError;
    }

    // Create draw_allocations (copy from invoice_allocations)
    for (const alloc of allocations) {
      const { error: allocError } = await supabase
        .from('v2_draw_allocations')
        .upsert({
          draw_id: drawId,
          invoice_id: invoiceId,
          cost_code_id: alloc.cost_code_id,
          amount: alloc.amount,
          notes: alloc.notes,
          created_by: performedBy
        }, { onConflict: 'draw_id,invoice_id,cost_code_id' });

      if (allocError) {
        logger.error('Error creating draw allocation', { component: 'draw', error: allocError.message });
      }
    }

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    const totalAmount = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    await logDrawActivity(drawId, 'invoice_added', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    logger.error('Error adding invoice to draw', { component: 'draw', error: err.message });
    throw err;
  }
}

// Helper: Remove invoice from draw
async function removeInvoiceFromDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get the amount being removed for logging
    const { data: allocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    const totalAmount = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Remove draw_allocations
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Remove from draw_invoices
    await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    await logDrawActivity(drawId, 'invoice_removed', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    logger.error('Error removing invoice from draw', { component: 'draw', error: err.message });
    throw err;
  }
}

module.exports = {
  updateDrawTotal,
  getOrCreateDraftDraw,
  logDrawActivity,
  addInvoiceToDraw,
  removeInvoiceFromDraw
};
