# Phase 112-04: Hierarchy Creation & Drag-and-Drop - SUMMARY

## Objective
Complete the hierarchy system by adding UI to create phases/groups/subgroups AND implement drag-and-drop to move items between subgroups.

## What Was Built

### 1. API Endpoints for Hierarchy Creation
Added 4 new API routes to `server/routes/estimates.js`:
- `POST /api/estimates/:id/phases` - Create a new phase
- `POST /api/estimates/:id/phases/:phaseId/groups` - Create a new group within a phase
- `POST /api/estimates/:id/groups/:groupId/subgroups` - Create a new subgroup within a group
- `POST /api/estimates/:id/reorder` - Reorder items (for drag-and-drop between subgroups)

### 2. Creation Modals
Added 3 new modals to `public/estimates-budget.html`:
- **Phase Modal**: Fields for phase name, phase code, and description
- **Group Modal**: Dropdown to select parent phase, plus name and description
- **Subgroup Modal**: Dropdown to select parent group, plus name and description

Added toolbar buttons to open each modal (+ Phase, + Group, + Subgroup)

### 3. JavaScript Modal Functions
Added modal handling functions to `public/js/estimates-budget.js`:
- `openPhaseModal()`, `closePhaseModal()`, `savePhase()`
- `openGroupModal()`, `closeGroupModal()`, `saveGroup()`
- `openSubgroupModal()`, `closeSubgroupModal()`, `saveSubgroup()`

Each save function:
- Validates required fields
- Makes API call to create the hierarchy item
- Shows success toast
- Reloads the estimate to show the new structure

### 4. Drag-and-Drop System
Implemented drag-and-drop functionality in `public/js/estimates-budget.js`:
- Added `draggedItem` state variable to track what's being dragged
- Created `initDragDrop()` function that:
  - Makes item rows draggable (HTML5 drag API)
  - Makes subgroup rows drop zones
  - Handles drag events (dragstart, dragend, dragover, dragleave, drop)
  - Calls `/api/estimates/:id/reorder` API when item is dropped
- Updated `renderEstimateHierarchy()` to call `initDragDrop()` after rendering
- Added `data-item-id` and `data-subgroup-id` attributes to item rows
- Added `data-subgroup-id` attribute to subgroup rows

Added CSS styles for drag states:
- `.item-row[draggable="true"]` - cursor: grab
- `.item-row.dragging` - opacity: 0.5
- `.drop-zone-active` - blue dashed border with subtle background

### 5. Subgroup Selector in Line Item Modal
Updated the line item creation modal:
- Added subgroup dropdown to `public/estimates-budget.html`
- Updated `openAddLineModal()` to populate subgroup options (showing full path: Phase > Group > Subgroup)
- Updated `saveLineItem()` to include `subgroup_id` in the request body

## Files Changed

1. **server/routes/estimates.js**
   - Added 4 new API endpoints (lines 2448-2528)

2. **public/estimates-budget.html**
   - Updated toolbar with + Phase, + Group, + Subgroup buttons (lines 708-711)
   - Added 3 new modals: phaseModal, groupModal, subgroupModal (lines 2086-2172)
   - Added subgroup dropdown to line item modal (lines 2052-2057)
   - Added drag-and-drop CSS styles (lines 531-544)

3. **public/js/estimates-budget.js**
   - Added hierarchy creation modal functions (lines 3080-3253)
   - Added drag-and-drop system (lines 3255-3325)
   - Updated `renderEstimateHierarchy()` to call initDragDrop (line 1066)
   - Updated `renderSubgroupRow()` to add data-subgroup-id (line 1109)
   - Updated `renderItemRow()` to add data-item-id and data-subgroup-id (line 1129)
   - Updated `openAddLineModal()` to populate subgroups (lines 730-742)
   - Updated `saveLineItem()` to include subgroup_id (lines 805, 827)

## Features Added

✅ User can create phases via modal
✅ User can create groups within phases via modal
✅ User can create subgroups within groups via modal
✅ User can drag line items between subgroups
✅ Visual feedback during drag (opacity change, cursor change, drop zone highlight)
✅ User can assign items to subgroups when creating line items
✅ All changes persist to database
✅ Modals properly populate dropdowns based on current hierarchy

## Testing Notes

### Manual Testing Steps
1. **Create Phase**:
   - Click "+ Phase" button
   - Enter phase name (e.g., "Foundation")
   - Optional: Enter phase code and description
   - Click "Save Phase"
   - Verify phase appears in hierarchy

2. **Create Group**:
   - Click "+ Group" button
   - Select a phase from dropdown
   - Enter group name (e.g., "Concrete Work")
   - Click "Save Group"
   - Verify group appears under selected phase

3. **Create Subgroup**:
   - Click "+ Subgroup" button
   - Select a group from dropdown (shows as "Phase > Group")
   - Enter subgroup name (e.g., "Footings")
   - Click "Save Subgroup"
   - Verify subgroup appears under selected group

4. **Drag-and-Drop**:
   - Create at least 2 subgroups
   - Add line items to one subgroup
   - Drag an item from one subgroup and drop on another subgroup row
   - Verify item moves to new subgroup
   - Verify "Item moved" toast appears

5. **Line Item with Subgroup**:
   - Click "Add Item" button
   - Fill in line item details
   - Select a subgroup from the dropdown
   - Save item
   - Verify item appears under selected subgroup

### Expected Behavior
- Modals open/close smoothly with fade transition
- Dropdowns populate correctly based on hierarchy
- API calls succeed and return created items
- Drag-and-drop provides visual feedback
- Items can be moved between subgroups
- Changes persist after page reload

## Success Criteria
✅ User can create phases
✅ User can create groups within phases
✅ User can create subgroups within groups
✅ User can assign items to subgroups when creating
✅ User can drag items between subgroups
✅ Visual feedback during drag
✅ Changes persist to database

## Next Steps
- Implement reordering within the same subgroup (currently only supports moving between subgroups)
- Add ability to edit/delete phases, groups, and subgroups
- Add drag handles to make it clearer which items are draggable
- Consider adding keyboard shortcuts for hierarchy operations
