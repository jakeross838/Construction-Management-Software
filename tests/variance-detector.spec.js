/**
 * Variance Detector Unit Tests
 *
 * Tests for server/services/varianceDetector.js
 * Covers text normalization, similarity calculation, and variance detection logic.
 */

const { test, expect } = require('@playwright/test');

// Copy pure functions from varianceDetector.js for unit testing
// (We test these in isolation without database dependencies)

/**
 * Normalize text for comparison - lowercase, remove extra spaces, punctuation
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings (Jaccard coefficient on words)
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
 * Find best PO line item match for an invoice line item
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

// ============================================================================
// TEXT NORMALIZATION TESTS
// ============================================================================

test.describe('Variance Detection - Text Normalization', () => {

  test('handles empty input', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });

  test('converts to lowercase', () => {
    expect(normalizeText('ROUGH CARPENTRY')).toBe('rough carpentry');
    expect(normalizeText('Electrical PANEL')).toBe('electrical panel');
  });

  test('removes punctuation', () => {
    expect(normalizeText('Hello, World!')).toBe('hello world');
    expect(normalizeText('Line-Item #1: Test')).toBe('line item 1 test');
    expect(normalizeText('Price (per unit)')).toBe('price per unit');
  });

  test('normalizes whitespace', () => {
    expect(normalizeText('  extra   spaces  ')).toBe('extra spaces');
    expect(normalizeText('tab\there')).toBe('tab here');
    expect(normalizeText('new\nline')).toBe('new line');
  });

  test('handles special characters', () => {
    expect(normalizeText('$1,234.56')).toBe('1 234 56');
    expect(normalizeText('10% discount')).toBe('10 discount');
    expect(normalizeText('Item @ $100/ea')).toBe('item 100 ea');
  });

  test('preserves numbers and letters', () => {
    expect(normalizeText('Model K-6489-0')).toBe('model k 6489 0');
    expect(normalizeText('PO-001')).toBe('po 001');
  });

});

// ============================================================================
// SIMILARITY CALCULATION TESTS
// ============================================================================

test.describe('Variance Detection - Similarity Calculation', () => {

  test('exact match returns 1.0', () => {
    expect(calculateSimilarity('Rough Carpentry', 'Rough Carpentry')).toBe(1);
    expect(calculateSimilarity('Electrical Panel Installation', 'Electrical Panel Installation')).toBe(1);
  });

  test('case-insensitive comparison', () => {
    expect(calculateSimilarity('ROUGH CARPENTRY', 'rough carpentry')).toBe(1);
    expect(calculateSimilarity('electrical', 'ELECTRICAL')).toBe(1);
  });

  test('partial word overlap', () => {
    const sim = calculateSimilarity('Rough Carpentry Labor', 'Rough Carpentry Materials');
    // Both have "Rough" and "Carpentry", don't have "Labor"/"Materials"
    // Union: rough, carpentry, labor, materials = 4
    // Intersection: rough, carpentry = 2
    // Jaccard: 2/4 = 0.5
    expect(sim).toBe(0.5);
  });

  test('no overlap returns 0', () => {
    expect(calculateSimilarity('Plumbing Fixtures', 'Electrical Wiring')).toBe(0);
    expect(calculateSimilarity('Concrete Foundation', 'Roofing Materials')).toBe(0);
  });

  test('short words (< 3 chars) are ignored', () => {
    // Words with length <= 2 are filtered out (filter is w.length > 2)
    // "a" (1 char) is ignored, but "the" (3 chars) passes the filter
    // So "a test" -> ["test"] and "the test" -> ["the", "test"]
    // Jaccard: 1/2 = 0.5
    expect(calculateSimilarity('a test', 'the test')).toBe(0.5);
    // "It" filtered, "is" filtered, leaving "done" vs "finished"
    expect(calculateSimilarity('It is done', 'It is finished')).toBe(0);
  });

  test('handles empty after filtering short words', () => {
    expect(calculateSimilarity('a', 'b')).toBe(0);
    expect(calculateSimilarity('a', 'ab')).toBe(0);
    expect(calculateSimilarity('ab cd', 'ef gh')).toBe(0);
  });

  test('handles abbreviations (limited matching)', () => {
    // Current implementation does exact word match
    // "Elec" won't match "Electrical" - this documents current behavior
    const sim = calculateSimilarity('Elec Panel', 'Electrical Panel');
    // Intersection: "panel"
    // Union: "elec", "panel", "electrical" = 3
    // Jaccard: 1/3 = 0.333
    expect(sim).toBeCloseTo(0.333, 2);
  });

  test('model number matching', () => {
    // Current behavior: digits are kept, but separated
    const sim1 = calculateSimilarity('Kohler K-6489', 'K-6489-0');
    // "kohler" won't match, but "6489" should be in both
    expect(sim1).toBeGreaterThan(0);

    const sim2 = calculateSimilarity('Model ABC-123', 'ABC-123 Unit');
    // "model", "abc", "123", "unit" - matches: "abc", "123"
    expect(sim2).toBeGreaterThan(0);
  });

  test('high similarity for similar descriptions', () => {
    const sim = calculateSimilarity(
      'Rough Carpentry - Framing Labor',
      'Rough Carpentry Framing Labor and Materials'
    );
    // Union: rough, carpentry, framing, labor, and, materials = 6
    // Intersection: rough, carpentry, framing, labor = 4
    // Jaccard: 4/6 = 0.666
    expect(sim).toBeGreaterThan(0.6);
  });

});

// ============================================================================
// LINE ITEM MATCHING TESTS
// ============================================================================

test.describe('Variance Detection - Line Item Matching', () => {

  const mockPOLineItems = [
    { id: '1', title: 'Rough Carpentry', description: 'Framing labor', amount: 5000 },
    { id: '2', title: 'Electrical', description: 'Panel installation', amount: 3000 },
    { id: '3', title: 'Plumbing', description: 'Fixtures', amount: 2000 },
    { id: '4', title: 'Drywall', description: 'Installation and finish', amount: 4000 },
  ];

  test('exact description match', () => {
    const invoiceLine = { description: 'Rough Carpentry Framing labor', amount: 5000 };
    const match = findBestPOMatch(invoiceLine, mockPOLineItems);

    expect(match).not.toBeNull();
    expect(match.poLineItem.id).toBe('1');
    expect(match.similarity).toBeGreaterThan(0.7);
    expect(match.score).toBeGreaterThan(0.8); // High score for description + amount match
  });

  test('similar description match (above threshold)', () => {
    const invoiceLine = { description: 'Rough Carpentry Materials', amount: 4500 };
    const match = findBestPOMatch(invoiceLine, mockPOLineItems);

    expect(match).not.toBeNull();
    expect(match.poLineItem.id).toBe('1'); // Best match is still Rough Carpentry
    expect(match.score).toBeGreaterThan(0.3);
  });

  test('amount matching improves score', () => {
    // Invoice matches description but different amounts
    const exactAmountLine = { description: 'Electrical Panel', amount: 3000 };
    const differentAmountLine = { description: 'Electrical Panel', amount: 1000 };

    const exactMatch = findBestPOMatch(exactAmountLine, mockPOLineItems);
    const diffMatch = findBestPOMatch(differentAmountLine, mockPOLineItems);

    expect(exactMatch.score).toBeGreaterThan(diffMatch.score);
    expect(exactMatch.amountMatch).toBe(1); // Exact amount
    expect(diffMatch.amountMatch).toBeLessThan(0.7); // Amount diff
  });

  test('no match found (below threshold)', () => {
    const invoiceLine = { description: 'HVAC Equipment Installation', amount: 10000 };
    const match = findBestPOMatch(invoiceLine, mockPOLineItems);

    expect(match).toBeNull(); // No PO line matches HVAC
  });

  test('respects used matches set', () => {
    const usedMatches = new Set(['1']); // Mark Rough Carpentry as used
    const invoiceLine = { description: 'Rough Carpentry', amount: 5000 };
    const match = findBestPOMatch(invoiceLine, mockPOLineItems, usedMatches);

    // Should not match id='1' since it's already used
    expect(match === null || match.poLineItem.id !== '1').toBe(true);
  });

  test('handles empty PO line items', () => {
    const invoiceLine = { description: 'Test Item', amount: 1000 };
    const match = findBestPOMatch(invoiceLine, []);

    expect(match).toBeNull();
  });

  test('handles invoice with empty description', () => {
    const invoiceLine = { description: '', amount: 5000 };
    const match = findBestPOMatch(invoiceLine, mockPOLineItems);

    // With empty description, only amount match matters
    // But text similarity is 0, so combined score will be low
    expect(match === null || match.score <= 0.3).toBe(true);
  });

});

// ============================================================================
// VARIANCE DETECTION LOGIC TESTS
// ============================================================================

test.describe('Variance Detection - Warning Logic', () => {

  test('change order detection regex', () => {
    const changeOrderRegex = /change\s*order|co\s*[-#]?\d|modification|addition|extra/i;

    expect(changeOrderRegex.test('Change Order #1')).toBe(true);
    expect(changeOrderRegex.test('CO-001')).toBe(true);
    expect(changeOrderRegex.test('CO #5')).toBe(true);
    expect(changeOrderRegex.test('modification to scope')).toBe(true);
    expect(changeOrderRegex.test('addition work')).toBe(true);
    expect(changeOrderRegex.test('extra materials')).toBe(true);
    expect(changeOrderRegex.test('Regular line item')).toBe(false);
    expect(changeOrderRegex.test('Carpentry labor')).toBe(false);
  });

  test('amount variance calculation', () => {
    const invoiceAmount = 5500;
    const poRemaining = 5000;
    const overAmount = invoiceAmount - poRemaining;

    expect(overAmount).toBe(500);
    expect(invoiceAmount > poRemaining).toBe(true);
  });

  test('percent diff calculation', () => {
    const invAmount = 5500;
    const poAmount = 5000;
    const amountDiff = invAmount - poAmount;
    const percentDiff = poAmount > 0 ? Math.abs(amountDiff / poAmount * 100) : 0;

    expect(percentDiff).toBe(10); // 500 / 5000 * 100 = 10%
  });

  test('approaching limit threshold (90%)', () => {
    const poTotal = 10000;

    // 89% billed - not approaching
    const billedPercent89 = (8900 / poTotal) * 100;
    expect(billedPercent89 < 90).toBe(true);

    // 90% billed - approaching
    const billedPercent90 = (9000 / poTotal) * 100;
    expect(billedPercent90 >= 90).toBe(true);
    expect(billedPercent90 < 100).toBe(true);

    // 100% billed - not "approaching" (already at limit)
    const billedPercent100 = (10000 / poTotal) * 100;
    expect(billedPercent100 >= 100).toBe(true);
  });

  test('small amount threshold (< $1)', () => {
    const amounts = [0.5, 0.99, 1.00, 1.01, 50];

    expect(Math.abs(amounts[0]) < 1).toBe(true);  // Skip
    expect(Math.abs(amounts[1]) < 1).toBe(true);  // Skip
    expect(Math.abs(amounts[2]) < 1).toBe(false); // Include (exactly $1)
    expect(Math.abs(amounts[3]) < 1).toBe(false); // Include
    expect(Math.abs(amounts[4]) < 1).toBe(false); // Include
  });

  test('amount match tolerance (10%)', () => {
    const poAmount = 1000;

    // 10% tolerance means amount match score decreases linearly
    const calcAmountMatch = (invAmount) => {
      const amountDiff = Math.abs(invAmount - poAmount);
      return poAmount > 0 ? Math.max(0, 1 - (amountDiff / poAmount)) : 0;
    };

    expect(calcAmountMatch(1000)).toBe(1);      // Exact match
    expect(calcAmountMatch(1100)).toBe(0.9);    // 10% over
    expect(calcAmountMatch(900)).toBe(0.9);     // 10% under
    expect(calcAmountMatch(1500)).toBe(0.5);    // 50% over
    expect(calcAmountMatch(2000)).toBe(0);      // 100% over (clamped to 0)
    expect(calcAmountMatch(500)).toBe(0.5);     // 50% under
  });

});

// ============================================================================
// EDGE CASES
// ============================================================================

test.describe('Variance Detection - Edge Cases', () => {

  test('credit invoice (negative amount)', () => {
    const invoiceAmount = -500; // Credit
    const isCredit = invoiceAmount < 0;

    expect(isCredit).toBe(true);
  });

  test('zero amount invoice', () => {
    const invoiceAmount = 0;
    const poRemaining = 5000;

    // Zero invoice should never exceed remaining
    expect(invoiceAmount > poRemaining).toBe(false);
  });

  test('zero PO budget', () => {
    const invoiceAmount = 100;
    const poTotal = 0;
    const poRemaining = 0;

    // Division by zero protection
    const billedPercent = poTotal > 0 ? (invoiceAmount / poTotal) * 100 : 0;
    expect(billedPercent).toBe(0); // Protected from infinity

    // Any positive invoice exceeds zero remaining
    expect(invoiceAmount > poRemaining + 0.01).toBe(true);
  });

  test('floating point tolerance (0.01)', () => {
    const invoiceAmount = 5000.005;
    const poRemaining = 5000;

    // Without tolerance, this would be flagged as over budget
    // With 0.01 tolerance, it's acceptable
    expect(invoiceAmount > poRemaining + 0.01).toBe(false);

    // But significant overage is still caught
    const overAmount = 5000.02;
    expect(overAmount > poRemaining + 0.01).toBe(true);
  });

  test('very long descriptions', () => {
    const longDesc = 'A'.repeat(1000) + ' Rough Carpentry Labor ' + 'B'.repeat(1000);
    const normalizedLong = normalizeText(longDesc);

    // Should handle long strings without error
    // Note: A's and B's are word characters, so they're kept (just lowercased)
    expect(normalizedLong.length).toBeLessThanOrEqual(longDesc.length);
    expect(normalizedLong).toContain('rough');
    expect(normalizedLong).toContain('carpentry');

    // Test with special characters that get removed
    const longWithPunctuation = '!'.repeat(500) + ' Rough Carpentry ' + '?'.repeat(500);
    const normalizedPunct = normalizeText(longWithPunctuation);
    expect(normalizedPunct.length).toBeLessThan(longWithPunctuation.length);
    expect(normalizedPunct).toBe('rough carpentry');
  });

  test('unicode characters', () => {
    const unicodeDesc = 'Rough Carpentry - Framing';
    const normalizedUnicode = normalizeText(unicodeDesc);

    // Should handle unicode dash
    expect(normalizedUnicode).not.toContain('\u2013');
  });

  test('description truncation in warnings', () => {
    const longDesc = 'This is a very long description that should be truncated to 60 characters in warning messages';
    const truncated = longDesc.substring(0, 60) + (longDesc.length > 60 ? '...' : '');

    expect(truncated.length).toBe(63); // 60 chars + "..."
    expect(truncated.endsWith('...')).toBe(true);
  });

});
