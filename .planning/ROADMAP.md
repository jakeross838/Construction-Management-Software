# Roadmap: Kind Creation

## Overview

Upgrade Kind Creation's AI invoice processing from the credit-limited Lovable gateway to a sophisticated Claude-powered system with OCR support, learning capabilities, and professional polish. The journey progresses from core API migration through advanced learning features to workflow enhancements.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Claude API Integration** - Replace Lovable AI gateway with Claude/Anthropic API
- [x] **Phase 2: OCR Support** - Add Claude Vision for scanned PDF processing
- [ ] **Phase 3: AI Learning System** - Enable learning from corrections and alias tracking
- [ ] **Phase 4: Enhanced Matching** - Multi-strategy cost code suggestions
- [ ] **Phase 5: PDF Stamp Redesign** - Professional approval stamp aesthetics
- [ ] **Phase 6: Bulk Processing** - Queue and process multiple invoices

## Phase Details

### Phase 1: Claude API Integration
**Goal**: Replace Lovable AI gateway with Claude/Anthropic API for invoice data extraction
**Depends on**: Nothing (first phase)
**Requirements**: AI-01
**Success Criteria** (what must be TRUE):
  1. Invoice uploads call Claude API instead of Lovable gateway
  2. Extraction returns same data structure (vendor, amounts, line items, dates)
  3. Confidence scores returned for each extracted field
  4. Existing matching logic (vendor, job, PO) continues to work
**Research**: Likely (external API integration)
**Research topics**: Claude API for Deno, message format, image/PDF handling
**Plans**: PLAN-01 (Claude API Integration)

### Phase 2: OCR Support
**Goal**: Enable processing of scanned/image-based PDFs using Claude Vision
**Depends on**: Phase 1 (Claude API must be integrated first)
**Requirements**: AI-02
**Success Criteria** (what must be TRUE):
  1. Scanned PDFs are detected (no extractable text)
  2. PDF pages rendered to images when needed
  3. Claude Vision extracts text from images
  4. Extracted text fed to existing extraction pipeline
**Research**: Likely (Claude Vision API, PDF image extraction in Deno)
**Research topics**: pdf-lib image extraction, Claude Vision message format, image encoding
**Plans**: 02-01-PLAN (OCR Support)

### Phase 3: AI Learning System
**Goal**: System learns from user corrections to improve future extractions
**Depends on**: Phase 1 (needs Claude API for contextual learning)
**Requirements**: LEARN-01, LEARN-02, LEARN-03
**Success Criteria** (what must be TRUE):
  1. User corrections to vendor matches are stored
  2. User corrections to job matches are stored
  3. Future extractions check learned mappings first
  4. Vendor name variations map to canonical vendor
  5. Job reference patterns map to correct job
**Research**: Unlikely (database operations, existing matching patterns)
**Plans**: TBD

### Phase 4: Enhanced Matching
**Goal**: Improve cost code suggestions using multiple strategies
**Depends on**: Phase 3 (can use learned patterns)
**Requirements**: AI-03
**Success Criteria** (what must be TRUE):
  1. Line item descriptions suggest relevant cost codes
  2. Vendor trade type informs cost code suggestions
  3. Historical allocations inform suggestions
  4. Multiple suggestions ranked by confidence
**Research**: Unlikely (extending existing matching logic)
**Plans**: TBD

### Phase 5: PDF Stamp Redesign
**Goal**: Professional-looking approval stamps on invoices
**Depends on**: Phase 1 (can run in parallel after Claude integration)
**Requirements**: PDF-01
**Success Criteria** (what must be TRUE):
  1. Stamps have professional typography and layout
  2. Status colors are visually clear
  3. Stamp includes all required info (date, approver, amounts)
  4. Stamps don't obscure invoice content
**Research**: Unlikely (pdf-lib already in use)
**Plans**: TBD

### Phase 6: Bulk Processing
**Goal**: Process multiple invoices in a queue
**Depends on**: Phase 2 (needs OCR support for all invoice types)
**Requirements**: WORK-01
**Success Criteria** (what must be TRUE):
  1. User can upload multiple files at once
  2. Progress indicator shows queue status
  3. Each invoice processes independently (one failure doesn't block others)
  4. Results available as each completes
**Research**: Unlikely (frontend queue pattern, existing edge function)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6
(Phases 4 and 5 could potentially run in parallel after Phase 3)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Claude API Integration | 1/1 | Complete | 2026-01-27 |
| 2. OCR Support | 1/1 | Complete | 2026-01-27 |
| 3. AI Learning System | 0/TBD | Not started | - |
| 4. Enhanced Matching | 0/TBD | Not started | - |
| 5. PDF Stamp Redesign | 0/TBD | Not started | - |
| 6. Bulk Processing | 0/TBD | Not started | - |
