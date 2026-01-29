/**
 * Unit tests for validation functions
 */

const {
  validateInvoice,
  validateStatusTransition,
  validateAllocations,
  generateInvoiceHash,
  STATUS_TRANSITIONS
} = require('../../server/validation');

describe('validateInvoice', () => {
  describe('amount validation', () => {
    test('rejects missing amount', () => {
      const result = validateInvoice({ invoice_number: 'INV-001', invoice_date: '2026-01-15' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'amount' }));
    });

    test('rejects zero amount', () => {
      const result = validateInvoice({
        amount: 0,
        invoice_number: 'INV-001',
        invoice_date: '2026-01-15'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'amount',
        message: 'amount cannot be zero'
      }));
    });

    test('accepts positive amount', () => {
      const result = validateInvoice({
        amount: 1500.50,
        invoice_number: 'INV-001',
        invoice_date: '2026-01-15'
      });
      expect(result.valid).toBe(true);
    });

    test('accepts negative amount for credit memos', () => {
      const result = validateInvoice({
        amount: -500.00,
        invoice_number: 'CM-001',
        invoice_date: '2026-01-15'
      });
      expect(result.valid).toBe(true);
    });

    test('rejects amount exceeding max', () => {
      const result = validateInvoice({
        amount: 20000000,
        invoice_number: 'INV-001',
        invoice_date: '2026-01-15'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'amount' }));
    });
  });

  describe('invoice_number validation', () => {
    test('rejects missing invoice number', () => {
      const result = validateInvoice({ amount: 100, invoice_date: '2026-01-15' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'invoice_number' }));
    });

    test('accepts valid invoice number formats', () => {
      const validNumbers = ['INV-001', 'INV_2026_001', '12345', 'ABC #123'];
      validNumbers.forEach(num => {
        const result = validateInvoice({
          amount: 100,
          invoice_number: num,
          invoice_date: '2026-01-15'
        });
        expect(result.valid).toBe(true);
      });
    });

    test('rejects invalid invoice number characters', () => {
      const result = validateInvoice({
        amount: 100,
        invoice_number: 'INV@#$%',
        invoice_date: '2026-01-15'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'invoice_number' }));
    });
  });

  describe('date validation', () => {
    test('rejects missing invoice date', () => {
      const result = validateInvoice({ amount: 100, invoice_number: 'INV-001' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'invoice_date' }));
    });

    test('rejects future invoice date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const result = validateInvoice({
        amount: 100,
        invoice_number: 'INV-001',
        invoice_date: futureDate.toISOString().split('T')[0]
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'invoice_date',
        message: 'invoice_date cannot be in the future'
      }));
    });

    test('rejects due date before invoice date', () => {
      const result = validateInvoice({
        amount: 100,
        invoice_number: 'INV-001',
        invoice_date: '2026-01-15',
        due_date: '2026-01-10'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'due_date',
        message: 'Due date cannot be before invoice date'
      }));
    });

    test('accepts valid date range', () => {
      const result = validateInvoice({
        amount: 100,
        invoice_number: 'INV-001',
        invoice_date: '2026-01-15',
        due_date: '2026-02-15'
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('partial validation', () => {
    test('skips required fields in partial mode', () => {
      const result = validateInvoice({ amount: 150 }, true);
      expect(result.valid).toBe(true);
    });

    test('still validates provided fields in partial mode', () => {
      const result = validateInvoice({ amount: 0 }, true);
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateStatusTransition', () => {
  describe('valid transitions', () => {
    test('allows needs_review to ready_for_approval', () => {
      const result = validateStatusTransition('needs_review', 'ready_for_approval');
      expect(result.valid).toBe(true);
    });

    test('allows ready_for_approval to approved', () => {
      const result = validateStatusTransition('ready_for_approval', 'approved');
      expect(result.valid).toBe(true);
    });

    test('allows approved to in_draw', () => {
      const result = validateStatusTransition('approved', 'in_draw');
      expect(result.valid).toBe(true);
    });

    test('allows in_draw to billed', () => {
      const result = validateStatusTransition('in_draw', 'billed');
      expect(result.valid).toBe(true);
    });

    test('allows going back to needs_review', () => {
      const result = validateStatusTransition('ready_for_approval', 'needs_review');
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    test('blocks skipping statuses', () => {
      const result = validateStatusTransition('needs_review', 'in_draw');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    test('blocks going back from billed', () => {
      const result = validateStatusTransition('billed', 'approved');
      expect(result.valid).toBe(false);
    });

    test('blocks going back from paid', () => {
      const result = validateStatusTransition('paid', 'in_draw');
      expect(result.valid).toBe(false);
    });

    test('handles unknown status', () => {
      const result = validateStatusTransition('unknown_status', 'approved');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown current status');
    });
  });

  describe('special statuses', () => {
    test('allows split from needs_review', () => {
      const result = validateStatusTransition('needs_review', 'split');
      expect(result.valid).toBe(true);
    });

    test('allows denied from needs_review', () => {
      const result = validateStatusTransition('needs_review', 'denied');
      expect(result.valid).toBe(true);
    });

    test('allows resubmit from denied', () => {
      const result = validateStatusTransition('denied', 'needs_review');
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateAllocations', () => {
  describe('standard invoices', () => {
    test('valid when allocations match invoice amount', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: 500 },
        { cost_code_id: 'uuid-2', amount: 500 }
      ], 1000);
      expect(result.valid).toBe(true);
      expect(result.total).toBe(1000);
      expect(result.difference).toBeLessThan(0.01);
    });

    test('invalid when allocations exceed invoice', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: 600 },
        { cost_code_id: 'uuid-2', amount: 600 }
      ], 1000);
      expect(result.valid).toBe(false);
      expect(result.difference).toBe(200);
    });

    test('invalid when allocations are under invoice', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: 400 }
      ], 1000);
      expect(result.valid).toBe(false);
      expect(result.difference).toBe(600);
    });

    test('invalid with no allocations', () => {
      const result = validateAllocations([], 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one allocation');
    });

    test('invalid with zero amount allocation', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: 0 }
      ], 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot have zero amount');
    });

    test('invalid with missing cost code', () => {
      const result = validateAllocations([
        { amount: 1000 }
      ], 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing a cost code');
    });

    test('invalid with negative allocation on standard invoice', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: -500 }
      ], 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });
  });

  describe('credit invoices', () => {
    test('valid credit with matching negative allocations', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: -500 }
      ], -500);
      expect(result.valid).toBe(true);
      expect(result.isCredit).toBe(true);
    });

    test('invalid credit with positive allocations', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: 500 }
      ], -500);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be negative');
    });
  });

  describe('floating point tolerance', () => {
    test('handles small floating point differences', () => {
      const result = validateAllocations([
        { cost_code_id: 'uuid-1', amount: 333.33 },
        { cost_code_id: 'uuid-2', amount: 333.33 },
        { cost_code_id: 'uuid-3', amount: 333.34 }
      ], 1000);
      expect(result.valid).toBe(true);
    });
  });
});

describe('generateInvoiceHash', () => {
  test('generates consistent hash for same input', () => {
    const hash1 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500);
    const hash2 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500);
    expect(hash1).toBe(hash2);
  });

  test('generates different hash for different vendor', () => {
    const hash1 = generateInvoiceHash('vendor-1', 'INV-001', 1500);
    const hash2 = generateInvoiceHash('vendor-2', 'INV-001', 1500);
    expect(hash1).not.toBe(hash2);
  });

  test('generates different hash for different invoice number', () => {
    const hash1 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500);
    const hash2 = generateInvoiceHash('vendor-uuid', 'INV-002', 1500);
    expect(hash1).not.toBe(hash2);
  });

  test('generates different hash for different amount', () => {
    const hash1 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500);
    const hash2 = generateInvoiceHash('vendor-uuid', 'INV-001', 1501);
    expect(hash1).not.toBe(hash2);
  });

  test('normalizes invoice number case', () => {
    const hash1 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500);
    const hash2 = generateInvoiceHash('vendor-uuid', 'inv-001', 1500);
    expect(hash1).toBe(hash2);
  });

  test('normalizes invoice number whitespace', () => {
    const hash1 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500);
    const hash2 = generateInvoiceHash('vendor-uuid', '  INV-001  ', 1500);
    expect(hash1).toBe(hash2);
  });

  test('normalizes amount to 2 decimal places', () => {
    const hash1 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500.00);
    const hash2 = generateInvoiceHash('vendor-uuid', 'INV-001', 1500.001);
    expect(hash1).toBe(hash2);
  });
});

describe('STATUS_TRANSITIONS constant', () => {
  test('all statuses have defined transitions', () => {
    const expectedStatuses = ['needs_review', 'ready_for_approval', 'approved', 'in_draw', 'billed', 'denied', 'split'];
    expectedStatuses.forEach(status => {
      expect(STATUS_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(STATUS_TRANSITIONS[status])).toBe(true);
    });
  });

  test('terminal statuses have no transitions', () => {
    expect(STATUS_TRANSITIONS.billed).toEqual([]);
    expect(STATUS_TRANSITIONS.paid).toEqual([]);
    expect(STATUS_TRANSITIONS.split).toEqual([]);
  });
});
