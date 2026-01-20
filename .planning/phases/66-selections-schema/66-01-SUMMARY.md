# Phase 66-01 Summary: Selections Schema

## Completed

Database schema enhanced for visual catalog with multiple photos per product, product specs/dimensions, and multi-level category hierarchy.

## Changes Made

### migration-081-selection-catalog-enhancements.sql

**Category Hierarchy (v2_selection_categories)**
- Added `parent_id` UUID for multi-level navigation
- Added `slug` TEXT for URL-friendly names
- Added `image_url` TEXT for category images
- Added index on parent_id

**Catalog Item Enhancements (v2_selection_catalog)**
- Added `specs` JSONB - product specifications (color, finish, style)
- Added `dimensions` JSONB - width, height, depth with unit
- Added `square_footage` DECIMAL - for area-based products
- Added `quantity_default` DECIMAL - default quantities
- Added `room` TEXT - Kitchen, Master Bath, etc.
- Added `tags` TEXT[] - for search/filtering
- Added `thumb_hash` TEXT - ThumbHash for placeholders
- Added `primary_image_id` UUID - reference to main image
- Added indexes on room and tags (GIN)

**Catalog Images Table (v2_catalog_images)** - NEW
```sql
id UUID PRIMARY KEY
catalog_item_id UUID REFERENCES v2_selection_catalog(id)
storage_path TEXT NOT NULL         -- selections/{catalog_id}/{filename}
file_name TEXT NOT NULL
file_size INTEGER
mime_type TEXT
width INTEGER
height INTEGER
thumb_hash TEXT
thumbnail_path TEXT
display_order INTEGER DEFAULT 0
is_primary BOOLEAN DEFAULT false
caption TEXT
alt_text TEXT
uploaded_by TEXT
created_at TIMESTAMPTZ
```

**Triggers**
- `set_primary_catalog_image` - Auto-sets first image as primary
- `handle_primary_image_update` - Syncs primary_image_id when is_primary changes

**Seeded Subcategories**
- Flooring: Hardwood, LVP/LVT, Tile, Carpet
- Cabinets: Kitchen Cabinets, Bathroom Vanities, Pantry
- Plumbing: Kitchen Faucets, Bath Faucets, Sinks, Toilets, Tubs & Showers

## Requirements Satisfied

- [x] CAT-06: Product details include quantities, square footage, and specs
- [x] MGT-03: Staff can add multiple photos per product with gallery

## Success Criteria Met

1. ✓ v2_catalog_images table exists with storage paths
2. ✓ v2_selection_catalog has columns for quantities, specs, dimensions
3. ⚠ Supabase storage bucket 'selections' - needs manual creation in dashboard
4. ✓ ThumbHash column added for placeholder images

## Storage Bucket Note

The Supabase storage bucket `selections` needs to be created manually:
- Go to Supabase Dashboard > Storage > New Bucket
- Name: `selections`
- Public: false (private bucket)
- Set RLS policies for authenticated users

## Files Modified

| File | Lines Added | Description |
|------|-------------|-------------|
| database/migration-081-selection-catalog-enhancements.sql | ~200 | Full schema enhancement |
