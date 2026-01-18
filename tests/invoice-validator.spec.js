/**
 * Invoice Validator Tests
 *
 * Tests for the invoice validation module (server/invoice-validator.js)
 * Validates: amounts, dates, vendor, invoice number, cross-field consistency
 *
 * Run with: npx playwright test tests/invoice-validator.spec.js
 */

const { test, expect } = require('@playwright/test');

// Import the validator module directly for unit testing
// Note: This requires the test to run in Node.js context
let validator;

test.beforeAll(async () => {
  // Dynamic import to load the validator module
  validator = require('../server/invoice-validator');
});

test.describe('Invoice Validator', () => {

  test.describe('Amount Validation', () => {

    test('validates correct line items sum', async () => {
      const extracted = {
        totalAmount: 1000,
        lineItems: [
          { description: 'Item 1', amount: 600 },
          { description: 'Item 2', amount: 400 }
        ]
      };

      const result = validator.validateAmounts(extracted);
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.score).toBeGreaterThan(0.9);
    });

    test('flags mismatched line items sum', async () => {
      const extracted = {
        totalAmount: 1000,
        lineItems: [
          { description: 'Item 1', amount: 600 },
          { description: 'Item 2', amount: 300 } // Sum = 900, not 1000
        ]
      };

      const result = validator.validateAmounts(extracted);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('differs from'))).toBe(true);
    });

    test('validates subtotal + tax = total', async () => {
      const extracted = {
        totalAmount: 1070,
        amounts: {
          subtotal: 1000,
          taxAmount: 70,
          totalAmount: 1070
        }
      };

      const result = validator.validateAmounts(extracted);
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(0.9);
    });

    test('auto-corrects small amount discrepancy', async () => {
      const extracted = {
        totalAmount: 1069.50, // Slightly off
        amounts: {
          subtotal: 1000,
          taxAmount: 70,
          totalAmount: 1069.50
        }
      };

      const result = validator.validateAmounts(extracted);
      // Should suggest correction
      expect(result.corrections.totalAmount).toBeDefined();
      expect(result.corrections.totalAmount).toBeCloseTo(1070, 2);
    });

    test('flags negative amount as credit memo', async () => {
      const extracted = {
        totalAmount: -500,
        invoiceType: 'standard'
      };

      const result = validator.validateAmounts(extracted);
      expect(result.corrections.invoiceType).toBe('credit_memo');
      expect(result.issues.some(i => i.includes('credit memo'))).toBe(true);
    });

    test('flags unusually low amount', async () => {
      const extracted = {
        totalAmount: 5 // Very low for construction invoice
      };

      const result = validator.validateAmounts(extracted);
      expect(result.issues.some(i => i.includes('low amount'))).toBe(true);
    });

    test('flags very high amount', async () => {
      const extracted = {
        totalAmount: 2000000 // Over $1M
      };

      const result = validator.validateAmounts(extracted);
      expect(result.issues.some(i => i.includes('high amount'))).toBe(true);
    });

  });

  test.describe('Date Validation', () => {

    test('validates recent invoice date', async () => {
      const today = new Date();
      const recentDate = new Date(today - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const dateStr = recentDate.toISOString().split('T')[0];

      const result = validator.validateDates({ invoiceDate: dateStr });
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    test('flags missing invoice date', async () => {
      const result = validator.validateDates({});
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Missing invoice date'))).toBe(true);
    });

    test('flags old invoice date (over 180 days)', async () => {
      const today = new Date();
      const oldDate = new Date(today - 200 * 24 * 60 * 60 * 1000); // 200 days ago
      const dateStr = oldDate.toISOString().split('T')[0];

      const result = validator.validateDates({ invoiceDate: dateStr });
      expect(result.issues.some(i => i.includes('unusually old'))).toBe(true);
    });

    test('flags future invoice date (over 30 days)', async () => {
      const today = new Date();
      const futureDate = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 days in future
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = validator.validateDates({ invoiceDate: dateStr });
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('in the future'))).toBe(true);
    });

    test('flags due date before invoice date', async () => {
      const result = validator.validateDates({
        invoiceDate: '2025-01-15',
        dueDate: '2025-01-01'
      });
      expect(result.issues.some(i => i.includes('before invoice date'))).toBe(true);
    });

    test('accepts valid due date after invoice date', async () => {
      const result = validator.validateDates({
        invoiceDate: '2025-01-01',
        dueDate: '2025-01-31'
      });
      expect(result.issues.filter(i => i.includes('due date') && i.includes('before'))).toHaveLength(0);
    });

  });

  test.describe('Vendor Validation', () => {

    test('validates complete vendor info', async () => {
      const extracted = {
        vendor: {
          companyName: 'Florida Sunshine Plumbing LLC',
          phone: '941-555-1234',
          email: 'info@fsp.com',
          tradeType: 'plumbing'
        }
      };

      const result = validator.validateVendor(extracted);
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(0.9);
    });

    test('flags missing vendor name', async () => {
      const result = validator.validateVendor({ vendor: {} });
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Missing vendor'))).toBe(true);
    });

    test('flags short vendor name', async () => {
      const result = validator.validateVendor({ vendor: { companyName: 'AB' } });
      expect(result.issues.some(i => i.includes('too short'))).toBe(true);
    });

    test('flags invalid phone format', async () => {
      const result = validator.validateVendor({
        vendor: {
          companyName: 'Test Company',
          phone: '123' // Too short
        }
      });
      expect(result.issues.some(i => i.includes('Invalid phone'))).toBe(true);
    });

    test('flags invalid email format', async () => {
      const result = validator.validateVendor({
        vendor: {
          companyName: 'Test Company',
          email: 'not-an-email'
        }
      });
      expect(result.issues.some(i => i.includes('Invalid email'))).toBe(true);
    });

    test('flags Ross Built as vendor (should be customer)', async () => {
      const result = validator.validateVendor({
        vendor: { companyName: 'Ross Built Custom Homes' }
      });
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Ross Built'))).toBe(true);
    });

    test('corrects invalid trade type to other', async () => {
      const result = validator.validateVendor({
        vendor: {
          companyName: 'Test Company',
          tradeType: 'invalid_trade'
        }
      });
      expect(result.corrections.tradeType).toBe('other');
    });

    test('accepts valid trade types', async () => {
      const validTrades = ['plumbing', 'electrical', 'hvac', 'drywall', 'framing'];

      for (const trade of validTrades) {
        const result = validator.validateVendor({
          vendor: { companyName: 'Test Company', tradeType: trade }
        });
        expect(result.corrections.tradeType).toBeUndefined();
      }
    });

  });

  test.describe('Invoice Number Validation', () => {

    test('validates standard invoice number', async () => {
      const result = validator.validateInvoiceNumber({ invoiceNumber: 'INV-2025-0001' });
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    test('flags missing invoice number', async () => {
      const result = validator.validateInvoiceNumber({});
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Missing invoice number'))).toBe(true);
    });

    test('flags very short invoice number', async () => {
      const result = validator.validateInvoiceNumber({ invoiceNumber: 'A' });
      expect(result.issues.some(i => i.includes('too short'))).toBe(true);
    });

    test('applies OCR correction O to 0', async () => {
      const result = validator.validateInvoiceNumber({ invoiceNumber: 'INV-2O25-OOO1' });
      // O adjacent to digits should be corrected to 0
      expect(result.corrections.invoiceNumber).toBeDefined();
      expect(result.corrections.invoiceNumber).toContain('0');
      expect(result.issues.some(i => i.includes('OCR corrections'))).toBe(true);
    });

    test('applies OCR correction l/I to 1', async () => {
      const result = validator.validateInvoiceNumber({ invoiceNumber: 'INV-2025-l234' });
      expect(result.corrections.invoiceNumber).toBeDefined();
      expect(result.corrections.invoiceNumber).toContain('1234');
    });

    test('removes spaces between digits', async () => {
      const result = validator.validateInvoiceNumber({ invoiceNumber: 'INV-20 25-0 001' });
      expect(result.corrections.invoiceNumber).toBeDefined();
      expect(result.corrections.invoiceNumber).not.toContain(' ');
    });

    test('preserves original invoice number', async () => {
      const original = 'INV-2O25-OOO1';
      const result = validator.validateInvoiceNumber({ invoiceNumber: original });
      expect(result.corrections.originalInvoiceNumber).toBe(original);
    });

  });

  test.describe('Cross-Field Consistency', () => {

    test('validates credit memo with negative amount', async () => {
      const extracted = {
        invoiceType: 'credit_memo',
        totalAmount: -500,
        amounts: { totalAmount: -500 }
      };

      const result = await validator.validateConsistency(extracted);
      // Should not flag since credit memo + negative amount is consistent
      expect(result.issues.filter(i => i.includes('credit_memo') && i.includes('positive'))).toHaveLength(0);
    });

    test('flags credit memo with positive amount', async () => {
      const extracted = {
        invoiceType: 'credit_memo',
        totalAmount: 500
      };

      const result = await validator.validateConsistency(extracted);
      expect(result.issues.some(i => i.includes('credit_memo') && i.includes('positive'))).toBe(true);
    });

    test('flags missing job reference', async () => {
      const extracted = {
        job: {} // No reference, address, or client name
      };

      const result = await validator.validateConsistency(extracted);
      expect(result.issues.some(i => i.includes('No job reference'))).toBe(true);
    });

    test('accepts complete job reference', async () => {
      const extracted = {
        job: {
          clientName: 'Drummond',
          address: '501 74th St'
        }
      };

      const result = await validator.validateConsistency(extracted);
      expect(result.issues.filter(i => i.includes('No job reference'))).toHaveLength(0);
    });

  });

  test.describe('Full Validation (validateExtraction)', () => {

    test('validates complete valid invoice', async () => {
      const today = new Date();
      const invoiceDate = new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const extracted = {
        vendor: {
          companyName: 'Florida Plumbing Services',
          phone: '941-555-1234',
          email: 'billing@fsp.com',
          tradeType: 'plumbing'
        },
        invoiceNumber: 'INV-2025-0042',
        invoiceDate: invoiceDate,
        totalAmount: 5750,
        amounts: {
          subtotal: 5000,
          taxAmount: 750,
          totalAmount: 5750
        },
        lineItems: [
          { description: 'Rough plumbing', amount: 3500 },
          { description: 'Fixtures', amount: 1500 }
        ],
        job: {
          clientName: 'Drummond',
          address: '501 74th St'
        }
      };

      const result = await validator.validateExtraction(extracted);
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.issues.length).toBeLessThan(5);
    });

    test('handles malformed data gracefully', async () => {
      const extracted = {
        vendor: null,
        invoiceNumber: '',
        totalAmount: 'not a number'
      };

      const result = await validator.validateExtraction(extracted);
      expect(result.isValid).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('handles null/undefined fields', async () => {
      const extracted = {};

      const result = await validator.validateExtraction(extracted);
      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.breakdown).toBeDefined();
    });

    test('calculates confidence breakdown correctly', async () => {
      const extracted = {
        vendor: { companyName: 'Test Company' },
        invoiceNumber: 'INV-001',
        invoiceDate: '2025-01-15',
        totalAmount: 1000
      };

      const result = await validator.validateExtraction(extracted);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.amounts).toBeDefined();
      expect(result.breakdown.dates).toBeDefined();
      expect(result.breakdown.vendor).toBeDefined();
      expect(result.breakdown.invoiceNumber).toBeDefined();
      expect(result.breakdown.consistency).toBeDefined();
    });

    test('tracks auto-corrections applied', async () => {
      const extracted = {
        vendor: { companyName: 'Test Company' },
        invoiceNumber: 'INV-2O25-OOO1', // OCR errors
        invoiceDate: '2025-01-15',
        totalAmount: 1000
      };

      const result = await validator.validateExtraction(extracted);
      expect(result.autoCorrectionsApplied.length).toBeGreaterThan(0);
      expect(result.autoCorrectionsApplied[0].field).toBe('invoiceNumber');
    });

  });

  test.describe('OCR Correction Functions', () => {

    test('applyOCRCorrections corrects invoice numbers', async () => {
      const result = validator.applyOCRCorrections('INV-2O25-l234', 'invoiceNumber');
      expect(result.wasModified).toBe(true);
      expect(result.corrected).toBe('INV-2025-1234');
      expect(result.corrections.length).toBeGreaterThan(0);
    });

    test('applyOCRCorrections preserves original', async () => {
      const original = 'INV-2O25-l234';
      const result = validator.applyOCRCorrections(original, 'invoiceNumber');
      expect(result.original).toBe(original);
    });

    test('correctAmount removes formatting', async () => {
      const result = validator.correctAmount('$1,234.56');
      expect(result.corrected).toBe(1234.56);
      expect(result.wasModified).toBe(true);
    });

    test('correctAmount handles numbers', async () => {
      const result = validator.correctAmount(1234.56);
      expect(result.corrected).toBe(1234.56);
      expect(result.wasModified).toBe(false);
    });

    test('correctAmount fixes O to 0', async () => {
      const result = validator.correctAmount('1O00');
      expect(result.corrected).toBe(1000);
    });

  });

  test.describe('Edge Cases', () => {

    test('handles empty string values', async () => {
      const extracted = {
        vendor: { companyName: '' },
        invoiceNumber: '',
        invoiceDate: ''
      };

      const result = await validator.validateExtraction(extracted);
      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
    });

    test('handles zero amount', async () => {
      const result = validator.validateAmounts({ totalAmount: 0 });
      expect(result).toBeDefined();
    });

    test('handles very long vendor name', async () => {
      const longName = 'A'.repeat(150);
      const result = validator.validateVendor({
        vendor: { companyName: longName }
      });
      expect(result.issues.some(i => i.includes('long'))).toBe(true);
    });

    test('handles very long invoice number', async () => {
      const longNumber = 'INV-' + '0'.repeat(60);
      const result = validator.validateInvoiceNumber({ invoiceNumber: longNumber });
      expect(result.issues.some(i => i.includes('long'))).toBe(true);
    });

    test('handles special characters in invoice number', async () => {
      const result = validator.validateInvoiceNumber({ invoiceNumber: 'INV#123@456' });
      expect(result.issues.some(i => i.includes('suspicious'))).toBe(true);
    });

  });

});
