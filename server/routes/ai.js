/**
 * AI Routes
 * AI feedback and learning endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler } = require('../errors');

// Submit AI feedback for learning
router.post('/feedback', asyncHandler(async (req, res) => {
  const {
    invoice_id,
    field_name,
    ai_value,
    user_value,
    corrected_by = 'unknown',
    vendor_name,
    context = {}
  } = req.body;

  // Store the feedback for AI learning
  const { error: insertError } = await supabase
    .from('v2_ai_feedback')
    .insert({
      invoice_id,
      field_name,
      ai_value: typeof ai_value === 'object' ? JSON.stringify(ai_value) : String(ai_value || ''),
      user_value: typeof user_value === 'object' ? JSON.stringify(user_value) : String(user_value || ''),
      corrected_by,
      vendor_name,
      ai_confidence: context.confidence || null,
      vendor_trade: context.vendor_trade || null,
      created_at: new Date().toISOString()
    });

  // If table doesn't exist, just log the feedback - it's non-critical
  if (insertError) {
    console.log('[AI Feedback] Could not store feedback (table may not exist):', insertError.message);
    console.log('[AI Feedback] Received:', {
      invoice_id,
      field_name,
      ai_value,
      user_value,
      corrected_by,
      vendor_name
    });
  } else {
    console.log(`[AI Feedback] Stored correction: ${field_name} "${ai_value}" → "${user_value}" by ${corrected_by}`);
  }

  res.json({ success: true });
}));

module.exports = router;

