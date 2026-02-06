# Estimates

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction estimating with hierarchical structure (phases, groups, line items). Supports assemblies (reusable component templates), AI-assisted estimation, drag-and-drop organization, and conversion to job budgets. Integrates with selections for allowance-based pricing.

## Key Files

### Frontend
- `client/src/pages/Estimates.tsx` - Main estimates page
- `client/src/components/estimates/` - 16 components

### Backend
- `server/routes/estimates.js` - Estimate API routes
- `server/routes/ai-estimates.js` - AI estimation routes

### Database Migrations
- `migration-041-estimates.sql` - Base schema
- `migration-042-estimate-assemblies.sql` - Assembly support
- `migration-043-ai-budget-system.sql` - AI integration
- `migration-117-estimate-hierarchy.sql` - Hierarchical structure
- `migration-119-selections-estimate-bridge.sql` - Selection integration
- `migration-157-estimate-assemblies-historical-costs.sql` - Historical pricing
- `migration-085-selection-driven-estimates-extension.sql` - Selection-driven

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_estimates` | Main estimate records |
| `v2_estimate_assemblies` | Reusable assembly templates |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/estimates` | List estimates |
| GET | `/api/estimates/:id` | Get estimate with hierarchy |
| POST | `/api/estimates` | Create estimate |
| PATCH | `/api/estimates/:id` | Update estimate |
| POST | `/api/estimates/:id/convert-to-budget` | Create job budget |
| GET | `/api/ai-estimates/suggest` | AI suggestions |

## Component Inventory

| Component | Purpose |
|-----------|---------|
| EstimateTable.tsx | Main estimates list |
| EstimateDetailDialog.tsx | Estimate detail modal |
| EstimateFormDialog.tsx | Create/edit estimate |
| EstimateStats.tsx | Summary statistics |
| EstimateBuilder.tsx | Full estimate builder UI |
| DBEstimateBuilder.tsx | Database-backed builder |
| DraggablePhase.tsx | Draggable phase container |
| DraggableGroup.tsx | Draggable group container |
| DraggableSubgroup.tsx | Draggable subgroup |
| DraggableLineItem.tsx | Draggable line item |
| DraggableLineItemRow.tsx | Line item row display |
| LineItemForm.tsx | Line item entry form |
| AssemblyPicker.tsx | Select assembly templates |
| SaveAsTemplateDialog.tsx | Save as reusable template |
| TemplatesTab.tsx | Assembly templates management |
| BulkActionsBar.tsx | Bulk operations |

## Estimate Hierarchy
```
Estimate
├── Phase (e.g., "Foundation")
│   ├── Group (e.g., "Concrete")
│   │   ├── Subgroup (e.g., "Footings")
│   │   │   ├── Line Item (e.g., "Labor - Pour footings")
│   │   │   └── Line Item (e.g., "Material - Concrete")
│   │   └── Line Item
│   └── Group
└── Phase
```

## Assembly Templates
Reusable component bundles:
- Pre-defined labor + material combinations
- Historical cost data integration
- Quick insertion into estimates
- Examples: "Standard Door Installation", "Foundation Package"

## Selection-Driven Estimation
Integrates with Selections feature:
- Allowance items link to selections
- Updates estimate when selection finalized
- Tracks selection vs budget variance

## AI Capabilities
- Suggest line items based on project type
- Historical cost lookup
- Quantity takeoff assistance
- Missing item detection

## Current Limitations / TODO
- [ ] Plan takeoff integration
- [ ] Subcontractor bid import

## Related Features
- [Budget](../budget/) - Estimates convert to budgets
- [Jobs](../jobs/) - Estimates belong to jobs
