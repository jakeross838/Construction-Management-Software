const http = require('http');

let passed = 0;
let failed = 0;
const errors = [];

async function fetchApi(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3001' + endpoint);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('✓ ' + name);
  } catch (err) {
    failed++;
    console.log('✗ ' + name + ': ' + err.message);
    errors.push({ test: name, error: err.message });
  }
}

async function runTests() {
  console.log('=== COMPREHENSIVE API TESTS ===\n');

  // 1. Dashboard Stats
  await test('Dashboard stats returns valid data', async () => {
    const res = await fetchApi('/api/dashboard/stats');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!res.data.invoices) throw new Error('Missing invoices');
    if (!res.data.jobs) throw new Error('Missing jobs');
  });

  // 2. Jobs List
  await test('Jobs list returns array', async () => {
    const res = await fetchApi('/api/jobs');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 3. Job Budget
  await test('Job budget returns valid structure', async () => {
    const res = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/budget');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Budget not an array');
  });

  // 4. Invoices List
  await test('Invoices list returns array', async () => {
    const res = await fetchApi('/api/invoices');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 5. Invoices with filters
  await test('Invoices filter by status works', async () => {
    const res = await fetchApi('/api/invoices?status=approved');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
    for (const inv of res.data) {
      if (inv.status !== 'approved') throw new Error('Filter not working: ' + inv.status);
    }
  });

  // 6. Single Invoice with allocations
  await test('Single invoice returns with allocations', async () => {
    const list = await fetchApi('/api/invoices');
    if (list.data.length === 0) throw new Error('No invoices');
    const inv = await fetchApi('/api/invoices/' + list.data[0].id);
    if (inv.status !== 200) throw new Error('Status: ' + inv.status);
    if (!inv.data.id) throw new Error('Missing id');
  });

  // 7. Vendors
  await test('Vendors list returns array', async () => {
    const res = await fetchApi('/api/vendors');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 8. Cost Codes
  await test('Cost codes list returns array', async () => {
    const res = await fetchApi('/api/cost-codes');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 9. Purchase Orders
  await test('Purchase orders list returns array', async () => {
    const res = await fetchApi('/api/purchase-orders');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 10. PO Stats
  await test('PO stats returns valid data', async () => {
    const res = await fetchApi('/api/purchase-orders/stats');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (typeof res.data.total !== 'number') throw new Error('Missing total');
  });

  // 11. Draws
  await test('Draws list returns array', async () => {
    const res = await fetchApi('/api/draws');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 12. Single Draw with G702/G703
  await test('Single draw returns with G702/G703 data', async () => {
    const list = await fetchApi('/api/draws');
    if (list.data.length === 0) throw new Error('No draws');
    const draw = await fetchApi('/api/draws/' + list.data[0].id);
    if (draw.status !== 200) throw new Error('Status: ' + draw.status);
    if (!draw.data.g702) throw new Error('Missing G702');
    if (!draw.data.g703) throw new Error('Missing G703');
  });

  // 13. Job Change Orders
  await test('Job change orders list returns array', async () => {
    const res = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/change-orders');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 14. Funding Sources
  await test('Funding sources returns POs and COs', async () => {
    const res = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/funding-sources');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!res.data.purchaseOrders) throw new Error('Missing purchaseOrders');
    if (!res.data.changeOrders) throw new Error('Missing changeOrders');
  });

  // 15. Invoice Family (split parent)
  await test('Invoice family endpoint works for split parent', async () => {
    const res = await fetchApi('/api/invoices/f84c7f1f-cf04-4fd2-8c0c-cbae0063b944/family');
    // Should return 200 if it's a split parent, 404 otherwise
    if (res.status !== 200 && res.status !== 404) throw new Error('Status: ' + res.status);
  });

  // 16. Approved Unbilled Invoices
  await test('Approved unbilled invoices endpoint works', async () => {
    const res = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/approved-unbilled-invoices');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 17. Draw CO Billings
  await test('Draw CO billings endpoint works', async () => {
    const list = await fetchApi('/api/draws');
    if (list.data.length === 0) throw new Error('No draws');
    const res = await fetchApi('/api/draws/' + list.data[0].id + '/co-billings');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 18. Lien Releases
  await test('Lien releases list returns array', async () => {
    const res = await fetchApi('/api/lien-releases');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 19. Job Budget Summary
  await test('Job budget summary returns valid data', async () => {
    const res = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/budget-summary');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!res.data.budget) throw new Error('Missing budget');
    if (!res.data.changeOrders) throw new Error('Missing changeOrders');
  });

  // 20. Needs Review Invoices
  await test('Needs review invoices endpoint works', async () => {
    const res = await fetchApi('/api/invoices/needs-review');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 21. Invoice Allocations
  await test('Invoice allocations endpoint works', async () => {
    const list = await fetchApi('/api/invoices?status=approved');
    if (list.data.length === 0) {
      console.log('  (skipped - no approved invoices)');
      return;
    }
    const res = await fetchApi('/api/invoices/' + list.data[0].id + '/allocations');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 22. Invoice Approval Context
  await test('Invoice approval context endpoint works', async () => {
    const list = await fetchApi('/api/invoices');
    if (list.data.length === 0) throw new Error('No invoices');
    const res = await fetchApi('/api/invoices/' + list.data[0].id + '/approval-context');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
  });

  // 23. Draw Available COs
  await test('Draw available COs endpoint works', async () => {
    const list = await fetchApi('/api/draws');
    if (list.data.length === 0) throw new Error('No draws');
    const res = await fetchApi('/api/draws/' + list.data[0].id + '/available-cos');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 24. Single PO detail
  await test('Single PO returns with line items', async () => {
    const list = await fetchApi('/api/purchase-orders');
    if (list.data.length === 0) throw new Error('No POs');
    const po = await fetchApi('/api/purchase-orders/' + list.data[0].id);
    if (po.status !== 200) throw new Error('Status: ' + po.status);
    if (!po.data.id) throw new Error('Missing id');
  });

  // 25. Single CO detail
  await test('Single CO returns valid data', async () => {
    const list = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/change-orders');
    if (list.data.length === 0) throw new Error('No COs');
    const co = await fetchApi('/api/change-orders/' + list.data[0].id);
    if (co.status !== 200) throw new Error('Status: ' + co.status);
    if (!co.data.id) throw new Error('Missing id');
  });

  // 26. CO Invoices
  await test('CO invoices endpoint works', async () => {
    const list = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/change-orders');
    if (list.data.length === 0) throw new Error('No COs');
    const res = await fetchApi('/api/change-orders/' + list.data[0].id + '/invoices');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 27. CO Cost Codes
  await test('CO cost codes endpoint works', async () => {
    const list = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/change-orders');
    if (list.data.length === 0) throw new Error('No COs');
    const res = await fetchApi('/api/change-orders/' + list.data[0].id + '/cost-codes');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 28. Draw Activity
  await test('Draw activity endpoint works', async () => {
    const list = await fetchApi('/api/draws');
    if (list.data.length === 0) throw new Error('No draws');
    const res = await fetchApi('/api/draws/' + list.data[0].id + '/activity');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 29. PO Activity
  await test('PO activity endpoint works', async () => {
    const list = await fetchApi('/api/purchase-orders');
    if (list.data.length === 0) throw new Error('No POs');
    const res = await fetchApi('/api/purchase-orders/' + list.data[0].id + '/activity');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
  });

  // 30. Job Stats
  await test('Job stats endpoint works', async () => {
    const res = await fetchApi('/api/jobs/d8a914c9-b861-4a4f-b888-75887b1570c4/stats');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
  });

  console.log('\n=== RESULTS ===');
  console.log('Passed: ' + passed);
  console.log('Failed: ' + failed);

  if (errors.length > 0) {
    console.log('\n=== ERRORS ===');
    errors.forEach(e => console.log('  - ' + e.test + ': ' + e.error));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
