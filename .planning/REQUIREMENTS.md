# Requirements: Kind Creation

## Overview

This document defines the v1 requirements for upgrading Kind Creation's AI invoice processing system. The goal is to replace the credit-limited Lovable AI gateway with Claude/Anthropic API, adding OCR support and AI learning capabilities.

## v1 Requirements

### AI Extraction (AI)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| AI-01 | Replace Lovable AI gateway with Claude/Anthropic API | Must Have | Core extraction engine upgrade |
| AI-02 | Add OCR support for scanned PDFs using Claude Vision | Must Have | Handle non-digital invoices |
| AI-03 | Multi-strategy cost code suggestions from line items and trade types | Should Have | Improves accuracy |

### AI Learning (LEARN)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| LEARN-01 | Implement AI learning system (corrections improve future extractions) | Must Have | Core value proposition |
| LEARN-02 | Add vendor alias learning (remember vendor name variations) | Must Have | Common variation: "ABC Electric" vs "ABC Electrical Services" |
| LEARN-03 | Add job reference learning (remember job reference patterns) | Should Have | Job numbers vary by vendor |

### PDF Processing (PDF)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| PDF-01 | Improve PDF stamp aesthetics (professional appearance) | Should Have | User feedback: stamps look basic |

### Workflow (WORK)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| WORK-01 | Bulk invoice processing (queue multiple invoices) | Should Have | Efficiency for batch uploads |

## Summary

- **Total v1 Requirements**: 8
- **Must Have**: 5 (AI-01, AI-02, LEARN-01, LEARN-02, LEARN-03)
- **Should Have**: 3 (AI-03, PDF-01, WORK-01)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AI-01 | Phase 1: Claude API Integration | Complete |
| AI-02 | Phase 2: OCR Support | Complete |
| AI-03 | Phase 4: Enhanced Matching | Complete |
| LEARN-01 | Phase 3: AI Learning System | Complete |
| LEARN-02 | Phase 3: AI Learning System | Complete |
| LEARN-03 | Phase 3: AI Learning System | Complete |
| PDF-01 | Phase 5: PDF Stamp Redesign | Complete |
| WORK-01 | Phase 6: Bulk Processing | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Last updated: 2026-01-28*
