/**
 * Price Capture Service
 * Automatically captures prices from invoices and other sources
 * Feeds data into the Price Intelligence system
 */

const { supabase } = require('../config');
const priceMatcher = require('./price-matcher');

/**
 * Capture prices from invoice line items
 * Called when AI processes an invoice
 *
 * @param {Object} options
 * @param {string} options.invoiceId - Invoice ID (source reference)
 * @param {string} options.vendorId - Vendor ID
 * @param {Array} options.lineItems - Array of line items with description, quantity, amount
 * @param {string} options.invoiceDate - Invoice date
 * @returns {Object} Capture results with matched/unmatched items
 */
async function captureFromInvoice({ invoiceId, vendorId, lineItems, invoiceDate }) {
  if (!lineItems || lineItems.length === 0) {
    return { captured: 0, matched: [], unmatched: [], errors: [] };
  }

  const results = {
    captured: 0,
    matched: [],
    unmatched: [],
    errors: []
  };

  for (const item of lineItems) {
    try {
      // Skip items without useful data
      if (!item.description || !item.amount) continue;

      // Skip very small amounts (likely not material costs)
      if (Math.abs(item.amount) < 1) continue;

      // Try to match to a master item
      const match = await priceMatcher.findMasterItem(item.description, vendorId);

      if (match.masterItem && match.confidence >= 0.5) {
        // Good match - capture the price
        const quantity = item.quantity || 1;
        const unitPrice = item.amount / quantity;

        // Detect unit from description or default to 'ea'
        const unit = detectUnit(item.description) || match.masterItem.standard_unit || 'ea';

        // Add to price history
        const priceEntry = await priceMatcher.addPriceHistory({
          masterItemId: match.masterItem.id,
          vendorId: vendorId,
          sourceType: 'invoice',
          sourceId: invoiceId,
          unitPrice: unitPrice,
          unit: unit,
          quantity: quantity,
          dimensions: match.masterItem.dimensions,
          priceDate: invoiceDate
        });

        // Create or update vendor alias for future matching
        if (match.matchMethod !== 'exact_alias') {
          await priceMatcher.createAlias(
            match.masterItem.id,
            vendorId,
            item.description,
            null,
            'auto_invoice'
          ).catch(() => {}); // Ignore duplicate errors
        }

        results.matched.push({
          description: item.description,
          masterItem: match.masterItem.standard_name,
          category: match.masterItem.category,
          unitPrice: unitPrice,
          quantity: quantity,
          confidence: match.confidence,
          priceId: priceEntry.id
        });
        results.captured++;

      } else {
        // No match - log for potential new item creation
        results.unmatched.push({
          description: item.description,
          amount: item.amount,
          quantity: item.quantity || 1,
          suggestedCategory: match.suggestedCategory || 'General',
          extractedKeywords: match.extractedKeywords || [],
          confidence: match.confidence || 0
        });
      }

    } catch (err) {
      results.errors.push({
        description: item.description,
        error: err.message
      });
    }
  }

  return results;
}

/**
 * Detect unit from description text
 */
function detectUnit(description) {
  const text = description.toLowerCase();

  // Check for explicit units
  if (/\b(per|each|ea|pc|piece)\b/.test(text)) return 'ea';
  if (/\b(linear\s*f|lf|per\s*foot|\/ft)\b/.test(text)) return 'lf';
  if (/\b(sq\s*f|sf|per\s*sq|\/sf)\b/.test(text)) return 'sf';
  if (/\b(sheet|sht)\b/.test(text)) return 'sheet';
  if (/\b(bundle|bndl)\b/.test(text)) return 'bundle';
  if (/\b(box)\b/.test(text)) return 'box';
  if (/\b(bag)\b/.test(text)) return 'bag';
  if (/\b(roll)\b/.test(text)) return 'roll';

  return null;
}

/**
 * Get the source document for a price entry
 * Returns URL or info to view the original invoice/quote
 *
 * @param {string} priceId - Price history entry ID
 * @returns {Object} Source document info
 */
async function getPriceSource(priceId) {
  const { data: price } = await supabase
    .from('v2_price_history')
    .select('source_type, source_id')
    .eq('id', priceId)
    .single();

  if (!price || !price.source_id) {
    return { type: price?.source_type || 'manual', document: null };
  }

  if (price.source_type === 'invoice') {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, invoice_number, pdf_url, vendor_id, job_id')
      .eq('id', price.source_id)
      .single();

    return {
      type: 'invoice',
      document: invoice,
      url: invoice?.pdf_url,
      label: invoice ? `Invoice #${invoice.invoice_number}` : null
    };
  }

  if (price.source_type === 'quote') {
    const { data: quote } = await supabase
      .from('v2_vendor_quotes')
      .select('id, file_name, file_path, vendor_id')
      .eq('id', price.source_id)
      .single();

    return {
      type: 'quote',
      document: quote,
      url: quote?.file_path,
      label: quote?.file_name
    };
  }

  return { type: price.source_type, document: null };
}

/**
 * Update confidence score for a master item + vendor
 */
async function updateConfidenceScore(masterItemId, vendorId) {
  // Get price history for this combination
  const { data: history } = await supabase
    .from('v2_price_history')
    .select('source_type, price_date')
    .eq('master_item_id', masterItemId)
    .eq('vendor_id', vendorId);

  if (!history || history.length === 0) return;

  const counts = { invoice: 0, quote: 0, manual: 0 };
  let latestDate = null;

  for (const h of history) {
    counts[h.source_type] = (counts[h.source_type] || 0) + 1;
    if (!latestDate || h.price_date > latestDate) {
      latestDate = h.price_date;
    }
  }

  // Calculate confidence score
  // Invoice data is most reliable, then quotes, then manual
  const totalPoints = history.length;
  const weightedScore = (counts.invoice * 1.0 + counts.quote * 0.8 + counts.manual * 0.6) / totalPoints;

  // Recency bonus (data from last 90 days gets a boost)
  const daysSinceUpdate = latestDate
    ? Math.floor((Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  const recencyMultiplier = daysSinceUpdate < 90 ? 1.0 : daysSinceUpdate < 180 ? 0.9 : 0.8;

  const finalScore = Math.min(weightedScore * recencyMultiplier, 1.0);

  // Upsert confidence record
  await supabase
    .from('v2_price_confidence')
    .upsert({
      master_item_id: masterItemId,
      vendor_id: vendorId,
      invoice_count: counts.invoice,
      quote_count: counts.quote,
      manual_count: counts.manual,
      confidence_score: finalScore,
      last_price_date: latestDate
    }, {
      onConflict: 'master_item_id,vendor_id'
    });
}

/**
 * Suggest new master items from unmatched invoice items
 * Called periodically or on demand to review unmatched items
 */
async function getUnmatchedItemSuggestions(vendorId = null) {
  // Get invoices with unmatched items stored in ai_extracted_data
  let query = supabase
    .from('v2_invoices')
    .select('id, vendor_id, ai_extracted_data, invoice_date')
    .not('ai_extracted_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (vendorId) {
    query = query.eq('vendor_id', vendorId);
  }

  const { data: invoices } = await query;

  const suggestions = {};

  for (const invoice of (invoices || [])) {
    const lineItems = invoice.ai_extracted_data?.line_items || [];

    for (const item of lineItems) {
      if (!item.description) continue;

      // Try to match
      const match = await priceMatcher.findMasterItem(item.description, invoice.vendor_id);

      if (!match.masterItem || match.confidence < 0.5) {
        // This is an unmatched item - suggest as new master item
        const normalized = priceMatcher.normalizeText(item.description);
        const key = normalized.substring(0, 50); // Group similar descriptions

        if (!suggestions[key]) {
          suggestions[key] = {
            description: item.description,
            category: match.suggestedCategory || priceMatcher.detectCategory(item.description),
            keywords: match.extractedKeywords || priceMatcher.extractKeywords(item.description),
            dimensions: priceMatcher.extractDimensions(item.description),
            occurrences: 0,
            vendors: new Set(),
            totalAmount: 0
          };
        }

        suggestions[key].occurrences++;
        suggestions[key].vendors.add(invoice.vendor_id);
        suggestions[key].totalAmount += item.amount || 0;
      }
    }
  }

  // Convert to array and sort by occurrences
  return Object.values(suggestions)
    .map(s => ({
      ...s,
      vendors: Array.from(s.vendors),
      avgAmount: s.totalAmount / s.occurrences
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 50); // Top 50 suggestions
}

/**
 * Create a master item from an unmatched suggestion
 */
async function createMasterItemFromSuggestion(suggestion) {
  const { description, category, keywords, dimensions } = suggestion;

  // Generate a standard name
  const standardName = priceMatcher.normalizeText(description)
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .substring(0, 100);

  // Detect unit
  const unit = detectUnit(description) || 'ea';

  // Create the master item
  const { data: newItem, error } = await supabase
    .from('v2_master_items')
    .insert({
      category,
      subcategory: null,
      standard_name: standardName,
      standard_unit: unit,
      dimensions: dimensions,
      keywords: keywords,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;

  return newItem;
}

module.exports = {
  captureFromInvoice,
  getPriceSource,
  updateConfidenceScore,
  getUnmatchedItemSuggestions,
  createMasterItemFromSuggestion,
  detectUnit
};
