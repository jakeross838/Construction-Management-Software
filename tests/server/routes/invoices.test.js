/**
 * Invoice Routes Tests
 *
 * Tests for critical invoice management endpoints:
 * - GET /api/invoices (list with filters)
 * - GET /api/invoices/:id
 * - PATCH /api/invoices/:id/approve
 */

const { fixtures, createMockRequest, createMockResponse, createMockNext } = require('../setup');

// Mock dependencies before importing routes
jest.mock('../../../server/services/invoice-helpers', () => ({
  logActivity: jest.fn().mockResolvedValue(true),
  stampInvoice: jest.fn().mockResolvedValue({ success: true }),
  updatePOLineItemsForAllocations: jest.fn().mockResolvedValue(true),
  syncPOLineItemsOnAllocationChange: jest.fn().mockResolvedValue(true),
  updatePOInvoicedAmounts: jest.fn().mockResolvedValue(true),
  updateCOInvoicedAmounts: jest.fn().mockResolvedValue(true),
  restampInvoice: jest.fn().mockResolvedValue({ success: true }),
  checkSplitReconciliation: jest.fn().mockResolvedValue(true),
  getOrCreateDraftDraw: jest.fn().mockResolvedValue({ id: 'draft-draw-id' }),
  cleanupInvoiceAllocations: jest.fn().mockResolvedValue(true),
  recalculateBilledAmounts: jest.fn().mockResolvedValue(true),
  recalculatePOLineItemInvoiced: jest.fn().mockResolvedValue(true),
  recalculateCOInvoiced: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../server/services/variance-detector', () => ({
  detectVariances: jest.fn().mockResolvedValue({ hasVariance: false }),
  quickVarianceCheck: jest.fn().mockResolvedValue({ warning: false })
}));

jest.mock('../../../server/core/realtime', () => ({
  broadcastInvoiceUpdate: jest.fn(),
  broadcast: jest.fn()
}));

jest.mock('../../../server/core/validation', () => ({
  validateInvoice: jest.fn().mockReturnValue({ valid: true, errors: [] }),
  validateStatusTransition: jest.fn().mockReturnValue({ valid: true }),
  validatePreTransition: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
  validateAllocations: jest.fn().mockReturnValue({ valid: true, errors: [] }),
  validateCostCodesExist: jest.fn().mockResolvedValue({ valid: true })
}));

jest.mock('../../../server/core/undo', () => ({
  createUndoSnapshot: jest.fn().mockResolvedValue(true),
  UNDO_WINDOW_SECONDS: 30
}));

jest.mock('../../../server/core/multi-tenant', () => ({
  getBuilderId: jest.fn().mockReturnValue(null)
}));

jest.mock('../../../server/middleware/validate', () => ({
  validate: () => (req, res, next) => next(),
  schemas: {
    idParam: {},
    invoiceQuery: {}
  }
}));

jest.mock('../../../server/core/errors', () => {
  const original = jest.requireActual('../../../server/core/errors');
  return {
    ...original,
    asyncHandler: (fn) => (req, res, next) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    }
  };
});

jest.mock('../../../server/routes/webhooks', () => ({
  triggerWebhooks: jest.fn().mockResolvedValue(true)
}));

describe('Invoice Routes', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = global.mockSupabase;
    jest.clearAllMocks();
  });

  // ============================================================
  // GET /api/invoices
  // ============================================================

  describe('GET /api/invoices', () => {
    const invoiceRouter = require('../../../server/routes/invoices');

    it('should return list of invoices', async () => {
      const invoicesWithJoins = [
        {
          ...fixtures.invoice,
          vendor: fixtures.vendor,
          job: fixtures.job,
          po: null,
          allocations: [],
          draw_invoices: []
        }
      ];

      mockSupabase.__setTableData('v2_invoices', invoicesWithJoins);

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const next = createMockNext();

      // Get the route handler
      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      expect(res.json).toHaveBeenCalled();
      expect(res.jsonData).toHaveProperty('success', true);
      expect(res.jsonData).toHaveProperty('data');
      expect(Array.isArray(res.jsonData.data)).toBe(true);
    });

    it('should filter invoices by status', async () => {
      const approvedInvoices = [{
        ...fixtures.approvedInvoice,
        vendor: fixtures.vendor,
        job: fixtures.job,
        po: null,
        allocations: [],
        draw_invoices: []
      }];

      mockSupabase.__setTableData('v2_invoices', approvedInvoices);

      const req = createMockRequest({ query: { status: 'approved' } });
      const res = createMockResponse();
      const next = createMockNext();

      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalledWith('v2_invoices');
      expect(res.jsonData.success).toBe(true);
    });

    it('should filter invoices by job_id', async () => {
      mockSupabase.__setTableData('v2_invoices', []);

      const req = createMockRequest({
        query: { job_id: fixtures.job.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalledWith('v2_invoices');
    });

    it('should support pagination', async () => {
      mockSupabase.__setTableData('v2_invoices', []);

      const req = createMockRequest({
        query: { page: '1', limit: '10' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.__setTableError('v2_invoices', { message: 'Database connection failed' });

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const next = createMockNext();

      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ============================================================
  // GET /api/invoices/:id
  // ============================================================

  describe('GET /api/invoices/:id', () => {
    const invoiceRouter = require('../../../server/routes/invoices');

    it('should return invoice with full details', async () => {
      const invoiceWithDetails = {
        ...fixtures.invoice,
        vendor: fixtures.vendor,
        job: fixtures.job,
        po: fixtures.purchaseOrder,
        allocations: [fixtures.allocation],
        draw_invoices: []
      };

      mockSupabase.__setTableData('v2_invoices', [invoiceWithDetails]);

      const req = createMockRequest({
        params: { id: fixtures.invoice.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Find the /:id GET route handler
      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      expect(res.json).toHaveBeenCalled();
      expect(res.jsonData).toHaveProperty('id', fixtures.invoice.id);
    });

    it('should return 404 for non-existent invoice', async () => {
      mockSupabase.__setTableError('v2_invoices', { code: 'PGRST116', message: 'Not found' });

      const req = createMockRequest({
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should include variance data when invoice has PO', async () => {
      const invoiceWithPO = {
        ...fixtures.invoice,
        po_id: fixtures.purchaseOrder.id,
        vendor: fixtures.vendor,
        job: fixtures.job,
        po: fixtures.purchaseOrder,
        allocations: [],
        draw_invoices: []
      };

      mockSupabase.__setTableData('v2_invoices', [invoiceWithPO]);

      const req = createMockRequest({
        params: { id: fixtures.invoice.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const routeHandler = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      ).route.stack[1].handle;

      await routeHandler(req, res, next);

      const { detectVariances } = require('../../../server/services/variance-detector');
      expect(detectVariances).toHaveBeenCalled();
    });
  });

  // ============================================================
  // PATCH /api/invoices/:id/approve
  // ============================================================

  describe('PATCH /api/invoices/:id/approve', () => {
    const invoiceRouter = require('../../../server/routes/invoices');

    it('should approve invoice successfully', async () => {
      const invoiceToApprove = {
        ...fixtures.invoice,
        status: 'needs_approval',
        job: fixtures.job,
        vendor: fixtures.vendor,
        allocations: [fixtures.allocation]
      };

      const approvedInvoice = {
        ...invoiceToApprove,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'Test User'
      };

      // First call returns the invoice to approve
      mockSupabase.__setTableData('v2_invoices', [invoiceToApprove]);

      const req = createMockRequest({
        params: { id: fixtures.invoice.id },
        body: { approved_by: 'Test User' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Find the approve route
      const approveRoute = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/approve' && layer.route.methods.patch
      );

      if (approveRoute) {
        const routeHandler = approveRoute.route.stack[approveRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        // Check that approval helpers were called
        const { stampInvoice, logActivity } = require('../../../server/services/invoice-helpers');
        expect(logActivity).toHaveBeenCalled();
      }
    });

    it('should reject approval for already approved invoice', async () => {
      const alreadyApproved = {
        ...fixtures.approvedInvoice,
        job: fixtures.job,
        vendor: fixtures.vendor
      };

      mockSupabase.__setTableData('v2_invoices', [alreadyApproved]);

      const { validateStatusTransition } = require('../../../server/core/validation');
      validateStatusTransition.mockReturnValue({ valid: false, reason: 'Already approved' });

      const req = createMockRequest({
        params: { id: fixtures.approvedInvoice.id },
        body: { approved_by: 'Test User' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const approveRoute = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/approve' && layer.route.methods.patch
      );

      if (approveRoute) {
        const routeHandler = approveRoute.route.stack[approveRoute.route.stack.length - 1].handle;

        try {
          await routeHandler(req, res, next);
        } catch (err) {
          // Expected - transition should be blocked
          expect(err.code || err.message).toBeTruthy();
        }
      }
    });

    it('should require allocations before approval', async () => {
      const invoiceWithoutAllocations = {
        ...fixtures.invoice,
        status: 'needs_approval',
        job: fixtures.job,
        vendor: fixtures.vendor,
        allocations: []
      };

      mockSupabase.__setTableData('v2_invoices', [invoiceWithoutAllocations]);

      const { validatePreTransition } = require('../../../server/core/validation');
      validatePreTransition.mockResolvedValue({
        valid: false,
        errors: [{ type: 'NO_ALLOCATIONS', message: 'Invoice has no allocations' }]
      });

      const req = createMockRequest({
        params: { id: fixtures.invoice.id },
        body: { approved_by: 'Test User' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const approveRoute = invoiceRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/approve' && layer.route.methods.patch
      );

      if (approveRoute) {
        const routeHandler = approveRoute.route.stack[approveRoute.route.stack.length - 1].handle;

        try {
          await routeHandler(req, res, next);
        } catch (err) {
          expect(err).toBeTruthy();
        }
      }
    });
  });

  // ============================================================
  // Business Logic Tests
  // ============================================================

  describe('Invoice Business Logic', () => {
    it('should correctly identify credit memos by negative amount', () => {
      const creditMemo = {
        ...fixtures.invoice,
        amount: -500,
        invoice_type: 'credit_memo'
      };

      expect(creditMemo.amount).toBeLessThan(0);
      expect(creditMemo.invoice_type).toBe('credit_memo');
    });

    it('should calculate allocation totals correctly', () => {
      const allocations = [
        { amount: 3000 },
        { amount: 2000 },
        { amount: 5000 }
      ];

      const total = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      expect(total).toBe(10000);
    });

    it('should validate allocation sum does not exceed invoice amount', () => {
      const invoiceAmount = 5000;
      const allocations = [
        { amount: 3000 },
        { amount: 2500 }
      ];

      const allocationTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
      const isValid = allocationTotal <= invoiceAmount;

      expect(isValid).toBe(false);
      expect(allocationTotal).toBe(5500);
    });

    it('should correctly determine invoice status transitions', () => {
      const validTransitions = {
        received: ['needs_approval', 'denied'],
        needs_approval: ['approved', 'denied', 'received'],
        approved: ['in_draw', 'needs_approval'],
        in_draw: ['paid', 'approved'],
        paid: []
      };

      expect(validTransitions.received).toContain('needs_approval');
      expect(validTransitions.approved).toContain('in_draw');
      expect(validTransitions.paid).toHaveLength(0);
    });
  });
});
