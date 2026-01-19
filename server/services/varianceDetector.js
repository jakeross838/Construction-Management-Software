/**
 * Variance Detection Service
 *
 * Detects discrepancies between invoices and their linked POs:
 * - Amount variances (invoice exceeds PO budget)
 * - Line item variances (billed amount exceeds line item budget)
 * - Unmatched line items (invoice has items not on PO)
 * - Description mismatches
 *
 * MATCHING ALGORITHM:
 * - Text similarity uses Jaccard coefficient (word overlap between descriptions)
 * - Words with 3 or fewer characters are filtered out to reduce noise
 * - Combined score = 70% text similarity + 30% amount match
 *
 * THRESHOLDS:
 * - 0.2 minimum Jaccard similarity for initial match consideration
 * - 0.3 minimum combined score for final line item match
 * - 0.01 tolerance for floating point amount comparisons
 * - $1 tolerance for CO/VPO amount matching
 * - 5% + $50 minimum for flagging amount mismatches
 * - 90% threshold for "approaching limit" warnings
 *
 * MATCHING PRIORITY:
 * 1. PO Line Items (original scope)
 * 2. Approved Change Orders (formal changes)
 * 3. Approved VPOs (verbal authorizations)
 * 4. Unmatched (triggers warning with action buttons)
 *
 * SEVERITY LEVELS:
 * - high: Over budget, exceeds PO total, unmatched change orders
 * - medium: Amount mismatches (invoice > PO), line item over budget
 * - low: Amount mismatches (invoice < PO), approaching limit
 */

const { supabase } = require('../../config');

/**
 * Common construction abbreviations mapped to full forms.
 * Used to improve text matching between invoice and PO descriptions.
 * @constant {Object.<string, string>}
 */
const ABBREVIATIONS = {
  'elec': 'electrical',
  'elect': 'electrical',
  'plbg': 'plumbing',
  'plumb': 'plumbing',
  'mech': 'mechanical',
  'carp': 'carpentry',
  'insul': 'insulation',
  'conc': 'concrete',
  'struct': 'structural',
  'hvac': 'heating ventilation air conditioning',
  'dw': 'drywall',
  'sheetrock': 'drywall',
  'gyp': 'drywall',
  'gypsum': 'drywall',
  'frm': 'framing',
  'frmg': 'framing',
  'fin': 'finish',
  'rfg': 'roofing',
  'flr': 'flooring',
  'flrg': 'flooring',
  'cab': 'cabinet',
  'cabs': 'cabinets',
  'ctr': 'counter',
  'ctop': 'countertop',
  'appl': 'appliance',
  'appls': 'appliances',
  'fixt': 'fixture',
  'fixts': 'fixtures',
  'lbr': 'labor',
  'labr': 'labor',
  'matl': 'material',
  'matls': 'materials',
  'inst': 'installation',
  'instl': 'installation'
};

/**
 * Normalize text for comparison - lowercase, remove extra spaces, punctuation.
 * Optionally expands common construction abbreviations.
 *
 * @param {string} text - The text to normalize
 * @param {boolean} [expandAbbreviations=true] - Whether to expand abbreviations
 * @returns {string} Normalized text
 */
function normalizeText(text, expandAbbreviations = true) {
  if (!text) return '';

  let normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Optionally expand common construction abbreviations
  if (expandAbbreviations) {
    const words = normalized.split(' ');
    const expanded = words.map(w => ABBREVIATIONS[w] || w);
    normalized = expanded.join(' ');
  }

  return normalized;
}

/**
 * Calculate similarity between two strings (simple word overlap)
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(normalizeText(str1).split(' ').filter(w => w.length > 2));
  const words2 = new Set(normalizeText(str2).split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return intersection / union; // Jaccard similarity
}

/**
 * Try to match an invoice line item to a PO line item
 */
function findBestPOMatch(invoiceLineItem, poLineItems, usedMatches = new Set()) {
  const invDesc = invoiceLineItem.description || '';
  const invAmount = parseFloat(invoiceLineItem.amount) || 0;

  let bestMatch = null;
  let bestScore = 0;

  for (const poLine of poLineItems) {
    if (usedMatches.has(poLine.id)) continue;

    const poDesc = `${poLine.title || ''} ${poLine.description || ''}`;
    const poAmount = parseFloat(poLine.amount) || 0;

    // Calculate description similarity
    const descSimilarity = calculateSimilarity(invDesc, poDesc);

    // Calculate amount match (within 10% = high score)
    const amountDiff = Math.abs(invAmount - poAmount);
    const amountMatch = poAmount > 0 ? Math.max(0, 1 - (amountDiff / poAmount)) : 0;

    // Combined score (description weighted more heavily)
    const score = (descSimilarity * 0.7) + (amountMatch * 0.3);

    if (score > bestScore && score > 0.2) { // Minimum threshold
      bestScore = score;
      bestMatch = {
        poLineItem: poLine,
        similarity: descSimilarity,
        amountMatch,
        score
      };
    }
  }

  return bestMatch;
}

/**
 * Calculate variance between an invoice and its linked PO
 * @param {Object} invoice - Invoice with po_id and ai_extracted_data
 * @returns {Object} Variance analysis result
 */
async function detectVariances(invoice) {
  const result = {
    hasVariances: false,
    warnings: [],
    details: {
      poTotal: 0,
      poBilled: 0,
      poRemaining: 0,
      invoiceAmount: parseFloat(invoice.amount) || 0,
      overBudgetAmount: 0,
      lineItemVariances: [],
      unmatchedItems: [],
      matchedItems: []
    }
  };

  if (!invoice.po_id) {
    return result;
  }

  try {
    // Get PO with line items and change orders
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select(`
        id, po_number, total_amount, status,
        line_items:v2_po_line_items(
          id, title, description, amount, invoiced_amount, cost_type,
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
      .eq('id', invoice.po_id)
      .single();

    if (poError || !po) {
      return result;
    }

    // Also get approved change orders for matching
    const { data: changeOrders } = await supabase
      .from('v2_change_orders')
      .select('id, description, reason, amount_change, status')
      .eq('po_id', invoice.po_id)
      .eq('status', 'approved');

    // Also get approved VPOs (Verbal Purchase Orders) for matching
    const { data: vpos } = await supabase
      .from('v2_verbal_purchase_orders')
      .select('id, vpo_number, description, amount, status')
      .eq('po_id', invoice.po_id)
      .eq('status', 'approved');

    const poTotal = parseFloat(po.total_amount) || 0;
    const invoiceAmount = parseFloat(invoice.amount) || 0;

    // Calculate total already billed against this PO
    const { data: existingInvoices } = await supabase
      .from('v2_invoices')
      .select('id, amount, status')
      .eq('po_id', invoice.po_id)
      .neq('id', invoice.id)
      .is('deleted_at', null)
      .in('status', ['approved', 'in_draw', 'paid']);

    const previouslyBilled = (existingInvoices || []).reduce(
      (sum, inv) => sum + (parseFloat(inv.amount) || 0),
      0
    );

    const totalBilledIncludingThis = previouslyBilled + invoiceAmount;
    const poRemaining = poTotal - previouslyBilled;

    result.details.poTotal = poTotal;
    result.details.poBilled = previouslyBilled;
    result.details.poRemaining = poRemaining;
    result.details.po = {
      id: po.id,
      po_number: po.po_number,
      status: po.status
    };

    // Check 1: Does this invoice exceed remaining PO budget?
    if (invoiceAmount > poRemaining + 0.01) {
      result.hasVariances = true;
      const overAmount = invoiceAmount - poRemaining;
      result.details.overBudgetAmount = overAmount;
      result.warnings.push({
        type: 'over_budget',
        severity: 'high',
        message: `Invoice exceeds PO remaining budget by $${overAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        details: { invoiceAmount, poRemaining, overAmount }
      });
    }

    // Check 2: Will total billed exceed PO total?
    if (totalBilledIncludingThis > poTotal + 0.01) {
      result.hasVariances = true;
      const overTotal = totalBilledIncludingThis - poTotal;
      result.warnings.push({
        type: 'exceeds_po_total',
        severity: 'high',
        message: `Total billed ($${totalBilledIncludingThis.toLocaleString('en-US', { minimumFractionDigits: 2 })}) will exceed PO total ($${poTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })})`,
        details: { totalBilled: totalBilledIncludingThis, poTotal, overAmount: overTotal }
      });
    }

    // Check 3: LINE ITEM MATCHING - Compare invoice line items to PO line items
    const invoiceLineItems = invoice.ai_extracted_data?.line_items ||
                            invoice.ai_extracted_data?.lineItems ||
                            [];

    if (invoiceLineItems.length > 0 && po.line_items && po.line_items.length > 0) {
      const usedMatches = new Set();

      for (const invLine of invoiceLineItems) {
        const invAmount = parseFloat(invLine.amount) || 0;
        const invDesc = invLine.description || '';

        // Skip very small amounts (likely notes or subtotals)
        if (Math.abs(invAmount) < 1) continue;

        // Try to find matching PO line item
        const match = findBestPOMatch(invLine, po.line_items, usedMatches);

        if (match && match.score >= 0.3) {
          // Found a match
          usedMatches.add(match.poLineItem.id);

          const poAmount = parseFloat(match.poLineItem.amount) || 0;
          const amountDiff = invAmount - poAmount;
          const percentDiff = poAmount > 0 ? Math.abs(amountDiff / poAmount * 100) : 0;

          result.details.matchedItems.push({
            invoiceDescription: invDesc,
            invoiceAmount: invAmount,
            poTitle: match.poLineItem.title,
            poDescription: match.poLineItem.description,
            poAmount: poAmount,
            similarity: match.similarity,
            amountDifference: amountDiff
          });

          // Flag if amounts differ significantly (> 5%)
          if (percentDiff > 5 && Math.abs(amountDiff) > 50) {
            result.hasVariances = true;
            result.warnings.push({
              type: 'amount_mismatch',
              severity: amountDiff > 0 ? 'medium' : 'low',
              message: `"${match.poLineItem.title || invDesc.substring(0, 40)}" - Invoice: $${invAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}, PO: $${poAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${amountDiff > 0 ? '+' : ''}${percentDiff.toFixed(0)}%)`,
              details: {
                invoiceDescription: invDesc,
                invoiceAmount: invAmount,
                poTitle: match.poLineItem.title,
                poAmount: poAmount,
                difference: amountDiff,
                percentDiff
              }
            });
          }
        } else {
          // NO MATCH in PO line items - check if it matches an approved Change Order
          let matchedCO = null;
          if (changeOrders && changeOrders.length > 0) {
            for (const co of changeOrders) {
              const coDesc = `${co.description || ''} ${co.reason || ''}`;
              const coAmount = parseFloat(co.amount_change) || 0;
              const descSimilarity = calculateSimilarity(invDesc, coDesc);
              const amountMatch = Math.abs(invAmount - coAmount) < 1; // Within $1

              if (descSimilarity > 0.2 || amountMatch) {
                matchedCO = co;
                break;
              }
            }
          }

          if (matchedCO) {
            // Matched to an approved CO - this is fine, just note it
            result.details.matchedItems.push({
              invoiceDescription: invDesc,
              invoiceAmount: invAmount,
              matchedTo: 'change_order',
              coDescription: matchedCO.description,
              coAmount: parseFloat(matchedCO.amount_change) || 0
            });
          } else {
            // Check if it matches an approved VPO (Verbal Purchase Order)
            let matchedVPO = null;
            if (vpos && vpos.length > 0) {
              for (const vpo of vpos) {
                const vpoDesc = vpo.description || '';
                const vpoAmount = parseFloat(vpo.amount) || 0;
                const descSimilarity = calculateSimilarity(invDesc, vpoDesc);
                const amountMatch = Math.abs(invAmount - vpoAmount) < 1; // Within $1

                if (descSimilarity > 0.2 || amountMatch) {
                  matchedVPO = vpo;
                  break;
                }
              }
            }

            if (matchedVPO) {
              // Matched to an approved VPO - this is fine, just note it
              result.details.matchedItems.push({
                invoiceDescription: invDesc,
                invoiceAmount: invAmount,
                matchedTo: 'vpo',
                vpoNumber: matchedVPO.vpo_number,
                vpoDescription: matchedVPO.description,
                vpoAmount: parseFloat(matchedVPO.amount) || 0
              });
            } else {
              // NO MATCH FOUND - This is a new/unmatched line item!
            result.hasVariances = true;
            result.details.unmatchedItems.push({
              description: invDesc,
              amount: invAmount
            });

            // Check if it looks like a change order
            const isChangeOrder = /change\s*order|co\s*[-#]?\d|modification|addition|extra/i.test(invDesc);
            const isCredit = invAmount < 0;

            result.warnings.push({
              type: 'unmatched_line_item',
              severity: isChangeOrder ? 'high' : 'medium',
              message: isChangeOrder
                ? `⚠️ Change Order not on PO: "${invDesc.substring(0, 60)}${invDesc.length > 60 ? '...' : ''}" ($${invAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})`
                : `New line item not on PO: "${invDesc.substring(0, 60)}${invDesc.length > 60 ? '...' : ''}" ($${invAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})`,
              details: {
                description: invDesc,
                amount: invAmount,
                isChangeOrder,
                isCredit
              }
            });
            }
          }
        }
      }
    }

    // Check 4: Allocation-based line item over-budget (if invoice has allocations)
    if (invoice.allocations && po.line_items) {
      for (const alloc of invoice.allocations) {
        if (alloc.po_line_item_id) {
          const lineItem = po.line_items.find(li => li.id === alloc.po_line_item_id);
          if (lineItem) {
            const lineItemBudget = parseFloat(lineItem.amount) || 0;
            const lineItemBilled = parseFloat(lineItem.invoiced_amount) || 0;
            const allocAmount = parseFloat(alloc.amount) || 0;
            const newTotalBilled = lineItemBilled + allocAmount;

            if (newTotalBilled > lineItemBudget + 0.01) {
              result.hasVariances = true;
              const overAmount = newTotalBilled - lineItemBudget;
              result.details.lineItemVariances.push({
                lineItemId: lineItem.id,
                lineItemTitle: lineItem.title || lineItem.cost_code?.name || 'Line Item',
                budget: lineItemBudget,
                previouslyBilled: lineItemBilled,
                thisInvoice: allocAmount,
                totalBilled: newTotalBilled,
                overAmount
              });
              result.warnings.push({
                type: 'line_item_over_budget',
                severity: 'medium',
                message: `"${lineItem.title || lineItem.cost_code?.name}" over budget by $${overAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                details: { budget: lineItemBudget, billed: newTotalBilled, over: overAmount }
              });
            }
          }
        }
      }
    }

    // Check 5: Approaching limit warning
    const billedPercent = poTotal > 0 ? (totalBilledIncludingThis / poTotal) * 100 : 0;
    if (billedPercent >= 90 && billedPercent < 100 && !result.hasVariances) {
      result.warnings.push({
        type: 'approaching_limit',
        severity: 'low',
        message: `PO is ${billedPercent.toFixed(0)}% billed after this invoice`,
        details: { percentBilled: billedPercent, remaining: poTotal - totalBilledIncludingThis }
      });
    }

  } catch (err) {
    console.error('[Variance] Error detecting variances:', err);
  }

  return result;
}

/**
 * Quick check if invoice amount exceeds PO remaining
 */
async function quickVarianceCheck(poId, invoiceAmount, excludeInvoiceId = null) {
  if (!poId) return null;

  try {
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('id, po_number, total_amount')
      .eq('id', poId)
      .single();

    if (!po) return null;

    const query = supabase
      .from('v2_invoices')
      .select('amount')
      .eq('po_id', poId)
      .is('deleted_at', null)
      .in('status', ['approved', 'in_draw', 'paid']);

    if (excludeInvoiceId) {
      query.neq('id', excludeInvoiceId);
    }

    const { data: invoices } = await query;
    const billed = (invoices || []).reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    const remaining = parseFloat(po.total_amount) - billed;

    if (invoiceAmount > remaining) {
      return {
        warning: true,
        message: `Invoice amount ($${invoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}) exceeds PO remaining ($${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })})`,
        poNumber: po.po_number,
        remaining,
        overAmount: invoiceAmount - remaining
      };
    }

    return { warning: false };
  } catch (err) {
    console.error('[Variance] Quick check error:', err);
    return null;
  }
}

module.exports = {
  detectVariances,
  quickVarianceCheck,
  // Export pure functions for testing
  normalizeText,
  calculateSimilarity,
  findBestPOMatch,
  ABBREVIATIONS
};
