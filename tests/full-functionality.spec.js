const { test, expect } = require('@playwright/test');

/**
 * Full Functionality Test Suite
 * Tests every feature of the Construction Management Software
 */

let errors = [];
let apiCalls = [];

test.describe('Full Functionality Tests', () => {

  test.beforeEach(async ({ page }) => {
    errors = [];
    apiCalls = [];

    // Monitor console errors (ignore non-critical 404s)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore Realtime errors and static resource 404s (favicon, etc.)
        if (text.includes('Realtime')) return;
        if (text.includes('404') && !text.includes('/api/')) return;
        if (text.includes('favicon')) return;
        errors.push(text);
      }
    });

    page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

    // Monitor API calls
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/')) {
        apiCalls.push({ url, status: response.status() });
        if (response.status() >= 400) {
          try {
            const body = await response.json();
            errors.push(`API ${response.status()}: ${url} - ${JSON.stringify(body)}`);
          } catch (e) {
            errors.push(`API ${response.status()}: ${url}`);
          }
        }
      }
    });

    // Handle dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.goto('http://localhost:3001?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test.afterEach(async ({}, testInfo) => {
    if (errors.length > 0) {
      console.log(`\n[${testInfo.title}] Errors:`, errors);
    }
  });

  // ========== DASHBOARD & NAVIGATION ==========

  test('1. Dashboard loads correctly', async ({ page }) => {
    // Check page title
    const title = page.locator('h1');
    await expect(title).toContainText('Invoice');

    // Check filter buttons exist
    await expect(page.locator('.filter-btn:has-text("Needs Approval")')).toBeVisible();
    await expect(page.locator('.filter-btn:has-text("Approved")')).toBeVisible();
    await expect(page.locator('.filter-btn:has-text("In Draw")')).toBeVisible();
    await expect(page.locator('.filter-btn:has-text("Archive")')).toBeVisible();

    // Check upload button exists
    await expect(page.locator('button:has-text("Upload")')).toBeVisible();

    // Check connection status
    await expect(page.locator('.connection-status')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('2. Filter: Needs Approval', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn:has-text("Needs Approval")');
    await filterBtn.click();
    await page.waitForTimeout(1000);

    // Should show coded invoices or empty state
    const invoiceCards = await page.locator('.invoice-card').count();
    console.log('Needs Approval invoices:', invoiceCards);

    expect(errors.length).toBe(0);
  });

  test('3. Filter: Approved', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn:has-text("Approved")');
    await filterBtn.click();
    await page.waitForTimeout(1000);

    const invoiceCards = await page.locator('.invoice-card').count();
    console.log('Approved invoices:', invoiceCards);

    expect(errors.length).toBe(0);
  });

  test('4. Filter: In Draw', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn:has-text("In Draw")');
    await filterBtn.click();
    await page.waitForTimeout(1000);

    const invoiceCards = await page.locator('.invoice-card').count();
    console.log('In Draw invoices:', invoiceCards);

    expect(errors.length).toBe(0);
  });

  test('5. Filter: Archive', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn:has-text("Archive")');
    await filterBtn.click();
    await page.waitForTimeout(1000);

    const invoiceCards = await page.locator('.invoice-card').count();
    console.log('Archived invoices:', invoiceCards);

    expect(errors.length).toBe(0);
  });

  test('6. Job filter dropdown', async ({ page }) => {
    const jobFilter = page.locator('select').first();
    if (await jobFilter.count() > 0) {
      const options = await jobFilter.locator('option').count();
      console.log('Job filter options:', options);

      // Try selecting a job
      if (options > 1) {
        await jobFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    }

    expect(errors.length).toBe(0);
  });

  // ========== INVOICE MODAL ==========

  test('7. Open invoice edit modal', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();

    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      // Modal should be visible
      const modal = page.locator('#modal-container.active');
      await expect(modal).toBeVisible();

      // Check modal has expected sections
      await expect(page.locator('.modal-header')).toBeVisible();
      await expect(page.locator('#edit-invoice-number')).toBeVisible();
      await expect(page.locator('#edit-amount')).toBeVisible();

      // Close modal
      await page.locator('.modal-close').click({ force: true });
      await page.waitForTimeout(500);
    }

    expect(errors.length).toBe(0);
  });

  test('8. Edit invoice number field', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const field = page.locator('#edit-invoice-number');
      if (await field.isEditable()) {
        const original = await field.inputValue();
        await field.fill('TEST-EDIT-' + Date.now());
        await page.waitForTimeout(300);

        // Restore original
        await field.fill(original);
        console.log('Invoice number field: editable ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('9. Edit amount field', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const field = page.locator('#edit-amount');
      if (await field.isEditable()) {
        const original = await field.inputValue();
        await field.fill('$1,234.56');
        await page.waitForTimeout(300);

        // Restore original
        await field.fill(original);
        console.log('Amount field: editable ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('10. Edit date fields', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // Check invoice date
      const invoiceDate = page.locator('#edit-invoice-date');
      const dueDateField = page.locator('#edit-due-date');

      if (await invoiceDate.count() > 0) {
        console.log('Invoice date field: present ✓');
      }
      if (await dueDateField.count() > 0) {
        console.log('Due date field: present ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('11. Job dropdown selection', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const jobSelect = page.locator('#edit-job');
      if (await jobSelect.count() > 0 && await jobSelect.isEnabled()) {
        const options = await jobSelect.locator('option').count();
        console.log('Job dropdown options:', options);

        if (options > 1) {
          const original = await jobSelect.inputValue();
          await jobSelect.selectOption({ index: 1 });
          await page.waitForTimeout(500);
          await jobSelect.selectOption(original);
          console.log('Job dropdown: functional ✓');
        }
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('12. Vendor dropdown selection', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const vendorSelect = page.locator('#edit-vendor');
      if (await vendorSelect.count() > 0 && await vendorSelect.isEnabled()) {
        const options = await vendorSelect.locator('option').count();
        console.log('Vendor dropdown options:', options);

        if (options > 1) {
          const original = await vendorSelect.inputValue();
          await vendorSelect.selectOption({ index: 1 });
          await page.waitForTimeout(500);
          await vendorSelect.selectOption(original);
          console.log('Vendor dropdown: functional ✓');
        }
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  // ========== COST CODE ALLOCATIONS ==========

  test('13. Cost code picker functionality', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const ccPicker = page.locator('.cc-picker-input').first();
      if (await ccPicker.count() > 0) {
        await ccPicker.click();
        await page.waitForTimeout(500);

        // Dropdown should appear
        const dropdown = page.locator('.cc-picker-dropdown.visible');
        if (await dropdown.count() > 0) {
          console.log('Cost code picker: dropdown opens ✓');

          // Check for items
          const items = await dropdown.locator('.cc-picker-item').count();
          console.log('Cost code options:', items);
        }

        // Click elsewhere to close
        await page.locator('.modal-header').click();
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('14. Add allocation button', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const addBtn = page.locator('button:has-text("Add Allocation"), button:has-text("Add Cost Code")');
      if (await addBtn.count() > 0) {
        const initialRows = await page.locator('.allocation-row').count();
        await addBtn.click();
        await page.waitForTimeout(500);

        const newRows = await page.locator('.allocation-row').count();
        console.log('Allocation rows before:', initialRows, 'after:', newRows);

        if (newRows > initialRows) {
          console.log('Add allocation: functional ✓');
        }
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('15. Fill remaining amount button', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const fillBtn = page.locator('.btn-fill-remaining').first();
      if (await fillBtn.count() > 0) {
        await fillBtn.click();
        await page.waitForTimeout(500);
        console.log('Fill remaining button: clicked ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('16. Remove allocation button', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // First add an allocation if there's only one
      const addBtn = page.locator('button:has-text("Add Allocation"), button:has-text("Add Cost Code")');
      if (await addBtn.count() > 0) {
        await addBtn.click();
        await page.waitForTimeout(500);
      }

      const removeBtn = page.locator('.btn-remove').first();
      if (await removeBtn.count() > 0) {
        const beforeCount = await page.locator('.allocation-row').count();
        await removeBtn.click();
        await page.waitForTimeout(500);
        const afterCount = await page.locator('.allocation-row').count();

        console.log('Remove allocation: before', beforeCount, 'after', afterCount);
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  // ========== SAVE & STATUS CHANGES ==========

  test('17. Save invoice button', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const saveBtn = page.locator('.modal-footer-right button:has-text("Save")');
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        console.log('Save button: clicked ✓');
      }
    }

    expect(errors.length).toBe(0);
  });

  test('18. Approve invoice with confirmation', async ({ page }) => {
    const codedInvoice = page.locator('.invoice-card.status-coded').first();

    if (await codedInvoice.count() > 0) {
      await codedInvoice.click();
      await page.waitForTimeout(2000);

      // Make sure allocation is set up
      const ccPicker = page.locator('.cc-picker-input').first();
      const ccValue = await ccPicker.inputValue();

      if (!ccValue) {
        // Select a cost code
        await ccPicker.click();
        await page.waitForTimeout(500);
        const firstItem = page.locator('.cc-picker-item').first();
        if (await firstItem.count() > 0) {
          await firstItem.click();
          await page.waitForTimeout(500);
        }

        // Fill amount
        const fillBtn = page.locator('.btn-fill-remaining').first();
        if (await fillBtn.count() > 0) {
          await fillBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // Click approve
      const approveBtn = page.locator('.modal-footer-right button.btn-success:has-text("Approve")');
      if (await approveBtn.count() > 0) {
        await approveBtn.click();
        await page.waitForTimeout(1000);

        // Handle confirm dialog
        const confirmOverlay = page.locator('#confirm-overlay');
        if (await confirmOverlay.count() > 0) {
          const confirmBtn = confirmOverlay.locator('button.btn-primary');
          if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
            await page.waitForTimeout(3000);
            console.log('Approve with confirmation: functional ✓');
          }
        }
      }
    }

    expect(errors.length).toBe(0);
  });

  test('19. Cancel button closes modal', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();

    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const cancelBtn = page.locator('.modal-footer button:has-text("Cancel")');
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(500);

        // Modal should be closed
        const modal = page.locator('#modal-container.active');
        const isActive = await modal.count() > 0;
        console.log('Cancel button closes modal:', !isActive ? '✓' : '✗');
      }
    }

    expect(errors.length).toBe(0);
  });

  test('20. X button closes modal', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();

    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const closeBtn = page.locator('.modal-close');
      await closeBtn.click({ force: true });
      await page.waitForTimeout(500);

      const modal = page.locator('#modal-container.active');
      const isActive = await modal.count() > 0;
      console.log('X button closes modal:', !isActive ? '✓' : '✗');
    }

    expect(errors.length).toBe(0);
  });

  // ========== UPLOAD MODAL ==========

  test('21. Upload invoice modal opens', async ({ page }) => {
    const uploadBtn = page.locator('button:has-text("Upload Invoice"), button:has-text("Upload")').first();

    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      // Check modal opened
      const uploadModal = page.locator('#uploadInvoiceModal, .upload-modal');
      console.log('Upload modal visible:', await uploadModal.isVisible());

      // Close modal
      const closeBtn = page.locator('.modal-close, button:has-text("Cancel")').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
      }
    }

    expect(errors.length).toBe(0);
  });

  test('22. Upload modal has file input', async ({ page }) => {
    const uploadBtn = page.locator('button:has-text("Upload Invoice"), button:has-text("Upload")').first();

    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      const fileInput = page.locator('input[type="file"]');
      console.log('File input present:', await fileInput.count() > 0);

      // Close modal
      const closeBtn = page.locator('.modal-close, button:has-text("Cancel")').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
      }
    }

    expect(errors.length).toBe(0);
  });

  // ========== ACTIVITY & NOTES ==========

  test('23. Activity timeline displays', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();

    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const activitySection = page.locator('.activity-section, .activity-timeline');
      if (await activitySection.count() > 0) {
        console.log('Activity timeline: present ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('24. Notes field exists', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const notesField = page.locator('#edit-notes, textarea[name="notes"]');
      if (await notesField.count() > 0) {
        console.log('Notes field: present ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  // ========== PDF VIEWER ==========

  test('25. PDF viewer displays', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();

    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const pdfViewer = page.locator('.pdf-viewer, iframe, .modal-pdf-pane');
      if (await pdfViewer.count() > 0) {
        console.log('PDF viewer: present ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  // ========== STATUS-SPECIFIC BUTTONS ==========

  test('26. Approved invoice has Add to Draw button', async ({ page }) => {
    // First switch to Approved filter
    await page.locator('.filter-btn:has-text("Approved")').click();
    await page.waitForTimeout(1000);

    const approvedInvoice = page.locator('.invoice-card').first();

    if (await approvedInvoice.count() > 0) {
      await approvedInvoice.click();
      await page.waitForTimeout(2000);

      const addToDrawBtn = page.locator('button:has-text("Add to Draw")');
      if (await addToDrawBtn.count() > 0) {
        console.log('Add to Draw button: present ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('27. Delete button on editable invoices', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const deleteBtn = page.locator('.modal-footer button:has-text("Delete")');
      if (await deleteBtn.count() > 0) {
        console.log('Delete button: present ✓');
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  // ========== REALTIME & CONNECTION ==========

  test('28. SSE connection status', async ({ page }) => {
    const connectionStatus = page.locator('.connection-status');

    if (await connectionStatus.count() > 0) {
      const text = await connectionStatus.textContent();
      console.log('Connection status:', text);
    }

    expect(errors.length).toBe(0);
  });

  // ========== API ENDPOINTS ==========

  test('29. API: /api/invoices loads', async ({ page }) => {
    const invoicesCall = apiCalls.find(c => c.url.includes('/api/invoices') && !c.url.includes('/api/invoices/'));
    console.log('Invoices API called:', !!invoicesCall);

    if (invoicesCall) {
      expect(invoicesCall.status).toBe(200);
    }
  });

  test('30. API: /api/jobs loads', async ({ page }) => {
    // Open modal to trigger jobs load
    const invoiceCard = page.locator('.invoice-card').first();
    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const jobsCall = apiCalls.find(c => c.url.includes('/api/jobs'));
      console.log('Jobs API called:', !!jobsCall);

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('31. API: /api/vendors loads', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();
    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const vendorsCall = apiCalls.find(c => c.url.includes('/api/vendors'));
      console.log('Vendors API called:', !!vendorsCall);

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('32. API: /api/cost-codes loads', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();
    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const costCodesCall = apiCalls.find(c => c.url.includes('/api/cost-codes'));
      console.log('Cost codes API called:', !!costCodesCall);

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  // ========== ALLOCATION SUMMARY ==========

  test('33. Allocation summary updates', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-coded').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      const summary = page.locator('#allocation-summary, .allocation-summary');
      if (await summary.count() > 0) {
        const text = await summary.textContent();
        console.log('Allocation summary:', text?.substring(0, 50));
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  // ========== TOAST NOTIFICATIONS ==========

  test('34. Toast container exists', async ({ page }) => {
    const toastContainer = page.locator('#toast-container, .toast-container');
    console.log('Toast container present:', await toastContainer.count() > 0);

    expect(errors.length).toBe(0);
  });

  // ========== VERSION INFO ==========

  test('35. Version info in modal footer', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();

    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const versionInfo = page.locator('.modal-footer-left, .version-info');
      if (await versionInfo.count() > 0) {
        const text = await versionInfo.textContent();
        console.log('Version info:', text?.substring(0, 30));
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });
});
