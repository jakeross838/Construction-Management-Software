/**
 * Schedule/Gantt Chart PDF Generator
 * Creates professional schedule PDFs with task lists, timeline visualization, and summary statistics
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// Brand colors (matching other PDF generators)
const BRAND_COLOR = rgb(0.29, 0.4, 0.45); // #4A6672 slate teal
const TEXT_DARK = rgb(0.2, 0.2, 0.2);
const TEXT_LIGHT = rgb(0.5, 0.5, 0.5);
const BORDER_COLOR = rgb(0.85, 0.85, 0.85);
const HEADER_BG = rgb(0.95, 0.95, 0.95);

// Status colors
const STATUS_COLORS = {
  scheduled: rgb(0.92, 0.70, 0.03), // Yellow
  in_progress: rgb(0.23, 0.51, 0.96), // Blue
  completed: rgb(0.42, 0.49, 0.50), // Gray
  delayed: rgb(0.92, 0.35, 0.05), // Orange
  cancelled: rgb(0.61, 0.64, 0.65), // Light gray
  not_started: rgb(0.92, 0.70, 0.03), // Yellow
  on_hold: rgb(0.92, 0.35, 0.05), // Orange
};

// Task type colors
const TASK_TYPE_COLORS = {
  work: rgb(0.23, 0.51, 0.96), // Blue
  inspection: rgb(0.86, 0.15, 0.15), // Red
  delivery: rgb(0.49, 0.23, 0.93), // Purple
  milestone: rgb(0.03, 0.57, 0.70), // Cyan
  meeting: rgb(0.01, 0.52, 0.78), // Sky blue
  walkthrough: rgb(0.85, 0.28, 0.93), // Fuchsia
  punch_list: rgb(0.98, 0.45, 0.09), // Orange
};

// Page constants
const PAGE_WIDTH = 792; // Landscape Letter
const PAGE_HEIGHT = 612;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN);

/**
 * Format date string
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format short date for timeline
 */
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Calculate duration in days between two dates
 */
function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } catch {
    return 0;
  }
}

/**
 * Get status label
 */
function getStatusLabel(status) {
  const labels = {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
    not_started: 'Not Started',
    on_hold: 'On Hold',
  };
  return labels[status] || status || 'Unknown';
}

/**
 * Check if we need a new page
 */
function checkPageBreak(pdfDoc, currentPage, currentY, neededSpace) {
  const BOTTOM_MARGIN = 50;
  if (currentY - neededSpace < BOTTOM_MARGIN) {
    const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page: newPage, y: PAGE_HEIGHT - MARGIN };
  }
  return { page: currentPage, y: currentY };
}

/**
 * Draw a horizontal line
 */
function drawLine(page, x1, y, x2, color = BORDER_COLOR, thickness = 0.5) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color
  });
}

/**
 * Truncate text to fit within maxWidth
 */
function truncateText(text, font, size, maxWidth) {
  if (!text) return '';
  const textWidth = font.widthOfTextAtSize(text, size);
  if (textWidth <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 3 && font.widthOfTextAtSize(truncated + '...', size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Format predecessors for display
 */
function formatPredecessors(predecessors, allTasks) {
  if (!predecessors || predecessors.length === 0) return 'None';

  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const predLabels = predecessors.map(pred => {
    const task = taskMap.get(pred.task_id);
    if (task) {
      const taskIndex = allTasks.findIndex(t => t.id === pred.task_id) + 1;
      return `${taskIndex}${pred.type || 'FS'}`;
    }
    return null;
  }).filter(Boolean);

  return predLabels.length > 0 ? predLabels.join(', ') : 'None';
}

/**
 * Generate Schedule PDF
 * @param {Object} data - Schedule data
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateSchedulePDF(data) {
  const {
    job,
    schedule,
    tasks = [],
  } = data;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // First page - landscape orientation
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // === HEADER ===
  page.drawText('PROJECT SCHEDULE', {
    x: MARGIN, y, font: boldFont, size: 18, color: BRAND_COLOR
  });

  // Date generated on right
  const dateGenerated = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const dateText = `Generated: ${dateGenerated}`;
  const dateWidth = font.widthOfTextAtSize(dateText, 10);
  page.drawText(dateText, {
    x: PAGE_WIDTH - MARGIN - dateWidth, y: y + 5, font, size: 10, color: TEXT_LIGHT
  });
  y -= 25;

  // === JOB INFO ===
  if (job) {
    page.drawText(job.name || 'Project Name', {
      x: MARGIN, y, font: boldFont, size: 14, color: TEXT_DARK
    });
    y -= 16;

    if (job.address) {
      page.drawText(job.address, {
        x: MARGIN, y, font, size: 10, color: TEXT_LIGHT
      });
      y -= 14;
    }

    if (job.client_name) {
      page.drawText(`Client: ${job.client_name}`, {
        x: MARGIN, y, font, size: 10, color: TEXT_LIGHT
      });
      y -= 14;
    }
  }

  // Schedule dates if available
  if (schedule) {
    const scheduleInfo = [];
    if (schedule.start_date) scheduleInfo.push(`Start: ${formatDate(schedule.start_date)}`);
    if (schedule.target_end_date) scheduleInfo.push(`Target End: ${formatDate(schedule.target_end_date)}`);
    if (scheduleInfo.length > 0) {
      page.drawText(scheduleInfo.join('  |  '), {
        x: MARGIN, y, font, size: 10, color: TEXT_LIGHT
      });
      y -= 14;
    }
  }

  y -= 15;
  drawLine(page, MARGIN, y, PAGE_WIDTH - MARGIN, BRAND_COLOR, 1);
  y -= 20;

  // === SUMMARY STATS ===
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    scheduled: tasks.filter(t => t.status === 'scheduled' || t.status === 'not_started').length,
    delayed: tasks.filter(t => t.status === 'delayed').length,
  };

  const avgComplete = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.percent_complete || 0), 0) / tasks.length)
    : 0;

  // Stats row
  page.drawText('SUMMARY', { x: MARGIN, y, font: boldFont, size: 11, color: TEXT_DARK });
  y -= 18;

  const statsText = [
    `Total Tasks: ${stats.total}`,
    `Completed: ${stats.completed}`,
    `In Progress: ${stats.inProgress}`,
    `Scheduled: ${stats.scheduled}`,
    `Delayed: ${stats.delayed}`,
    `Avg Progress: ${avgComplete}%`
  ].join('    |    ');

  page.drawText(statsText, { x: MARGIN, y, font, size: 9, color: TEXT_LIGHT });
  y -= 25;

  // === TASK TABLE ===
  if (tasks.length === 0) {
    page.drawText('No tasks found for this schedule.', {
      x: MARGIN, y, font, size: 11, color: TEXT_LIGHT
    });
    return Buffer.from(await pdfDoc.save());
  }

  // Table column configuration
  const columns = [
    { header: '#', width: 25, align: 'center' },
    { header: 'Task Name', width: 180, align: 'left' },
    { header: 'Start Date', width: 75, align: 'center' },
    { header: 'End Date', width: 75, align: 'center' },
    { header: 'Duration', width: 50, align: 'center' },
    { header: '% Complete', width: 60, align: 'center' },
    { header: 'Status', width: 75, align: 'center' },
    { header: 'Predecessors', width: 80, align: 'center' },
    { header: 'Phase', width: 92, align: 'left' },
  ];

  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const tableStartX = MARGIN;

  // Draw table header
  ({ page, y } = checkPageBreak(pdfDoc, page, y, 25));

  // Header background
  page.drawRectangle({
    x: tableStartX,
    y: y - 15,
    width: tableWidth,
    height: 18,
    color: HEADER_BG
  });

  let colX = tableStartX;
  for (const col of columns) {
    const textWidth = boldFont.widthOfTextAtSize(col.header, 8);
    let textX = colX + 4;
    if (col.align === 'center') {
      textX = colX + (col.width - textWidth) / 2;
    }
    page.drawText(col.header, {
      x: textX, y: y - 11, font: boldFont, size: 8, color: TEXT_DARK
    });
    colX += col.width;
  }

  y -= 18;
  drawLine(page, tableStartX, y, tableStartX + tableWidth, BORDER_COLOR, 1);
  y -= 3;

  // Draw task rows
  const rowHeight = 16;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    // Check for page break
    ({ page, y } = checkPageBreak(pdfDoc, page, y, rowHeight + 5));

    // If we're on a new page, redraw the header
    if (y > PAGE_HEIGHT - MARGIN - 50) {
      // Header background
      page.drawRectangle({
        x: tableStartX,
        y: y - 15,
        width: tableWidth,
        height: 18,
        color: HEADER_BG
      });

      colX = tableStartX;
      for (const col of columns) {
        const textWidth = boldFont.widthOfTextAtSize(col.header, 8);
        let textX = colX + 4;
        if (col.align === 'center') {
          textX = colX + (col.width - textWidth) / 2;
        }
        page.drawText(col.header, {
          x: textX, y: y - 11, font: boldFont, size: 8, color: TEXT_DARK
        });
        colX += col.width;
      }

      y -= 18;
      drawLine(page, tableStartX, y, tableStartX + tableWidth, BORDER_COLOR, 1);
      y -= 3;
    }

    // Alternate row background
    if (i % 2 === 1) {
      page.drawRectangle({
        x: tableStartX,
        y: y - rowHeight + 3,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.98)
      });
    }

    // Critical path indicator
    if (task.critical_path) {
      page.drawRectangle({
        x: tableStartX,
        y: y - rowHeight + 3,
        width: 3,
        height: rowHeight,
        color: rgb(0.86, 0.15, 0.15) // Red for critical path
      });
    }

    // Row data
    const duration = calculateDuration(task.start_date || task.planned_start, task.end_date || task.planned_end);
    const statusColor = STATUS_COLORS[task.status] || TEXT_DARK;

    const rowData = [
      { value: String(i + 1), bold: false },
      { value: task.name || 'Unnamed Task', bold: task.is_milestone },
      { value: formatShortDate(task.start_date || task.planned_start), bold: false },
      { value: formatShortDate(task.end_date || task.planned_end), bold: false },
      { value: `${duration} day${duration !== 1 ? 's' : ''}`, bold: false },
      { value: `${task.percent_complete || 0}%`, bold: false },
      { value: getStatusLabel(task.status), bold: false, color: statusColor },
      { value: formatPredecessors(task.predecessors, tasks), bold: false },
      { value: task.phase || '-', bold: false },
    ];

    colX = tableStartX;
    for (let j = 0; j < columns.length; j++) {
      const col = columns[j];
      const cellData = rowData[j];
      const cellFont = cellData.bold ? boldFont : font;
      const cellColor = cellData.color || TEXT_DARK;

      const truncatedText = truncateText(cellData.value, cellFont, 8, col.width - 8);
      const textWidth = cellFont.widthOfTextAtSize(truncatedText, 8);

      let textX = colX + 4;
      if (col.align === 'center') {
        textX = colX + (col.width - textWidth) / 2;
      }

      page.drawText(truncatedText, {
        x: textX, y: y - 10, font: cellFont, size: 8, color: cellColor
      });

      colX += col.width;
    }

    y -= rowHeight;
    drawLine(page, tableStartX, y + 3, tableStartX + tableWidth, rgb(0.9, 0.9, 0.9), 0.5);
  }

  // === LEGEND ===
  y -= 25;
  ({ page, y } = checkPageBreak(pdfDoc, page, y, 60));

  drawLine(page, MARGIN, y, PAGE_WIDTH - MARGIN, BORDER_COLOR, 0.5);
  y -= 15;

  page.drawText('LEGEND', { x: MARGIN, y, font: boldFont, size: 9, color: TEXT_DARK });
  y -= 14;

  // Status legend
  const statusLegend = [
    { status: 'scheduled', label: 'Scheduled' },
    { status: 'in_progress', label: 'In Progress' },
    { status: 'completed', label: 'Completed' },
    { status: 'delayed', label: 'Delayed' },
  ];

  let legendX = MARGIN;
  for (const item of statusLegend) {
    page.drawRectangle({
      x: legendX, y: y - 4, width: 10, height: 10,
      color: STATUS_COLORS[item.status]
    });
    page.drawText(item.label, {
      x: legendX + 14, y: y - 2, font, size: 8, color: TEXT_LIGHT
    });
    legendX += 90;
  }

  // Critical path legend
  legendX = MARGIN;
  y -= 16;
  page.drawRectangle({
    x: legendX, y: y - 4, width: 10, height: 10,
    color: rgb(0.86, 0.15, 0.15), borderColor: rgb(0.86, 0.15, 0.15), borderWidth: 1
  });
  page.drawText('Critical Path (red left border on task row)', {
    x: legendX + 14, y: y - 2, font, size: 8, color: TEXT_LIGHT
  });

  // Predecessor notation
  y -= 16;
  page.drawText('Predecessor Notation: Task#[Type] (e.g., "3FS" = Task 3 must Finish before this task Starts)', {
    x: MARGIN, y, font, size: 8, color: TEXT_LIGHT
  });
  y -= 12;
  page.drawText('FS = Finish-to-Start  |  SS = Start-to-Start', {
    x: MARGIN, y, font, size: 8, color: TEXT_LIGHT
  });

  // === FOOTER ===
  y -= 25;
  const pageCount = pdfDoc.getPageCount();
  const footerText = `Page 1 of ${pageCount}  |  Ross Built Construction Management System`;
  const footerWidth = font.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (PAGE_WIDTH - footerWidth) / 2,
    y: MARGIN / 2,
    font, size: 8, color: TEXT_LIGHT
  });

  // Add page numbers to all pages
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageText = `Page ${i + 1} of ${pageCount}  |  Ross Built Construction Management System`;
    const pageTextWidth = font.widthOfTextAtSize(pageText, 8);
    p.drawText(pageText, {
      x: (PAGE_WIDTH - pageTextWidth) / 2,
      y: MARGIN / 2,
      font, size: 8, color: TEXT_LIGHT
    });
  }

  return Buffer.from(await pdfDoc.save());
}

module.exports = {
  generateSchedulePDF,
  formatDate,
  formatShortDate,
  calculateDuration,
  getStatusLabel,
};
