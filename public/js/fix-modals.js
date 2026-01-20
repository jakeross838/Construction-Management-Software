/**
 * Fix Modals - UI for fixing validation errors
 * Displays validation errors and provides one-click fix options
 * Includes bulk fix operations and validation summary component
 * UPDATED: 2026-01-19 - Added bulk fix and validation summary
 */
window.FixModals = {
  activeFixModal: null,
  escapeHandler: null,
  currentBulkErrors: null,

  /**
   * Show fix modal for a specific error
   * @param {Object} error - Error object from validation endpoint
   * @param {Object} context - Additional context (invoice_id, po_id, job_id)
   */
  showFixModal(error, context) {
    // Close any existing modal
    this.closeFixModal();

    const modalHtml = this.buildFixModal(error, context);
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    this.activeFixModal = document.getElementById('fixModal');
    this.activeFixModal.style.display = 'flex';
    requestAnimationFrame(() => this.activeFixModal.classList.add('show'));

    // Set up event listeners
    this.setupFixModalEvents(error, context);
  },

  buildFixModal(error, context) {
    const title = this.getErrorTitle(error.type);
    const description = this.getErrorDescription(error);
    const options = this.getFixOptions(error, context);

    return `
      <div id="fixModal" class="modal modal-centered">
        <div class="modal-content fix-modal-content">
          <div class="modal-header">
            <h3 class="modal-title">
              <span class="error-icon">!</span>
              ${title}
            </h3>
            <button class="modal-close" onclick="FixModals.closeFixModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="fix-error-details">
              <p class="fix-description">${description}</p>
              ${error.fix_hint ? `<p class="fix-hint"><strong>Suggested fix:</strong> ${error.fix_hint}</p>` : ''}
              ${this.buildErrorDetails(error)}
            </div>
            <div class="fix-options">
              <h4>Fix Options</h4>
              ${options}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="FixModals.closeFixModal()">Cancel</button>
          </div>
        </div>
      </div>
    `;
  },

  getErrorTitle(type) {
    const titles = {
      'ORPHANED_PO_ALLOCATION': 'Orphaned PO Allocation',
      'ORPHANED_LINE_ITEM_ALLOCATION': 'Orphaned Line Item Allocation',
      'ORPHANED_CO_ALLOCATION': 'Orphaned Change Order Allocation',
      'CO_TOTAL_MISMATCH': 'Change Order Total Mismatch',
      'PO_TOTAL_MISMATCH': 'PO Total Mismatch',
      'ALLOCATION_SUM_EXCEEDS_INVOICE': 'Allocations Exceed Invoice',
      'OVER_COMMITTED': 'Budget Over-Committed',
      'OVER_BILLED': 'Over-Billed Amount'
    };
    return titles[type] || 'Validation Error';
  },

  getErrorDescription(error) {
    const stored_co_total = error.details?.stored_co_total;
    const calculated_co_total = error.details?.calculated_co_total;
    const stored_total = error.details?.stored_total;
    const expected_total = error.details?.expected_total;
    const allocation_sum = error.details?.allocation_sum;
    const invoice_amount = error.details?.invoice_amount;

    const descriptions = {
      'ORPHANED_PO_ALLOCATION': 'This allocation references a PO that no longer exists or has been deleted.',
      'ORPHANED_LINE_ITEM_ALLOCATION': 'This allocation references a PO line item that no longer exists.',
      'ORPHANED_CO_ALLOCATION': 'This allocation references a change order that no longer exists.',
      'CO_TOTAL_MISMATCH': `The stored change order total ($${stored_co_total?.toFixed(2) || '?'}) doesn't match the calculated sum of approved COs ($${calculated_co_total?.toFixed(2) || '?'}).`,
      'PO_TOTAL_MISMATCH': `The stored PO total ($${stored_total?.toFixed(2) || '?'}) doesn't match original + COs ($${expected_total?.toFixed(2) || '?'}).`,
      'ALLOCATION_SUM_EXCEEDS_INVOICE': `Allocations total ($${allocation_sum?.toFixed(2) || '?'}) exceeds invoice amount ($${invoice_amount?.toFixed(2) || '?'}).`
    };
    return descriptions[error.type] || 'A validation error was detected.';
  },

  buildErrorDetails(error) {
    if (!error.details) return '';

    const details = [];
    if (error.invoice_number) details.push(`Invoice: ${error.invoice_number}`);
    if (error.po_number) details.push(`PO: ${error.po_number}`);
    if (error.cost_code) details.push(`Cost Code: ${error.cost_code}`);
    if (error.details.discrepancy) details.push(`Discrepancy: $${error.details.discrepancy.toFixed(2)}`);

    if (details.length === 0) return '';

    return `
      <div class="fix-details-list">
        ${details.map(d => `<span class="fix-detail-item">${d}</span>`).join('')}
      </div>
    `;
  },

  getFixOptions(error, context) {
    const options = [];

    switch (error.type) {
      case 'ORPHANED_PO_ALLOCATION':
      case 'ORPHANED_LINE_ITEM_ALLOCATION':
      case 'ORPHANED_CO_ALLOCATION':
        options.push({
          label: 'Remove Allocation',
          action: 'remove',
          description: 'Delete this orphaned allocation',
          btnClass: 'btn-danger'
        });
        options.push({
          label: 'Reassign to Another PO',
          action: 'reassign',
          description: 'Link this allocation to a different PO',
          btnClass: 'btn-primary'
        });
        break;

      case 'CO_TOTAL_MISMATCH':
      case 'PO_TOTAL_MISMATCH':
        options.push({
          label: 'Recalculate Totals',
          action: 'recalculate',
          description: 'Automatically recalculate from approved COs',
          btnClass: 'btn-primary'
        });
        break;

      case 'ALLOCATION_SUM_EXCEEDS_INVOICE':
        options.push({
          label: 'View Allocations',
          action: 'view_allocations',
          description: 'Open invoice to adjust allocations manually',
          btnClass: 'btn-secondary'
        });
        break;

      default:
        options.push({
          label: 'View Details',
          action: 'view_details',
          description: 'See full error details',
          btnClass: 'btn-secondary'
        });
    }

    return options.map(opt => `
      <button class="fix-option-btn ${opt.btnClass}" data-action="${opt.action}">
        <span class="fix-option-label">${opt.label}</span>
        <span class="fix-option-desc">${opt.description}</span>
      </button>
    `).join('');
  },

  setupFixModalEvents(error, context) {
    const modal = this.activeFixModal;
    if (!modal) return;

    // Fix option buttons
    modal.querySelectorAll('.fix-option-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        await this.executeFixAction(action, error, context);
      });
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeFixModal();
    });

    // Close on Escape
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') this.closeFixModal();
    };
    document.addEventListener('keydown', this.escapeHandler);
  },

  async executeFixAction(action, error, context) {
    const modal = this.activeFixModal;
    const buttons = modal.querySelectorAll('.fix-option-btn');
    buttons.forEach(b => b.disabled = true);

    try {
      let result;

      switch (action) {
        case 'remove':
          result = await this.removeAllocation(error, context);
          break;
        case 'reassign':
          // Open PO selector for reassignment
          this.closeFixModal();
          this.showReassignModal(error, context);
          return;
        case 'recalculate':
          result = await this.recalculateTotals(error, context);
          break;
        case 'view_allocations':
          this.closeFixModal();
          if (context.invoice_id) {
            window.Modals?.openInvoice?.(context.invoice_id);
          }
          return;
        case 'view_details':
          console.log('Error details:', error);
          window.toasts?.show('info', 'See browser console for details');
          return;
      }

      if (result?.success) {
        window.toasts?.show('success', 'Fix applied successfully');
        this.closeFixModal();
        // Trigger refresh of validation display
        if (this.onFixComplete) this.onFixComplete(result);
      } else {
        window.toasts?.show('error', result?.error || 'Fix failed');
      }
    } catch (err) {
      console.error('Fix action failed:', err);
      window.toasts?.show('error', 'Fix failed: ' + err.message);
    } finally {
      buttons.forEach(b => b.disabled = false);
    }
  },

  async removeAllocation(error, context) {
    const response = await fetch(`/api/invoices/${context.invoice_id}/fix-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allocation_id: error.details?.allocation_id,
        fix_action: 'remove',
        performed_by: window.currentUser || 'User'
      })
    });
    return response.json();
  },

  async recalculateTotals(error, context) {
    const response = await fetch(`/api/purchase-orders/${context.po_id}/fix-totals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fix_actions: ['co_total', 'po_total'],
        performed_by: window.currentUser || 'User'
      })
    });
    return response.json();
  },

  showReassignModal(error, context) {
    // TODO: Implement PO selector for reassignment
    window.toasts?.show('info', 'Reassign feature coming soon');
  },

  closeFixModal() {
    if (this.activeFixModal) {
      this.activeFixModal.classList.remove('show');
      setTimeout(() => {
        this.activeFixModal?.remove();
        this.activeFixModal = null;
      }, 200);
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
  },

  // Callback for when fix completes
  onFixComplete: null,

  /**
   * Render validation errors with Fix buttons
   * @param {Array} errors - Array of error objects from validation endpoint
   * @param {Object} context - Context for fixes (job_id, invoice_id, po_id)
   * @returns {string} HTML string
   */
  renderValidationErrors(errors, context) {
    if (!errors || errors.length === 0) {
      return '<p class="validation-success">No errors found</p>';
    }

    return `
      <div class="validation-errors">
        ${errors.map((error) => {
          // Safely encode error and context for onclick
          const errorJson = JSON.stringify(error).replace(/"/g, '&quot;');
          const contextJson = JSON.stringify(context).replace(/"/g, '&quot;');

          return `
            <div class="validation-error-item ${error.severity || 'error'}">
              <div class="error-content">
                <span class="error-type">${this.getErrorTitle(error.type)}</span>
                <span class="error-message">${error.fix_hint || ''}</span>
                ${error.invoice_number ? `<span class="error-context">Invoice: ${error.invoice_number}</span>` : ''}
                ${error.po_number ? `<span class="error-context">PO: ${error.po_number}</span>` : ''}
              </div>
              <button class="btn btn-sm btn-fix" onclick="FixModals.showFixModal(${errorJson}, ${contextJson})">
                Fix
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // =========================================================================
  // BULK FIX FUNCTIONALITY
  // =========================================================================

  /**
   * Show bulk fix modal for all errors of a type
   * @param {string} errorType - Type of error to fix
   * @param {Array} errors - Array of errors of this type
   * @param {Object} context - Context with job_id
   */
  showBulkFixModal(errorType, errors, context) {
    this.closeFixModal();

    const title = this.getErrorTitle(errorType);
    const fixAction = this.getBulkFixAction(errorType);

    // Safely encode context for onclick attribute
    const contextStr = JSON.stringify(context).replace(/"/g, '&quot;');

    const modalHtml = `
      <div id="fixModal" class="modal modal-centered">
        <div class="modal-content fix-modal-content bulk-fix-modal">
          <div class="modal-header">
            <h3 class="modal-title">
              <span class="bulk-icon"></span>
              Bulk Fix: ${title}
            </h3>
            <button class="modal-close" onclick="FixModals.closeFixModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="bulk-fix-summary">
              <p class="bulk-count">
                <strong>${errors.length}</strong> ${errors.length === 1 ? 'error' : 'errors'} of this type found
              </p>
              <p class="bulk-action">
                <strong>Action:</strong> ${fixAction.description}
              </p>
            </div>

            <div class="bulk-fix-preview">
              <h4>Affected Items</h4>
              <div class="affected-items-list">
                ${errors.slice(0, 10).map(err => `
                  <div class="affected-item">
                    ${err.invoice_number ? `<span>Invoice: ${err.invoice_number}</span>` : ''}
                    ${err.po_number ? `<span>PO: ${err.po_number}</span>` : ''}
                    ${err.cost_code ? `<span>Cost Code: ${err.cost_code}</span>` : ''}
                  </div>
                `).join('')}
                ${errors.length > 10 ? `<div class="more-items">...and ${errors.length - 10} more</div>` : ''}
              </div>
            </div>

            <div class="bulk-fix-progress" style="display: none;">
              <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
              </div>
              <p class="progress-text">Processing...</p>
            </div>

            <div class="bulk-fix-results" style="display: none;">
              <div class="results-summary"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="FixModals.closeFixModal()">Cancel</button>
            <button class="btn btn-primary bulk-fix-btn" data-error-type="${errorType}" data-context="${contextStr}">
              Fix All ${errors.length} Errors
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.activeFixModal = document.getElementById('fixModal');
    this.activeFixModal.style.display = 'flex';
    requestAnimationFrame(() => this.activeFixModal.classList.add('show'));

    // Store errors for later
    this.currentBulkErrors = errors;

    // Set up bulk fix button click
    const bulkFixBtn = this.activeFixModal.querySelector('.bulk-fix-btn');
    bulkFixBtn.addEventListener('click', () => {
      this.executeBulkFix(errorType, context);
    });

    // Close on backdrop click
    this.activeFixModal.addEventListener('click', (e) => {
      if (e.target === this.activeFixModal) this.closeFixModal();
    });

    // Close on Escape
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') this.closeFixModal();
    };
    document.addEventListener('keydown', this.escapeHandler);
  },

  /**
   * Get bulk fix action for error type
   * @param {string} errorType - Type of error
   * @returns {Object} action and description
   */
  getBulkFixAction(errorType) {
    const actions = {
      'ORPHANED_PO_ALLOCATION': {
        action: 'remove',
        description: 'Remove all orphaned allocations'
      },
      'ORPHANED_LINE_ITEM_ALLOCATION': {
        action: 'remove',
        description: 'Remove line item references from allocations'
      },
      'ORPHANED_CO_ALLOCATION': {
        action: 'remove',
        description: 'Remove CO references from allocations'
      },
      'CO_TOTAL_MISMATCH': {
        action: 'recalculate',
        description: 'Recalculate all PO change order totals'
      },
      'PO_TOTAL_MISMATCH': {
        action: 'recalculate',
        description: 'Recalculate all PO total amounts'
      }
    };
    return actions[errorType] || { action: 'review', description: 'Review and fix manually' };
  },

  /**
   * Execute bulk fix operation
   * @param {string} errorType - Type of error to fix
   * @param {Object} context - Context with job_id
   */
  async executeBulkFix(errorType, context) {
    const modal = this.activeFixModal;
    const fixBtn = modal.querySelector('.bulk-fix-btn');
    const progressDiv = modal.querySelector('.bulk-fix-progress');
    const resultsDiv = modal.querySelector('.bulk-fix-results');

    fixBtn.disabled = true;
    progressDiv.style.display = 'block';

    try {
      const fixAction = this.getBulkFixAction(errorType);

      // Call batch fix endpoint
      const response = await fetch(`/api/jobs/${context.job_id}/fix-validation-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_type: errorType,
          fix_action: fixAction.action,
          performed_by: window.currentUser || 'User'
        })
      });

      const result = await response.json();

      // Show results
      progressDiv.style.display = 'none';
      resultsDiv.style.display = 'block';

      if (result.success) {
        resultsDiv.querySelector('.results-summary').innerHTML = `
          <div class="results-success">
            <span class="success-icon"></span>
            <p><strong>${result.results.fixed}</strong> errors fixed successfully</p>
            ${result.results.failed > 0 ? `<p class="failed-note">${result.results.failed} could not be fixed</p>` : ''}
          </div>
        `;

        // Update button
        fixBtn.textContent = 'Done';
        fixBtn.onclick = () => {
          this.closeFixModal();
          if (this.onFixComplete) this.onFixComplete(result);
        };
        fixBtn.disabled = false;
        fixBtn.classList.remove('btn-primary');
        fixBtn.classList.add('btn-success');

        window.toasts?.show('success', `Fixed ${result.results.fixed} errors`);
      } else {
        resultsDiv.querySelector('.results-summary').innerHTML = `
          <div class="results-error">
            <span class="error-icon"></span>
            <p>Bulk fix failed: ${result.error || 'Unknown error'}</p>
          </div>
        `;
        fixBtn.disabled = false;
      }
    } catch (err) {
      console.error('Bulk fix failed:', err);
      progressDiv.style.display = 'none';
      resultsDiv.style.display = 'block';
      resultsDiv.querySelector('.results-summary').innerHTML = `
        <div class="results-error">
          <span class="error-icon"></span>
          <p>Error: ${err.message}</p>
        </div>
      `;
      fixBtn.disabled = false;
    }
  },

  // =========================================================================
  // VALIDATION SUMMARY COMPONENT
  // =========================================================================

  /**
   * Check if an error type can be bulk fixed
   * @param {string} errorType - Type of error
   * @returns {boolean}
   */
  canBulkFix(errorType) {
    const bulkFixable = [
      'ORPHANED_PO_ALLOCATION',
      'ORPHANED_LINE_ITEM_ALLOCATION',
      'ORPHANED_CO_ALLOCATION',
      'CO_TOTAL_MISMATCH',
      'PO_TOTAL_MISMATCH'
    ];
    return bulkFixable.includes(errorType);
  },

  /**
   * Toggle visibility of error details section
   * @param {string} type - Error type identifier
   */
  toggleErrorDetails(type) {
    const details = document.getElementById(`details-${type}`);
    if (details) {
      details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
  },

  /**
   * Render validation summary with grouped errors and bulk fix options
   * @param {Object} validationResult - Result from validate-linkages or similar
   * @param {Object} context - Context for fixes
   * @returns {string} HTML string
   */
  renderValidationSummary(validationResult, context) {
    const { errors = [], warnings = [], summary = {} } = validationResult;

    // Group errors by type
    const errorsByType = {};
    errors.forEach(err => {
      if (!errorsByType[err.type]) {
        errorsByType[err.type] = [];
      }
      errorsByType[err.type].push(err);
    });

    // Group warnings by type
    const warningsByType = {};
    warnings.forEach(warn => {
      if (!warningsByType[warn.type]) {
        warningsByType[warn.type] = [];
      }
      warningsByType[warn.type].push(warn);
    });

    const hasErrors = Object.keys(errorsByType).length > 0;
    const hasWarnings = Object.keys(warningsByType).length > 0;

    if (!hasErrors && !hasWarnings) {
      return `
        <div class="validation-summary success">
          <span class="status-icon success-check"></span>
          <span class="status-text">All validations passed</span>
        </div>
      `;
    }

    return `
      <div class="validation-summary">
        ${summary.invoices_checked ? `
          <div class="summary-stats">
            <span>Checked: ${summary.invoices_checked || 0} invoices, ${summary.allocations_checked || 0} allocations</span>
            <span class="error-count">${summary.errors_found || errors.length} errors</span>
            <span class="warning-count">${summary.warnings_found || warnings.length} warnings</span>
          </div>
        ` : ''}

        ${hasErrors ? `
          <div class="error-groups">
            <h4>Errors</h4>
            ${Object.entries(errorsByType).map(([type, errs]) => {
              const errsJson = JSON.stringify(errs).replace(/"/g, '&quot;');
              const contextJson = JSON.stringify(context).replace(/"/g, '&quot;');
              return `
                <div class="error-group">
                  <div class="error-group-header">
                    <span class="error-type-name">${this.getErrorTitle(type)}</span>
                    <span class="error-count-badge">${errs.length}</span>
                  </div>
                  <div class="error-group-actions">
                    ${this.canBulkFix(type) ? `
                      <button class="btn btn-sm btn-primary"
                        onclick="FixModals.showBulkFixModal('${type}', ${errsJson}, ${contextJson})">
                        Fix All
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary"
                      onclick="FixModals.toggleErrorDetails('${type}')">
                      Details
                    </button>
                  </div>
                  <div class="error-group-details" id="details-${type}" style="display: none;">
                    ${this.renderValidationErrors(errs, context)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${hasWarnings ? `
          <div class="warning-groups">
            <h4>Warnings</h4>
            ${Object.entries(warningsByType).map(([type, warns]) => `
              <div class="warning-group">
                <div class="warning-group-header">
                  <span class="warning-type-name">${this.getErrorTitle(type)}</span>
                  <span class="warning-count-badge">${warns.length}</span>
                </div>
                <button class="btn btn-sm btn-secondary"
                  onclick="FixModals.toggleErrorDetails('warn-${type}')">
                  Details
                </button>
                <div class="error-group-details" id="details-warn-${type}" style="display: none;">
                  ${warns.map(w => `<p class="warning-item">${w.fix_hint || w.message}</p>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
};

console.log('[FIX-MODALS] Module loaded with bulk fix support');
