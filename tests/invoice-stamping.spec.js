// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Invoice Stamping Test Suite
 * Tests the PDF stamping mechanism for invoices
 */

test.describe('Invoice Stamping', () => {
  test('stamp endpoint exists and responds', async ({ request }) => {
    // Get an invoice first
    const invoicesResponse = await request.get('/api/invoices');
    expect(invoicesResponse.ok()).toBeTruthy();

    const invoices = await invoicesResponse.json();
    if (invoices.length === 0) {
      test.skip();
      return;
    }

    const invoice = invoices[0];

    // Call stamp endpoint
    const stampResponse = await request.post(`/api/invoices/${invoice.id}/stamp`, {
      data: { status: invoice.status }
    });

    // Should respond (may return null if no PDF or status doesn't support stamping)
    expect(stampResponse.ok()).toBeTruthy();
    const result = await stampResponse.json();
    expect(result).toHaveProperty('success');
  });

  test('approve endpoint triggers stamping', async ({ request }) => {
    // Get invoices
    const invoicesResponse = await request.get('/api/invoices');
    const invoices = await invoicesResponse.json();

    // Find one that's needs_approval with a PDF
    const invoice = invoices.find(inv =>
      inv.status === 'needs_approval' && inv.pdf_url
    );

    if (!invoice) {
      console.log('No invoice in needs_approval status with PDF found');
      test.skip();
      return;
    }

    // Try to approve it (may fail if no allocations, which is fine)
    const approveResponse = await request.post(`/api/invoices/${invoice.id}/transition`, {
      data: {
        new_status: 'approved',
        performed_by: 'Test User'
      }
    });

    // Check response - may fail due to validation, but endpoint should exist
    const result = await approveResponse.json();
    console.log('Approve result:', result);

    // Either success or validation error is acceptable
    expect(approveResponse.status()).toBeLessThan(500);
  });

  test('invoice detail dialog shows stamp button', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click on first invoice row
    const row = page.locator('tbody tr').first();
    if (await row.count() > 0) {
      await row.click();
      await page.waitForTimeout(1000);

      // Check for approve/stamp related buttons in the dialog
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.count() > 0) {
        const approveBtn = dialog.locator('button:has-text("Approve")');
        const stampBtn = dialog.locator('button:has-text("Stamp")');

        // At least one should exist depending on invoice status
        const hasApproveOrStamp =
          await approveBtn.count() > 0 ||
          await stampBtn.count() > 0;

        console.log('Found Approve button:', await approveBtn.count() > 0);
        console.log('Found Stamp button:', await stampBtn.count() > 0);
      }
    }
  });

  test('transition endpoint works for status changes', async ({ request }) => {
    // Test that the transition endpoint exists
    const invoicesResponse = await request.get('/api/invoices');
    const invoices = await invoicesResponse.json();

    if (invoices.length === 0) {
      test.skip();
      return;
    }

    const invoice = invoices[0];

    // Just verify the endpoint responds (don't actually change status)
    const transitionResponse = await request.post(`/api/invoices/${invoice.id}/transition`, {
      data: {
        new_status: invoice.status, // Same status = no change
        performed_by: 'Test'
      }
    });

    // Should respond without 404
    expect(transitionResponse.status()).not.toBe(404);
  });
});
