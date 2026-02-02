# Contributing to Ross Built CMS

Thank you for your interest in contributing to Ross Built Construction Management Software!

## Table of Contents

- [Development Setup](#development-setup)
- [CI/CD Pipeline](#cicd-pipeline)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Security](#security)

---

## Development Setup

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git
- Docker (optional, for containerized development)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/jakeross838/Construction-Management-Software.git
cd Construction-Management-Software

# Install dependencies
npm run install:all

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Build the frontend
npm run build

# Start the development server
npm run dev
```

### Environment Variables

Required environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features |
| `PORT` | Server port (default: 3001) |

---

## CI/CD Pipeline

Our CI/CD pipeline runs automatically on GitHub Actions. Understanding the pipeline helps you write code that passes all checks.

### Pipeline Overview

```
Push/PR → Lint → Build → Test → Security Scan → Deploy (main only)
```

### Workflows

#### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on: Every push to `main` and all pull requests

| Job | Description | Must Pass? |
|-----|-------------|------------|
| **lint** | ESLint for server and client code | Yes |
| **build** | Build frontend, verify server starts | Yes |
| **test** | Unit tests and E2E tests | No (warnings only) |
| **type-check** | TypeScript compilation check | Yes |

#### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

Runs on: Push to `main` (after CI passes)

| Job | Description |
|-----|-------------|
| **build-image** | Build and push Docker image to GHCR |
| **deploy** | Deploy to production (configurable) |
| **health-check** | Verify deployment succeeded |

#### 3. Security Workflow (`.github/workflows/security.yml`)

Runs on: Push to `main`, PRs, and weekly schedule

| Job | Description |
|-----|-------------|
| **dependency-audit** | npm audit for vulnerabilities |
| **codeql-analysis** | Static code analysis |
| **secrets-scan** | Check for committed secrets |
| **license-check** | Verify dependency licenses |
| **docker-scan** | Trivy scan of Docker image |

### Required Secrets

For full CI/CD functionality, configure these secrets in GitHub:

| Secret | Required For | Description |
|--------|--------------|-------------|
| `SUPABASE_URL` | Build/Test | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Build/Test | Service role key |
| `ANTHROPIC_API_KEY` | Build/Test | For AI processing tests |
| `GITHUB_TOKEN` | Auto-provided | Docker registry access |

For deployment, add one of:
- `RAILWAY_TOKEN` - Railway deployment
- `FLY_API_TOKEN` - Fly.io deployment
- `DIGITALOCEAN_ACCESS_TOKEN` - DigitalOcean deployment

---

## Code Style

### Linting

We use ESLint to enforce code style. Run linting locally before committing:

```bash
# Lint all code
npm run lint

# Lint and auto-fix
npm run lint:fix

# Lint only server
npm run lint:server

# Lint only client
npm run lint:client
```

### Server Code (JavaScript)

- Use ES modules (`import`/`export`)
- Single quotes for strings
- Semicolons required
- 2-space indentation
- Trailing commas in multiline
- Prefer `const` over `let`

Example:

```javascript
import express from 'express';

const router = express.Router();

router.get('/items', async (req, res) => {
  const items = await getItems();
  res.json({ data: items });
});

export default router;
```

### Client Code (TypeScript/React)

- Follow the existing client ESLint config
- Use TypeScript for all new code
- Follow React best practices (hooks, functional components)
- Use Tailwind CSS for styling

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(invoices): add bulk approval action`
- `fix(draws): correct G702 calculation`
- `docs(readme): update setup instructions`

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# E2E tests (requires server running)
npm run test:e2e

# Specific E2E test
npm run test:sidebar

# Interactive test UI
npm run test:ui
```

### Test Structure

```
tests/
├── e2e/                    # E2E tests (Playwright)
│   ├── invoices.spec.ts
│   ├── draws.spec.ts
│   └── ...
├── unit/                   # Unit tests (Jest)
│   └── ...
└── *.spec.js               # Legacy tests
```

### Writing Tests

- E2E tests: Use Playwright, test user flows
- Unit tests: Use Jest, test individual functions
- All tests should be deterministic (no flaky tests)

---

## Pull Request Process

### Before Opening a PR

1. **Fork and branch**: Create a feature branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Run all checks locally**:
   ```bash
   npm run lint
   npm run build
   npm run type-check
   npm test
   ```

3. **Commit your changes** with meaningful commit messages

4. **Push and open PR** against `main`

### PR Requirements

- [ ] All CI checks pass
- [ ] Code follows style guidelines
- [ ] Tests added for new functionality
- [ ] No secrets or credentials in code
- [ ] Documentation updated if needed

### Review Process

1. Automated checks run on PR creation
2. Code review by maintainer
3. Address any feedback
4. Merge when approved and checks pass

---

## Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. Email the maintainers privately
3. Include detailed reproduction steps

### Security Best Practices

- Never commit secrets or credentials
- Use environment variables for sensitive config
- Keep dependencies updated
- Run `npm audit` regularly

### Security Scanning

The security workflow runs automatically, but you can also run locally:

```bash
# Check for vulnerabilities
npm audit

# Check client dependencies
cd client && npm audit

# Run security scan script
npm run security:scan
```

---

## Questions?

- Open a GitHub issue for bugs or feature requests
- Check existing issues before creating new ones
- For urgent matters, contact the maintainers directly

---

Thank you for contributing to Ross Built CMS!
