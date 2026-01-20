const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Upload Debug Tests', () => {
  let consoleErrors = [];
  let consoleWarnings = [];
  let consoleLogs = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    consoleLogs = [];

    // Capture all console output
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log('CONSOLE ERROR:', text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
        console.log('CONSOLE WARNING:', text);
      } else {
        consoleLogs.push(text);
        console.log('CONSOLE LOG:', text);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(`PAGE ERROR: ${error.message}`);
      console.log('PAGE ERROR:', error.message);
    });

    // Capture request failures
    page.on('requestfailed', request => {
      console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
    });
  });

  test('Invoice page - Click Upload button', async ({ page }) => {
    console.log('=== Testing Invoice Page Upload ===');

    await page.goto('http://localhost:3001/index.html');
    await page.waitForLoadState('domcontentloaded');

    console.log('Page loaded, waiting for content...');

    // Wait for page to be ready
    await page.waitForTimeout(1000);

    // Check if upload button exists
    const uploadBtn = page.locator('button:has-text("Upload")');
    const btnCount = await uploadBtn.count();
    console.log(`Found ${btnCount} upload button(s)`);

    if (btnCount === 0) {
      console.log('ERROR: No upload button found!');
      // Take screenshot
      await page.screenshot({ path: 'tests/screenshots/no-upload-btn.png' });
      return;
    }

    // Click the upload button
    console.log('Clicking upload button...');
    await uploadBtn.first().click();

    console.log('Clicked upload button, waiting...');
    await page.waitForTimeout(500);

    // Check if modal opened
    const modal = page.locator('#universalUploadModal');
    const isVisible = await modal.isVisible();
    console.log(`Modal visible: ${isVisible}`);

    if (!isVisible) {
      console.log('ERROR: Modal did not open!');
      await page.screenshot({ path: 'tests/screenshots/modal-not-open.png' });
    } else {
      console.log('SUCCESS: Modal opened');
      await page.screenshot({ path: 'tests/screenshots/modal-opened.png' });
    }

    // Print any console errors
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors Found ===');
      consoleErrors.forEach(e => console.log(e));
    } else {
      console.log('No console errors detected');
    }

    expect(isVisible).toBe(true);
  });

  test('Invoice page - Full upload flow with test PDF', async ({ page }) => {
    console.log('=== Testing Full Upload Flow ===');

    await page.goto('http://localhost:3001/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click upload button
    const uploadBtn = page.locator('button:has-text("Upload")');
    await uploadBtn.first().click();
    await page.waitForTimeout(500);

    // Check modal
    const modal = page.locator('#universalUploadModal');
    const isVisible = await modal.isVisible();
    console.log(`Modal visible: ${isVisible}`);

    if (!isVisible) {
      console.log('Modal did not open, cannot continue test');
      await page.screenshot({ path: 'tests/screenshots/upload-flow-failed.png' });
      expect(isVisible).toBe(true);
      return;
    }

    // Create a simple test PDF file
    const testPdfPath = path.join(__dirname, 'test-invoice.pdf');

    // Check if we have a test PDF, if not create a minimal one
    if (!fs.existsSync(testPdfPath)) {
      console.log('Creating test PDF...');
      // Minimal valid PDF
      const minimalPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n172\n%%EOF',
        'utf-8'
      );
      fs.writeFileSync(testPdfPath, minimalPdf);
    }

    // Find file input and upload
    const fileInput = page.locator('#universalPdfFile');
    console.log('Uploading test file...');

    // Set file with timeout protection
    const uploadPromise = fileInput.setInputFiles(testPdfPath);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('File upload timed out after 10s')), 10000)
    );

    try {
      await Promise.race([uploadPromise, timeoutPromise]);
      console.log('File selected successfully');
    } catch (e) {
      console.log('ERROR during file selection:', e.message);
      await page.screenshot({ path: 'tests/screenshots/file-select-error.png' });

      // Print any console errors
      if (consoleErrors.length > 0) {
        console.log('\n=== Console Errors ===');
        consoleErrors.forEach(e => console.log(e));
      }
      throw e;
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/after-file-select.png' });

    // Check if Process button is enabled
    const processBtn = page.locator('#processDocumentBtn');
    const isDisabled = await processBtn.isDisabled();
    console.log(`Process button disabled: ${isDisabled}`);

    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors Found ===');
      consoleErrors.forEach(e => console.log(e));
    }
  });

  test('Invoice page - Click Process Document button', async ({ page }) => {
    console.log('=== Testing Process Document Click ===');

    await page.goto('http://localhost:3001/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click upload button
    const uploadBtn = page.locator('button:has-text("Upload")');
    await uploadBtn.first().click();
    await page.waitForTimeout(500);

    // Check modal
    const modal = page.locator('#universalUploadModal');
    const isVisible = await modal.isVisible();
    console.log(`Modal visible: ${isVisible}`);

    if (!isVisible) {
      console.log('Modal did not open');
      return;
    }

    // Create test PDF
    const fs = require('fs');
    const path = require('path');
    const testPdfPath = path.join(__dirname, 'test-invoice.pdf');
    if (!fs.existsSync(testPdfPath)) {
      const minimalPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n172\n%%EOF',
        'utf-8'
      );
      fs.writeFileSync(testPdfPath, minimalPdf);
    }

    // Upload file
    const fileInput = page.locator('#universalPdfFile');
    await fileInput.setInputFiles(testPdfPath);
    await page.waitForTimeout(1000);
    console.log('File selected');

    // Take screenshot before clicking Process
    await page.screenshot({ path: 'tests/screenshots/before-process-click.png' });

    // Click Process Document
    const processBtn = page.locator('#processDocumentBtn');
    const isDisabled = await processBtn.isDisabled();
    console.log(`Process button disabled: ${isDisabled}`);

    if (!isDisabled) {
      console.log('Clicking Process Document...');

      // Start listening for network requests
      const requestPromise = page.waitForRequest(req =>
        req.url().includes('/api/documents/process'),
        { timeout: 5000 }
      ).catch(() => null);

      await processBtn.click();
      console.log('Process button clicked');

      // Wait a moment
      await page.waitForTimeout(2000);

      // Check if request was made
      const request = await requestPromise;
      if (request) {
        console.log('API request was made to:', request.url());
      } else {
        console.log('WARNING: No API request detected!');
      }

      await page.screenshot({ path: 'tests/screenshots/after-process-click.png' });

      // Check for any visible errors or status changes
      const statusDiv = page.locator('#universalProcessingStatus');
      const statusVisible = await statusDiv.isVisible();
      console.log(`Processing status visible: ${statusVisible}`);
    }

    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach(e => console.log(e));
    }
  });

  test('Lien Releases page - Click Upload button', async ({ page }) => {
    console.log('=== Testing Lien Releases Upload ===');

    await page.goto('http://localhost:3001/lien-releases.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check if upload button exists
    const uploadBtn = page.locator('button:has-text("Upload")');
    const btnCount = await uploadBtn.count();
    console.log(`Found ${btnCount} upload button(s)`);

    if (btnCount === 0) {
      console.log('ERROR: No upload button found!');
      await page.screenshot({ path: 'tests/screenshots/lien-no-upload-btn.png' });
      return;
    }

    // Click the upload button
    console.log('Clicking upload button...');
    await uploadBtn.first().click();

    await page.waitForTimeout(500);

    // Check if modal opened
    const modal = page.locator('#uploadModal');
    const isVisible = await modal.isVisible();
    console.log(`Modal visible: ${isVisible}`);

    if (!isVisible) {
      console.log('ERROR: Modal did not open!');
      await page.screenshot({ path: 'tests/screenshots/lien-modal-not-open.png' });
    } else {
      console.log('SUCCESS: Modal opened');
      await page.screenshot({ path: 'tests/screenshots/lien-modal-opened.png' });
    }

    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors Found ===');
      consoleErrors.forEach(e => console.log(e));
    }

    expect(isVisible).toBe(true);
  });

  test('Check JavaScript loading on index page', async ({ page }) => {
    console.log('=== Checking JS Loading ===');

    const responses = [];
    page.on('response', response => {
      if (response.url().includes('.js')) {
        responses.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    await page.goto('http://localhost:3001/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    console.log('\nJS Files loaded:');
    responses.forEach(r => {
      console.log(`  ${r.status} - ${r.url.split('/').pop()}`);
    });

    // Check for any 404s
    const failures = responses.filter(r => r.status !== 200);
    if (failures.length > 0) {
      console.log('\nFAILED to load:');
      failures.forEach(f => console.log(`  ${f.status} - ${f.url}`));
    }

    // Check that key functions exist
    const hasShowUniversalUploadModal = await page.evaluate(() => {
      return typeof window.showUniversalUploadModal === 'function';
    });
    console.log(`showUniversalUploadModal exists: ${hasShowUniversalUploadModal}`);

    const hasHandleUniversalFileSelect = await page.evaluate(() => {
      return typeof window.handleUniversalFileSelect === 'function';
    });
    console.log(`handleUniversalFileSelect exists: ${hasHandleUniversalFileSelect}`);

    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach(e => console.log(e));
    }

    expect(failures.length).toBe(0);
  });
});
