/**
 * Ross Built CMS - AI Learning System
 *
 * Records and retrieves learned mappings from manual corrections.
 * When an accountant assigns an unmatched invoice to a job/vendor,
 * the system learns that mapping for future invoices.
 *
 * Learning improves over time:
 * - First correction: 90% confidence
 * - Each confirmation: +2% confidence (max 99%)
 * - times_used tracks how reliable the mapping is
 */

const { supabase } = require('../config');

/**
 * Normalize a string for matching
 * Lowercase, remove special chars, trim
 */
function normalizeForLearning(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Record a learning from a manual correction
 *
 * @param {string} entityType - 'job' or 'vendor'
 * @param {string} extractedValue - What AI extracted (e.g., "Drumnd", "FL Sunshine")
 * @param {string} matchedId - UUID of the entity it was matched to
 * @param {string} matchedName - Name of the matched entity
 * @param {string} sourceField - Which field it came from (optional)
 */
async function recordLearning(entityType, extractedValue, matchedId, matchedName, sourceField = null) {
  if (!extractedValue || !matchedId) return null;

  const normalized = normalizeForLearning(extractedValue);
  if (normalized.length < 2) return null; // Too short to be useful

  try {
    // Check if we already have this mapping
    const { data: existing } = await supabase
      .from('v2_ai_learning')
      .select('*')
      .eq('entity_type', entityType)
      .eq('extracted_value', normalized)
      .single();

    if (existing) {
      // Update existing mapping
      if (existing.matched_id === matchedId) {
        // Same match - increment times_used and boost confidence
        const newTimesUsed = existing.times_used + 1;
        const newConfidence = Math.min(0.99, existing.confidence + 0.02);

        const { data: updated, error } = await supabase
          .from('v2_ai_learning')
          .update({
            times_used: newTimesUsed,
            confidence: newConfidence,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error) {
          console.log(`[AI Learning] Reinforced ${entityType} mapping: "${extractedValue}" → "${matchedName}" (${newTimesUsed}x, ${Math.round(newConfidence * 100)}%)`);
        }
        return updated;
      } else {
        // Different match - this is a correction, update the mapping
        const { data: updated, error } = await supabase
          .from('v2_ai_learning')
          .update({
            matched_id: matchedId,
            matched_name: matchedName,
            confidence: 0.90, // Reset confidence for new mapping
            times_used: 1,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error) {
          console.log(`[AI Learning] Updated ${entityType} mapping: "${extractedValue}" → "${matchedName}" (was: ${existing.matched_name})`);
        }
        return updated;
      }
    }

    // Create new learning
    const { data: newLearning, error } = await supabase
      .from('v2_ai_learning')
      .insert({
        entity_type: entityType,
        extracted_value: normalized,
        extracted_raw: extractedValue,
        matched_id: matchedId,
        matched_name: matchedName,
        source_field: sourceField,
        confidence: 0.90,
        times_used: 1
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation means concurrent insert - that's ok
      if (error.code === '23505') {
        console.log(`[AI Learning] Concurrent insert for "${extractedValue}" - already learned`);
        return null;
      }
      console.error('[AI Learning] Failed to record:', error.message);
      return null;
    }

    console.log(`[AI Learning] Learned new ${entityType} mapping: "${extractedValue}" → "${matchedName}"`);
    return newLearning;

  } catch (err) {
    console.error('[AI Learning] Error recording learning:', err.message);
    return null;
  }
}

/**
 * Look up a learned mapping
 *
 * @param {string} entityType - 'job' or 'vendor'
 * @param {string} extractedValue - What AI extracted
 * @returns {Object|null} - { matched_id, matched_name, confidence } or null
 */
async function findLearnedMapping(entityType, extractedValue) {
  if (!extractedValue) return null;

  const normalized = normalizeForLearning(extractedValue);
  if (normalized.length < 2) return null;

  try {
    const { data, error } = await supabase
      .from('v2_ai_learning')
      .select('matched_id, matched_name, confidence, times_used')
      .eq('entity_type', entityType)
      .eq('extracted_value', normalized)
      .single();

    if (error || !data) return null;

    // Verify the matched entity still exists
    const table = entityType === 'job' ? 'v2_jobs' : 'v2_vendors';
    const { data: entity, error: entityError } = await supabase
      .from(table)
      .select('id, name')
      .eq('id', data.matched_id)
      .single();

    if (entityError || !entity) {
      // Entity was deleted - remove the learning
      await supabase
        .from('v2_ai_learning')
        .delete()
        .eq('entity_type', entityType)
        .eq('extracted_value', normalized);
      return null;
    }

    return {
      matched_id: data.matched_id,
      matched_name: data.matched_name,
      confidence: data.confidence,
      times_used: data.times_used,
      source: 'learned'
    };

  } catch (err) {
    console.error('[AI Learning] Error finding mapping:', err.message);
    return null;
  }
}

/**
 * Find learned mappings for multiple search terms
 * Used during invoice processing to check all possible extracted values
 *
 * @param {string} entityType - 'job' or 'vendor'
 * @param {string[]} searchTerms - Array of extracted values to check
 * @returns {Object|null} - Best learned match or null
 */
async function findBestLearnedMapping(entityType, searchTerms) {
  if (!searchTerms || searchTerms.length === 0) return null;

  let bestMatch = null;

  for (const term of searchTerms) {
    const mapping = await findLearnedMapping(entityType, term);
    if (mapping && (!bestMatch || mapping.confidence > bestMatch.confidence)) {
      bestMatch = mapping;
    }
  }

  return bestMatch;
}

/**
 * Record learning from an invoice assignment
 * Called when an invoice's job_id is updated
 *
 * @param {Object} invoice - Invoice record with AI extracted data
 * @param {string} jobId - The job it was assigned to
 * @param {Object} job - The job record
 */
async function recordInvoiceLearning(invoice, jobId, job) {
  if (!invoice || !jobId || !job) return;

  const aiData = invoice.ai_extracted_data;
  if (!aiData) return;

  // Extract job references from AI data
  const jobReferences = [
    aiData.parsed_job_reference,
    aiData.parsed_job_name,
    aiData.parsed_client_name,
    aiData.parsed_address
  ].filter(Boolean);

  // Also check the job object in extracted data
  if (invoice.extracted?.job) {
    const jobData = invoice.extracted.job;
    if (jobData.reference) jobReferences.push(jobData.reference);
    if (jobData.clientName) jobReferences.push(jobData.clientName);
    if (jobData.address) jobReferences.push(jobData.address);
    if (jobData.poNumber) jobReferences.push(jobData.poNumber);
  }

  // Record learning for each unique reference
  const seen = new Set();
  for (const ref of jobReferences) {
    const normalized = normalizeForLearning(ref);
    if (normalized.length >= 2 && !seen.has(normalized)) {
      seen.add(normalized);
      await recordLearning('job', ref, jobId, job.name, 'job.reference');
    }
  }

  // Also record vendor learning if we have vendor data
  if (aiData.parsed_vendor_name && invoice.vendor_id) {
    const { data: vendor } = await supabase
      .from('v2_vendors')
      .select('id, name')
      .eq('id', invoice.vendor_id)
      .single();

    if (vendor && normalizeForLearning(aiData.parsed_vendor_name) !== normalizeForLearning(vendor.name)) {
      await recordLearning('vendor', aiData.parsed_vendor_name, vendor.id, vendor.name, 'vendor.companyName');
    }
  }
}

/**
 * Get learning statistics
 */
async function getLearningStats() {
  try {
    const { data: jobLearnings } = await supabase
      .from('v2_ai_learning')
      .select('id, times_used, confidence')
      .eq('entity_type', 'job');

    const { data: vendorLearnings } = await supabase
      .from('v2_ai_learning')
      .select('id, times_used, confidence')
      .eq('entity_type', 'vendor');

    return {
      job: {
        count: jobLearnings?.length || 0,
        totalUses: jobLearnings?.reduce((sum, l) => sum + l.times_used, 0) || 0,
        avgConfidence: jobLearnings?.length
          ? Math.round(jobLearnings.reduce((sum, l) => sum + l.confidence, 0) / jobLearnings.length * 100)
          : 0
      },
      vendor: {
        count: vendorLearnings?.length || 0,
        totalUses: vendorLearnings?.reduce((sum, l) => sum + l.times_used, 0) || 0,
        avgConfidence: vendorLearnings?.length
          ? Math.round(vendorLearnings.reduce((sum, l) => sum + l.confidence, 0) / vendorLearnings.length * 100)
          : 0
      }
    };
  } catch (err) {
    console.error('[AI Learning] Error getting stats:', err.message);
    return { job: { count: 0 }, vendor: { count: 0 } };
  }
}

module.exports = {
  recordLearning,
  findLearnedMapping,
  findBestLearnedMapping,
  recordInvoiceLearning,
  getLearningStats,
  normalizeForLearning
};
