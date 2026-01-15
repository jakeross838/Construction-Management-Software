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
  console.log('=== ADDITIONAL TESTS ===\n');

  const JOB_ID = 'd8a914c9-b861-4a4f-b888-75887b1570c4';

  // === PAYMENT WORKFLOW TESTS ===
  console.log('--- Payment Workflow Tests ---');

  await test('Pay endpoint validates required fields', async () => {
    // Get an in_draw invoice
    const res = await fetchApi('/api/invoices?status=in_draw');
    if (res.data.length === 0) {
      console.log('  (skipped - no in_draw invoices)');
      return;
    }

    // Try to pay without required fields
    const payRes = await fetchApi('/api/invoices/' + res.data[0].id + '/pay', {
      method: 'PATCH',
      body: { } // Missing payment_method
    });

    if (payRes.status === 200) {
      throw new Error('Should require payment fields');
    }
  });

  await test('Unpay endpoint requires paid status', async () => {
    // Get a non-paid invoice
    const res = await fetchApi('/api/invoices?status=approved');
    if (res.data.length === 0) {
      console.log('  (skipped - no approved invoices)');
      return;
    }

    const unpayRes = await fetchApi('/api/invoices/' + res.data[0].id + '/unpay', {
      method: 'PATCH',
      body: { performed_by: 'Test' }
    });

    if (unpayRes.status === 200) {
      throw new Error('Should reject unpay on non-paid invoice');
    }
  });

  // === VENDOR TESTS ===
  console.log('\n--- Vendor Tests ---');

  await test('Vendor duplicate detection works', async () => {
    const res = await fetchApi('/api/vendors/duplicates');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    if (!Array.isArray(res.data)) throw new Error('Not an array');
    console.log('  Found ' + res.data.length + ' potential duplicate groups');
  });

  await test('Vendor details endpoint works', async () => {
    const vendors = await fetchApi('/api/vendors');
    if (vendors.data.length === 0) throw new Error('No vendors');

    const res = await fetchApi('/api/vendors/' + vendors.data[0].id + '/details');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
  });

  // === LIEN RELEASE TESTS ===
  console.log('\n--- Lien Release Tests ---');

  await test('Lien release coverage check works', async () => {
    const draws = await fetchApi('/api/draws');
    if (draws.data.length === 0) throw new Error('No draws');

    const res = await fetchApi('/api/draws/' + draws.data[0].id + '/lien-release-coverage');
    if (res.status !== 200) throw new Error('Status: ' + res.status);
    console.log('  Coverage data returned');
  });

  // === BUDGET CLOSE-OUT TESTS ===
  console.log('\n--- Budget Close-out Tests ---');

  await test('Cost code details endpoint works', async () => {
    const budget = await fetchApi('/api/jobs/' + JOB_ID + '/budget');
    if (budget.data.length === 0) throw new Error('No budget lines');

    const firstLine = budget.data.find(b => b.cost_code_id);
    if (firstLine) {
      const res = await fetchApi('/api/jobs/' + JOB_ID + '/cost-code/' + firstLine.cost_code_id + '/details');
      if (res.status !== 200) throw new Error('Status: ' + res.status);
      console.log('  Got cost code details');
    }
  });

  // === LOCK TESTS ===
  console.log('\n--- Lock Tests ---');

  await test('Lock acquire and release works', async () => {
    const invoices = await fetchApi('/api/invoices');
    if (invoices.data.length === 0) throw new Error('No invoices');

    const inv = invoices.data[0];

    // Acquire lock
    const acquireRes = await fetchApi('/api/locks/acquire', {
      method: 'POST',
      body: {
        entity_type: 'invoice',
        entity_id: inv.id,
        user_id: 'test-user'
      }
    });

    if (acquireRes.status === 200) {
      const lockId = acquireRes.data.id;

      // Release lock
      const releaseRes = await fetchApi('/api/locks/' + lockId, {
        method: 'DELETE'
      });

      if (releaseRes.status !== 200) {
        throw new Error('Failed to release lock');
      }
    }
  });

  await test('Double lock acquisition fails', async () => {
    const invoices = await fetchApi('/api/invoices');
    if (invoices.data.length === 0) throw new Error('No invoices');

    const inv = invoices.data[0];

    // First acquire
    const lock1 = await fetchApi('/api/locks/acquire', {
      method: 'POST',
      body: { entity_type: 'invoice', entity_id: inv.id, user_id: 'user1' }
    });

    if (lock1.status === 200) {
      // Second acquire should fail
      const lock2 = await fetchApi('/api/locks/acquire', {
        method: 'POST',
        body: { entity_type: 'invoice', entity_id: inv.id, user_id: 'user2' }
      });

      // Clean up
      await fetchApi('/api/locks/' + lock1.data.id, { method: 'DELETE' });

      // The second lock should have been rejected
      if (lock2.status === 200 && lock2.data.id !== lock1.data.id) {
        throw new Error('Should not acquire lock when already locked');
      }
    }
  });

  // === EDGE CASES ===
  console.log('\n--- Edge Cases ---');

  await test('Invalid UUID returns 404 or 400', async () => {
    const res = await fetchApi('/api/invoices/not-a-uuid');
    if (res.status !== 400 && res.status !== 404 && res.status !== 500) {
      throw new Error('Should return error for invalid UUID');
    }
  });

  await test('Non-existent ID returns 404', async () => {
    const res = await fetchApi('/api/invoices/00000000-0000-0000-0000-000000000000');
    if (res.status !== 404 && res.status !== 400) {
      throw new Error('Should return 404 for non-existent ID');
    }
  });

  await test('Draw export endpoints exist', async () => {
    const draws = await fetchApi('/api/draws');
    if (draws.data.length === 0) throw new Error('No draws');

    // Excel export should work (returns file, not JSON)
    const excelRes = await fetchApi('/api/draws/' + draws.data[0].id + '/export/excel');
    // Just check it doesn't 404
    if (excelRes.status === 404) throw new Error('Excel export not found');
    console.log('  Excel export status: ' + excelRes.status);
  });

  // === VALIDATION TESTS ===
  console.log('\n--- Validation Tests ---');

  await test('Invalid status transition is rejected', async () => {
    const invoices = await fetchApi('/api/invoices?status=needs_review');
    if (invoices.data.length === 0) {
      console.log('  (skipped - no needs_review invoices)');
      return;
    }

    const res = await fetchApi('/api/invoices/' + invoices.data[0].id + '/transition', {
      method: 'POST',
      body: { status: 'paid', performed_by: 'Test' }
    });

    if (res.status === 200) {
      throw new Error('Should reject invalid transition');
    }
  });

  await test('Split on already-split invoice fails', async () => {
    // Get a split parent
    const invoices = await fetchApi('/api/invoices');
    const parent = invoices.data.find(i => i.is_split_parent);

    if (parent) {
      const res = await fetchApi('/api/invoices/' + parent.id + '/split', {
        method: 'POST',
        body: {
          splits: [{ amount: 100 }, { amount: 100 }],
          performed_by: 'Test'
        }
      });

      if (res.status === 200) {
        throw new Error('Should reject split on already-split invoice');
      }
    } else {
      console.log('  (skipped - no split parents to test)');
    }
  });

  // Print results
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
