/**
 * GanttChart Component
 *
 * A CSS-based Gantt chart visualization for construction schedules.
 * This is a re-export of the enhanced ScheduleGanttView component.
 *
 * Features:
 * - Tasks displayed as horizontal bars on a timeline
 * - Color coding by status (gray=not_started, blue=in_progress, green=completed, red=delayed)
 * - Dependencies shown as lines between tasks (FS and SS types)
 * - Milestones displayed as diamond shapes
 * - Baseline visualization (toggle to show/hide)
 * - Today marker (vertical line)
 * - Horizontal scroll for timeline navigation
 * - Click task to open edit dialog
 * - Drag and drop to reschedule tasks
 * - Drag from handles to create predecessor links
 */

export { ScheduleGanttView as GanttChart } from './ScheduleGanttView';

// Also export the component with its original name for backward compatibility
export { ScheduleGanttView } from './ScheduleGanttView';
