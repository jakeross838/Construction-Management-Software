# Construction Management SaaS - Technical Standards

> Mandatory standards for all features in this construction management platform.
> Both Architect (Gemini) and Builder (Claude) must enforce these patterns.

---

## 1. Network & Data Architecture

> **Decision (2026-02-04):** Offline-First architecture was evaluated and deferred.
> The application operates as Online-First with graceful degradation.

### Current Approach: Online-First
- **Real-time sync**: Data syncs immediately with Supabase
- **Optimistic UI**: Updates show immediately, rollback on error
- **Connection awareness**: Show clear status when offline
- **Graceful errors**: User-friendly messages when network unavailable

### Implementation Pattern
```typescript
// Standard mutation pattern with TanStack Query
const mutation = useMutation({
  mutationFn: async (data) => {
    const res = await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save');
    return res.json();
  },
  onMutate: async (newData) => {
    // Optimistic update
    await queryClient.cancelQueries({ queryKey: ['resource'] });
    const previous = queryClient.getQueryData(['resource']);
    queryClient.setQueryData(['resource'], (old) => [...old, newData]);
    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['resource'], context.previous);
    toast.error('Failed to save. Please check your connection.');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['resource'] });
  },
});
```

### Future Consideration
Full offline-first with service workers, IndexedDB, and sync queues may be
implemented in a future version if field usage demands it.

---

## 2. Audit Logging

Every database mutation MUST be tracked for compliance and dispute resolution.

### Requirements
- **Immutable Audit Trail**: Never delete audit records
- **User Attribution**: Every change tied to authenticated user
- **Timestamp Precision**: Use ISO 8601 with timezone (TIMESTAMPTZ)
- **Change Capture**: Store before/after values for updates
- **IP & Device Tracking**: For security and legal compliance

### Database Schema Pattern
```sql
-- Every table with auditable data needs:
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger function for automatic auditing
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_fields, user_id)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END,
    CASE WHEN TG_OP = 'UPDATE' THEN
      ARRAY(SELECT key FROM jsonb_each(to_jsonb(NEW))
            WHERE to_jsonb(NEW)->key != to_jsonb(OLD)->key)
    END,
    current_setting('app.current_user_id', true)::uuid
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### Required Audit Events
| Event | Must Log |
|-------|----------|
| Invoice creation/edit | Yes |
| Payment recording | Yes |
| Contract changes | Yes |
| Change order approval | Yes |
| Document upload/delete | Yes |
| User permission changes | Yes |
| Schedule modifications | Yes |

---

## 3. BIM/CAD Compatibility

Support industry-standard formats for architectural and engineering files.

### Supported File Formats
| Format | Extension | Use Case |
|--------|-----------|----------|
| IFC | .ifc | BIM data exchange (ISO 16739) |
| DWG | .dwg | AutoCAD drawings |
| DXF | .dxf | CAD interchange |
| RVT | .rvt | Revit models |
| PDF | .pdf | 2D plans & specifications |
| STEP | .stp, .step | 3D CAD models |
| glTF | .gltf, .glb | 3D visualization |

### Data Structure Standards
```typescript
// Standard structure for plan references
interface PlanReference {
  id: string;
  filename: string;
  format: 'IFC' | 'DWG' | 'DXF' | 'RVT' | 'PDF' | 'STEP' | 'GLTF';
  version: string;
  uploadedAt: string;
  uploadedBy: string;

  // Spatial reference
  coordinates?: {
    system: 'WGS84' | 'NAD83' | 'local';
    origin?: [number, number, number];
    rotation?: number;
  };

  // BIM-specific metadata
  bimMetadata?: {
    ifcSchema?: 'IFC2X3' | 'IFC4' | 'IFC4X3';
    discipline?: 'architectural' | 'structural' | 'mep' | 'civil';
    lod?: 100 | 200 | 300 | 350 | 400 | 500; // Level of Development
  };

  // Linked elements
  linkedElements?: {
    rooms?: string[];
    systems?: string[];
    costCodes?: string[];
  };
}

// Standard structure for spatial elements
interface SpatialElement {
  id: string;
  globalId?: string; // IFC GlobalId
  name: string;
  type: string;

  // Hierarchy
  parentId?: string;
  buildingId?: string;
  floorId?: string;

  // Geometry bounds (for clash detection, quantity takeoff)
  bounds?: {
    min: [number, number, number];
    max: [number, number, number];
  };

  // Properties from BIM
  properties?: Record<string, unknown>;

  // Links to project data
  linkedCostCodes?: string[];
  linkedTasks?: string[];
  linkedRFIs?: string[];
}
```

### Integration Requirements
- **Viewer**: Integrate IFC.js or similar for in-browser BIM viewing
- **Quantity Takeoff**: Extract quantities from BIM for estimating
- **Clash Detection**: Flag spatial conflicts between disciplines
- **Version Control**: Track model revisions with diff capability

---

## 4. API Standards

### RESTful Conventions
```
GET    /api/v1/{resource}          - List (with pagination)
GET    /api/v1/{resource}/:id      - Get single
POST   /api/v1/{resource}          - Create
PUT    /api/v1/{resource}/:id      - Full update
PATCH  /api/v1/{resource}/:id      - Partial update
DELETE /api/v1/{resource}/:id      - Soft delete (set deleted_at)
```

### Response Format
```json
{
  "success": true,
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { },
    "requestId": "req_xxx"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 5. Security Requirements

### Authentication
- JWT tokens with short expiry (15 min access, 7 day refresh)
- Role-based access control (RBAC) with granular permissions
- Multi-tenant isolation at database level (RLS policies)

### Data Protection
- Encrypt PII at rest (AES-256)
- TLS 1.3 for all API traffic
- Sanitize all user inputs (SQL injection, XSS prevention)
- Rate limiting on all endpoints

### Construction-Specific
- Lien waiver document signing with audit trail
- AIA document compliance (G702, G703)
- Certified payroll data protection (Davis-Bacon)

---

## 6. Testing Requirements

### Coverage Minimums
- Unit tests: 80% coverage
- Integration tests: All API endpoints
- E2E tests: Critical user flows

### Construction Domain Tests
- Invoice → Draw request flow
- Change order impact on budget
- Schedule critical path calculations
- Retainage calculations
- Lien deadline tracking

---

## Enforcement

Both AI agents must:
1. **Check** these standards before writing specs or code
2. **Flag** any violations during review
3. **Document** any approved exceptions with rationale
