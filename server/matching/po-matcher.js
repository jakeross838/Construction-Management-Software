/**
 * Ross Built CMS - PO Matcher Module
 *
 * Multi-signal PO matching for smarter invoice-to-PO assignment.
 * Uses weighted scoring across multiple signals:
 * - Vendor similarity (40%)
 * - PO number match (25%)
 * - Amount proximity (15%)
 * - Date relevance (10%)
 * - Line item match (10%)
 */

const { supabase } = require('../../config');

// Match thresholds
const MATCH_THRESHOLDS = {
  AUTO_MATCH: 0.95,    // High confidence, auto-assign
  REVIEW_QUEUE: 0.80,  // Good match but needs review
  INVESTIGATE: 0.55    // Possible match, needs human verification (lowered from 0.60 to catch date edge cases)
};

// Signal weights (must sum to 1.0)
const SIGNAL_WEIGHTS = {
  vendor: 0.40,
  poNumber: 0.25,
  amount: 0.15,
  date: 0.10,
  lineItems: 0.10
};

/**
 * Calculate vendor similarity score using Jaro-Winkler-like algorithm
 * @param {string} invoiceVendor - Vendor name from invoice
 * @param {string} poVendor - Vendor name from PO
 * @returns {number} Score 0-1
 */
function vendorSimilarity(invoiceVendor, poVendor) {
  if (!invoiceVendor || !poVendor) return 0;

  const a = invoiceVendor.toLowerCase().trim();
  const b = poVendor.toLowerCase().trim();

  // Exact match
  if (a === b) return 1.0;

  // One contains the other
  if (a.includes(b) || b.includes(a)) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return 0.85 + (ratio * 0.10);
  }

  // Token-based matching for company names
  const aTokens = a.split(/\s+/).filter(t => t.length > 1 && !['inc', 'llc', 'corp', 'co', 'company'].includes(t));
  const bTokens = b.split(/\s+/).filter(t => t.length > 1 && !['inc', 'llc', 'corp', 'co', 'company'].includes(t));

  let matches = 0;
  for (const aToken of aTokens) {
    for (const bToken of bTokens) {
      if (aToken === bToken) {
        matches++;
        break;
      }
      // Partial match (starts with same chars)
      if (aToken.length >= 3 && bToken.length >= 3) {
        if (aToken.startsWith(bToken.slice(0, 3)) || bToken.startsWith(aToken.slice(0, 3))) {
          matches += 0.7;
          break;
        }
      }
    }
  }

  const maxTokens = Math.max(aTokens.length, bTokens.length);
  if (maxTokens === 0) return 0;

  return Math.min(matches / maxTokens, 1.0);
}

/**
 * Check if PO number matches
 * Handles variations: PO-123, 123, PO123, PO 123
 * @param {string} invoicePoRef - PO reference from invoice
 * @param {string} poNumber - Actual PO number
 * @returns {number} Score 0 or 1 (binary match)
 */
function poNumberMatch(invoicePoRef, poNumber) {
  if (!invoicePoRef || !poNumber) return 0;

  // Normalize both: remove non-alphanumeric, lowercase
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const normInvoice = normalize(invoicePoRef);
  const normPO = normalize(poNumber);

  // Exact match after normalization
  if (normInvoice === normPO) return 1.0;

  // Extract just the number part
  const invoiceNum = invoicePoRef.replace(/\D/g, '');
  const poNum = poNumber.replace(/\D/g, '');

  if (invoiceNum && poNum && invoiceNum === poNum) return 0.95;

  // One contains the other
  if (normPO.includes(normInvoice) || normInvoice.includes(normPO)) {
    return 0.80;
  }

  return 0;
}

/**
 * Calculate amount proximity score
 * @param {number} invoiceAmount - Invoice total amount
 * @param {number} poRemaining - Remaining amount on PO (total - billed)
 * @param {number} poTotal - Total PO amount
 * @param {number} tolerance - Tolerance percentage (default 0.10 = 10%)
 * @returns {number} Score 0-1
 */
function amountProximity(invoiceAmount, poRemaining, poTotal, tolerance = 0.10) {
  if (!invoiceAmount || invoiceAmount <= 0) return 0;
  if (!poTotal || poTotal <= 0) return 0;

  // If there's remaining amount on the PO
  if (poRemaining !== null && poRemaining !== undefined) {
    // Perfect match to remaining
    if (Math.abs(invoiceAmount - poRemaining) < 0.01) return 1.0;

    // Within tolerance of remaining
    const remainingDiff = Math.abs(invoiceAmount - poRemaining) / poRemaining;
    if (remainingDiff <= tolerance) {
      return 1.0 - (remainingDiff / tolerance) * 0.3;
    }
  }

  // Check against total PO amount
  if (invoiceAmount <= poTotal * 1.1) { // Allow up to 110% of PO total
    // Invoice is a reasonable portion of PO
    const ratio = invoiceAmount / poTotal;

    // Perfect match to total
    if (Math.abs(ratio - 1.0) < 0.01) return 0.95;

    // Partial billing (common pattern)
    if (ratio >= 0.1 && ratio <= 1.0) return 0.70 + (ratio * 0.25);

    // Slightly over (change orders)
    if (ratio > 1.0 && ratio <= 1.1) return 0.60;
  }

  // Amount significantly differs
  return 0;
}

/**
 * Calculate date relevance score
 * @param {string|Date} invoiceDate - Invoice date
 * @param {string|Date} poDate - PO creation date
 * @param {number} windowDays - Relevance window in days (default 90)
 * @returns {number} Score 0-1
 */
function dateRelevance(invoiceDate, poDate, windowDays = 90) {
  if (!invoiceDate || !poDate) return 0.5; // Neutral score if missing

  const invDate = new Date(invoiceDate);
  const pDate = new Date(poDate);

  if (isNaN(invDate.getTime()) || isNaN(pDate.getTime())) return 0.5;

  const diffMs = invDate - pDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Invoice should typically come after PO
  if (diffDays < -30) {
    // Invoice dated more than 30 days before PO - suspicious
    return 0.2;
  }

  if (diffDays >= 0 && diffDays <= windowDays) {
    // Invoice within expected window after PO
    return 1.0 - (diffDays / windowDays) * 0.3;
  }

  if (diffDays > windowDays && diffDays <= windowDays * 2) {
    // Somewhat late but still reasonable
    return 0.5;
  }

  // Very old or future dated
  return 0.3;
}

/**
 * Compare line items between invoice and PO
 * @param {Array} invoiceItems - Line items from invoice [{description, amount}]
 * @param {Array} poItems - Line items from PO [{description, amount}]
 * @returns {number} Score 0-1
 */
function lineItemMatch(invoiceItems, poItems) {
  if (!invoiceItems || !Array.isArray(invoiceItems) || invoiceItems.length === 0) return 0.5;
  if (!poItems || !Array.isArray(poItems) || poItems.length === 0) return 0.5;

  let matches = 0;
  let totalWeight = 0;

  for (const invItem of invoiceItems) {
    const invDesc = (invItem.description || '').toLowerCase();
    const invAmt = parseFloat(invItem.amount) || 0;

    if (!invDesc && invAmt <= 0) continue;

    let bestMatch = 0;

    for (const poItem of poItems) {
      const poDesc = (poItem.description || '').toLowerCase();
      const poAmt = parseFloat(poItem.amount) || 0;

      let itemScore = 0;

      // Description similarity
      if (invDesc && poDesc) {
        const descWords = invDesc.split(/\s+/);
        const poWords = poDesc.split(/\s+/);
        const commonWords = descWords.filter(w => w.length > 2 && poWords.includes(w));
        if (commonWords.length > 0) {
          itemScore += 0.6 * (commonWords.length / Math.max(descWords.length, poWords.length));
        }
      }

      // Amount similarity
      if (invAmt > 0 && poAmt > 0) {
        const amtRatio = Math.min(invAmt, poAmt) / Math.max(invAmt, poAmt);
        if (amtRatio > 0.8) {
          itemScore += 0.4 * amtRatio;
        }
      }

      bestMatch = Math.max(bestMatch, itemScore);
    }

    matches += bestMatch;
    totalWeight += 1;
  }

  if (totalWeight === 0) return 0.5;
  return matches / totalWeight;
}

/**
 * Calculate match score between invoice and PO candidate
 * @param {Object} invoice - { vendorName, amount, date, poRef, lineItems }
 * @param {Object} po - PO record with vendor and line items
 * @returns {Object} { score, breakdown, explanation }
 */
function calculateMatchScore(invoice, po) {
  const breakdown = {
    vendor: 0,
    poNumber: 0,
    amount: 0,
    date: 0,
    lineItems: 0
  };

  const explanations = [];

  // 1. Vendor similarity (40%)
  breakdown.vendor = vendorSimilarity(
    invoice.vendorName,
    po.vendor?.name || po.vendor_name
  );
  if (breakdown.vendor >= 0.85) {
    explanations.push(`vendor match (${Math.round(breakdown.vendor * 100)}%)`);
  }

  // 2. PO number match (25%)
  breakdown.poNumber = poNumberMatch(invoice.poRef, po.po_number);
  if (breakdown.poNumber > 0) {
    explanations.push(`PO# match (${Math.round(breakdown.poNumber * 100)}%)`);
  }

  // 3. Amount proximity (15%)
  const poRemaining = (po.total_amount || 0) - (po.billed_amount || 0);
  breakdown.amount = amountProximity(invoice.amount, poRemaining, po.total_amount);
  if (breakdown.amount >= 0.70) {
    explanations.push(`amount proximity (${Math.round(breakdown.amount * 100)}%)`);
  }

  // 4. Date relevance (10%)
  breakdown.date = dateRelevance(invoice.date, po.created_at);
  if (breakdown.date >= 0.70) {
    explanations.push(`date within range (${Math.round(breakdown.date * 100)}%)`);
  }

  // 5. Line item match (10%)
  breakdown.lineItems = lineItemMatch(invoice.lineItems, po.line_items);
  if (breakdown.lineItems >= 0.60) {
    explanations.push(`line items match (${Math.round(breakdown.lineItems * 100)}%)`);
  }

  // Calculate weighted score
  const score =
    breakdown.vendor * SIGNAL_WEIGHTS.vendor +
    breakdown.poNumber * SIGNAL_WEIGHTS.poNumber +
    breakdown.amount * SIGNAL_WEIGHTS.amount +
    breakdown.date * SIGNAL_WEIGHTS.date +
    breakdown.lineItems * SIGNAL_WEIGHTS.lineItems;

  const explanation = explanations.length > 0
    ? `Matched on ${explanations.join(' + ')}`
    : 'Low confidence across all signals';

  return {
    score: Math.round(score * 100) / 100, // Round to 2 decimal places
    breakdown,
    explanation
  };
}

/**
 * Find matching POs for an invoice with confidence scoring
 * @param {Object} invoiceData - Extracted invoice data
 * @param {string} jobId - Job ID to search within
 * @param {string} vendorId - Optional vendor ID (if already matched)
 * @returns {Object} { match, confidence, candidates, needsReview, explanation, breakdown }
 */
async function findMatchingPO(invoiceData, jobId, vendorId) {
  const result = {
    match: null,
    confidence: 0,
    breakdown: null,
    candidates: [],
    needsReview: false,
    explanation: ''
  };

  if (!jobId) {
    result.explanation = 'No job ID provided for PO matching';
    return result;
  }

  // Build query for open POs on this job
  let query = supabase
    .from('v2_purchase_orders')
    .select(`
      id,
      po_number,
      job_id,
      vendor_id,
      total_amount,
      status,
      created_at,
      vendor:v2_vendors(id, name),
      line_items:v2_po_line_items(id, description, amount)
    `)
    .eq('job_id', jobId)
    .eq('status', 'open')
    .is('deleted_at', null);

  // If vendor already matched, filter to that vendor
  if (vendorId) {
    query = query.eq('vendor_id', vendorId);
  }

  const { data: openPOs, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[PO Matcher] Error fetching POs:', error.message);
    result.explanation = 'Error fetching POs';
    return result;
  }

  if (!openPOs || openPOs.length === 0) {
    result.explanation = vendorId
      ? 'No open POs found for this vendor on this job'
      : 'No open POs found for this job';
    return result;
  }

  // Prepare invoice data for matching
  const invoiceForMatch = {
    vendorName: invoiceData.vendor?.companyName || invoiceData.vendorName,
    amount: invoiceData.amounts?.totalAmount || invoiceData.totalAmount || invoiceData.amount,
    date: invoiceData.invoiceDate || invoiceData.date,
    poRef: invoiceData.job?.poNumber || invoiceData.poRef || invoiceData.poNumber,
    lineItems: invoiceData.lineItems || []
  };

  // Calculate billed amounts for each PO
  const poIds = openPOs.map(po => po.id);
  const { data: billingData } = await supabase
    .from('v2_invoices')
    .select('po_id, amount')
    .in('po_id', poIds)
    .not('status', 'eq', 'denied')
    .is('deleted_at', null);

  const billedByPO = {};
  for (const inv of (billingData || [])) {
    billedByPO[inv.po_id] = (billedByPO[inv.po_id] || 0) + parseFloat(inv.amount || 0);
  }

  // Score each PO
  const scoredPOs = [];
  for (const po of openPOs) {
    po.billed_amount = billedByPO[po.id] || 0;
    po.vendor_name = po.vendor?.name;

    const matchResult = calculateMatchScore(invoiceForMatch, po);

    scoredPOs.push({
      po,
      score: matchResult.score,
      breakdown: matchResult.breakdown,
      explanation: matchResult.explanation
    });
  }

  // Sort by score descending
  scoredPOs.sort((a, b) => b.score - a.score);

  // Special case: If only one open PO for this vendor and vendor matches perfectly,
  // auto-link it (with review flag) since there's high confidence it's the right PO
  if (scoredPOs.length === 1 && scoredPOs[0].breakdown.vendor >= 0.95) {
    const singlePO = scoredPOs[0];
    // If score is reasonable (>= 0.50) and vendor match is perfect,
    // boost to REVIEW_QUEUE threshold to auto-link with review flag
    if (singlePO.score >= 0.50 && singlePO.score < MATCH_THRESHOLDS.REVIEW_QUEUE) {
      singlePO.score = MATCH_THRESHOLDS.REVIEW_QUEUE; // Boost to auto-link threshold
      singlePO.explanation += ' (auto-linked: single open PO with perfect vendor match)';
    }
  }

  // Build candidates list (top 5 above INVESTIGATE threshold)
  result.candidates = scoredPOs
    .filter(s => s.score >= MATCH_THRESHOLDS.INVESTIGATE)
    .slice(0, 5)
    .map(s => ({
      po_id: s.po.id,
      po_number: s.po.po_number,
      vendor_name: s.po.vendor_name,
      total_amount: s.po.total_amount,
      remaining: s.po.total_amount - s.po.billed_amount,
      score: s.score,
      breakdown: s.breakdown,
      explanation: s.explanation
    }));

  // Determine best match
  if (scoredPOs.length > 0) {
    const best = scoredPOs[0];

    if (best.score >= MATCH_THRESHOLDS.AUTO_MATCH) {
      // High confidence auto-match
      result.match = best.po;
      result.confidence = best.score;
      result.breakdown = best.breakdown;
      result.needsReview = false;
      result.explanation = best.explanation;
    } else if (best.score >= MATCH_THRESHOLDS.REVIEW_QUEUE) {
      // Good match but needs review
      result.match = best.po;
      result.confidence = best.score;
      result.breakdown = best.breakdown;
      result.needsReview = true;
      result.explanation = best.explanation + ' (review recommended)';

      // Check for ambiguous matches (multiple candidates with similar scores)
      if (scoredPOs.length > 1 && scoredPOs[1].score >= best.score - 0.10) {
        result.needsReview = true;
        result.explanation = `Multiple similar matches found - ${best.po.po_number} (${Math.round(best.score * 100)}%) vs ${scoredPOs[1].po.po_number} (${Math.round(scoredPOs[1].score * 100)}%)`;
      }
    } else if (best.score >= MATCH_THRESHOLDS.INVESTIGATE) {
      // Possible match, needs investigation
      result.match = null; // Don't auto-assign
      result.confidence = best.score;
      result.breakdown = best.breakdown;
      result.needsReview = true;
      result.explanation = `Possible match to ${best.po.po_number} (${Math.round(best.score * 100)}%) - investigation needed`;
    } else {
      // No suitable match
      result.explanation = determineNoMatchReason(invoiceForMatch, openPOs);
    }
  }

  return result;
}

/**
 * Determine why no match was found
 * @param {Object} invoice - Invoice data
 * @param {Array} openPOs - List of open POs
 * @returns {string} Explanation
 */
function determineNoMatchReason(invoice, openPOs) {
  if (!openPOs || openPOs.length === 0) {
    return 'No open POs found for this job';
  }

  // Check vendor mismatch
  const vendorMatches = openPOs.some(po =>
    vendorSimilarity(invoice.vendorName, po.vendor?.name || po.vendor_name) > 0.60
  );
  if (!vendorMatches) {
    return 'Vendor name does not match any open POs';
  }

  // Check amount issues
  const invoiceAmt = invoice.amount || 0;
  const anyReasonableAmount = openPOs.some(po => {
    const remaining = (po.total_amount || 0) - (po.billed_amount || 0);
    return invoiceAmt <= remaining * 1.1 || invoiceAmt <= po.total_amount * 1.1;
  });
  if (!anyReasonableAmount) {
    return 'Invoice amount exceeds available PO balances';
  }

  return 'Low confidence across multiple signals';
}

module.exports = {
  findMatchingPO,
  calculateMatchScore,
  vendorSimilarity,
  poNumberMatch,
  amountProximity,
  dateRelevance,
  lineItemMatch,
  MATCH_THRESHOLDS,
  SIGNAL_WEIGHTS
};
