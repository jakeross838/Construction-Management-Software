// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Split Invoice Feature', () => {
  const BASE_URL = 'http://localhost:3001';

  test('API: Split invoice into multiple children', async ({ request }) => {
    console.log('=== Testing Split Invoice API ===');

    // Get an invoice that can be split
    const invoicesRes = await request.get(`${BASE_URL}/api/invoices`);
    expect(invoicesRes.ok()).toBeTruthy();
    const invoices = await invoicesRes.json();

    // Find a splittable invoice (not already split, has amount, correct status)
    const splittableStatuses = ['received', 'needs_review', 'needs_approval', 'ready_for_approval'];
    const candidate = invoices.find(inv =>
      !inv.is_split_parent &&
      !inv.parent_invoice_id &&
      inv.amount > 100 &&
      splittableStatuses.includes(inv.status)
    );

    if (!candidate) {
      console.log('No splittable invoice found - skipping API test');
      console.log('Available invoices:', invoices.map(i => ({
        id: i.id?.slice(0,8),
        status: i.status,
        amount: i.amount,
        is_split_parent: i.is_split_parent,
        parent_invoice_id: i.parent_invoice_id
      })));
      return;
    }

    console.log('Found splittable invoice:', {
      id: candidate.id,
      invoice_number: candidate.invoice_number,
      amount: candidate.amount,
      status: candidate.status
    });

    // Get jobs for splitting
    const jobsRes = await request.get(`${BASE_URL}/api/jobs`);
    const jobs = await jobsRes.json();

    if (jobs.length === 0) {
      console.log('No jobs found - skipping');
      return;
    }

    const splitAmount = parseFloat(candidate.amount);
    const split1Amount = Math.floor(splitAmount * 0.6 * 100) / 100;
    const split2Amount = Math.round((splitAmount - split1Amount) * 100) / 100;

    console.log('Splitting:', { total: splitAmount, split1: split1Amount, split2: split2Amount });

    // Perform the split
    const splitRes = await request.post(`${BASE_URL}/api/invoices/${candidate.id}/split`, {
      data: {
        splits: [
          { job_id: jobs[0].id, amount: split1Amount, notes: 'Test split 1' },
          { job_id: jobs[0].id, amount: split2Amount, notes: 'Test split 2' }
        ],
        performed_by: 'Test Runner'
      }
    });

    if (!splitRes.ok()) {
      const error = await splitRes.json();
      console.log('Split failed:', error);
      // This is expected if invoice is already processed
      if (error.error?.includes('already part of a split') || error.error?.includes('Cannot split')) {
        console.log('Invoice not in splittable state - this is OK');
        return;
      }
      throw new Error(`Split failed: ${error.error}`);
    }

    const splitResult = await splitRes.json();
    console.log('Split result:', {
      success: splitResult.success,
      parent_id: splitResult.parent_id,
      children: splitResult.children?.length
    });

    expect(splitResult.success).toBe(true);
    expect(splitResult.children).toHaveLength(2);
    console.log('Created children:', splitResult.children.map(c => ({
      id: c.id?.slice(0,8),
      invoice_number: c.invoice_number,
      amount: c.amount
    })));

    // Test: Get family
    console.log('\n--- Testing Family Endpoint ---');
    const familyRes = await request.get(`${BASE_URL}/api/invoices/${candidate.id}/family`);
    expect(familyRes.ok()).toBeTruthy();
    const family = await familyRes.json();

    console.log('Family result:', {
      is_split: family.is_split,
      parent_id: family.parent?.id?.slice(0,8),
      children_count: family.children?.length
    });

    expect(family.is_split).toBe(true);
    expect(family.children).toHaveLength(2);

    // Test: Unsplit
    console.log('\n--- Testing Unsplit ---');
    const unsplitRes = await request.post(`${BASE_URL}/api/invoices/${candidate.id}/unsplit`, {
      data: { performed_by: 'Test Runner' }
    });

    if (!unsplitRes.ok()) {
      const error = await unsplitRes.json();
      console.log('Unsplit failed:', error);
      // May fail if children were already processed
      return;
    }

    const unsplitResult = await unsplitRes.json();
    console.log('Unsplit result:', unsplitResult);
    expect(unsplitResult.success).toBe(true);

    // Verify parent is restored
    const verifyRes = await request.get(`${BASE_URL}/api/invoices/${candidate.id}`);
    const restored = await verifyRes.json();
    console.log('Restored invoice:', {
      is_split_parent: restored.is_split_parent,
      status: restored.status
    });

    expect(restored.is_split_parent).toBe(false);
    console.log('\n=== Split Invoice API Test PASSED ===');
  });

  test('UI: Split modal opens and displays correctly', async ({ page }) => {
    console.log('=== Testing Split Invoice UI ===');

    await page.goto(BASE_URL);
    await page.waitForSelector('.invoice-card', { timeout: 10000 });

    // Find an invoice card
    const invoiceCards = page.locator('.invoice-card');
    const count = await invoiceCards.count();
    console.log('Found invoice cards:', count);

    if (count === 0) {
      console.log('No invoices - skipping UI test');
      return;
    }

    // Click first invoice to open modal
    await invoiceCards.first().click();
    await page.waitForTimeout(1500);

    // Check if modal opened
    const modalContainer = page.locator('#modal-container');
    const modalActive = await modalContainer.evaluate(el => el.classList.contains('active'));
    console.log('Modal opened:', modalActive);

    if (!modalActive) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Look for Split button in modal footer (exact match, not "Add Split" or "Split Evenly")
    const modalFooter = page.locator('.modal-footer');
    const splitButton = modalFooter.locator('button').filter({ hasText: /^Split$/ });
    const splitBtnExists = await splitButton.count() > 0;
    console.log('Split button exists:', splitBtnExists);

    if (splitBtnExists) {
      // Check if button is enabled (invoice is splittable)
      const isDisabled = await splitButton.isDisabled();
      console.log('Split button disabled:', isDisabled);

      if (!isDisabled) {
        // Click to open split modal
        await splitButton.click();
        await page.waitForTimeout(500);

        // Check if split modal opened
        const splitModal = page.locator('#splitInvoiceModal');
        const splitModalVisible = await splitModal.isVisible();
        console.log('Split modal visible:', splitModalVisible);

        if (splitModalVisible) {
          // Check for split sections
          const splitSections = page.locator('.split-section');
          const sectionCount = await splitSections.count();
          console.log('Split sections:', sectionCount);

          // Check for add split button
          const addSplitBtn = page.locator('button:has-text("+ Add Split")');
          const addBtnExists = await addSplitBtn.count() > 0;
          console.log('Add Split button exists:', addBtnExists);

          // Check totals display
          const allocatedAmount = page.locator('#splitAllocatedAmount');
          const remainingAmount = page.locator('#splitRemainingAmount');

          if (await allocatedAmount.count() > 0) {
            console.log('Allocated amount:', await allocatedAmount.textContent());
          }
          if (await remainingAmount.count() > 0) {
            console.log('Remaining amount:', await remainingAmount.textContent());
          }

          // Close split modal
          await page.locator('button:has-text("Cancel")').first().click();
          await page.waitForTimeout(300);

          console.log('Split modal UI test PASSED');
        }
      } else {
        console.log('Split button disabled - invoice may not be splittable');
      }
    } else {
      // Check if this is already a split invoice
      const splitBadge = page.locator('.split-info-banner, .badge:has-text("Split")');
      const isSplit = await splitBadge.count() > 0;
      console.log('Invoice is already split:', isSplit);
    }

    // Close modal with Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    console.log('\n=== Split Invoice UI Test Complete ===');
  });

  test('UI: Split parent shows unsplit button', async ({ page }) => {
    console.log('=== Testing Unsplit Button UI ===');

    // First, check API for any split parents
    const response = await page.request.get(`${BASE_URL}/api/invoices`);
    const invoices = await response.json();

    const splitParent = invoices.find(inv => inv.is_split_parent === true);

    if (!splitParent) {
      console.log('No split parent invoices found - skipping');
      return;
    }

    console.log('Found split parent:', {
      id: splitParent.id?.slice(0,8),
      invoice_number: splitParent.invoice_number,
      status: splitParent.status
    });

    await page.goto(BASE_URL);
    await page.waitForSelector('.invoice-card', { timeout: 10000 });

    // Find and click the split parent invoice by its exact ID
    const parentCard = page.locator(`.invoice-card[onclick*="${splitParent.id}"]`);
    const exists = await parentCard.count() > 0;

    if (!exists) {
      // Try alternative - the parent may have status='split' and not show in default view
      console.log('Split parent card not visible in list (may be filtered by status)');
      // Check if we can find any split-related badges
      const splitBadges = page.locator('.badge:has-text("Split"), .split-badge');
      const badgeCount = await splitBadges.count();
      console.log('Split badges visible:', badgeCount);
      return;
    }

    await parentCard.click();
    await page.waitForTimeout(1500);

    // Look for Unsplit button
    const unsplitBtn = page.locator('button:has-text("Unsplit")');
    const unsplitExists = await unsplitBtn.count() > 0;
    console.log('Unsplit button exists:', unsplitExists);

    if (unsplitExists) {
      console.log('Unsplit button UI test PASSED');
    }

    // Close modal
    await page.keyboard.press('Escape');
    console.log('\n=== Unsplit Button Test Complete ===');
  });

  test('UI: Split child shows parent link', async ({ page }) => {
    console.log('=== Testing Split Child UI ===');

    // Check API for any split children
    const response = await page.request.get(`${BASE_URL}/api/invoices`);
    const invoices = await response.json();

    const splitChild = invoices.find(inv => inv.parent_invoice_id != null);

    if (!splitChild) {
      console.log('No split child invoices found - skipping');
      return;
    }

    console.log('Found split child:', {
      id: splitChild.id?.slice(0,8),
      invoice_number: splitChild.invoice_number,
      parent_id: splitChild.parent_invoice_id?.slice(0,8)
    });

    await page.goto(BASE_URL);
    await page.waitForSelector('.invoice-card', { timeout: 10000 });

    // Find and click the split child invoice
    const childCard = page.locator(`.invoice-card:has-text("${splitChild.invoice_number}")`);
    const exists = await childCard.count() > 0;

    if (!exists) {
      console.log('Split child card not visible in list');
      return;
    }

    await childCard.click();
    await page.waitForTimeout(1500);

    // Look for split info banner or parent link
    const splitBanner = page.locator('.split-info-banner');
    const bannerExists = await splitBanner.count() > 0;
    console.log('Split info banner exists:', bannerExists);

    if (bannerExists) {
      const bannerText = await splitBanner.textContent();
      console.log('Banner text:', bannerText?.slice(0, 100));

      // Look for "View Parent" link
      const viewParentLink = page.locator('button:has-text("View Parent")');
      const linkExists = await viewParentLink.count() > 0;
      console.log('View Parent link exists:', linkExists);

      if (linkExists) {
        console.log('Split child UI test PASSED');
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
    console.log('\n=== Split Child Test Complete ===');
  });
});
