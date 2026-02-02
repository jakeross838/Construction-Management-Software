# Ross Built Construction Management Software

A comprehensive construction management platform for custom home builders. Features include job tracking, financial management, invoicing, purchase orders, draws, scheduling, and business intelligence.

## Features

- **Job Management**: Track projects from pre-construction through closeout
- **Financial Management**: Budgets, invoices, purchase orders, draws, and P&L tracking
- **AI Invoice Processing**: Automated data extraction from PDFs using Claude
- **Business Intelligence**: Profitability analysis, WIP schedules, cash flow forecasting
- **Client Portal**: Share project updates with homeowners
- **Integrations**: QuickBooks, Xero, Procore, Slack
- **Multi-tenant**: Support for multiple builder companies

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (database & auth)
- Anthropic API key (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/jakeross838/Construction-Management-Software.git
cd Construction-Management-Software

# Install dependencies
npm run install:all

# Copy environment file and configure
cp .env.example .env
# Edit .env with your credentials

# Build the frontend
npm run build

# Start the server
npm start
```

The application will be available at http://localhost:3001

### Environment Variables

Required variables in `.env`:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features |
| `SUPABASE_ACCESS_TOKEN` | For running migrations |

Optional variables for integrations:
- `STRIPE_SECRET_KEY` - Subscription billing
- `QBO_CLIENT_ID/SECRET` - QuickBooks integration
- `XERO_CLIENT_ID/SECRET` - Xero integration
- `SLACK_BOT_TOKEN` - Slack notifications

See `.env.example` for the complete list.

### Database Setup

Run migrations to set up the database schema:

```bash
npm run migrate
```

## Development

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

## Project Structure

```
├── client/                 # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (auth, user)
│   │   ├── hooks/          # Custom React hooks
│   │   └── pages/          # Page components
│   └── dist/               # Production build
├── server/                 # Express backend
│   ├── routes/             # API endpoints
│   ├── middleware/         # Express middleware
│   ├── services/           # Business logic
│   └── ai/                 # AI processing modules
├── database/               # SQL migrations
├── tests/                  # E2E and unit tests
└── config/                 # Configuration files
```

## API Documentation

API documentation is available at `/api/docs` when the server is running.

Key endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/jobs` | List all jobs with budget data |
| `GET /api/invoices` | List invoices |
| `POST /api/invoices/process` | AI process invoice PDF |
| `GET /api/purchase-orders` | List purchase orders |
| `GET /api/draws` | List draws |
| `GET /api/jobs/:id/budget` | Get job budget details |

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t ross-built-cms .
docker run -p 3001:3001 --env-file .env ross-built-cms
```

## Supabase Configuration

### Disable Email Confirmation (Recommended for Development)

For easier development/testing, disable email confirmation:

1. Go to Supabase Dashboard > Authentication > Providers
2. Click on Email
3. Disable "Confirm email"

### Row Level Security

The application uses RLS policies for multi-tenant data isolation. Migrations automatically configure these policies.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Supabase)
- **AI**: Claude (Anthropic)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage

## Key Features Detail

### Invoice Processing
- AI-powered PDF extraction using Claude Vision
- Automatic vendor and job matching
- Cost code allocation with searchable picker
- Multi-status workflow: received → needs_approval → approved → in_draw → paid
- PDF stamping on approval

### Financial Management
- Budget tracking per cost code
- Purchase order management with line items
- Draw management with AIA G702/G703 format
- Retainage tracking
- Change order management

### Business Intelligence
- Job profitability analysis
- WIP (Work-in-Progress) schedule
- Company P&L dashboard
- Cash flow forecasting
- NAHB industry benchmarks

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policies and reporting vulnerabilities.

## License

Proprietary - Ross Built Custom Homes
