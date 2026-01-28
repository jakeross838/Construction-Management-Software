# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest.config.ts` in project root

**Assertion Library:**
- Vitest built-in expect
- Testing Library matchers via `@testing-library/jest-dom`

**Run Commands:**
```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode (vitest)
npm test -- path/to/file.test.ts     # Single file
```

## Test File Organization

**Location:**
- Pattern: `src/**/*.{test,spec}.{ts,tsx}` (per vitest.config.ts)
- Setup file: `src/test/setup.ts`

**Naming:**
- `*.test.ts` or `*.spec.ts` for test files
- Co-located with source files (expected pattern)

**Current State:**
- No test files currently exist in the codebase
- Test infrastructure is configured and ready
- Testing Library and jsdom are installed

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  beforeEach(() => {
    // reset state
  });

  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

**Patterns:**
- Use describe blocks for grouping related tests
- Use beforeEach for setup
- Testing Library for React component testing
- jsdom environment configured in vitest.config.ts

## Mocking

**Framework:**
- Vitest built-in mocking (vi)

**Patterns:**
```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  }
}));
```

**What to Mock:**
- Supabase client for database operations
- External API calls
- Edge function invocations

**What NOT to Mock:**
- Pure utility functions
- UI component internals

## Fixtures and Factories

**Test Data:**
```typescript
// Factory pattern recommended
function createTestInvoice(overrides?: Partial<Invoice>): Invoice {
  return {
    id: 'test-id',
    invoice_number: 'INV-001',
    amount: 1000,
    status: 'needs_review',
    ...overrides
  };
}
```

**Location:**
- Factory functions: define in test file or `src/test/factories/`
- Mock data: `src/test/fixtures/`

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage not currently configured

**Configuration:**
- Add `--coverage` flag to npm test
- Configure in vitest.config.ts if needed

## Test Types

**Unit Tests:**
- Test individual components in isolation
- Mock Supabase client and external dependencies
- Fast execution

**Integration Tests:**
- Test component interactions
- Use MSW for API mocking (not currently set up)

**E2E Tests:**
- Not currently configured
- Could add Playwright or Cypress

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  render(<Component />);
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

**User Events:**
```typescript
import userEvent from '@testing-library/user-event';

it('should handle click', async () => {
  const user = userEvent.setup();
  render(<Button onClick={handleClick} />);
  await user.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```

**Query Testing:**
```typescript
// Test hooks with renderHook
import { renderHook, waitFor } from '@testing-library/react';

it('should fetch data', async () => {
  const { result } = renderHook(() => useInvoices(), {
    wrapper: QueryClientWrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});
```

## Gaps and Recommendations

**Current Gaps:**
- No test files exist yet
- No mock setup for Supabase
- No component tests

**Recommended Priority:**
1. Add tests for edge functions (critical business logic)
2. Add tests for invoice processing components
3. Add tests for financial calculations

---

*Testing analysis: 2026-01-27*
*Update when test patterns change*
