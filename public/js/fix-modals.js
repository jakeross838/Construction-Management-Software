/**
 * Fix Modals - UI for fixing validation errors
 * Displays validation errors and provides one-click fix options
 */
window.FixModals = {
  activeFixModal: null,
  escapeHandler: null,

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
  }
};

console.log('[FIX-MODALS] Module loaded');
