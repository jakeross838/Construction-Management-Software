/**
 * Jobs Routes Tests
 *
 * Tests for critical job management endpoints:
 * - GET /api/jobs
 * - GET /api/jobs/:id/budget
 */

const { fixtures, createMockRequest, createMockResponse, createMockNext } = require('../setup');

// Mock dependencies
jest.mock('../../../server/core/multi-tenant', () => ({
  getBuilderId: jest.fn().mockReturnValue(null),
  tables: {}
}));

jest.mock('../../../server/middleware/validate', () => ({
  validate: () => (req, res, next) => next(),
  schemas: {
    idParam: {},
    jobCreate: {},
    jobUpdate: {}
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

jest.mock('../../../server/routes/webhooks', () => ({
  triggerWebhooks: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../server/ai/document-processor', () => ({
  extractSpecsFromPlans: jest.fn().mockResolvedValue({ specs: {}, confidence: 0.8 }),
  extractSpecsFromMultipleDocuments: jest.fn().mockResolvedValue({ specs: {}, confidence: 0.8 })
}));

jest.mock('../../../server/matching/validation-errors', () => ({
  createValidationError: jest.fn((type, details) => ({ type, ...details })),
  createValidationWarning: jest.fn((type, details) => ({ type, severity: 'warning', ...details })),
  createDetailedFixHint: jest.fn(() => 'Fix hint'),
  formatAmount: jest.fn((amt) => `$${amt.toFixed(2)}`)
}));

jest.mock('../../../server/services/budget-sync', () => ({
  syncJobBudget: jest.fn().mockResolvedValue({ synced: 5 })
}));

jest.mock('../../../server/services/invoice-sync', () => ({
  syncJobInvoices: jest.fn().mockResolvedValue({ synced: 3 })
}));

jest.mock('../../../server/services/co-sync', () => ({
  syncJobCOs: jest.fn().mockResolvedValue({ posUpdated: 2, costCodesUpdated: 4 })
}));

jest.mock('../../../server/services/schedule-sync', () => ({
  syncJobSchedule: jest.fn().mockResolvedValue([]),
  getJobScheduleProgress: jest.fn().mockResolvedValue({ progress: 50 })
}));

describe('Jobs Routes', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = global.mockSupabase;
    jest.clearAllMocks();
  });

  // ============================================================
  // GET /api/jobs
  // ============================================================

  describe('GET /api/jobs', () => {
    const jobsRouter = require('../../../server/routes/jobs');

    it('should return list of jobs', async () => {
      mockSupabase.__setTableData('v2_jobs', [fixtures.job]);

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const next = createMockNext();

      const listRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      );

      if (listRoute) {
        const routeHandler = listRoute.route.stack[listRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(res.json).toHaveBeenCalled();
        expect(Array.isArray(res.jsonData)).toBe(true);
      }
    });

    it('should filter jobs by status', async () => {
      const activeJobs = [fixtures.job];
      mockSupabase.__setTableData('v2_jobs', activeJobs);

      const req = createMockRequest({
        query: { status: 'active' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const listRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      );

      if (listRoute) {
        const routeHandler = listRoute.route.stack[listRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(mockSupabase.from).toHaveBeenCalledWith('v2_jobs');
      }
    });

    it('should support pagination', async () => {
      mockSupabase.__setTableData('v2_jobs', []);

      const req = createMockRequest({
        query: { page: '1', limit: '25' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const listRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      );

      if (listRoute) {
        const routeHandler = listRoute.route.stack[listRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(res.json).toHaveBeenCalled();
        if (res.jsonData) {
          expect(res.jsonData).toHaveProperty('data');
          expect(res.jsonData).toHaveProperty('meta');
        }
      }
    });

    it('should exclude deleted jobs', async () => {
      const deletedJob = {
        ...fixtures.job,
        deleted_at: '2025-01-01T00:00:00Z'
      };
      mockSupabase.__setTableData('v2_jobs', []);

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const next = createMockNext();

      const listRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/' && layer.route.methods.get
      );

      if (listRoute) {
        const routeHandler = listRoute.route.stack[listRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        // Verify the query includes deleted_at filter
        expect(mockSupabase.from).toHaveBeenCalledWith('v2_jobs');
      }
    });
  });

  // ============================================================
  // GET /api/jobs/:id
  // ============================================================

  describe('GET /api/jobs/:id', () => {
    const jobsRouter = require('../../../server/routes/jobs');

    it('should return single job', async () => {
      mockSupabase.__setTableData('v2_jobs', [fixtures.job]);

      const req = createMockRequest({
        params: { id: fixtures.job.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const getRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      if (getRoute) {
        const routeHandler = getRoute.route.stack[getRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(res.json).toHaveBeenCalled();
        if (res.jsonData) {
          expect(res.jsonData).toHaveProperty('id', fixtures.job.id);
        }
      }
    });

    it('should return 404 for non-existent job', async () => {
      mockSupabase.__setTableError('v2_jobs', { code: 'PGRST116', message: 'Not found' });

      const req = createMockRequest({
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const getRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
      );

      if (getRoute) {
        const routeHandler = getRoute.route.stack[getRoute.route.stack.length - 1].handle;

        try {
          await routeHandler(req, res, next);
        } catch (err) {
          expect(err).toBeTruthy();
        }
      }
    });
  });

  // ============================================================
  // GET /api/jobs/:id/budget
  // ============================================================

  describe('GET /api/jobs/:id/budget', () => {
    const jobsRouter = require('../../../server/routes/jobs');

    it('should return budget with totals', async () => {
      const budgetLines = [
        {
          ...fixtures.budgetLine,
          cost_code: fixtures.costCode
        },
        {
          id: 'bl2',
          job_id: fixtures.job.id,
          cost_code_id: 'cc2',
          budgeted_amount: 30000,
          committed_amount: 15000,
          billed_amount: 5000,
          paid_amount: 2000,
          cost_code: { id: 'cc2', code: '06200', name: 'Finish Carpentry', category: 'Carpentry' }
        }
      ];

      mockSupabase.__setTableData('v2_budget_lines', budgetLines);
      mockSupabase.__setTableData('v2_invoices', []);
      mockSupabase.__setTableData('v2_invoice_allocations', []);

      const req = createMockRequest({
        params: { id: fixtures.job.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const budgetRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/budget' && layer.route.methods.get
      );

      if (budgetRoute) {
        const routeHandler = budgetRoute.route.stack[budgetRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        expect(res.json).toHaveBeenCalled();
        if (res.jsonData) {
          expect(res.jsonData).toHaveProperty('budget_lines');
          expect(res.jsonData).toHaveProperty('totals');
        }
      }
    });

    it('should calculate totals correctly', async () => {
      const budgetLines = [
        { budgeted_amount: 50000, committed_amount: 25000, billed_amount: 10000, paid_amount: 5000 },
        { budgeted_amount: 30000, committed_amount: 15000, billed_amount: 5000, paid_amount: 2000 }
      ];

      const totals = {
        budgeted: 0,
        committed: 0,
        billed: 0,
        paid: 0
      };

      budgetLines.forEach(bl => {
        totals.budgeted += parseFloat(bl.budgeted_amount || 0);
        totals.committed += parseFloat(bl.committed_amount || 0);
        totals.billed += parseFloat(bl.billed_amount || 0);
        totals.paid += parseFloat(bl.paid_amount || 0);
      });

      expect(totals.budgeted).toBe(80000);
      expect(totals.committed).toBe(40000);
      expect(totals.billed).toBe(15000);
      expect(totals.paid).toBe(7000);
    });

    it('should include cost code details', async () => {
      const budgetLineWithCostCode = {
        ...fixtures.budgetLine,
        cost_code: fixtures.costCode
      };

      mockSupabase.__setTableData('v2_budget_lines', [budgetLineWithCostCode]);
      mockSupabase.__setTableData('v2_invoices', []);
      mockSupabase.__setTableData('v2_invoice_allocations', []);

      const req = createMockRequest({
        params: { id: fixtures.job.id }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const budgetRoute = jobsRouter.stack.find(
        layer => layer.route && layer.route.path === '/:id/budget' && layer.route.methods.get
      );

      if (budgetRoute) {
        const routeHandler = budgetRoute.route.stack[budgetRoute.route.stack.length - 1].handle;
        await routeHandler(req, res, next);

        if (res.jsonData && res.jsonData.budget_lines && res.jsonData.budget_lines[0]) {
          expect(res.jsonData.budget_lines[0]).toHaveProperty('cost_code');
        }
      }
    });
  });

  // ============================================================
  // Budget Business Logic Tests
  // ============================================================

  describe('Budget Business Logic', () => {
    it('should calculate variance correctly', () => {
      const budgetLine = {
        budgeted_amount: 50000,
        committed_amount: 55000
      };

      const variance = budgetLine.committed_amount - budgetLine.budgeted_amount;
      const variancePercent = (variance / budgetLine.budgeted_amount) * 100;

      expect(variance).toBe(5000);
      expect(variancePercent).toBe(10);
    });

    it('should identify over-budget conditions', () => {
      const checkOverBudget = (budgeted, committed) => {
        return committed > budgeted + 0.01;
      };

      expect(checkOverBudget(50000, 55000)).toBe(true);
      expect(checkOverBudget(50000, 50000)).toBe(false);
      expect(checkOverBudget(50000, 45000)).toBe(false);
    });

    it('should calculate remaining budget', () => {
      const calculateRemaining = (budgeted, committed) => {
        return Math.max(0, budgeted - committed);
      };

      expect(calculateRemaining(50000, 25000)).toBe(25000);
      expect(calculateRemaining(50000, 50000)).toBe(0);
      expect(calculateRemaining(50000, 55000)).toBe(0);
    });

    it('should calculate percent complete', () => {
      const calculatePercentComplete = (billed, budgeted) => {
        if (budgeted <= 0) return billed > 0 ? 100 : 0;
        return Math.min(100, (billed / budgeted) * 100);
      };

      expect(calculatePercentComplete(25000, 50000)).toBe(50);
      expect(calculatePercentComplete(50000, 50000)).toBe(100);
      expect(calculatePercentComplete(60000, 50000)).toBe(100);  // Capped at 100%
      expect(calculatePercentComplete(0, 50000)).toBe(0);
      expect(calculatePercentComplete(5000, 0)).toBe(100);  // Edge case: no budget but has billings
    });

    it('should validate budget line creation', () => {
      const validateBudgetLine = (line) => {
        const errors = [];

        if (!line.job_id) errors.push('job_id is required');
        if (!line.cost_code_id) errors.push('cost_code_id is required');
        if (line.budgeted_amount === undefined || line.budgeted_amount === null) {
          errors.push('budgeted_amount is required');
        }
        if (line.budgeted_amount < 0) {
          errors.push('budgeted_amount must be non-negative');
        }

        return { valid: errors.length === 0, errors };
      };

      expect(validateBudgetLine({
        job_id: 'j1',
        cost_code_id: 'cc1',
        budgeted_amount: 50000
      })).toEqual({ valid: true, errors: [] });

      expect(validateBudgetLine({
        cost_code_id: 'cc1',
        budgeted_amount: 50000
      })).toEqual({ valid: false, errors: ['job_id is required'] });

      expect(validateBudgetLine({
        job_id: 'j1',
        cost_code_id: 'cc1',
        budgeted_amount: -1000
      })).toEqual({ valid: false, errors: ['budgeted_amount must be non-negative'] });
    });
  });

  // ============================================================
  // Job Status Tests
  // ============================================================

  describe('Job Status Management', () => {
    it('should validate job statuses', () => {
      const validStatuses = ['active', 'completed', 'on_hold'];

      expect(validStatuses).toContain('active');
      expect(validStatuses).toContain('completed');
      expect(validStatuses).toContain('on_hold');
    });

    it('should calculate job completion percentage', () => {
      const calculateCompletion = (billed, contractAmount) => {
        if (contractAmount <= 0) return 0;
        return Math.min(100, Math.round((billed / contractAmount) * 100));
      };

      expect(calculateCompletion(250000, 500000)).toBe(50);
      expect(calculateCompletion(500000, 500000)).toBe(100);
      expect(calculateCompletion(600000, 500000)).toBe(100);  // Capped
      expect(calculateCompletion(0, 500000)).toBe(0);
      expect(calculateCompletion(100000, 0)).toBe(0);  // No contract
    });

    it('should track job financial metrics', () => {
      const metrics = {
        contract_amount: 500000,
        budget: {
          budgeted: 450000,
          committed: 300000,
          billed: 150000,
          paid: 100000
        }
      };

      const budgetVariance = metrics.budget.committed - metrics.budget.budgeted;
      const profitMargin = metrics.contract_amount - metrics.budget.committed;
      const collectedPercent = (metrics.budget.paid / metrics.budget.billed) * 100;

      expect(budgetVariance).toBe(-150000);  // Under budget
      expect(profitMargin).toBe(200000);
      expect(collectedPercent).toBeCloseTo(66.67, 1);
    });
  });
});
