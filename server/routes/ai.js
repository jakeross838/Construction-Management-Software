/**
 * AI Routes
 * AI feedback, learning, and statistics endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler } = require('../errors');
const aiLearning = require('../ai-learning');

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

// Get AI learning statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await aiLearning.getLearningStats();

  // Get feedback counts
  const { count: feedbackCount } = await supabase
    .from('v2_ai_feedback')
    .select('*', { count: 'exact', head: true });

  const { count: appliedCount } = await supabase
    .from('v2_ai_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('applied_to_learning', true);

  // Get alias counts
  const { count: aliasCount } = await supabase
    .from('v2_vendor_aliases')
    .select('*', { count: 'exact', head: true });

  // Get duplicate counts
  const { count: pendingDuplicates } = await supabase
    .from('v2_vendor_duplicates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  res.json({
    learning: stats,
    feedback: {
      total: feedbackCount || 0,
      applied: appliedCount || 0
    },
    vendor_aliases: aliasCount || 0,
    pending_duplicates: pendingDuplicates || 0
  });
}));

module.exports = router;
