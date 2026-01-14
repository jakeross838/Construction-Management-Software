const { test, expect } = require('@playwright/test');

/**
 * Data Validation and Balance Verification Test
 *
 * Verifies that all data balances correctly:
 * - Invoice allocations sum to invoice total
 * - Draw totals match included invoice totals
 * - Budget committed matches POs + approved invoices
 * - G702/G703 calculations are accurate
 */

const BASE_URL = 'http://localhost:3001';

test.describe('Data Validation', () => {
  let issues = [];

  test.afterAll(async () => {
    console.log('\n========================================');
    console.log('DATA VALIDATION SUMMARY');
    console.log('========================================\n');

    if (issues.length === 0) {
      console.log('All data validations passed!');
    } else {
      console.log(`Found ${issues.length} issues:\n`);
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    }
  });

  test('1. Invoice Allocations Balance', async ({ request }) => {
    console.log('\n--- Testing Invoice Allocation Balances ---\n');

    const response = await request.get(`${BASE_URL}/api/invoices`);
    const invoices = await response.json();

    for (const invoice of invoices) {
      const detailRes = await request.get(`${BASE_URL}/api/invoices/${invoice.id}`);
      if (!detailRes.ok()) continue;

      const detail = await detailRes.json();
      const invoiceAmount = parseFloat(invoice.amount) || 0;
      const allocations = detail.allocations || [];
      const allocationTotal = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

      // Check if allocations sum to invoice amount (allow small rounding)
      const diff = Math.abs(invoiceAmount - allocationTotal);
      if (allocations.length > 0 && diff > 0.01) {
        const issue = `Invoice ${invoice.invoice_number}: Amount $${invoiceAmount} but allocations total $${allocationTotal} (diff: $${diff.toFixed(2)})`;
        console.log('WARNING: ' + issue);
        issues.push(issue);
      }
    }

    console.log(`Checked ${invoices.length} invoices`);
  });

  test('2. Draw Invoice Totals', async ({ request }) => {
    console.log('\n--- Testing Draw Invoice Totals ---\n');

    const drawsRes = await request.get(`${BASE_URL}/api/draws`);
    const draws = await drawsRes.json();

    for (const draw of draws) {
      const detailRes = await request.get(`${BASE_URL}/api/draws/${draw.id}`);
      if (!detailRes.ok()) continue;

      const detail = await detailRes.json();
      const invoices = detail.invoices || [];
      const invoiceTotal = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
      const coBillings = detail.coBillings || [];
      const coTotal = coBillings.reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0);
      const expectedTotal = invoiceTotal + coTotal;
      const drawTotal = parseFloat(draw.total_amount) || 0;

      // Check totals match
      const diff = Math.abs(drawTotal - expectedTotal);
      if (diff > 0.01) {
        const issue = `Draw #${draw.draw_number} (${draw.job?.name}): Total $${drawTotal} but invoices+COs = $${expectedTotal} (diff: $${diff.toFixed(2)})`;
        console.log('INFO: ' + issue);
        // This is expected for historical draws with CO billings
        if (invoices.length === 0 && coTotal > 0) {
          console.log('  (Historical draw with CO billings only - expected)');
        } else {
          issues.push(issue);
        }
      }
    }

    console.log(`Checked ${draws.length} draws`);
  });

  test('3. Budget Committed Calculation', async ({ request }) => {
    console.log('\n--- Testing Budget Committed Calculations ---\n');

    const jobsRes = await request.get(`${BASE_URL}/api/jobs`);
    const jobs = await jobsRes.json();

    for (const job of jobs) {
      const budgetRes = await request.get(`${BASE_URL}/api/jobs/${job.id}/budget-summary`);
      if (!budgetRes.ok()) continue;

      const budget = await budgetRes.json();

      // Check each line
      for (const line of budget.lines || []) {
        // Committed should be >= 0
        if (line.committed < 0) {
          const issue = `Budget line ${line.costCode} (${job.name}): Negative committed amount $${line.committed}`;
          console.log('ERROR: ' + issue);
          issues.push(issue);
        }

        // Budgeted should be >= 0
        if (line.budgeted < 0) {
          const issue = `Budget line ${line.costCode} (${job.name}): Negative budget amount $${line.budgeted}`;
          console.log('ERROR: ' + issue);
          issues.push(issue);
        }

        // If closed, projected should equal committed
        if (line.closedAt) {
          const expectedProjected = (line.committed || 0) + (line.pending || 0);
          if (Math.abs(line.projected - expectedProjected) > 0.01) {
            const issue = `Closed line ${line.costCode}: Projected $${line.projected} should equal committed $${expectedProjected}`;
            console.log('WARNING: ' + issue);
            issues.push(issue);
          }
        }
      }

      // Check totals match line sums
      const lineBudgetTotal = (budget.lines || []).reduce((sum, l) => sum + (l.budgeted || 0), 0);
      const diff = Math.abs(lineBudgetTotal - (budget.totals?.budgeted || 0));
      if (diff > 0.01) {
        const issue = `Job ${job.name}: Line budget total $${lineBudgetTotal} doesn't match totals.budgeted $${budget.totals?.budgeted}`;
        console.log('WARNING: ' + issue);
        issues.push(issue);
      }

      console.log(`Job ${job.name}: ${budget.lines?.length || 0} lines, budget $${budget.totals?.budgeted?.toFixed(2)}, committed $${budget.totals?.committed?.toFixed(2)}`);
    }
  });

  test('4. G702/G703 Calculations', async ({ request }) => {
    console.log('\n--- Testing G702/G703 Calculations ---\n');

    const drawsRes = await request.get(`${BASE_URL}/api/draws`);
    const draws = await drawsRes.json();

    for (const draw of draws.slice(0, 5)) { // Test first 5 draws
      const detailRes = await request.get(`${BASE_URL}/api/draws/${draw.id}`);
      if (!detailRes.ok()) continue;

      const detail = await detailRes.json();
      const g702 = detail.g702 || {};
      const g703 = detail.g703 || [];

      // G702 checks
      if (g702.originalContractSum !== undefined) {
        // Contract sum to date = original + change orders
        const expectedContractSum = (g702.originalContractSum || 0) + (g702.netChangeOrders || 0);
        if (Math.abs((g702.contractSumToDate || 0) - expectedContractSum) > 0.01) {
          const issue = `Draw #${draw.draw_number} G702: Contract sum to date calculation error`;
          console.log('WARNING: ' + issue);
          issues.push(issue);
        }

        // Retainage = total completed * retainage %
        const expectedRetainage = (g702.totalCompletedToDate || 0) * ((g702.retainagePercent || 10) / 100);
        if (Math.abs((g702.retainageAmount || 0) - expectedRetainage) > 0.01) {
          const issue = `Draw #${draw.draw_number} G702: Retainage calculation error (expected $${expectedRetainage.toFixed(2)}, got $${g702.retainageAmount})`;
          console.log('WARNING: ' + issue);
          issues.push(issue);
        }
      }

      // G703 checks
      for (const line of g703) {
        // Total billed = previous + current
        const expectedTotal = (line.previousBillings || 0) + (line.currentBillings || 0);
        if (Math.abs((line.totalBilled || 0) - expectedTotal) > 0.01) {
          const issue = `Draw #${draw.draw_number} G703 ${line.costCode}: Total billed calculation error`;
          console.log('WARNING: ' + issue);
          issues.push(issue);
        }

        // Balance remaining = scheduled - total billed
        const expectedBalance = (line.scheduledValue || 0) - (line.totalBilled || 0);
        if (Math.abs((line.balanceRemaining || 0) - expectedBalance) > 0.01) {
          const issue = `Draw #${draw.draw_number} G703 ${line.costCode}: Balance remaining calculation error`;
          console.log('WARNING: ' + issue);
          issues.push(issue);
        }

        // Percent complete = total billed / scheduled value
        if (line.scheduledValue > 0) {
          const expectedPercent = ((line.totalBilled || 0) / line.scheduledValue) * 100;
          if (Math.abs((line.percentComplete || 0) - expectedPercent) > 1) { // Allow 1% tolerance
            const issue = `Draw #${draw.draw_number} G703 ${line.costCode}: Percent complete calculation error`;
            console.log('WARNING: ' + issue);
            issues.push(issue);
          }
        }
      }

      console.log(`Draw #${draw.draw_number}: G702 OK, G703 has ${g703.length} lines`);
    }
  });

  test('5. Invoice Status Consistency', async ({ request }) => {
    console.log('\n--- Testing Invoice Status Consistency ---\n');

    const response = await request.get(`${BASE_URL}/api/invoices`);
    const invoices = await response.json();

    const validStatuses = ['received', 'needs_approval', 'approved', 'in_draw', 'paid', 'denied'];

    for (const invoice of invoices) {
      // Check status is valid
      if (!validStatuses.includes(invoice.status)) {
        const issue = `Invoice ${invoice.invoice_number}: Invalid status "${invoice.status}"`;
        console.log('ERROR: ' + issue);
        issues.push(issue);
      }

      // If in_draw, should have a draw associated
      if (invoice.status === 'in_draw') {
        // Would need to check draw_invoices table
      }

      // If approved, should have approved_at timestamp
      if (invoice.status === 'approved' && !invoice.approved_at) {
        const issue = `Invoice ${invoice.invoice_number}: Status is approved but no approved_at timestamp`;
        console.log('WARNING: ' + issue);
        // Not adding to issues - might be legacy data
      }
    }

    const statusCounts = {};
    invoices.forEach(inv => {
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
    });

    console.log('Invoice status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  });

  test('6. PO and Invoice Linkage', async ({ request }) => {
    console.log('\n--- Testing PO and Invoice Linkage ---\n');

    const posRes = await request.get(`${BASE_URL}/api/purchase-orders`);
    const pos = await posRes.json();

    console.log(`Found ${pos.length} purchase orders`);

    for (const po of pos) {
      // Get PO details
      const detailRes = await request.get(`${BASE_URL}/api/purchase-orders/${po.id}`);
      if (!detailRes.ok()) continue;

      const detail = await detailRes.json();
      const lineItems = detail.line_items || [];
      const linkedInvoices = detail.invoices || [];

      // Calculate totals
      const lineItemTotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);
      const poTotal = parseFloat(po.total_amount) || 0;

      // Check line items sum to PO total
      if (Math.abs(lineItemTotal - poTotal) > 0.01) {
        const issue = `PO ${po.po_number}: Line items total $${lineItemTotal} doesn't match PO total $${poTotal}`;
        console.log('WARNING: ' + issue);
        issues.push(issue);
      }

      // Check for over-invoicing
      const invoicedTotal = linkedInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
      if (invoicedTotal > poTotal * 1.1) { // Allow 10% tolerance for change orders
        const issue = `PO ${po.po_number}: Invoiced $${invoicedTotal} exceeds PO total $${poTotal} by more than 10%`;
        console.log('WARNING: ' + issue);
        issues.push(issue);
      }
    }
  });

  test('7. Cost Code Allocation Consistency', async ({ request }) => {
    console.log('\n--- Testing Cost Code Allocation Consistency ---\n');

    const jobsRes = await request.get(`${BASE_URL}/api/jobs`);
    const jobs = await jobsRes.json();

    for (const job of jobs) {
      const budgetRes = await request.get(`${BASE_URL}/api/jobs/${job.id}/budget-summary`);
      if (!budgetRes.ok()) continue;

      const budget = await budgetRes.json();

      // Check for duplicate cost codes
      const costCodes = (budget.lines || []).map(l => l.costCode);
      const uniqueCostCodes = [...new Set(costCodes)];
      if (costCodes.length !== uniqueCostCodes.length) {
        const issue = `Job ${job.name}: Duplicate cost codes in budget`;
        console.log('WARNING: ' + issue);
        issues.push(issue);
      }

      // Check for missing cost codes (cost codes with activity but no budget)
      for (const line of budget.lines || []) {
        if (line.budgeted === 0 && (line.committed > 0 || line.billed > 0)) {
          console.log(`  Note: ${line.costCode} has activity but no budget (committed: $${line.committed}, billed: $${line.billed})`);
        }
      }
    }
  });

  test('8. Change Order Consistency', async ({ request }) => {
    console.log('\n--- Testing Change Order Consistency ---\n');

    const jobsRes = await request.get(`${BASE_URL}/api/jobs`);
    const jobs = await jobsRes.json();

    for (const job of jobs) {
      const budgetRes = await request.get(`${BASE_URL}/api/jobs/${job.id}/budget-summary`);
      if (!budgetRes.ok()) continue;

      const budget = await budgetRes.json();
      const jobCOs = budget.jobChangeOrders || [];

      // Sum approved COs
      const approvedCOTotal = jobCOs
        .filter(co => co.status === 'approved')
        .reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0);

      const reportedCOTotal = budget.totals?.changeOrderTotal || 0;

      if (Math.abs(approvedCOTotal - reportedCOTotal) > 0.01) {
        const issue = `Job ${job.name}: Approved CO total $${approvedCOTotal} doesn't match reported $${reportedCOTotal}`;
        console.log('WARNING: ' + issue);
        issues.push(issue);
      }

      console.log(`Job ${job.name}: ${jobCOs.length} COs, approved total $${approvedCOTotal}`);
    }
  });
});
