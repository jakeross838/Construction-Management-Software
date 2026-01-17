# Testing

## Framework

- **Playwright** - E2E testing framework
- **Version**: 1.57.0
- **Configuration**: Default Playwright config

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm run test:budget
npm run test:sidebar

# Run with UI (interactive)
npm run test:ui

# View test report
npm run test:report
```

## Test File Location

```
tests/
├── *.spec.js              # Playwright test specs
├── screenshots/           # Test artifacts
│   └── *.png
└── *.js                   # Helper scripts
```

## Test Types

### E2E Tests (Primary)
- All tests are E2E via Playwright
- Tests run against live server (localhost:3001)
- Database state may affect tests

### Example Test Files
| File | Purpose |
|------|---------|
| `app.spec.js` | Basic app loading |
| `invoice-workflow.spec.js` | Invoice approval flow |
| `po-workflow.spec.js` | PO lifecycle |
| `add-to-draw.spec.js` | Draw workflow |
| `budget-projected.spec.js` | Budget calculations |
| `sidebar-navigation.spec.js` | Navigation |
| `comprehensive.spec.js` | Full feature coverage |

### Visual Tests
- Many tests capture screenshots
- Screenshots stored in `tests/screenshots/`
- Used for visual regression debugging

## Test Patterns

### Page Navigation
```javascript
const { test, expect } = require('@playwright/test');

test('navigate to POs page', async ({ page }) => {
  await page.goto('http://localhost:3001/pos.html');
  await expect(page).toHaveTitle(/Purchase Orders/);
});
```

### Modal Interaction
```javascript
test('open PO modal', async ({ page }) => {
  await page.goto('http://localhost:3001/pos.html');
  await page.waitForSelector('.po-card');
  await page.click('.po-card');
  await page.waitForSelector('#poDetailModal.show');
  await expect(page.locator('#poDetailModal')).toBeVisible();
});
```

### Form Submission
```javascript
test('create invoice', async ({ page }) => {
  await page.goto('http://localhost:3001/');
  await page.click('button:text("Upload")');
  await page.waitForSelector('#uploadModal.show');
  // ... fill form
  await page.click('button:text("Save")');
  await expect(page.locator('.toast-success')).toBeVisible();
});
```

### Screenshot Capture
```javascript
test('visual check', async ({ page }) => {
  await page.goto('http://localhost:3001/draws.html');
  await page.screenshot({
    path: 'tests/screenshots/draws-page.png',
    fullPage: true
  });
});
```

## Test Data

### Database State
- Tests run against development database
- No automatic seeding/cleanup
- Manual setup required for specific scenarios

### Test Users
- No authentication in app
- Tests use whatever "user" names exist

## Assertions

### Common Patterns
```javascript
// Element visibility
await expect(page.locator('#modal')).toBeVisible();
await expect(page.locator('.error')).not.toBeVisible();

// Text content
await expect(page.locator('.total')).toContainText('$1,000');

// Element count
await expect(page.locator('.invoice-card')).toHaveCount(5);

// URL
await expect(page).toHaveURL(/pos\.html/);
```

## Known Issues

### Flaky Tests
- Modal animations can cause timing issues
- Use `waitForSelector` with `.show` class
- Network requests may timeout

### Database Dependency
- Tests depend on existing data
- May fail on clean database
- Consider seeding test data

## API Testing

### Manual Scripts
```
tests/
├── comprehensive-api-test.js  # API endpoint testing
├── workflow-test.js           # Business flow testing
├── data-integrity-check.js    # Data validation
└── additional-tests.js        # Misc tests
```

### Running API Tests
```bash
# These are standalone Node scripts
node tests/comprehensive-api-test.js
node tests/workflow-test.js
```

## Coverage

### Not Measured
- No code coverage tooling configured
- Manual assessment of test completeness

### Key Flows Tested
- Invoice upload and processing
- Invoice approval workflow
- PO creation and management
- Draw creation and invoices
- Navigation between pages

### Not Covered
- AI processing (mocked/skipped)
- PDF stamping verification
- File upload to storage
- Real-time updates

## CI/CD

### Not Configured
- No automated test runs
- Manual local testing only
- No GitHub Actions or similar

## Recommendations

1. **Add test database** - Separate DB for test isolation
2. **Add seeding** - Consistent test data setup
3. **Add CI** - Automated test runs on commit
4. **Add API tests** - Direct endpoint testing
5. **Add coverage** - Track what's tested
