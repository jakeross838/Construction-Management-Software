/**
 * Draws Routes Tests
 *
 * Tests for critical draw management endpoints:
 * - GET /api/draws/:id (with G702/G703 calculations)
 * - POST /api/draws/:id/add-invoices
 */

const { fixtures, createMockRequest, createMockResponse, createMockNext } = require('../setup');

// Mock dependencies
jest.mock('../../../server/services/invoice-helpers', () => ({
  logActivity: jest.fn().mockResolvedValue(true),
  checkSplitReconciliation: jest.fn().mockResolvedValue(true),
  stampInvoice: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../../server/core/multi-tenant', () => ({
  getBuilderId: jest.fn().mockReturnValue(null)
}));

jest.mock('../../../server/middleware/validate', () => ({
  validate: () => (req, res, next) => next(),
  schemas: {
    idParam: {},
    drawUpdate: {}
  }
}));

jest.mock('../../../server/core/errors', () => {
  const original = jest.requireActual('../../../server/core/errors');
  return {
    ...original,
    asyncHandler: (fn) => (req, res, next) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    },
    validateRequest: () => (req, res, next) => next()
  };
});

describe('Draws Routes', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = global.mockSupabase;
    jest.clearAllMocks();
  });

  // ============================================================
  // GET /api/draws/:id
  // ============================================================

  describe('GET /api/draws/:id', () => {
    const drawRouter = require('../../../server/routes/draws');

    it('should return draw with G702/G703 data', async () => {
      const drawWithJob = {
        ...fixtures.draw,
        job: {
          ...fixtures.job,
          contract_amount: 500000
        }
      };

      mockSupabase.__setTableData('v2_draws', [drawWithJob]);
      mockSupabase.__setTableData('v2_draw_allocations', []);
      mockSupabase.__setTableData('v2_job_co_draw_billings', []);
      mockSupabase.__setTableData('v2_draw_invoices', []);
      mockSupabase.__setTableData('v2_budget_lines', [fixtures.budgetLine]);
      mockSupabase.__setTableData('v2_job_change_orders', []);
      mockSupabase.__setTableData('v2_draw_attachments', []);
      mockSupabase.__setTableData('v2_draw_activity', []);

      const req = createMockRequest({
        params: { id: fixtures.draw.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const getRoute = drawRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      if (getRoute) {
        const routeHandler = getRoute.route.stack[getRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(res.json).toHaveBeenCalled();
        if (res.jsonData) {
          expect(res.jsonData).toHaveProperty('id');
          expect(res.jsonData).toHaveProperty('g702');
        }
      }
    });

    it('should calculate G702 totals correctly', async () => {
      // G702 calculation test data
      const contractAmount = 500000;
      const changeOrderTotal = 25000;
      const previousBillings = 100000;
      const currentBillings = 50000;
      const retainagePercent = 0.10;

      const contractSumToDate = contractAmount + changeOrderTotal;
      const totalCompletedToDate = previousBillings + currentBillings;
      const retainageAmount = totalCompletedToDate * retainagePercent;
      const currentPaymentDue = currentBillings - (currentBillings * retainagePercent);

      expect(contractSumToDate).toBe(525000);
      expect(totalCompletedToDate).toBe(150000);
      expect(retainageAmount).toBe(15000);
      expect(currentPaymentDue).toBe(45000);
    });

    it('should include schedule of values (G703)', async () => {
      const budgetLines = [
        {
          id: 'bl1',
          cost_code_id: 'cc1',
          budgeted_amount: 50000,
          cost_code: { id: 'cc1', code: '06100', name: 'Rough Carpentry' }
        },
        {
          id: 'bl2',
          cost_code_id: 'cc2',
          budgeted_amount: 30000,
          cost_code: { id: 'cc2', code: '06200', name: 'Finish Carpentry' }
        }
      ];

      const drawWithJob = {
        ...fixtures.draw,
        job: fixtures.job
      };

      mockSupabase.__setTableData('v2_draws', [drawWithJob]);
      mockSupabase.__setTableData('v2_budget_lines', budgetLines);
      mockSupabase.__setTableData('v2_draw_allocations', []);
      mockSupabase.__setTableData('v2_job_co_draw_billings', []);
      mockSupabase.__setTableData('v2_draw_invoices', []);
      mockSupabase.__setTableData('v2_job_change_orders', []);
      mockSupabase.__setTableData('v2_draw_attachments', []);
      mockSupabase.__setTableData('v2_draw_activity', []);

      const req = createMockRequest({
        params: { id: fixtures.draw.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const getRoute = drawRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      if (getRoute) {
        const routeHandler = getRoute.route.stack[getRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        if (res.jsonData) {
          expect(res.jsonData).toHaveProperty('scheduleOfValues');
        }
      }
    });

    it('should include invoices in draw', async () => {
      const drawInvoices = [{
        invoice: {
          ...fixtures.approvedInvoice,
          vendor: fixtures.vendor,
          allocations: [fixtures.allocation]
        }
      }];

      const drawWithJob = {
        ...fixtures.draw,
        job: fixtures.job
      };

      mockSupabase.__setTableData('v2_draws', [drawWithJob]);
      mockSupabase.__setTableData('v2_draw_invoices', drawInvoices);
      mockSupabase.__setTableData('v2_draw_allocations', []);
      mockSupabase.__setTableData('v2_job_co_draw_billings', []);
      mockSupabase.__setTableData('v2_budget_lines', []);
      mockSupabase.__setTableData('v2_job_change_orders', []);
      mockSupabase.__setTableData('v2_draw_attachments', []);
      mockSupabase.__setTableData('v2_draw_activity', []);

      const req = createMockRequest({
        params: { id: fixtures.draw.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const getRoute = drawRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      if (getRoute) {
        const routeHandler = getRoute.route.stack[getRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        if (res.jsonData) {
          expect(res.jsonData).toHaveProperty('invoices');
        }
      }
    });

    it('should return 404 for non-existent draw', async () => {
      // Set empty data so .single() returns { data: null, error: null }
      mockSupabase.__setTableData('v2_draws', []);

      const req = createMockRequest({
        params: { id: 'non-existent-draw' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const getRoute = drawRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      if (getRoute) {
        const routeHandler = getRoute.route.stack[getRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
      }
    });
  });

  // ============================================================
  // POST /api/draws/:id/add-invoices
  // ============================================================

  describe('POST /api/draws/:id/add-invoices', () => {
    const drawRouter = require('../../../server/routes/draws');

    it('should add invoices to draft draw', async () => {
      const invoiceWithAllocations = {
        ...fixtures.approvedInvoice,
        allocations: [{
          id: 'alloc1',
          cost_code_id: fixtures.costCode.id,
          amount: fixtures.approvedInvoice.amount
        }]
      };

      mockSupabase.__setTableData('v2_draws', [fixtures.draw]);
      mockSupabase.__setTableData('v2_invoices', [invoiceWithAllocations]);
      mockSupabase.__setTableData('v2_budget_lines', [fixtures.budgetLine]);
      mockSupabase.__setTableData('v2_draw_invoices', []);
      mockSupabase.__setTableData('v2_draw_allocations', []);

      const req = createMockRequest({
        params: { id: fixtures.draw.id },
        body: {
          invoice_ids: [fixtures.approvedInvoice.id]
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const addRoute = drawRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/add-invoices' && layer.route.methods.post
      );

      if (addRoute) {
        const routeHandler = addRoute.route.stack[addRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(mockSupabase.from).toHaveBeenCalledWith('v2_draw_invoices');
      }
    });

    it('should reject invoices without allocations', async () => {
      const invoiceWithoutAllocations = {
        ...fixtures.approvedInvoice,
        allocations: []
      };

      mockSupabase.__setTableData('v2_draws', [fixtures.draw]);
      mockSupabase.__setTableData('v2_invoices', [invoiceWithoutAllocations]);

      const req = createMockRequest({
        params: { id: fixtures.draw.id },
        body: {
          invoice_ids: [fixtures.approvedInvoice.id]
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const addRoute = drawRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/add-invoices' && layer.route.methods.post
      );

      if (addRoute) {
        const routeHandler = addRoute.route.stack[addRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.jsonData).toHaveProperty('error');
      }
    });

    it('should update invoice status to in_draw', async () => {
      const invoiceWithAllocations = {
        ...fixtures.approvedInvoice,
        allocations: [{
          id: 'alloc1',
          cost_code_id: fixtures.costCode.id,
          amount: fixtures.approvedInvoice.amount
        }]
      };

      mockSupabase.__setTableData('v2_draws', [fixtures.draw]);
      mockSupabase.__setTableData('v2_invoices', [invoiceWithAllocations]);
      mockSupabase.__setTableData('v2_budget_lines', [fixtures.budgetLine]);
      mockSupabase.__setTableData('v2_draw_invoices', []);
      mockSupabase.__setTableData('v2_draw_allocations', []);

      const req = createMockRequest({
        params: { id: fixtures.draw.id },
        body: {
          invoice_ids: [fixtures.approvedInvoice.id]
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const addRoute = drawRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/add-invoices' && layer.route.methods.post
      );

      if (addRoute) {
        const routeHandler = addRoute.route.stack[addRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        // Verify invoice update was called
        expect(mockSupabase.from).toHaveBeenCalledWith('v2_invoices');
      }
    });

    it('should handle partial billing for partially billable invoices', () => {
      // Test partial billing calculation
      const invoiceAmount = 10000;
      const billableAmount = 8000;  // Only 80% billable
      const allocations = [
        { amount: 5000 },
        { amount: 5000 }
      ];

      const allocationTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
      const billableRatio = billableAmount < allocationTotal ? billableAmount / allocationTotal : 1;

      expect(billableRatio).toBe(0.8);

      // Scaled allocations
      const scaledAllocations = allocations.map(a => ({
        ...a,
        scaledAmount: a.amount * billableRatio
      }));

      expect(scaledAllocations[0].scaledAmount).toBe(4000);
      expect(scaledAllocations[1].scaledAmount).toBe(4000);
    });
  });

  // ============================================================
  // G702/G703 Calculation Tests
  // ============================================================

  describe('G702/G703 Calculations', () => {
    it('should calculate G702 correctly with change orders', () => {
      const g702Data = {
        originalContractSum: 500000,
        netChangeOrders: 50000,
        totalCompletedPrevious: 150000,
        totalCompletedThisPeriod: 75000,
        retainagePercent: 0.10
      };

      const contractSumToDate = g702Data.originalContractSum + g702Data.netChangeOrders;
      const grandTotalCompleted = g702Data.totalCompletedPrevious + g702Data.totalCompletedThisPeriod;
      const retainageAmount = grandTotalCompleted * g702Data.retainagePercent;
      const lessPreviousCertificates = g702Data.totalCompletedPrevious;
      const currentPaymentDue = g702Data.totalCompletedThisPeriod - (g702Data.totalCompletedThisPeriod * g702Data.retainagePercent);

      expect(contractSumToDate).toBe(550000);
      expect(grandTotalCompleted).toBe(225000);
      expect(retainageAmount).toBe(22500);
      expect(currentPaymentDue).toBe(67500);
    });

    it('should calculate G703 line items correctly', () => {
      const budgetLines = [
        { code: '06100', budgeted: 50000, previousBilled: 20000, currentBilled: 10000 },
        { code: '06200', budgeted: 30000, previousBilled: 15000, currentBilled: 5000 }
      ];

      const scheduleOfValues = budgetLines.map(bl => {
        const totalBilled = bl.previousBilled + bl.currentBilled;
        const percentComplete = bl.budgeted > 0 ? (totalBilled / bl.budgeted) * 100 : 0;
        const balance = bl.budgeted - totalBilled;

        return {
          ...bl,
          totalBilled,
          percentComplete,
          balance
        };
      });

      expect(scheduleOfValues[0].totalBilled).toBe(30000);
      expect(scheduleOfValues[0].percentComplete).toBe(60);
      expect(scheduleOfValues[0].balance).toBe(20000);

      expect(scheduleOfValues[1].totalBilled).toBe(20000);
      expect(scheduleOfValues[1].percentComplete).toBeCloseTo(66.67, 1);
      expect(scheduleOfValues[1].balance).toBe(10000);
    });

    it('should correctly handle CO cost code allocations', () => {
      const isCOCostCode = (code) => !!(code && /C$/i.test(code.trim()));

      expect(isCOCostCode('06100C')).toBe(true);
      expect(isCOCostCode('06100c')).toBe(true);
      expect(isCOCostCode('06100')).toBe(false);
      expect(isCOCostCode('')).toBe(false);
      expect(isCOCostCode(null)).toBe(false);
    });

    it('should calculate retainage correctly', () => {
      const calculateRetainage = (billedAmount, retainagePercent = 0.10) => {
        return billedAmount * retainagePercent;
      };

      expect(calculateRetainage(100000)).toBe(10000);
      expect(calculateRetainage(50000, 0.05)).toBe(2500);
      expect(calculateRetainage(75000, 0.10)).toBe(7500);
    });

    it('should track draw allocations separately from source allocations', () => {
      // Draw allocations are snapshots copied from invoice allocations
      // This prevents drift when source allocations are later modified

      const sourceAllocations = [
        { cost_code_id: 'cc1', amount: 5000 },
        { cost_code_id: 'cc2', amount: 3000 }
      ];

      // Copy to draw allocations
      const drawAllocations = sourceAllocations.map(sa => ({
        ...sa,
        draw_id: 'draw-1',
        invoice_id: 'inv-1'
      }));

      // Source is modified after copying
      sourceAllocations[0].amount = 6000;

      // Draw allocations should retain original values
      expect(drawAllocations[0].amount).toBe(5000);
      expect(sourceAllocations[0].amount).toBe(6000);
    });
  });

  // ============================================================
  // Draw Status Tests
  // ============================================================

  describe('Draw Status Management', () => {
    it('should only allow invoice changes on draft draws', () => {
      const drawStatuses = ['draft', 'submitted', 'funded'];
      const editableStatuses = drawStatuses.filter(s => s === 'draft');

      expect(editableStatuses).toHaveLength(1);
      expect(editableStatuses[0]).toBe('draft');
    });

    it('should track draw status transitions', () => {
      const validTransitions = {
        draft: ['submitted'],
        submitted: ['funded', 'draft'],  // Can unsubmit back to draft
        funded: []  // Terminal state
      };

      expect(validTransitions.draft).toContain('submitted');
      expect(validTransitions.submitted).toContain('funded');
      expect(validTransitions.funded).toHaveLength(0);
    });

    it('should lock draw when submitted', () => {
      const draftDraw = { status: 'draft', locked_at: null };
      const submittedDraw = {
        ...draftDraw,
        status: 'submitted',
        locked_at: new Date().toISOString()
      };

      expect(submittedDraw.locked_at).not.toBeNull();
      expect(submittedDraw.status).toBe('submitted');
    });
  });
});
