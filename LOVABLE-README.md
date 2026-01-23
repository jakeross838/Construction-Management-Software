# Lovable.dev Setup Guide for Ross Built CMS

## Quick Start

### Step 1: Set Up Knowledge Base
1. Open Lovable.dev and create a new project
2. Go to **Settings → Knowledge** (or the Knowledge tab)
3. Copy the entire contents of `LOVABLE-KNOWLEDGE-BASE.md`
4. Paste it into Lovable's Knowledge field
5. Save

This context will be sent with every prompt automatically.

### Step 2: Build Page by Page
1. Open `LOVABLE-PAGE-PROMPTS.md`
2. Copy **ONE prompt at a time** (don't paste multiple)
3. Paste into Lovable's chat
4. Wait for completion
5. Review and test
6. Move to next prompt

### Step 3: Follow the Build Order
```
PHASE 1: Layout
  1.1 App Layout Shell (header, nav, routing)
  1.2 Job Sidebar Component

PHASE 2: Overview
  2.1 Dashboard Page
  2.2 Job Hub Page

PHASE 3: Financial (core workflow)
  3.1 Invoices List
  3.2 Invoice Detail Modal
  3.3 Invoice Upload Modal
  3.4 Purchase Orders List
  3.5 PO Detail Modal
  3.6 PO Form Modal
  3.7 Draws List
  3.8 Draw Detail Modal (G702/G703)
  3.9 Change Orders Page
  3.10 Budget Page

PHASE 4: Settings
  4.1 Vendors Page
  ... (additional pages)
```

---

## File Reference

| File | Purpose |
|------|---------|
| `LOVABLE-README.md` | This guide |
| `LOVABLE-KNOWLEDGE-BASE.md` | Paste into Lovable's Knowledge feature |
| `LOVABLE-PAGE-PROMPTS.md` | Individual prompts for each page |
| `LOVABLE-COMPLETE.md` | Full reference (old format, for reference only) |
| `LOVABLE-FINANCIAL-MODULE.md` | Detailed financial module docs (reference) |

---

## Best Practices

### DO:
- ✅ Paste Knowledge Base first, before any prompts
- ✅ Build one page at a time
- ✅ Test after each prompt
- ✅ Use Chat Mode to investigate issues before fixing
- ✅ Be specific about what NOT to change

### DON'T:
- ❌ Paste multiple prompts at once
- ❌ Skip the Knowledge Base setup
- ❌ Ask for too many features in one prompt
- ❌ Let Lovable modify files you didn't ask about

---

## Troubleshooting

### If styling looks wrong:
Add to your prompt:
```
CONSTRAINT: Use the warm cream color palette from the Knowledge Base.
Background should be #f5f3ef, not white.
```

### If it modifies other pages:
Add to your prompt:
```
CONSTRAINT: Do NOT modify any files except [specific file].
Focus changes solely on [component name].
```

### If it's not responsive:
Add to your prompt:
```
Ensure this is fully responsive:
- Desktop: [describe layout]
- Tablet: [describe layout]
- Mobile: [describe layout, stack vertically]
```

### If something breaks:
Use Chat Mode (don't edit) and paste:
```
Analyze the current state of [component].
What might be causing [issue]?
Do NOT make any changes yet - just investigate.
```

---

## API Connection

The frontend will connect to your existing backend:

**Base URL:** `http://localhost:3001/api`

Make sure your backend is running before testing the Lovable frontend.

For development, you may need to:
1. Enable CORS on your backend (already done)
2. Update the API base URL in Lovable's environment/config

---

## After Building

Once all pages are built in Lovable:

1. **Export the code** from Lovable
2. **Review and customize** in your local IDE
3. **Connect to your actual backend**
4. **Test all workflows** end-to-end
5. **Deploy** to your hosting

---

## Need More Pages?

The prompts file covers the core financial module. For additional pages, follow the same pattern:

```
CONTEXT:
[What you're building and why]

TASK:
[Specific page/component to create]

REQUIREMENTS:
[Numbered list of features]

GUIDELINES:
[API endpoints, components to use]

CONSTRAINTS:
[What NOT to do]
```
