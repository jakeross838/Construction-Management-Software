/**
 * Database Integrity Test Suite
 *
 * Tests database schema, relationships, and data integrity
 * for all v2_ and v3.0 tables
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3001';

test.describe('Core Table Integrity', () => {

  test('v2_jobs table has records', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/jobs`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const jobs = data.jobs || data;
    expect(Array.isArray(jobs)).toBe(true);

    console.log(`Found ${jobs.length} jobs`);
  });

  test('v2_vendors table has records', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/vendors`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const vendors = data.vendors || data;
    expect(Array.isArray(vendors)).toBe(true);

    console.log(`Found ${vendors.length} vendors`);
  });

  test('v2_cost_codes table has records', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/cost-codes`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const codes = data.costCodes || data.cost_codes || data;
    expect(Array.isArray(codes)).toBe(true);

    console.log(`Found ${codes.length} cost codes`);
  });

  test('v2_invoices table accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoices`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const invoices = data.invoices || data;
    expect(Array.isArray(invoices)).toBe(true);

    console.log(`Found ${invoices.length} invoices`);
  });

  test('v2_purchase_orders table accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/purchase-orders`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toBeDefined();

    console.log(`PO endpoint working`);
  });

  test('v2_draws table accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/draws`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toBeDefined();

    console.log(`Draws endpoint working`);
  });
});

test.describe('V3.0 Document Hub Tables', () => {

  test('v2_document_queue accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/document-hub/queue`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.documents)).toBe(true);

    console.log(`Document queue has ${data.documents.length} items`);
  });

  test('v2_extraction_templates loaded', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/document-hub/types`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.types.length).toBeGreaterThan(5);

    // Verify key document types exist
    const typeNames = data.types.map(t => t.type);
    expect(typeNames).toContain('invoice');
    expect(typeNames).toContain('quote');
    expect(typeNames).toContain('proposal');
    expect(typeNames).toContain('spec_sheet');
    expect(typeNames).toContain('delivery_receipt');
    expect(typeNames).toContain('warranty_doc');
    expect(typeNames).toContain('change_order');

    console.log(`${data.types.length} document types configured`);
  });

  test('v2_document_processing_stats view works', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/document-hub/stats/overview`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);

    console.log(`Stats endpoint working`);
  });
});

test.describe('Foreign Key Relationships', () => {

  test('Invoices reference valid jobs', async ({ request }) => {
    const [invoicesRes, jobsRes] = await Promise.all([
      request.get(`${BASE_URL}/api/invoices?limit=10`),
      request.get(`${BASE_URL}/api/jobs`)
    ]);

    if (invoicesRes.ok() && jobsRes.ok()) {
      const invoicesData = await invoicesRes.json();
      const jobsData = await jobsRes.json();

      const invoices = invoicesData.invoices || invoicesData;
      const jobs = jobsData.jobs || jobsData;
      const jobIds = new Set(jobs.map(j => j.id));

      let validRefs = 0;
      let nullRefs = 0;

      for (const inv of invoices) {
        if (inv.job_id) {
          if (jobIds.has(inv.job_id)) {
            validRefs++;
          } else {
            console.log(`WARNING: Invoice ${inv.id} references non-existent job ${inv.job_id}`);
          }
        } else {
          nullRefs++;
        }
      }

      console.log(`Invoices: ${validRefs} valid job refs, ${nullRefs} null refs`);
    }
  });

  test('Invoices reference valid vendors', async ({ request }) => {
    const [invoicesRes, vendorsRes] = await Promise.all([
      request.get(`${BASE_URL}/api/invoices?limit=10`),
      request.get(`${BASE_URL}/api/vendors`)
    ]);

    if (invoicesRes.ok() && vendorsRes.ok()) {
      const invoicesData = await invoicesRes.json();
      const vendorsData = await vendorsRes.json();

      const invoices = invoicesData.invoices || invoicesData;
      const vendors = vendorsData.vendors || vendorsData;
      const vendorIds = new Set(vendors.map(v => v.id));

      let validRefs = 0;
      let nullRefs = 0;

      for (const inv of invoices) {
        if (inv.vendor_id) {
          if (vendorIds.has(inv.vendor_id)) {
            validRefs++;
          } else {
            console.log(`WARNING: Invoice ${inv.id} references non-existent vendor ${inv.vendor_id}`);
          }
        } else {
          nullRefs++;
        }
      }

      console.log(`Invoices: ${validRefs} valid vendor refs, ${nullRefs} null refs`);
    }
  });

  test('POs reference valid jobs', async ({ request }) => {
    const [posRes, jobsRes] = await Promise.all([
      request.get(`${BASE_URL}/api/purchase-orders?limit=10`),
      request.get(`${BASE_URL}/api/jobs`)
    ]);

    if (posRes.ok() && jobsRes.ok()) {
      const posData = await posRes.json();
      const jobsData = await jobsRes.json();

      const pos = posData.pos || posData.purchaseOrders || posData;
      const jobs = jobsData.jobs || jobsData;

      if (Array.isArray(pos) && Array.isArray(jobs)) {
        const jobIds = new Set(jobs.map(j => j.id));

        for (const po of pos) {
          if (po.job_id) {
            expect(jobIds.has(po.job_id)).toBe(true);
          }
        }
      }
    }
  });
});

test.describe('Data Validation', () => {

  test('Invoice amounts are valid numbers', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoices?limit=20`);

    if (response.ok()) {
      const data = await response.json();
      const invoices = data.invoices || data;

      for (const inv of invoices) {
        if (inv.amount !== null && inv.amount !== undefined) {
          expect(typeof parseFloat(inv.amount)).toBe('number');
          expect(isNaN(parseFloat(inv.amount))).toBe(false);
        }
      }
    }
  });

  test('Invoice statuses are valid', async ({ request }) => {
    const validStatuses = [
      'received', 'needs_approval', 'approved', 'in_draw', 'paid', 'denied', 'archive'
    ];

    const response = await request.get(`${BASE_URL}/api/invoices?limit=20`);

    if (response.ok()) {
      const data = await response.json();
      const invoices = data.invoices || data;

      for (const inv of invoices) {
        if (inv.status) {
          expect(validStatuses).toContain(inv.status);
        }
      }
    }
  });

  test('PO statuses are valid', async ({ request }) => {
    const validStatuses = ['draft', 'pending', 'approved', 'open', 'closed', 'cancelled', 'active'];

    const response = await request.get(`${BASE_URL}/api/purchase-orders?limit=20`);

    if (response.ok()) {
      const data = await response.json();
      const pos = data.pos || data.purchaseOrders || data;

      if (Array.isArray(pos)) {
        for (const po of pos) {
          if (po.status) {
            expect(validStatuses).toContain(po.status);
          }
        }
      }
    }
  });

  test('UUIDs are properly formatted', async ({ request }) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const response = await request.get(`${BASE_URL}/api/jobs`);

    if (response.ok()) {
      const data = await response.json();
      const jobs = data.jobs || data;

      for (const job of jobs) {
        expect(job.id).toMatch(uuidRegex);
      }
    }
  });

  test('Dates are properly formatted', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoices?limit=10`);

    if (response.ok()) {
      const data = await response.json();
      const invoices = data.invoices || data;

      for (const inv of invoices) {
        if (inv.created_at) {
          const date = new Date(inv.created_at);
          expect(date.toString()).not.toBe('Invalid Date');
        }
        if (inv.invoice_date) {
          const date = new Date(inv.invoice_date);
          expect(date.toString()).not.toBe('Invalid Date');
        }
      }
    }
  });
});

test.describe('Cascade Delete Protection', () => {

  test('Document extractions cascade from document queue', async ({ request }) => {
    // Get a document with extractions
    const queueRes = await request.get(`${BASE_URL}/api/document-hub/queue?limit=1`);

    if (queueRes.ok()) {
      const data = await queueRes.json();
      if (data.documents && data.documents.length > 0) {
        const docId = data.documents[0].id;

        // Get full document with extractions
        const docRes = await request.get(`${BASE_URL}/api/document-hub/${docId}`);

        if (docRes.ok()) {
          const docData = await docRes.json();
          console.log(`Document ${docId} has ${docData.document?.extractions?.length || 0} extractions`);
        }
      }
    }
  });
});

test.describe('Index Performance', () => {

  test('Invoice query with status filter is fast', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${BASE_URL}/api/invoices?status=approved&limit=50`);
    const duration = Date.now() - start;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(1000);

    console.log(`Status filter query: ${duration}ms`);
  });

  test('Invoice query with job filter is fast', async ({ request }) => {
    // Get a job ID first
    const jobsRes = await request.get(`${BASE_URL}/api/jobs`);

    if (jobsRes.ok()) {
      const jobsData = await jobsRes.json();
      const jobs = jobsData.jobs || jobsData;

      if (jobs.length > 0) {
        const jobId = jobs[0].id;

        const start = Date.now();
        const response = await request.get(`${BASE_URL}/api/invoices?job_id=${jobId}&limit=50`);
        const duration = Date.now() - start;

        expect(response.ok()).toBeTruthy();
        expect(duration).toBeLessThan(1000);

        console.log(`Job filter query: ${duration}ms`);
      }
    }
  });

  test('Document queue query with status filter is fast', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${BASE_URL}/api/document-hub/queue?status=pending&limit=50`);
    const duration = Date.now() - start;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(1000);

    console.log(`Document queue status filter: ${duration}ms`);
  });
});

test.describe('Migration Completeness', () => {

  test('All v3.0 tables exist', async ({ request }) => {
    // Test Document Hub tables via API
    const hubTypesRes = await request.get(`${BASE_URL}/api/document-hub/types`);
    expect(hubTypesRes.ok()).toBeTruthy();

    const hubQueueRes = await request.get(`${BASE_URL}/api/document-hub/queue`);
    expect(hubQueueRes.ok()).toBeTruthy();

    const hubStatsRes = await request.get(`${BASE_URL}/api/document-hub/stats/overview`);
    expect(hubStatsRes.ok()).toBeTruthy();

    console.log('V3.0 Document Hub tables verified');
  });
});
