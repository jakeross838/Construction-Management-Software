# Roadmap: v2.0 Business Operating System

**Milestone:** v2.0 Business Operating System
**Status:** In Progress
**Started:** 2026-01-19

## Overview

Transform from construction project management into a complete business operating system. Full CRM, Job Hub, crew scheduling, permitting, and business-wide metrics.

**Phases:** 8 (57-64)
**Requirements:** 26

---

## Phase 57: CRM Foundation

**Goal:** Create contacts and companies database with relationship management

**Depends on:** Nothing (first phase)
**Requirements:** CRM-01, CRM-02, CRM-03
**Research:** Unlikely (extends existing vendor/lead patterns)

**Success Criteria:**
1. User can create contacts with roles (client, vendor, sub, architect, inspector)
2. User can create company/organization records
3. User can link multiple contacts to a company
4. Contacts appear in global search

---

## Phase 58: Communication Logging

**Goal:** Track calls, emails, and meetings tied to contacts and jobs

**Depends on:** Phase 57 (CRM Foundation)
**Requirements:** CRM-04, CRM-05
**Research:** Unlikely (follows activity log patterns)

**Success Criteria:**
1. User can log communications (calls, emails, meetings) to any contact
2. User can link communications to jobs
3. Communication history visible on contact and job pages

---

## Phase 59: Jobs Enhancement

**Goal:** Add categories, timeline tracking, and contract health metrics to jobs

**Depends on:** Nothing (enhances existing jobs)
**Requirements:** JMGT-01, JMGT-02, JMGT-03
**Research:** Unlikely (extends existing job profile)

**Success Criteria:**
1. User can assign job category (new construction, remodel, addition, commercial)
2. User can set job timeline (start date, projected end, actual end)
3. User can view contract health (remaining value, burn rate, profit)

---

## Phase 60: Contracts

**Goal:** Contract document storage with versioning, terms tracking, and amendments

**Depends on:** Phase 59 (Jobs Enhancement)
**Requirements:** CNTR-01, CNTR-02, CNTR-03
**Research:** Unlikely (follows document versioning patterns)

**Success Criteria:**
1. User can upload contract documents with versioning
2. User can track contract terms (dates, amounts, parties)
3. User can track contract amendments over time

---

## Phase 61: Job Hub

**Goal:** 360° central view of each job with financials, activity, and status

**Depends on:** Phase 59 (Jobs Enhancement), Phase 58 (Communication)
**Requirements:** HUB-01, HUB-02, HUB-03
**Research:** Unlikely (aggregates existing data into new view)

**Success Criteria:**
1. User can view 360° job page with financial summary (budget, invoices, draws, P&L)
2. User can view activity timeline for a job (recent actions across all modules)
3. User can view status dashboard (punch lists, inspections, RFIs, submittals)

---

## Phase 62: Crew Scheduling

**Goal:** PM work requests, auto-scheduling, calendar view, and crew task queue

**Depends on:** Phase 57 (CRM for crew contacts)
**Requirements:** CREW-01, CREW-02, CREW-03, CREW-04
**Research:** Likely (new scheduling algorithm, calendar component)
**Research Topics:** Scheduling algorithms, calendar libraries (FullCalendar vs custom), drag-drop patterns

**Success Criteria:**
1. PM can submit work requests that become schedulable items
2. System auto-schedules crew based on availability
3. User can view/edit crew calendar with drag-to-reschedule
4. Crew can view task queue and check off completed items

---

## Phase 63: Permitting

**Goal:** Permit applications, inspection scheduling, and document management

**Depends on:** Phase 57 (CRM for inspector contacts)
**Requirements:** PERM-01, PERM-02, PERM-03, PERM-04
**Research:** Unlikely (follows existing workflow patterns)

**Success Criteria:**
1. User can create permit applications (type, submission date, status)
2. User can schedule inspections with inspector contacts
3. User can upload permit documents (permits, approvals, COO)
4. User can track permit status through approval workflow

---

## Phase 64: Business Dashboard

**Goal:** Company-wide metrics, burn rate analysis, and profit projections

**Depends on:** Phase 59 (Jobs Enhancement for contract health data)
**Requirements:** BIZ-01, BIZ-02, BIZ-03, BIZ-04
**Research:** Unlikely (uses Chart.js already in stack)

**Success Criteria:**
1. User can view job timeline tracking with contract remaining calculations
2. User can view burn rate analysis across jobs
3. User can view company-wide metrics dashboard (pipeline, capacity, health)
4. User can view profit projections across jobs

---

## Dependency Graph

```
57 CRM Foundation ─────┬──→ 58 Communication ──→ 61 Job Hub
                       │                              ↑
                       ├──→ 62 Crew Scheduling        │
                       │                              │
                       └──→ 63 Permitting             │
                                                      │
59 Jobs Enhancement ───┬──→ 60 Contracts             │
                       │                              │
                       └──→ 64 Business Dashboard ────┘
```

---

## Summary

| Metric | Value |
|--------|-------|
| Phases | 8 (57-64) |
| Requirements | 26 |
| Research Likely | 1 phase (Crew Scheduling) |

---
*Roadmap created: 2026-01-19*
