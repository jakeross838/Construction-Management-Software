# Phase 110-03: Workflow Stepper - Test Plan

## Manual Testing Checklist

### 1. Stepper Visibility
- [ ] Navigate to estimates page - stepper should NOT be visible
- [ ] Click on an estimate - stepper should appear below mode switcher
- [ ] Close estimate modal - stepper should disappear
- [ ] Switch to Budget mode - stepper should remain hidden

### 2. Step States (Visual)
- [ ] Open a draft estimate with line items
  - Expected: Build step should be highlighted (blue)
  - Expected: Create step should show green checkmark
  - Expected: Review/Send steps should be muted gray
- [ ] First connector should be green (completed)
- [ ] Other connectors should be gray

### 3. Step Navigation - Create
- [ ] Click "Create" step
- [ ] Expected: Edit estimate modal should open
- [ ] Expected: Form should be pre-filled with current estimate data
- [ ] Cancel modal
- [ ] Expected: Should return to estimate detail view

### 4. Step Navigation - Build
- [ ] Click "Build" step
- [ ] Expected: Line Items tab should be active
- [ ] Expected: Line items table visible
- [ ] Stepper should show Build as current (blue highlight)

### 5. Step Navigation - Review
- [ ] Click "Review" step
- [ ] Expected: Overview tab should be active
- [ ] Expected: Actions section shows Review Summary
- [ ] Expected: See line item count, subtotal, total
- [ ] Expected: See "Edit Line Items" and "Continue to Send" buttons
- [ ] Click "Edit Line Items" - should switch to Build step
- [ ] Click "Continue to Send" - should switch to Send step

### 6. Step Navigation - Send
- [ ] Click "Send" step
- [ ] Expected: Overview tab should be active
- [ ] Expected: Actions section shows Send Options
- [ ] Expected: See "Generate PDF Proposal" button (primary)
- [ ] Expected: See "Email to Client" and "Copy Share Link" buttons
- [ ] Click "Generate PDF Proposal" - should open proposal modal
- [ ] Click "Email to Client" - should show toast "Email functionality coming soon"
- [ ] Click "Copy Share Link" - should copy link and show success toast

### 7. Step State Determination
- [ ] Open draft estimate with NO line items
  - Expected: Create step highlighted
- [ ] Open draft estimate WITH line items
  - Expected: Build step highlighted
- [ ] Open submitted estimate
  - Expected: Review step highlighted
- [ ] Open approved estimate
  - Expected: Send step highlighted

### 8. Mobile Responsiveness
- [ ] Resize browser to 640px width
  - Expected: Steps become more compact
  - Expected: Labels may move below step numbers
- [ ] Resize to 400px width
  - Expected: Connectors may hide
  - Expected: Simplified layout
- [ ] All steps should remain clickable

### 9. Integration with Existing Features
- [ ] Switch between tabs manually - stepper should not interfere
- [ ] Edit line items - totals should update
- [ ] Generate proposal from Send step - should work normally
- [ ] Close and reopen estimate - stepper should reset to correct step

### 10. Edge Cases
- [ ] Open estimate, click step, close modal quickly - no errors
- [ ] Click same step multiple times - no errors
- [ ] Click steps rapidly in sequence - UI should update smoothly

## Expected Behaviors

### Visual Feedback
- Current step: Blue background, blue shadow, bold label
- Completed steps: Green circle with white checkmark, normal label weight
- Future steps: Gray circle with number, muted label
- Connectors: Green if completed, gray if not

### Content Changes
| Step | Tab | Content Area |
|------|-----|--------------|
| Create | N/A | Opens edit modal |
| Build | Lines | Line items table |
| Review | Overview | Summary with stats + action buttons |
| Send | Overview | Sharing options + proposal button |

### Status-Based Step
| Estimate Status | Default Step |
|----------------|--------------|
| draft (no lines) | Create |
| draft (with lines) | Build |
| submitted | Review |
| approved | Send |
| sent | Send |
| converted | Send |

## Success Criteria

All checkboxes above should be checked, with:
- No console errors
- Smooth transitions between steps
- Correct visual states
- All click handlers working
- Mobile layout functional
- Integration with existing features maintained
