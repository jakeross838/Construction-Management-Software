/**
 * Toast Notification System
 * Provides visual feedback for operations with undo support
 */

class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.init();
  }

  init() {
    // Create toast container if it doesn't exist
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  /**
   * Show a toast notification
   * @param {string} type - success, error, warning, info
   * @param {string} message - Main message
   * @param {Object} options - Additional options
   */
  show(type, message, options = {}) {
    const {
      duration = 5000,
      dismissible = true,
      details = null,
      id = `toast-${Date.now()}`
    } = options;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.id = id;

    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
        ${details ? `<div class="toast-details">${details}</div>` : ''}
      </div>
      ${dismissible ? '<button class="toast-close" aria-label="Dismiss">&times;</button>' : ''}
    `;

    // Add dismiss handler
    if (dismissible) {
      toast.querySelector('.toast-close').addEventListener('click', () => {
        this.dismiss(id);
      });
    }

    // Add to container
    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  /**
   * Show toast with undo button
   * @param {string} message - Message to display
   * @param {Function} undoCallback - Function to call when undo is clicked
   * @param {number} duration - Time before auto-dismiss (ms)
   */
  showWithUndo(message, undoCallback, duration = 5000) {
    const id = `toast-undo-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = 'toast toast-success toast-with-undo';
    toast.id = id;

    let remaining = duration;
    const startTime = Date.now();

    toast.innerHTML = `
      <div class="toast-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22,4 12,14.01 9,11.01"></polyline>
        </svg>
      </div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
        <div class="toast-countdown">
          <div class="toast-countdown-bar" style="animation-duration: ${duration}ms"></div>
        </div>
      </div>
      <button class="toast-undo-btn">Undo</button>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    // Undo handler
    toast.querySelector('.toast-undo-btn').addEventListener('click', async () => {
      toast.classList.add('toast-loading');
      try {
        await undoCallback();
        this.dismiss(id);
        this.show('success', 'Action undone');
      } catch (err) {
        this.dismiss(id);
        this.show('error', 'Undo failed', { details: err.message });
      }
    });

    // Dismiss handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.dismiss(id);
    });

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Auto dismiss
    setTimeout(() => this.dismiss(id), duration);

    return id;
  }

  /**
   * Show persistent error that doesn't auto-dismiss
   */
  showPersistentError(message, retryCallback = null) {
    const id = `toast-error-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = 'toast toast-error toast-persistent';
    toast.id = id;

    toast.innerHTML = `
      <div class="toast-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
      ${retryCallback ? '<button class="toast-retry-btn">Retry</button>' : ''}
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    if (retryCallback) {
      toast.querySelector('.toast-retry-btn').addEventListener('click', async () => {
        toast.classList.add('toast-loading');
        try {
          await retryCallback();
          this.dismiss(id);
        } catch (err) {
          toast.classList.remove('toast-loading');
          // Update message
          toast.querySelector('.toast-message').textContent = `Retry failed: ${err.message}`;
        }
      });
    }

    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.dismiss(id);
    });

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    return id;
  }

  /**
   * Show loading toast
   */
  showLoading(message) {
    const id = `toast-loading-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = 'toast toast-info toast-loading';
    toast.id = id;

    toast.innerHTML = `
      <div class="toast-icon toast-spinner"></div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
    `;

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    return id;
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id) {
    const toast = this.toasts.get(id);
    if (!toast) return;

    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');

    setTimeout(() => {
      toast.remove();
      this.toasts.delete(id);
    }, 300);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    this.toasts.forEach((toast, id) => this.dismiss(id));
  }

  /**
   * Success shorthand
   */
  success(message, options = {}) {
    return this.show('success', message, options);
  }

  /**
   * Error shorthand
   */
  error(message, options = {}) {
    return this.show('error', message, { duration: 8000, ...options });
  }

  /**
   * Warning shorthand
   */
  warning(message, options = {}) {
    return this.show('warning', message, options);
  }

  /**
   * Info shorthand
   */
  info(message, options = {}) {
    return this.show('info', message, options);
  }

  /**
   * Smart error handler with actionable suggestions
   * @param {Object} errorData - Error response from API (with code, message, details)
   * @param {string} fallbackMessage - Fallback message if error structure is unknown
   */
  showApiError(errorData, fallbackMessage = 'An error occurred') {
    // Map error codes to user-friendly messages with suggestions
    const errorSuggestions = {
      VALIDATION_FAILED: {
        title: 'Validation Error',
        suggestion: 'Check highlighted fields and correct any issues.'
      },
      INVALID_TRANSITION: {
        title: 'Status Change Not Allowed',
        suggestion: 'Refresh the page to see the current status.'
      },
      DUPLICATE_INVOICE: {
        title: 'Duplicate Invoice Found',
        suggestion: 'An invoice with this number already exists for this vendor. Check if this is the same invoice.'
      },
      ALLOCATIONS_UNBALANCED: {
        title: 'Allocations Don\'t Match',
        suggestion: 'Make sure your cost code allocations add up to the invoice total.'
      },
      MISSING_REQUIRED_FIELD: {
        title: 'Missing Information',
        suggestion: 'Fill in all required fields marked with *.'
      },
      PRE_TRANSITION_FAILED: {
        title: 'Cannot Complete Action',
        suggestion: 'Some requirements are not met. Check the invoice details.'
      },
      INVOICE_NOT_FOUND: {
        title: 'Invoice Not Found',
        suggestion: 'This invoice may have been deleted. Refresh the list.'
      },
      ENTITY_LOCKED: {
        title: 'Currently Being Edited',
        suggestion: 'Someone else is editing this. Try again in a few seconds.'
      },
      VERSION_CONFLICT: {
        title: 'Data Changed',
        suggestion: 'Someone else modified this. Refresh to see their changes, then make yours.'
      },
      ALREADY_IN_DRAW: {
        title: 'Already in Draw',
        suggestion: 'This invoice is already in a draw. Remove it from the existing draw first.'
      },
      DRAW_FUNDED: {
        title: 'Draw is Funded',
        suggestion: 'Cannot modify a draw that has been marked as funded.'
      },
      AI_EXTRACTION_FAILED: {
        title: 'AI Processing Failed',
        suggestion: 'The document could not be processed. Try uploading a clearer image or PDF.'
      },
      PDF_STAMP_FAILED: {
        title: 'PDF Stamping Failed',
        suggestion: 'Could not stamp the PDF. Try approving again.'
      },
      DATABASE_ERROR: {
        title: 'Server Error',
        suggestion: 'A temporary error occurred. Please try again.'
      },
      PO_NOT_FOUND: {
        title: 'PO Not Found',
        suggestion: 'The linked PO may have been deleted. Select a different PO or remove the link.'
      },
      PO_OVERAGE: {
        title: 'Over PO Budget',
        suggestion: 'This invoice exceeds the remaining PO balance. Consider creating a change order.'
      }
    };

    const code = errorData?.code || 'UNKNOWN_ERROR';
    const config = errorSuggestions[code];

    let title = config?.title || 'Error';
    let details = '';

    // Build details string
    if (errorData?.message) {
      details = errorData.message;
    }
    if (config?.suggestion) {
      details += (details ? '<br><br>' : '') + `<strong>Tip:</strong> ${config.suggestion}`;
    }

    // Add specific field errors if available
    if (errorData?.details?.fields && Array.isArray(errorData.details.fields)) {
      const fieldList = errorData.details.fields.map(f => `• ${f}`).join('<br>');
      details += `<br><br>${fieldList}`;
    }

    return this.show('error', title, {
      duration: 10000,
      details: details || fallbackMessage
    });
  }
}

// Export singleton instance
window.toasts = new ToastManager();

// Global helper function for backward compatibility
function showToast(message, type = 'info') {
  window.toasts.show(type, message);
}

// Also expose closeModal if not defined elsewhere
if (typeof window.closeModal === 'undefined') {
  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  };
}
