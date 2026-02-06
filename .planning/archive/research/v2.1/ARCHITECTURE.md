# Visual Selection Catalog Architecture Research

**Created:** 2026-01-20
**Milestone:** v2.1 Visual Selection Catalog
**Focus:** Database schema, image storage, frontend patterns, integration with existing architecture

---

## Executive Summary

This document outlines the architecture for adding a visual product catalog to the existing Ross Built CMS Selections/Allowances module. The existing foundation includes:
- `v2_selection_catalog` table (basic product data)
- `v2_selections` table (client choices)
- `v2_allowances` table (budgets with variance tracking)
- Integration with change orders for overages

The visual catalog enhancement adds:
- Multiple product images with thumbnails
- Hierarchical category/subcategory organization
- Product variants (size, color, finish)
- Rich product attributes for filtering/search
- Image optimization and CDN-ready storage patterns

---

## 1. Database Schema Additions

### 1.1 Existing Tables (Already Built)

The current schema in `database/migration-056-selections.sql` provides:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `v2_selection_categories` | Category reference | name, icon, display_order |
| `v2_allowances` | Per-job budgets | job_id, category_id, budgeted_amount, variance |
| `v2_selection_catalog` | Basic product catalog | category_id, vendor_id, name, unit_price, image_url |
| `v2_selections` | Client choices | allowance_id, catalog_item_id, final_price, change_order_id |
| `v2_selection_status_history` | Audit trail | selection_id, from_status, to_status |

### 1.2 New Tables Required

#### Category Hierarchy Enhancement

```sql
-- Add parent_id to existing categories for subcategories
ALTER TABLE v2_selection_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES v2_selection_categories(id),
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS typical_lead_days INTEGER,
  ADD COLUMN IF NOT EXISTS selection_deadline_phase TEXT; -- 'early', 'mid', 'late'

-- Index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_v2_selection_categories_parent
  ON v2_selection_categories(parent_id);
```

#### Product Images Table

```sql
-- Multiple images per catalog item
CREATE TABLE IF NOT EXISTS v2_catalog_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,

  -- Image URLs (Supabase Storage)
  storage_path TEXT NOT NULL,           -- Original: 'catalog/images/{uuid}.jpg'
  thumbnail_path TEXT,                  -- Thumbnail: 'catalog/thumbnails/{uuid}.jpg'

  -- Image metadata
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,

  -- Organization
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  alt_text TEXT,

  -- Source tracking
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_catalog_images_item
  ON v2_catalog_images(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_v2_catalog_images_primary
  ON v2_catalog_images(catalog_item_id, is_primary)
  WHERE is_primary = true;
```

#### Product Variants Table

```sql
-- Variants for size, color, finish options
CREATE TABLE IF NOT EXISTS v2_catalog_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,

  -- Variant identity
  sku TEXT,
  name TEXT NOT NULL,                    -- "12x24 Matte White"

  -- Variant attributes
  size TEXT,                             -- "12x24", "Large", "36in"
  color TEXT,
  finish TEXT,                           -- "Matte", "Polished", "Brushed"
  material TEXT,

  -- Pricing (can differ from base product)
  unit_price DECIMAL(12,2),              -- NULL = use base price
  price_modifier DECIMAL(12,2),          -- +/- from base (e.g., +50 for premium)

  -- Inventory/availability
  is_available BOOLEAN DEFAULT true,
  lead_time_days INTEGER,
  min_order_qty DECIMAL(10,2),

  -- Image (optional variant-specific image)
  image_id UUID REFERENCES v2_catalog_images(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(catalog_item_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_v2_catalog_variants_item
  ON v2_catalog_variants(catalog_item_id);
```

#### Product Attributes Table (Flexible)

```sql
-- Dynamic attributes for filtering/search
CREATE TABLE IF NOT EXISTS v2_catalog_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,

  attribute_name TEXT NOT NULL,          -- "Style", "Material", "Warranty"
  attribute_value TEXT NOT NULL,         -- "Modern", "Porcelain", "5 Year"
  attribute_type TEXT DEFAULT 'text',    -- 'text', 'number', 'boolean', 'range'
  display_order INTEGER DEFAULT 0,

  -- For faceted search
  is_filterable BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(catalog_item_id, attribute_name)
);

CREATE INDEX IF NOT EXISTS idx_v2_catalog_attributes_item
  ON v2_catalog_attributes(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_v2_catalog_attributes_filter
  ON v2_catalog_attributes(attribute_name, attribute_value)
  WHERE is_filterable = true;
```

#### Product Specifications/Documents

```sql
-- Spec sheets, installation guides, warranty docs
CREATE TABLE IF NOT EXISTS v2_catalog_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                    -- "Installation Guide"
  document_type TEXT,                    -- 'spec_sheet', 'warranty', 'manual', 'cad'
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_catalog_documents_item
  ON v2_catalog_documents(catalog_item_id);
```

### 1.3 Enhanced Selection Catalog Table

```sql
-- Enhance existing v2_selection_catalog
ALTER TABLE v2_selection_catalog
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer_url TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS typical_lead_days INTEGER,
  ADD COLUMN IF NOT EXISTS min_order_qty DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS tags TEXT[],                      -- For search: ['modern', 'premium', 'eco']
  ADD COLUMN IF NOT EXISTS search_vector tsvector;           -- Full-text search

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_v2_selection_catalog_search
  ON v2_selection_catalog USING GIN(search_vector);

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_catalog_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.brand, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.model_number, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_catalog_search_vector ON v2_selection_catalog;
CREATE TRIGGER trigger_catalog_search_vector
  BEFORE INSERT OR UPDATE ON v2_selection_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_catalog_search_vector();
```

---

## 2. Image Storage Patterns

### 2.1 Supabase Storage Structure

Based on Supabase Storage best practices and the existing project patterns:

```
storage/
└── catalog/
    ├── images/
    │   ├── {item_uuid}/
    │   │   ├── original_{filename}.jpg     -- Full resolution
    │   │   ├── large_1200.jpg              -- 1200px width
    │   │   ├── medium_600.jpg              -- 600px width
    │   │   └── thumb_300.jpg               -- 300px thumbnail
    │   └── ...
    ├── variants/
    │   └── {variant_uuid}/
    │       └── variant_{filename}.jpg
    └── documents/
        └── {item_uuid}/
            └── spec_sheet.pdf
```

### 2.2 Image Transformation Strategy

**Option A: On-Demand Transformation (Supabase Pro)**

```javascript
// Use Supabase Image Transformations (Pro plan)
const getImageUrl = (storagePath, size) => {
  const baseUrl = supabase.storage.from('catalog').getPublicUrl(storagePath);

  const sizes = {
    thumb: { width: 300, height: 300, quality: 80 },
    medium: { width: 600, quality: 85 },
    large: { width: 1200, quality: 90 },
    original: null
  };

  if (!sizes[size]) return baseUrl.data.publicUrl;

  const params = sizes[size];
  return `${baseUrl.data.publicUrl}?width=${params.width}${params.height ? `&height=${params.height}` : ''}&quality=${params.quality}`;
};
```

**Option B: Pre-Generate Thumbnails on Upload (Free tier)**

```javascript
// Upload with client-side resize before storage
const uploadCatalogImage = async (file, catalogItemId) => {
  const sizes = [
    { name: 'original', maxWidth: null },
    { name: 'large', maxWidth: 1200 },
    { name: 'medium', maxWidth: 600 },
    { name: 'thumb', maxWidth: 300 }
  ];

  const uploads = [];

  for (const size of sizes) {
    const resized = size.maxWidth
      ? await resizeImage(file, size.maxWidth)
      : file;

    const path = `images/${catalogItemId}/${size.name}_${file.name}`;
    uploads.push(
      supabase.storage.from('catalog').upload(path, resized)
    );
  }

  return Promise.all(uploads);
};

// Client-side image resize using canvas
const resizeImage = (file, maxWidth) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    };
    img.src = URL.createObjectURL(file);
  });
};
```

### 2.3 Image Optimization Best Practices

Based on research findings:

| Image Type | Dimensions | Format | Max Size | Quality |
|------------|------------|--------|----------|---------|
| Thumbnail | 300x300 | WebP/JPEG | 50KB | 80% |
| Grid View | 600x600 | WebP/JPEG | 150KB | 85% |
| Detail View | 1200x1200 | WebP/JPEG | 300KB | 90% |
| Original | Preserved | Original | 2MB | Original |

**Format Recommendations:**
- Use WebP when browser support allows (35% smaller than JPEG)
- Fall back to JPEG for compatibility
- PNG only for transparency requirements
- Lazy load images below the fold

---

## 3. Frontend Component Structure

### 3.1 Page Architecture

Following existing patterns from `public/selections.html`:

```
public/
├── selection-catalog.html          -- Main catalog browse page
├── js/
│   ├── selection-catalog.js        -- Catalog browsing logic
│   └── catalog-components.js       -- Reusable UI components
└── css/
    └── styles.css                  -- Add catalog-specific styles
```

### 3.2 Component Hierarchy

```
SelectionCatalogPage
├── CatalogHeader
│   ├── SearchBar (with autocomplete)
│   ├── CategoryBreadcrumbs
│   └── ViewToggle (grid/list)
├── CatalogSidebar
│   ├── CategoryTree (hierarchical)
│   ├── FilterPanel
│   │   ├── PriceRangeFilter
│   │   ├── VendorFilter
│   │   ├── AttributeFilters (dynamic)
│   │   └── AvailabilityFilter
│   └── AllowanceBudgetSummary (if in selection mode)
├── CatalogGrid
│   ├── ProductCard[] (grid view)
│   └── ProductRow[] (list view)
└── ProductDetailModal (fullscreen)
    ├── ImageGallery
    │   ├── MainImage
    │   └── ThumbnailStrip
    ├── ProductInfo
    │   ├── Title, Price, Vendor
    │   ├── VariantSelector (if variants)
    │   └── QuantityInput
    ├── ProductTabs
    │   ├── DescriptionTab
    │   ├── SpecificationsTab
    │   └── DocumentsTab
    └── ActionButtons
        ├── SelectForAllowance
        └── AddToCompare
```

### 3.3 Key UI Patterns

**Product Card (Grid View)**
```html
<div class="catalog-card" data-id="${item.id}">
  <div class="catalog-card-image">
    <img src="${item.thumbnail_url}" alt="${item.name}" loading="lazy">
    ${item.is_featured ? '<span class="badge-featured">Featured</span>' : ''}
  </div>
  <div class="catalog-card-body">
    <h4 class="catalog-card-title">${item.name}</h4>
    <p class="catalog-card-vendor">${item.vendor?.name || ''}</p>
    <div class="catalog-card-price">${formatCurrency(item.unit_price)}/${item.unit}</div>
  </div>
  <div class="catalog-card-actions">
    <button class="btn btn-sm btn-primary" onclick="selectItem('${item.id}')">Select</button>
    <button class="btn btn-sm btn-icon" onclick="quickView('${item.id}')">
      <svg><!-- eye icon --></svg>
    </button>
  </div>
</div>
```

**Image Gallery Pattern**
```javascript
// Following existing modal patterns with .show class
function renderImageGallery(images) {
  const primary = images.find(i => i.is_primary) || images[0];

  return `
    <div class="product-gallery">
      <div class="gallery-main">
        <img id="galleryMainImage" src="${primary.large_url}" alt="">
        <button class="gallery-nav prev" onclick="galleryPrev()">
          <svg><!-- chevron left --></svg>
        </button>
        <button class="gallery-nav next" onclick="galleryNext()">
          <svg><!-- chevron right --></svg>
        </button>
      </div>
      <div class="gallery-thumbs">
        ${images.map((img, i) => `
          <div class="gallery-thumb ${i === 0 ? 'active' : ''}"
               onclick="setGalleryImage(${i})">
            <img src="${img.thumbnail_url}" alt="">
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
```

### 3.4 CSS Structure (Dark Theme)

Following existing CSS variables from `public/css/styles.css`:

```css
/* Catalog Grid */
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 1rem 0;
}

.catalog-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.catalog-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.catalog-card-image {
  aspect-ratio: 1;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}

.catalog-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Product Gallery */
.product-gallery {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gallery-main {
  aspect-ratio: 4/3;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.gallery-main img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.gallery-thumbs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
}

.gallery-thumb {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
}

.gallery-thumb.active {
  border-color: var(--accent-blue);
}

/* Variant Selector */
.variant-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.variant-option {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.15s;
}

.variant-option:hover {
  border-color: var(--accent-blue);
}

.variant-option.selected {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}

.variant-option.unavailable {
  opacity: 0.5;
  text-decoration: line-through;
  cursor: not-allowed;
}
```

---

## 4. Data Flow for Selection Workflow

### 4.1 Browse-to-Select Flow

```
┌─────────────────┐
│  Catalog Page   │  Browse products, filter, search
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Product Detail  │  View images, specs, variants
│     Modal       │  Choose variant if applicable
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Select for      │  Associate with allowance
│ Allowance       │  Set quantity, confirm price
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Selection       │  v2_selections record created
│ Created         │  Links to catalog_item_id
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Allowance       │  Trigger updates selected_amount
│ Updated         │  Variance recalculated
└────────┬────────┘
         │
    ┌────┴────┐
    │ Variance│
    │   > 0?  │
    └────┬────┘
    Yes  │  No
    ▼    ▼
┌─────────┐  ┌─────────┐
│ Prompt  │  │ Complete│
│ for CO  │  │         │
└─────────┘  └─────────┘
```

### 4.2 API Endpoints (New)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/selections/catalog/browse` | Paginated catalog with filters |
| GET | `/api/selections/catalog/:id/full` | Full product with images, variants, docs |
| POST | `/api/selections/catalog/:id/images` | Upload images |
| DELETE | `/api/selections/catalog/images/:id` | Delete image |
| GET | `/api/selections/catalog/:id/variants` | List variants |
| POST | `/api/selections/catalog/:id/variants` | Create variant |
| PATCH | `/api/selections/catalog/variants/:id` | Update variant |
| GET | `/api/selections/categories/tree` | Hierarchical categories |
| GET | `/api/selections/catalog/search` | Full-text search |
| GET | `/api/selections/catalog/filters` | Available filter options |

### 4.3 Query Examples

**Paginated Catalog Browse with Filters:**
```javascript
// GET /api/selections/catalog/browse?category_id=xxx&min_price=100&max_price=500&vendor_id=yyy&page=1&limit=24

const browseCatalog = async (filters) => {
  let query = supabase
    .from('v2_selection_catalog')
    .select(`
      *,
      category:v2_selection_categories(id, name, slug),
      vendor:v2_vendors(id, name),
      primary_image:v2_catalog_images!inner(
        id, thumbnail_path, alt_text
      )
    `)
    .eq('is_active', true)
    .eq('v2_catalog_images.is_primary', true);

  if (filters.category_id) {
    // Include subcategories
    query = query.or(`category_id.eq.${filters.category_id},category.parent_id.eq.${filters.category_id}`);
  }

  if (filters.min_price) query = query.gte('unit_price', filters.min_price);
  if (filters.max_price) query = query.lte('unit_price', filters.max_price);
  if (filters.vendor_id) query = query.eq('vendor_id', filters.vendor_id);
  if (filters.search) {
    query = query.textSearch('search_vector', filters.search);
  }

  // Pagination
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  query = query.range(from, to);

  return query;
};
```

**Full Product Detail:**
```javascript
// GET /api/selections/catalog/:id/full

const getProductFull = async (id) => {
  const [product, images, variants, documents, attributes] = await Promise.all([
    supabase.from('v2_selection_catalog')
      .select(`*, category:v2_selection_categories(*), vendor:v2_vendors(*)`)
      .eq('id', id)
      .single(),
    supabase.from('v2_catalog_images')
      .select('*')
      .eq('catalog_item_id', id)
      .order('display_order'),
    supabase.from('v2_catalog_variants')
      .select('*')
      .eq('catalog_item_id', id)
      .eq('is_available', true)
      .order('name'),
    supabase.from('v2_catalog_documents')
      .select('*')
      .eq('catalog_item_id', id),
    supabase.from('v2_catalog_attributes')
      .select('*')
      .eq('catalog_item_id', id)
      .order('display_order')
  ]);

  return {
    ...product.data,
    images: images.data,
    variants: variants.data,
    documents: documents.data,
    attributes: attributes.data
  };
};
```

---

## 5. Integration with Existing Systems

### 5.1 Budget Integration

The existing variance tracking in `v2_allowances` handles this automatically via triggers. When a selection is created/updated:

1. `update_allowance_totals()` trigger fires
2. Sums `final_price` from all selections for the allowance
3. Updates `selected_amount` and `variance` fields
4. Auto-updates allowance status (pending/in_progress/complete)

**No changes needed** - existing trigger handles budget tracking.

### 5.2 Change Order Integration

Existing flow in `server/routes/selections.js`:

```javascript
// POST /api/selections/items/:id/create-co
// Creates v2_change_orders record when overage detected
// Links CO to selection via change_order_id
```

**Enhancement:** Add variant information to CO description:
```javascript
// When creating CO from selection with variant
const coDescription = selection.variant_id
  ? `${selection.name} (${selection.variant_name}) - Allowance overage`
  : `${selection.name} - Allowance overage`;
```

### 5.3 Vendor Integration

Catalog items link to existing `v2_vendors` table. When adding catalog items:

```javascript
// Reuse vendor lookup/create pattern from invoices
const findOrCreateVendor = async (vendorName) => {
  // Check existing
  const { data: existing } = await supabase
    .from('v2_vendors')
    .select('id')
    .ilike('name', vendorName)
    .single();

  if (existing) return existing.id;

  // Create new
  const { data: created } = await supabase
    .from('v2_vendors')
    .insert({ name: vendorName })
    .select('id')
    .single();

  return created.id;
};
```

### 5.4 Cost Code Mapping (Optional Future)

For tighter budget tracking, catalog items could map to cost codes:

```sql
-- Optional: Add cost_code_id to catalog for budget line mapping
ALTER TABLE v2_selection_catalog
  ADD COLUMN IF NOT EXISTS cost_code_id UUID REFERENCES v2_cost_codes(id);
```

This would allow selections to flow into `v2_budget_lines.billed_amount`.

---

## 6. Performance Considerations

### 6.1 Image Loading Optimization

```javascript
// Intersection Observer for lazy loading
const lazyLoadImages = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });

  document.querySelectorAll('img[data-src]').forEach(img => {
    observer.observe(img);
  });
};
```

### 6.2 Catalog Caching

Following existing `window.APICache` pattern:

```javascript
// Cache catalog data with 5-minute TTL
const getCatalogItems = async (categoryId) => {
  const cacheKey = `catalog_${categoryId}`;
  return window.APICache?.fetch(
    `/api/selections/catalog/browse?category_id=${categoryId}`,
    { ttl: 300000 }
  ) || fetch(`/api/selections/catalog/browse?category_id=${categoryId}`).then(r => r.json());
};
```

### 6.3 Search Indexing

The PostgreSQL full-text search via `tsvector` provides adequate performance for the expected catalog size (hundreds to low thousands of items). For larger catalogs, consider:

- Materialized view for frequently-queried combinations
- External search service (Algolia, Meilisearch) for sub-100ms search

---

## 7. Migration Plan

### Phase 1: Schema Additions
- Add new columns to `v2_selection_categories`
- Create `v2_catalog_images` table
- Create `v2_catalog_variants` table
- Create `v2_catalog_attributes` table
- Create `v2_catalog_documents` table
- Add search vector to `v2_selection_catalog`

### Phase 2: Storage Setup
- Create Supabase Storage bucket `catalog`
- Set up folder structure
- Configure public access policies

### Phase 3: API Endpoints
- Add browse endpoint with pagination/filters
- Add full product detail endpoint
- Add image upload endpoints
- Add variant CRUD endpoints
- Add search endpoint

### Phase 4: Frontend
- Create `selection-catalog.html` page
- Build catalog grid/list views
- Build product detail modal
- Build image gallery component
- Build variant selector
- Integrate with existing selection flow

### Phase 5: Integration Testing
- Test selection flow with images
- Test variant selection pricing
- Test variance calculation with variants
- Test change order creation

---

## References

### Web Search Sources
- [Supabase Storage Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) - On-demand resize
- [E-commerce Product Image Size Guide](https://www.squareshot.com/post/e-commerce-product-image-size-guide) - Image optimization standards
- [Designing Scalable Image Thumbnail Solution](https://medium.com/@ilakk2023/337-designing-a-scalable-and-customer-centric-image-thumbnail-solution) - Architecture patterns
- [Database Design for Product Management](https://medium.com/@pesarakex/database-design-for-product-management-9280fd7c66fe) - Schema patterns
- [Construction Client Selections Software](https://us.constructiononline.com/construction-client-selections-software) - Industry workflows
- [JobTread Selections & Allowances](https://www.jobtread.com/features/selections) - Feature reference
- [Buildern Construction Allowances](https://buildern.com/resources/blog/construction-allowances/) - Best practices

### Existing Codebase References
- `database/migration-056-selections.sql` - Current schema
- `server/routes/selections.js` - Current API
- `public/selections.html` - Current UI
- `public/js/selections.js` - Current JS
- `CLAUDE.md` - Project conventions

---

*Research completed: 2026-01-20*
