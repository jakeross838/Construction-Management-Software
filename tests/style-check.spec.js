const { test, expect } = require('@playwright/test');

test.describe('Style Consistency Check', () => {
  test.setTimeout(120000); // 2 minute timeout

  test('Capture screenshots of all UI areas for style review', async ({ page }) => {
    // Create screenshots directory
    const screenshotDir = 'tests/screenshots/style-check';

    console.log('\n========================================');
    console.log('STYLE CONSISTENCY CHECK');
    console.log('========================================\n');

    // Navigate to invoices page
    await page.goto('http://localhost:3001?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 1. Main invoice list page
    console.log('1. Capturing main invoice list...');
    await page.screenshot({ path: `${screenshotDir}/01-invoice-list.png`, fullPage: true });

    // 2. Open invoice modal
    console.log('2. Opening invoice modal...');
    const invoiceCards = await page.locator('.invoice-card').count();
    if (invoiceCards > 0) {
      await page.locator('.invoice-card').first().click();
      await page.waitForTimeout(2000);

      // Full modal screenshot
      await page.screenshot({ path: `${screenshotDir}/02-invoice-modal-full.png`, fullPage: true });

      // Form panel area
      const formPanel = page.locator('.form-panel').first();
      if (await formPanel.count() > 0 && await formPanel.isVisible()) {
        await formPanel.screenshot({ path: `${screenshotDir}/03-form-panel.png` });
      }

      // Budget standing section
      const budgetSection = page.locator('.budget-standing-section').first();
      if (await budgetSection.count() > 0 && await budgetSection.isVisible()) {
        await budgetSection.screenshot({ path: `${screenshotDir}/04-budget-standing.png` });
        console.log('   - Budget standing section found');
      } else {
        console.log('   - No budget standing section');
      }

      // Activity section
      const activitySection = page.locator('.activity-section').first();
      if (await activitySection.count() > 0 && await activitySection.isVisible()) {
        await activitySection.screenshot({ path: `${screenshotDir}/05-activity-section.png` });
      }

      // Allocation section
      const allocationSection = page.locator('.allocation-section, .allocations-form-section').first();
      if (await allocationSection.count() > 0 && await allocationSection.isVisible()) {
        await allocationSection.screenshot({ path: `${screenshotDir}/06-allocation-section.png` });
      }

      // Modal footer buttons - skip if not visible
      const modalFooter = page.locator('.modal-footer').first();
      if (await modalFooter.count() > 0 && await modalFooter.isVisible()) {
        await modalFooter.screenshot({ path: `${screenshotDir}/07-modal-footer.png` });
      }

      // Close modal
      await page.locator('.modal-close').first().click();
      await page.waitForTimeout(500);
    }

    // 3. Upload invoice modal
    console.log('3. Opening upload invoice modal...');
    const uploadBtn = page.locator('button:has-text("Upload Invoice")');
    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/08-upload-modal.png`, fullPage: true });

      // Close upload modal
      await page.locator('#uploadInvoiceModal .close-btn').click();
      await page.waitForTimeout(500);
    }

    // 4. Navigate to POs page
    console.log('4. Checking POs page...');
    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/09-po-list.png`, fullPage: true });

    // Open PO modal if there are POs
    const poCards = await page.locator('.po-card').count();
    if (poCards > 0) {
      await page.locator('.po-card').first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/10-po-modal.png`, fullPage: true });

      // Close PO modal
      const closeBtn = page.locator('.modal-close, .close-btn').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 5. Navigate to Draws page
    console.log('5. Checking Draws page...');
    await page.goto('http://localhost:3001/draws.html?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/11-draws-list.png`, fullPage: true });

    // Open draw modal if there are draws
    const drawCards = await page.locator('.draw-card').count();
    if (drawCards > 0) {
      await page.locator('.draw-card').first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/12-draw-modal.png`, fullPage: true });
    }

    // 6. Navigate to Budgets page
    console.log('6. Checking Budgets page...');
    await page.goto('http://localhost:3001/budgets.html?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/13-budgets-page.png`, fullPage: true });

    console.log('\n========================================');
    console.log('SCREENSHOTS CAPTURED');
    console.log(`Location: ${screenshotDir}/`);
    console.log('========================================\n');

    // Now analyze the CSS for issues
    console.log('ANALYZING STYLES...\n');

    // Go back to invoice page and check specific style issues
    await page.goto('http://localhost:3001?cachebust=' + Date.now());
    await page.waitForTimeout(2000);

    // Check computed styles on invoice cards
    const cardStyles = await page.evaluate(() => {
      const card = document.querySelector('.invoice-card');
      if (!card) return null;
      const styles = window.getComputedStyle(card);
      return {
        background: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        border: styles.border
      };
    });
    console.log('Invoice Card Styles:', cardStyles);

    // Open modal and check form panel styles
    if (invoiceCards > 0) {
      await page.locator('.invoice-card').first().click();
      await page.waitForTimeout(2000);

      // Check form panel computed styles
      const formPanelStyles = await page.evaluate(() => {
        const panel = document.querySelector('.form-panel');
        if (!panel) return null;
        const styles = window.getComputedStyle(panel);
        return {
          background: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding
        };
      });
      console.log('Form Panel Styles:', formPanelStyles);

      // Check form section styles
      const formSectionStyles = await page.evaluate(() => {
        const section = document.querySelector('.form-panel .form-section');
        if (!section) return null;
        const styles = window.getComputedStyle(section);
        return {
          background: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding,
          border: styles.border
        };
      });
      console.log('Form Section Styles:', formSectionStyles);

      // Check input styles
      const inputStyles = await page.evaluate(() => {
        const input = document.querySelector('.form-panel input[type="text"]');
        if (!input) return null;
        const styles = window.getComputedStyle(input);
        return {
          background: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding,
          border: styles.border,
          color: styles.color,
          fontSize: styles.fontSize
        };
      });
      console.log('Input Styles:', inputStyles);

      // Check budget standing styles
      const budgetStyles = await page.evaluate(() => {
        const section = document.querySelector('.budget-standing-section');
        if (!section) return null;
        const styles = window.getComputedStyle(section);
        return {
          background: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding,
          border: styles.border
        };
      });
      console.log('Budget Standing Styles:', budgetStyles);

      // Check button styles
      const btnStyles = await page.evaluate(() => {
        const btn = document.querySelector('.modal-footer .btn-primary');
        if (!btn) return null;
        const styles = window.getComputedStyle(btn);
        return {
          background: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight
        };
      });
      console.log('Button Styles:', btnStyles);

      // Check for any inline styles that shouldn't be there
      const inlineStyleElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('[style]');
        const issues = [];
        elements.forEach(el => {
          const style = el.getAttribute('style');
          if (style && style.length > 0) {
            // Ignore display:none and similar simple ones
            if (!style.match(/^display:\s*(none|flex|block);?$/)) {
              issues.push({
                tag: el.tagName,
                class: el.className,
                style: style.substring(0, 100)
              });
            }
          }
        });
        return issues.slice(0, 20); // First 20
      });

      if (inlineStyleElements.length > 0) {
        console.log('\nINLINE STYLES FOUND (potential issues):');
        inlineStyleElements.forEach((el, i) => {
          console.log(`  ${i+1}. <${el.tag} class="${el.class}"> style="${el.style}"`);
        });
      }

      // Check for hardcoded colors in elements
      const colorIssues = await page.evaluate(() => {
        const issues = [];
        const elements = document.querySelectorAll('*');
        const lightThemeColors = ['#ffffff', '#f6f7fb', '#323338', '#676879', '#e6e9ef', '#c5c7d0', 'rgb(255, 255, 255)', 'rgb(246, 247, 251)', 'rgb(50, 51, 56)'];

        elements.forEach(el => {
          const styles = window.getComputedStyle(el);
          const bg = styles.backgroundColor;
          const color = styles.color;

          // Check if this element is in a dark theme context but has light colors
          const parent = el.closest('.modal-fullscreen, .form-panel');
          if (parent) {
            // This is expected to be light theme in form panel
            return;
          }

          // Check for mismatched contexts
          if (el.closest('.invoice-card') || el.closest('.header')) {
            if (lightThemeColors.some(c => bg.includes('255, 255, 255') || color === 'rgb(50, 51, 56)')) {
              issues.push({
                element: el.tagName,
                class: el.className?.substring(0, 50),
                bg: bg,
                color: color
              });
            }
          }
        });
        return issues.slice(0, 10);
      });

      if (colorIssues.length > 0) {
        console.log('\nCOLOR CONTEXT ISSUES:');
        colorIssues.forEach((issue, i) => {
          console.log(`  ${i+1}. <${issue.element}> bg:${issue.bg} color:${issue.color}`);
        });
      }
    }

    console.log('\n========================================');
    console.log('STYLE CHECK COMPLETE');
    console.log('Review screenshots in tests/screenshots/style-check/');
    console.log('========================================\n');
  });
});
