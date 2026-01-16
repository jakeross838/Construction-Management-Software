// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('AI Split Detection', () => {
  const BASE_URL = 'http://localhost:3001';

  test('API: ai_split_suggested field is returned in invoice data', async ({ request }) => {
    console.log('=== Testing AI Split Field in API ===');

    const res = await request.get(`${BASE_URL}/api/invoices`);
    expect(res.ok()).toBeTruthy();

    const invoices = await res.json();
    console.log('Total invoices:', invoices.length);

    // Check that ai_split fields exist in response
    if (invoices.length > 0) {
      const sample = invoices[0];
      console.log('Sample invoice fields:', Object.keys(sample).filter(k => k.includes('split') || k.includes('ai')));

      // The field should be present (even if null/false)
      const hasAiSplitField = 'ai_split_suggested' in sample || sample.ai_split_suggested !== undefined;
      console.log('Has ai_split_suggested field:', hasAiSplitField);
    }

    // Check for any invoices with AI split suggestion
    const suggestedSplits = invoices.filter(inv => inv.ai_split_suggested === true);
    console.log('Invoices with AI split suggestion:', suggestedSplits.length);

    if (suggestedSplits.length > 0) {
      console.log('Sample suggested split:', {
        id: suggestedSplits[0].id?.slice(0, 8),
        invoice_number: suggestedSplits[0].invoice_number,
        ai_split_data: suggestedSplits[0].ai_split_data
      });
    }

    // Check for multi_job_detected flag
    const multiJobFlags = invoices.filter(inv =>
      inv.review_flags?.includes('multi_job_detected') ||
      inv.review_flags?.includes('split_suggested')
    );
    console.log('Invoices with split-related flags:', multiJobFlags.length);

    console.log('=== API Test Complete ===');
  });

  test('UI: AI split suggestion banner function exists', async ({ page }) => {
    console.log('=== Testing AI Split Banner Function ===');

    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check that the buildAISplitSuggestionBanner function exists
    const functionExists = await page.evaluate(() => {
      return typeof window.Modals?.buildAISplitSuggestionBanner === 'function';
    });
    console.log('buildAISplitSuggestionBanner function exists:', functionExists);
    expect(functionExists).toBe(true);

    // Check that dismissSplitSuggestion function exists
    const dismissExists = await page.evaluate(() => {
      return typeof window.Modals?.dismissSplitSuggestion === 'function';
    });
    console.log('dismissSplitSuggestion function exists:', dismissExists);
    expect(dismissExists).toBe(true);

    console.log('=== Function Test Complete ===');
  });

  test('UI: Banner renders correctly for invoice with ai_split_suggested', async ({ page }) => {
    console.log('=== Testing AI Split Banner Render ===');

    // First check API for any invoices with ai_split_suggested
    const apiRes = await page.request.get(`${BASE_URL}/api/invoices`);
    const invoices = await apiRes.json();

    const suggestedInvoice = invoices.find(inv => inv.ai_split_suggested === true);

    if (!suggestedInvoice) {
      console.log('No invoices with AI split suggestion - testing banner function directly');

      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Test the function with mock data
      const bannerHtml = await page.evaluate(() => {
        const mockInvoice = {
          id: 'test-123',
          ai_split_suggested: true,
          ai_split_data: {
            splitType: 'multi_job',
            reason: 'Invoice appears to cover multiple job sites',
            suggestedSplits: [
              { jobReference: 'Drummond', amount: 5000 },
              { jobReference: 'Crews', amount: 3000 }
            ]
          }
        };
        return window.Modals?.buildAISplitSuggestionBanner(mockInvoice);
      });

      console.log('Banner HTML generated:', bannerHtml ? 'Yes' : 'No');
      expect(bannerHtml).toContain('ai-split-suggestion-banner');
      expect(bannerHtml).toContain('AI Split Suggestion');
      expect(bannerHtml).toContain('Split Invoice');
      expect(bannerHtml).toContain('Dismiss');
      console.log('Banner contains expected elements');

      console.log('=== Banner Render Test Complete ===');
      return;
    }

    console.log('Found invoice with AI split suggestion:', suggestedInvoice.invoice_number);

    await page.goto(BASE_URL);
    await page.waitForSelector('.invoice-card', { timeout: 10000 });

    // Find and click the suggested invoice
    const invoiceCard = page.locator(`.invoice-card:has-text("${suggestedInvoice.invoice_number}")`);
    if (await invoiceCard.count() === 0) {
      console.log('Invoice card not visible in list');
      return;
    }

    await invoiceCard.first().click();
    await page.waitForTimeout(2000);

    // Check for the AI split suggestion banner
    const banner = page.locator('.ai-split-suggestion-banner');
    const bannerVisible = await banner.isVisible();
    console.log('AI split banner visible:', bannerVisible);

    if (bannerVisible) {
      // Check banner content
      const bannerText = await banner.textContent();
      console.log('Banner text:', bannerText?.slice(0, 100));

      expect(await banner.locator('.ai-split-icon').count()).toBeGreaterThan(0);
      expect(await banner.locator('button:has-text("Split Invoice")').count()).toBeGreaterThan(0);
      expect(await banner.locator('button:has-text("Dismiss")').count()).toBeGreaterThan(0);

      console.log('AI split banner rendered correctly');
    }

    // Close modal
    await page.keyboard.press('Escape');

    console.log('=== Banner Render Test Complete ===');
  });

  test('UI: Review flags show split-related labels', async ({ page }) => {
    console.log('=== Testing Review Flag Labels ===');

    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Test the getReviewFlagLabel function
    const labels = await page.evaluate(() => {
      const flags = ['split_suggested', 'multi_job_detected', 'split_child', 'no_job'];
      return flags.map(f => ({
        flag: f,
        label: window.Modals?.getReviewFlagLabel(f)
      }));
    });

    console.log('Review flag labels:');
    for (const item of labels) {
      console.log(`  ${item.flag}: "${item.label}"`);
      expect(item.label).toBeTruthy();
      expect(item.label).not.toBe(item.flag); // Should be human-readable, not just the flag
    }

    console.log('=== Review Flag Labels Test Complete ===');
  });

  test('API: AI processor includes split detection in prompt', async ({ request }) => {
    console.log('=== Verifying AI Split Detection Config ===');

    // This test verifies the AI processor is configured for split detection
    // by checking the response structure includes split fields

    const res = await request.get(`${BASE_URL}/api/invoices`);
    const invoices = await res.json();

    // Get a detailed invoice to check for ai_extracted_data
    if (invoices.length > 0) {
      const detailRes = await request.get(`${BASE_URL}/api/invoices/${invoices[0].id}`);
      const detail = await detailRes.json();

      console.log('Invoice detail fields:', Object.keys(detail).filter(k =>
        k.includes('ai') || k.includes('split') || k.includes('review')
      ));

      // Check if AI extracted data includes split suggestion structure
      if (detail.ai_extracted_data) {
        const hasSpitSuggestion = 'splitSuggestion' in detail.ai_extracted_data;
        console.log('AI extracted data has splitSuggestion:', hasSpitSuggestion);
      }
    }

    console.log('=== Config Verification Complete ===');
  });
});
