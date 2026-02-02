/**
 * Jest Test Setup for Server Tests
 *
 * Provides mock Supabase client, test utilities, and common fixtures.
 */

// Suppress console logs during tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging failed tests
    error: console.error
  };
}

// ============================================================
// MOCK SUPABASE CLIENT
// ============================================================

/**
 * Creates a chainable mock query builder
 * Supports: select, insert, update, delete, eq, neq, in, is, not, order, single, range, limit
 */
function createMockQueryBuilder(mockData = [], mockError = null) {
  const builder = {
    _data: mockData,
    _error: mockError,
    _count: mockData.length,

    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),

    single: jest.fn().mockImplementation(() => {
      return Promise.resolve({
        data: Array.isArray(builder._data) ? builder._data[0] || null : builder._data,
        error: builder._error
      });
    }),

    then: function(resolve) {
      return Promise.resolve({
        data: builder._data,
        error: builder._error,
        count: builder._count
      }).then(resolve);
    }
  };

  return builder;
}

/**
 * Creates a mock Supabase client
 */
function createMockSupabase() {
  const tableData = {};
  const tableErrors = {};

  const mockClient = {
    // Store mock data for tables
    __setTableData: (table, data) => {
      tableData[table] = data;
    },
    __setTableError: (table, error) => {
      tableErrors[table] = error;
    },
    __clearMocks: () => {
      Object.keys(tableData).forEach(key => delete tableData[key]);
      Object.keys(tableErrors).forEach(key => delete tableErrors[key]);
    },

    from: jest.fn((table) => {
      const data = tableData[table] || [];
      const error = tableErrors[table] || null;
      return createMockQueryBuilder(data, error);
    }),

    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),

    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test/path.pdf' }, error: null }),
        download: jest.fn().mockResolvedValue({ data: Buffer.from('test'), error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.url/file.pdf' } }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url' }, error: null })
      })
    }
  };

  return mockClient;
}

// Create global mock instance
global.mockSupabase = createMockSupabase();

// Mock the config module to use our mock Supabase
jest.mock('../../config', () => ({
  supabase: global.mockSupabase,
  port: 3001
}));

// Mock the logger to suppress output
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// ============================================================
// TEST FIXTURES
// ============================================================

global.fixtures = {
  // Sample job
  job: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test Job - 123 Main St',
    address: '123 Main St',
    client_name: 'Test Client',
    contract_amount: 500000,
    status: 'active',
    created_at: '2025-01-01T00:00:00Z'
  },

  // Sample vendor
  vendor: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Test Vendor LLC',
    email: 'test@vendor.com',
    phone: '555-1234',
    trade: 'General',
    created_at: '2025-01-01T00:00:00Z'
  },

  // Sample invoice
  invoice: {
    id: '33333333-3333-3333-3333-333333333333',
    job_id: '11111111-1111-1111-1111-111111111111',
    vendor_id: '22222222-2222-2222-2222-222222222222',
    invoice_number: 'INV-001',
    invoice_date: '2025-01-15',
    amount: 5000,
    status: 'received',
    ai_processed: false,
    needs_review: false,
    version: 1,
    created_at: '2025-01-15T00:00:00Z'
  },

  // Sample approved invoice
  approvedInvoice: {
    id: '44444444-4444-4444-4444-444444444444',
    job_id: '11111111-1111-1111-1111-111111111111',
    vendor_id: '22222222-2222-2222-2222-222222222222',
    invoice_number: 'INV-002',
    invoice_date: '2025-01-20',
    amount: 10000,
    status: 'approved',
    approved_at: '2025-01-21T00:00:00Z',
    approved_by: 'Jake Ross',
    version: 2,
    created_at: '2025-01-20T00:00:00Z'
  },

  // Sample purchase order
  purchaseOrder: {
    id: '55555555-5555-5555-5555-555555555555',
    job_id: '11111111-1111-1111-1111-111111111111',
    vendor_id: '22222222-2222-2222-2222-222222222222',
    po_number: 'PO-Test123-0001',
    description: 'Test PO',
    total_amount: 25000,
    original_amount: 25000,
    change_order_total: 0,
    status: 'open',
    status_detail: 'approved',
    approval_status: 'approved',
    approved_at: '2025-01-10T00:00:00Z',
    approved_by: 'Jake Ross',
    version: 1,
    created_at: '2025-01-05T00:00:00Z'
  },

  // Sample PO line items
  poLineItems: [
    {
      id: '66666666-6666-6666-6666-666666666666',
      po_id: '55555555-5555-5555-5555-555555555555',
      cost_code_id: '77777777-7777-7777-7777-777777777777',
      description: 'Rough Carpentry',
      amount: 15000,
      invoiced_amount: 0
    },
    {
      id: '66666666-6666-6666-6666-666666666667',
      po_id: '55555555-5555-5555-5555-555555555555',
      cost_code_id: '77777777-7777-7777-7777-777777777778',
      description: 'Framing Materials',
      amount: 10000,
      invoiced_amount: 0
    }
  ],

  // Sample cost code
  costCode: {
    id: '77777777-7777-7777-7777-777777777777',
    code: '06100',
    name: 'Rough Carpentry',
    category: 'Carpentry'
  },

  // Sample draw
  draw: {
    id: '88888888-8888-8888-8888-888888888888',
    job_id: '11111111-1111-1111-1111-111111111111',
    draw_number: 1,
    period_end: '2025-01-31',
    total_amount: 50000,
    status: 'draft',
    created_at: '2025-01-25T00:00:00Z'
  },

  // Sample budget line
  budgetLine: {
    id: '99999999-9999-9999-9999-999999999999',
    job_id: '11111111-1111-1111-1111-111111111111',
    cost_code_id: '77777777-7777-7777-7777-777777777777',
    budgeted_amount: 50000,
    committed_amount: 25000,
    billed_amount: 10000,
    paid_amount: 5000
  },

  // Sample allocation
  allocation: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    invoice_id: '44444444-4444-4444-4444-444444444444',
    job_id: '11111111-1111-1111-1111-111111111111',
    cost_code_id: '77777777-7777-7777-7777-777777777777',
    amount: 10000
  }
};

// ============================================================
// TEST HELPERS
// ============================================================

/**
 * Creates a mock Express request object
 */
global.createMockRequest = (options = {}) => ({
  params: options.params || {},
  query: options.query || {},
  body: options.body || {},
  headers: options.headers || {},
  user: options.user || null,
  ...options
});

/**
 * Creates a mock Express response object
 */
global.createMockResponse = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status: jest.fn().mockImplementation((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn().mockImplementation((data) => {
      res.jsonData = data;
      return res;
    }),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis()
  };
  return res;
};

/**
 * Creates a mock next function
 */
global.createMockNext = () => jest.fn();

/**
 * Reset all mocks between tests
 */
beforeEach(() => {
  jest.clearAllMocks();
  if (global.mockSupabase.__clearMocks) {
    global.mockSupabase.__clearMocks();
  }
});

// ============================================================
// SUPERTEST SETUP (for HTTP testing)
// ============================================================

// We don't import app here to avoid circular dependencies
// Tests should import and configure as needed

module.exports = {
  createMockSupabase,
  createMockQueryBuilder,
  fixtures: global.fixtures,
  createMockRequest: global.createMockRequest,
  createMockResponse: global.createMockResponse,
  createMockNext: global.createMockNext
};
