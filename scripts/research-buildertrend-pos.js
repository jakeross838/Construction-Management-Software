/**
 * Buildertrend PO Research - Fast Automated Version
 * Log in once, then it captures everything automatically
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const delay = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== BUILDERTREND PO RESEARCH ===\n');

  const browser = await chromium.launchPersistentContext(
    path.join(__dirname, 'bt-profile'),
    { headless: false, channel: 'chrome', viewport: null, args: ['--start-maximized'] }
  );

  const page = browser.pages()[0] || await browser.newPage();
  const data = { pos: [], fields: [], statuses: [] };

  // Go to POs
  console.log('Opening Buildertrend POs...');
  await page.goto('https://buildertrend.net/app/PurchaseOrders');
  await delay(2000);

  // Check for login
  if (page.url().includes('login') || page.url().includes('Login')) {
    console.log('\n>>> LOG IN NOW - script will continue automatically <<<\n');
    await page.waitForURL('**/app/**', { timeout: 300000 });
    await delay(2000);
  }

  console.log('Searching for Drummond...');

  // Try to filter to Drummond job
  await page.click('body'); // Focus
  await delay(500);

  // Look for job filter and search
  const searchBox = await page.$('input[placeholder*="search" i], input[placeholder*="filter" i], input[type="search"]');
  if (searchBox) {
    await searchBox.fill('Drummond');
    await delay(1500);
  }

  // Or click dropdown that might contain jobs
  const jobDropdowns = await page.$$('select, [class*="dropdown"], [class*="select"]');
  for (const dd of jobDropdowns.slice(0, 3)) {
    const text = await dd.innerText().catch(() => '');
    if (text.toLowerCase().includes('job') || text.toLowerCase().includes('all')) {
      await dd.click().catch(() => {});
      await delay(500);
      const drummondOption = await page.$('text=/Drummond/i');
      if (drummondOption) {
        await drummondOption.click();
        await delay(1500);
        break;
      }
    }
  }

  // Screenshot PO list
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1-po-list.png'), fullPage: true });
  console.log('Screenshot: 1-po-list.png');

  // Extract PO table data
  data.poListColumns = await page.$$eval('table th, thead th', ths => ths.map(t => t.innerText?.trim()));
  data.poRows = await page.$$eval('table tbody tr', rows =>
    rows.slice(0, 20).map(r => r.innerText?.trim().substring(0, 200))
  );
  console.log(`Found ${data.poRows.length} POs`);

  // Click first PO row
  const firstPO = await page.$('table tbody tr');
  if (firstPO) {
    await firstPO.click();
    await delay(3000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2-po-detail.png'), fullPage: true });
    console.log('Screenshot: 2-po-detail.png');

    // Get all visible labels/values
    data.detailLabels = await page.$$eval('label, [class*="label"]', els =>
      els.map(e => e.innerText?.trim()).filter(t => t && t.length < 50)
    );

    // Get tabs
    data.tabs = await page.$$eval('[role="tab"], [class*="tab"]', tabs =>
      tabs.map(t => t.innerText?.trim()).filter(t => t && t.length < 30)
    );
    console.log(`Tabs: ${data.tabs.join(', ')}`);

    // Get buttons
    data.buttons = await page.$$eval('button', btns =>
      btns.map(b => b.innerText?.trim()).filter(t => t && t.length < 40)
    );

    // Get select options (statuses, etc)
    data.selectOptions = await page.$$eval('select', selects =>
      selects.map(s => ({
        name: s.name || s.id || s.className,
        options: Array.from(s.options).map(o => o.text)
      }))
    );

    // Click through tabs to capture each
    for (const tabName of data.tabs.slice(0, 5)) {
      if (!tabName) continue;
      const tab = await page.$(`text="${tabName}"`);
      if (tab) {
        await tab.click().catch(() => {});
        await delay(1500);
        const safeName = tabName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `3-tab-${safeName}.png`), fullPage: true });
        console.log(`Screenshot: 3-tab-${safeName}.png`);
      }
    }
  }

  // Go back and look for Create button
  await page.goto('https://buildertrend.net/app/PurchaseOrders');
  await delay(2000);

  const createBtn = await page.$('button:has-text("New"), button:has-text("Create"), button:has-text("Add")');
  if (createBtn) {
    await createBtn.click();
    await delay(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '4-create-form.png'), fullPage: true });
    console.log('Screenshot: 4-create-form.png');

    data.createFormFields = await page.$$eval('input, select, textarea', fields =>
      fields.map(f => ({
        type: f.type || f.tagName,
        name: f.name || f.id,
        placeholder: f.placeholder
      })).filter(f => f.name || f.placeholder)
    );
  }

  // Save research
  fs.writeFileSync(path.join(__dirname, 'bt-po-data.json'), JSON.stringify(data, null, 2));
  console.log('\nData saved to: bt-po-data.json');

  // Generate summary
  const summary = `# Buildertrend PO Research

## PO List Columns
${data.poListColumns?.join(', ') || 'N/A'}

## Sample POs (${data.poRows?.length || 0})
${data.poRows?.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n') || 'N/A'}

## Detail View Tabs
${data.tabs?.join(', ') || 'N/A'}

## Buttons/Actions
${data.buttons?.slice(0, 15).join(', ') || 'N/A'}

## Status/Dropdown Options
${data.selectOptions?.map(s => `- ${s.name}: ${s.options?.join(', ')}`).join('\n') || 'N/A'}

## Create Form Fields
${data.createFormFields?.map(f => `- ${f.name || f.placeholder} (${f.type})`).join('\n') || 'N/A'}

## Screenshots
- 1-po-list.png
- 2-po-detail.png
- 3-tab-*.png (various tabs)
- 4-create-form.png
`;

  fs.writeFileSync(path.join(__dirname, 'buildertrend-po-research.md'), summary);
  console.log('Summary saved to: buildertrend-po-research.md');

  console.log('\n=== DONE - Browser staying open ===');
  console.log('Review screenshots in scripts/screenshots/');
  console.log('Press Ctrl+C to exit\n');

  await new Promise(() => {});
}

run().catch(e => console.error('Error:', e.message));
