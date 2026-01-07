# Construction Management Software

Invoice approval system for Ross Built Custom Homes.

## Setup

### 1. Clone the repository
```bash
git clone https://github.com/jakeross838/Construction-Management-Software.git
cd Construction-Management-Software
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create environment file
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. Run the server
```bash
npm start
```

Server runs at http://localhost:3001

## Features

- AI-powered invoice processing (PDF extraction)
- Cost code allocation with searchable picker
- Multi-status workflow: received → needs_approval → approved → in_draw → paid
- PDF viewer split-view modal
- Real-time updates via SSE
- Optimistic locking for concurrent edits
- Undo support
- PDF stamping on approval

## Project Structure

```
├── public/           # Frontend files
│   ├── css/          # Styles
│   ├── js/           # JavaScript modules
│   └── index.html    # Main page
├── server/           # Backend
│   ├── index.js      # Express server & API endpoints
│   ├── ai-processor.js
│   ├── pdf-stamper.js
│   └── ...
├── database/         # Schema & migrations
├── scripts/          # Utility scripts
└── config/           # Configuration
```
