# v2.1 Visual Selections Module - Stack Research

**Date:** 2026-01-20
**Goal:** Add visual catalog selections with photo-driven browsing to existing vanilla JS selections module

## Executive Summary

The Ross Built CMS already has a functional selections module (v1.6) with categories, budgets, and variance tracking. The v2.1 enhancement adds visual/photo-driven browsing similar to Materio - transforming the experience from spreadsheet-style lists into a visual showroom where clients can browse finishes and materials.

### Key Constraints
- **Must use vanilla JavaScript** - no React/Vue/Angular
- **Supabase Storage** for file storage (already integrated)
- **Existing dark theme CSS** with CSS variables
- **No build step** - frontend JS served directly

---

## 1. Image Gallery & Lightbox

### RECOMMENDED: lightGallery

**Version:** 2.7.2 (latest stable)
**Size:** ~16KB gzipped (core module)
**License:** GPLv3 (free for open source)

```bash
npm install lightgallery
```

**Why lightGallery:**
- Zero-dependency vanilla JS core
- Touch gestures (pinch zoom, swipe)
- Hardware-accelerated CSS3 transitions
- Modular architecture (load only needed features)
- Keyboard navigation & accessibility
- Works without any framework

**Usage:**
```javascript
import lightGallery from 'lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import lgThumbnail from 'lightgallery/plugins/thumbnail';

lightGallery(document.getElementById('gallery'), {
    plugins: [lgZoom, lgThumbnail],
    speed: 500
});
```

**Alternatives Considered:**
| Library | Size | Notes |
|---------|------|-------|
| fslightbox | ~7KB | Simple, but lacks zoom gestures |
| baguetteBox | ~3KB | Too basic, no thumbnails |
| Robroy | ~5KB | Accessible, but limited features |

**NOT RECOMMENDED:**
- PhotoSwipe - Heavy (~45KB), complex API
- Fancybox - jQuery dependency

---

## 2. Grid/Masonry Layout

### RECOMMENDED: MiniMasonry.js

**Version:** 3.2.0 (latest)
**Size:** ~2KB minified
**License:** MIT

```bash
npm install minimasonry
# OR use CDN
```

**Why MiniMasonry:**
- Zero dependencies
- Uses CSS transform (GPU-accelerated, no layout thrashing)
- Responsive - adjusts columns based on container width
- Tiny footprint
- Simple API

**Usage:**
```javascript
import MiniMasonry from 'minimasonry';

const masonry = new MiniMasonry({
    container: '.catalog-grid',
    baseWidth: 280,
    gutter: 16,
    surroundingGutter: false
});

// Re-layout after images load
window.addEventListener('load', () => masonry.layout());
```

**Alternatives Considered:**
| Library | Size | Notes |
|---------|------|-------|
| Masonry.js (Desandro) | ~35KB | Original, but heavy for modern use |
| Colcade | ~3KB | Good, but less actively maintained |
| masonry-grid | ~1.4KB | Very small, but less battle-tested |

**NOT RECOMMENDED:**
- Isotope - Way overkill (~25KB) with features we won't use
- Packery - Commercial license required

---

## 3. Image Lazy Loading

### RECOMMENDED: Native loading="lazy" + unlazy (for placeholders)

**Primary Approach:** Native HTML attribute (no library needed)
```html
<img src="image.jpg" loading="lazy" decoding="async" width="280" height="200">
```

**For BlurHash/ThumbHash placeholders:** unlazy

**Version:** 0.13.0 (latest)
**Size:** ~3KB gzipped
**License:** MIT

```bash
npm install unlazy
```

**Why This Combination:**
- Native lazy loading has 97%+ browser support
- unlazy adds blurry placeholder support (ThumbHash preferred over BlurHash)
- SEO-friendly (detects bots and preloads)
- SSR-compatible (can generate placeholder on server)
- Works with vanilla JS

**Usage:**
```javascript
import { lazyLoad } from 'unlazy';

// Auto-init all images with data-thumbhash
lazyLoad();

// Or specific image with hash
lazyLoad(document.querySelector('#image'), {
    hash: '1QcSHQRnh493V4dIh4eXh1h4kJUI',
    hashType: 'thumbhash'
});
```

```html
<img
  src="data:image/png;base64,..."
  data-src="/images/countertop.jpg"
  data-thumbhash="1QcSHQRnh493V4dIh4eXh1h4kJUI"
  loading="lazy"
  width="280"
  height="200"
>
```

**Alternative:** vanilla-lazyload
- Version 17.8.8, ~2.4KB
- More manual but well-documented
- Good fallback if unlazy doesn't fit

**NOT RECOMMENDED:**
- lozad.js - Less maintained
- lazysizes - Overly complex for our needs

---

## 4. Drag-and-Drop File Upload

### RECOMMENDED: FilePond

**Version:** 4.31.2 (latest)
**Size:** ~25KB gzipped (core)
**License:** MIT

```bash
npm install filepond
```

**Why FilePond:**
- Beautiful default UI fits our dark theme
- Image preview built-in
- Image crop/resize plugins available
- Reorderable uploads
- Progress indicators
- Works perfectly with vanilla JS
- Extremely well-documented

**Usage:**
```javascript
import * as FilePond from 'filepond';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import FilePondPluginImageResize from 'filepond-plugin-image-resize';
import 'filepond/dist/filepond.min.css';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';

FilePond.registerPlugin(FilePondPluginImagePreview, FilePondPluginImageResize);

const pond = FilePond.create(document.querySelector('input[type="file"]'), {
    server: {
        process: '/api/selections/catalog/upload',
        revert: '/api/selections/catalog/upload/revert'
    },
    imageResizeTargetWidth: 1200,
    imageResizeMode: 'contain'
});
```

**Supabase Storage Integration:**
```javascript
// Server-side upload handler
async function handleUpload(file) {
    const { data, error } = await supabase.storage
        .from('selection-images')
        .upload(`catalog/${Date.now()}-${file.originalname}`, file.buffer);
    return data;
}
```

**Alternative:** Dropzone.js
- Version 6.0.0-beta.2, ~43KB
- More established but larger
- Good if FilePond has issues

**Custom Implementation:**
For simpler needs, native Drag & Drop API works fine:
```javascript
dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    // Handle files
});
```

**NOT RECOMMENDED:**
- Uppy - Too heavy (100KB+), designed for complex upload flows
- Fine Uploader - Commercial license

---

## 5. Client-Side Image Compression

### RECOMMENDED: Compressor.js

**Version:** 1.2.1 (latest)
**Size:** ~3.8KB gzipped
**License:** MIT

```bash
npm install compressorjs
```

**Why Compressor.js:**
- Uses native browser Canvas API
- Very small footprint
- Simple API
- Automatically handles orientation (mobile photos)
- Quality control

**Usage:**
```javascript
import Compressor from 'compressorjs';

new Compressor(file, {
    quality: 0.8,
    maxWidth: 2000,
    maxHeight: 2000,
    success(result) {
        // Upload result (Blob) to server
        uploadToSupabase(result);
    },
    error(err) {
        console.error(err.message);
    }
});
```

**Alternative:** browser-image-compression
- Good for Web Worker support
- Slightly larger

**NOT RECOMMENDED:**
- Sharp (server-side only)
- ImageMagick wrappers (server-side)

---

## 6. Supabase Storage Image Transformations

### BUILT-IN: Supabase Image Transforms

**No additional library needed** - Supabase handles this server-side.

**Available on:** Pro plan and above

**Transformation Options:**
| Parameter | Description |
|-----------|-------------|
| width | 1-2500 pixels |
| height | 1-2500 pixels |
| resize | 'cover', 'contain', 'fill' |
| quality | 20-100 |
| format | 'origin' to keep original |

**Usage:**
```javascript
// Generate thumbnail URL
const thumbUrl = supabase.storage
    .from('selection-images')
    .getPublicUrl('catalog/countertop.jpg', {
        transform: {
            width: 300,
            height: 200,
            resize: 'cover'
        }
    }).data.publicUrl;

// Generate full-size URL
const fullUrl = supabase.storage
    .from('selection-images')
    .getPublicUrl('catalog/countertop.jpg').data.publicUrl;
```

**Limits:**
- Max image size: 25MB
- Max resolution: 50MP
- Width/height: 1-2500px

**Cost:** $5 per 1,000 origin images transformed (after plan quota)

---

## 7. ThumbHash Generation (Server-Side)

### RECOMMENDED: thumbhash (npm)

**Version:** 0.1.1
**License:** MIT

```bash
npm install thumbhash sharp
```

**Why ThumbHash over BlurHash:**
- Encodes more detail in same space
- Supports alpha channel (transparency)
- Encodes aspect ratio
- Smaller decoded file size

**Server-Side Generation:**
```javascript
import * as ThumbHash from 'thumbhash';
import sharp from 'sharp';

async function generateThumbHash(imageBuffer) {
    // Resize to max 100px (ThumbHash requirement)
    const { data, info } = await sharp(imageBuffer)
        .resize(100, 100, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Generate hash
    const hash = ThumbHash.rgbaToThumbHash(info.width, info.height, data);

    // Convert to base64 for storage
    return Buffer.from(hash).toString('base64');
}
```

**Store hash in database** (add column to v2_selection_catalog):
```sql
ALTER TABLE v2_selection_catalog ADD COLUMN thumb_hash TEXT;
```

---

## Complete Recommended Stack

| Category | Library | Version | Size |
|----------|---------|---------|------|
| **Lightbox/Gallery** | lightGallery | 2.7.2 | ~16KB |
| **Masonry Grid** | MiniMasonry.js | 3.2.0 | ~2KB |
| **Lazy Loading** | unlazy | 0.13.0 | ~3KB |
| **File Upload** | FilePond | 4.31.2 | ~25KB |
| **Client Compression** | Compressor.js | 1.2.1 | ~4KB |
| **Image Transforms** | Supabase (built-in) | - | 0KB |
| **ThumbHash** | thumbhash + sharp | 0.1.1 | Server only |

**Total frontend bundle increase:** ~50KB gzipped

---

## Installation Commands

```bash
# Core libraries
npm install lightgallery minimasonry unlazy filepond compressorjs

# FilePond plugins
npm install filepond-plugin-image-preview filepond-plugin-image-resize

# Server-side only (already have sharp)
npm install thumbhash
```

---

## What NOT to Use

| Library | Reason |
|---------|--------|
| **React/Vue/Angular** | Project is vanilla JS only |
| **PhotoSwipe** | Too heavy, complex API |
| **Isotope** | Overkill, commercial license for some features |
| **Masonry.js (original)** | 35KB is too heavy |
| **Uppy** | 100KB+ upload library, way too complex |
| **jQuery plugins** | Adds jQuery dependency |
| **lazysizes** | Overly complex, native approach is better |
| **lozad.js** | Less maintained than alternatives |
| **Cloudinary/Imgix** | External service dependency |

---

## Database Schema Additions

```sql
-- Add image support to catalog items
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS thumb_hash TEXT;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

-- Create selection-images storage bucket (via Supabase dashboard)
-- Bucket name: selection-images
-- Public: Yes (for direct image loading)
```

---

## UI Patterns to Implement

Based on research of Materio, BuildBook, and Buildertrend:

1. **Visual Catalog Grid** - Masonry layout of product images with quick-view overlay
2. **Category Filters** - Filter by room, finish type, price range
3. **Selection Comparison** - Side-by-side view of 2-3 options
4. **Room-Based Organization** - Group selections by room (Kitchen, Bath, etc.)
5. **Budget Bar on Thumbnails** - Show at-a-glance if selection is under/over allowance
6. **Drag to Compare** - Drag items to comparison area
7. **Client Portal View** - Simplified view for homeowner approval

---

## References

### Lightbox Libraries
- [lightGallery Official](https://www.lightgalleryjs.com/)
- [10 Best Gallery Lightbox Libraries](https://www.cssscript.com/top-10-javascript-css-gallery-lightbox-libraries/)

### Masonry Layouts
- [MiniMasonry.js](https://spope.github.io/MiniMasonry.js/)
- [Masonry Grid (1.4KB)](https://dev.to/dangreen/masonry-grid-a-14-kb-library-that-actually-works-341n)

### Lazy Loading
- [unlazy Documentation](https://unlazy.byjohann.dev/)
- [vanilla-lazyload](https://github.com/verlok/vanilla-lazyload)
- [Browser-level lazy loading](https://web.dev/articles/browser-level-image-lazy-loading)

### File Upload
- [FilePond](https://pqina.nl/filepond)
- [Dropzone.js](https://www.dropzone.dev/)

### Image Compression
- [Compressor.js](https://github.com/fengyuanchen/compressorjs)
- [browser-image-compression](https://www.npmjs.com/package/browser-image-compression)

### Supabase Storage
- [Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Client-side compression with Supabase](https://dev.to/mikeesto/client-side-image-compression-with-supabase-storage-1193)

### Placeholder Images
- [BlurHash](https://blurha.sh/)
- [ThumbHash](https://github.com/evanw/thumbhash)

### Industry References
- [Materio - Visual Design-Build Software](https://www.materio.co/)
- [BuildBook Client Selections](https://buildbook.co/client-selections-software)
- [Buildertrend Selections](https://buildertrend.com/project-management/construction-selections-software/)
