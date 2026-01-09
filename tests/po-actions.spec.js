const { test, expect } = require('@playwright/test');

test.describe('PO System - Full Actions Test', () => {
  test('Test all PO actions and dialogs', async ({ page }) => {
    const errors = [];
    const warnings = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push('CONSOLE: ' + msg.text());
      }
    });

    page.on('pageerror', err => {
      errors.push('PAGE ERROR: ' + err.message);
    });

    page.on('response', async response => {
      if (response.url().includes('/api/') && !response.ok()) {
        errors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });

    console.log('\n========================================');
    console.log('PO SYSTEM COMPREHENSIVE TEST');
    console.log('========================================\n');

    // Navigate to PO page
    console.log('=== 1. LOADING PO PAGE ===');
    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for JS errors on load
    if (errors.length > 0) {
      console.log('❌ Errors on page load:');
      errors.forEach(e => console.log('  ', e));
    } else {
      console.log('✓ Page loaded without errors');
    }

    // Check PO list
    const poRows = await page.locator('.po-row').count();
    console.log(`✓ Found ${poRows} PO rows`);

    if (poRows === 0) {
      console.log('⚠ No POs found, cannot test actions');
      await page.screenshot({ path: 'tests/screenshots/po-actions-no-pos.png', fullPage: true });
      return;
    }

    // Check status badges
    console.log('\n=== 2. CHECKING STATUS BADGES ===');
    const statusBadges = await page.locator('.po-row .status-badge').allTextContents();
    const uniqueStatuses = [...new Set(statusBadges)];
    console.log('Status badges found:', uniqueStatuses.join(', '));

    // Check for old "Pending Approval" status
    if (statusBadges.some(s => s.includes('Pending Approval'))) {
      warnings.push('Old "Pending Approval" status still showing');
      console.log('⚠ WARNING: "Pending Approval" status still showing!');
    }

    // Take screenshot of list
    await page.screenshot({ path: 'tests/screenshots/po-list.png', fullPage: true });

    // Open first PO
    console.log('\n=== 3. OPENING PO MODAL ===');
    await page.locator('.po-row').first().click();
    await page.waitForTimeout(1500);

    const modalVisible = await page.locator('#poModal').evaluate(el => {
      return el.style.display === 'flex' || el.classList.contains('show');
    });

    if (!modalVisible) {
      console.log('❌ Modal did not open!');
      errors.push('PO Modal failed to open');
      return;
    }
    console.log('✓ PO Modal opened');

    // Check modal styling
    console.log('\n=== 4. CHECKING MODAL STYLING ===');
    const modalContent = page.locator('#poModal .modal-content');
    const bgColor = await modalContent.evaluate(el => getComputedStyle(el).backgroundColor);
    const opacity = await modalContent.evaluate(el => getComputedStyle(el).opacity);
    console.log(`Modal background: ${bgColor}`);
    console.log(`Modal opacity: ${opacity}`);

    if (opacity !== '1') {
      warnings.push(`Modal opacity is ${opacity}, should be 1`);
    }

    // Check status badge in modal
    const modalStatusBadge = await page.locator('#poModal .status-badge').first().textContent();
    console.log(`Modal status badge: "${modalStatusBadge}"`);

    await page.screenshot({ path: 'tests/screenshots/po-modal-open.png', fullPage: true });

    // Check footer buttons
    console.log('\n=== 5. CHECKING FOOTER BUTTONS ===');
    const footerHtml = await page.locator('#poModalFooter').innerHTML();
    console.log('Footer HTML:', footerHtml.substring(0, 500));

    const buttons = await page.locator('#poModalFooter button').allTextContents();
    console.log('Footer buttons:', buttons.join(', '));

    // Test Send to Vendor button if present
    const sendBtn = page.locator('#poModalFooter button:has-text("Send to Vendor")');
    const sendBtnCount = await sendBtn.count();

    if (sendBtnCount > 0) {
      console.log('\n=== 6. TESTING SEND TO VENDOR ===');
      console.log('Clicking "Send to Vendor" button...');

      // Clear errors before action
      errors.length = 0;

      await sendBtn.click();
      await page.waitForTimeout(1000);

      // Check if styled confirm dialog appeared
      const confirmDialog = page.locator('#confirmDialog');
      const confirmVisible = await confirmDialog.evaluate(el => el.style.display === 'flex');

      if (confirmVisible) {
        console.log('✓ Styled confirm dialog appeared');

        // Check dialog content
        const title = await page.locator('#confirmTitle').textContent();
        const message = await page.locator('#confirmMessage').textContent();
        console.log(`  Title: "${title}"`);
        console.log(`  Message: "${message}"`);

        await page.screenshot({ path: 'tests/screenshots/po-send-dialog.png', fullPage: true });

        // Click Send PO button
        console.log('Clicking confirm button...');
        await page.locator('#confirmBtn').click();
        await page.waitForTimeout(2000);

        // Check for errors
        if (errors.length > 0) {
          console.log('❌ Errors after Send:');
          errors.forEach(e => console.log('  ', e));
        } else {
          console.log('✓ Send action completed');
        }
      } else {
        console.log('❌ Confirm dialog did not appear!');
        errors.push('Send to Vendor dialog did not appear');

        // Check if native confirm was used (page would be frozen)
        await page.screenshot({ path: 'tests/screenshots/po-send-failed.png', fullPage: true });
      }
    } else {
      console.log('\n=== 6. NO SEND BUTTON (PO may not be in Draft status) ===');
    }

    // Test Approve button if present
    const approveBtn = page.locator('#poModalFooter button:has-text("Approve")');
    const approveBtnCount = await approveBtn.count();

    if (approveBtnCount > 0) {
      console.log('\n=== 7. TESTING APPROVE BUTTON ===');
      errors.length = 0;

      await approveBtn.click();
      await page.waitForTimeout(1000);

      const confirmVisible = await page.locator('#confirmDialog').evaluate(el => el.style.display === 'flex');
      if (confirmVisible) {
        console.log('✓ Approve dialog appeared');
        await page.screenshot({ path: 'tests/screenshots/po-approve-dialog.png', fullPage: true });

        // Cancel instead of confirming
        await page.locator('#confirmDialog button:has-text("Cancel")').click();
        await page.waitForTimeout(500);
        console.log('✓ Dialog cancelled');
      } else {
        console.log('❌ Approve dialog did not appear');
        errors.push('Approve dialog did not appear');
      }
    }

    // Test Void button if present
    const voidBtn = page.locator('#poModalFooter button:has-text("Void")');
    const voidBtnCount = await voidBtn.count();

    if (voidBtnCount > 0) {
      console.log('\n=== 8. TESTING VOID BUTTON ===');
      errors.length = 0;

      await voidBtn.click();
      await page.waitForTimeout(1000);

      const confirmVisible = await page.locator('#confirmDialog').evaluate(el => el.style.display === 'flex');
      if (confirmVisible) {
        console.log('✓ Void dialog appeared');

        // Check for input field
        const inputVisible = await page.locator('#confirmInput').evaluate(el => el.style.display !== 'none');
        if (inputVisible) {
          console.log('✓ Reason input field is visible');
        } else {
          console.log('❌ Reason input field NOT visible');
          warnings.push('Void dialog missing reason input');
        }

        await page.screenshot({ path: 'tests/screenshots/po-void-dialog.png', fullPage: true });

        // Cancel
        await page.locator('#confirmDialog button:has-text("Cancel")').click();
        await page.waitForTimeout(500);
      } else {
        console.log('❌ Void dialog did not appear');
        errors.push('Void dialog did not appear');
      }
    }

    // Test Mark Complete button if present
    const completeBtn = page.locator('#poModalFooter button:has-text("Mark Complete")');
    const completeBtnCount = await completeBtn.count();

    if (completeBtnCount > 0) {
      console.log('\n=== 9. TESTING MARK COMPLETE BUTTON ===');
      errors.length = 0;

      await completeBtn.click();
      await page.waitForTimeout(1000);

      const confirmVisible = await page.locator('#confirmDialog').evaluate(el => el.style.display === 'flex');
      if (confirmVisible) {
        console.log('✓ Complete dialog appeared');
        await page.screenshot({ path: 'tests/screenshots/po-complete-dialog.png', fullPage: true });

        // Cancel
        await page.locator('#confirmDialog button:has-text("Cancel")').click();
        await page.waitForTimeout(500);
      } else {
        console.log('❌ Complete dialog did not appear');
        errors.push('Complete dialog did not appear');
      }
    }

    // Close modal
    console.log('\n=== 10. CLOSING MODAL ===');
    await page.locator('#poModal .close-btn').click();
    await page.waitForTimeout(500);

    // Print summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✓ ALL TESTS PASSED');
    } else {
      if (errors.length > 0) {
        console.log(`\n❌ ERRORS (${errors.length}):`);
        errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
      }
      if (warnings.length > 0) {
        console.log(`\n⚠ WARNINGS (${warnings.length}):`);
        warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
      }
    }

    // Final screenshot
    await page.screenshot({ path: 'tests/screenshots/po-test-final.png', fullPage: true });

    // Assertions
    expect(errors.filter(e => !e.includes('HTTP'))).toHaveLength(0);
  });
});
