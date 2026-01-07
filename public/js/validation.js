/**
 * Frontend Validation Module
 * Mirrors server validation rules for immediate feedback
 */

const Validation = {
  // Field validation rules
  rules: {
    invoice_number: {
      required: true,
      maxLength: 100,
      pattern: null,
      message: 'Invoice number is required'
    },
    amount: {
      required: true,
      min: 0.01,
      max: 100000000,
      message: 'Amount must be between $0.01 and $100,000,000'
    },
    invoice_date: {
      required: true,
      maxFutureDays: 7,
      message: 'Invoice date is required and cannot be more than 7 days in the future'
    },
    due_date: {
      required: false,
      afterField: 'invoice_date',
      message: 'Due date must be on or after invoice date'
    },
    job_id: {
      required: false,
      format: 'uuid',
      message: 'Invalid job selection'
    },
    vendor_id: {
      required: false,
      format: 'uuid',
      message: 'Invalid vendor selection'
    },
    po_id: {
      required: false,
      format: 'uuid',
      message: 'Invalid PO selection'
    },
    notes: {
      required: false,
      maxLength: 5000,
      message: 'Notes cannot exceed 5000 characters'
    }
  },

  // Status transitions allowed
  statusTransitions: {
    received: ['needs_approval', 'denied', 'deleted'],
    needs_approval: ['approved', 'denied', 'received'],
    approved: ['in_draw', 'needs_approval'],
    in_draw: ['paid', 'approved'],
    denied: ['received'],
    paid: []
  },

  // Requirements before transition
  preTransitionRequirements: {
    needs_approval: {
      fields: ['job_id', 'vendor_id'],
      message: 'Job and vendor must be assigned before coding'
    },
    approved: {
      fields: ['job_id', 'vendor_id'],
      custom: 'allocations_balanced',
      message: 'Job, vendor, and balanced cost allocations required for approval'
    },
    in_draw: {
      custom: 'draw_selected',
      message: 'Must select a draw to add invoice to'
    }
  },

  /**
   * Validate a single field
   */
  validateField(fieldName, value, allValues = {}) {
    const rule = this.rules[fieldName];
    if (!rule) return { valid: true };

    const errors = [];

    // Required check
    if (rule.required && (value === null || value === undefined || value === '')) {
      errors.push(rule.message || `${fieldName} is required`);
      return { valid: false, errors };
    }

    // Skip further validation if empty and not required
    if (!rule.required && (value === null || value === undefined || value === '')) {
      return { valid: true };
    }

    // String length checks
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      errors.push(`${fieldName} cannot exceed ${rule.maxLength} characters`);
    }

    // Number range checks
    if (rule.min !== undefined) {
      const num = parseFloat(value);
      if (isNaN(num) || num < rule.min) {
        errors.push(`${fieldName} must be at least ${rule.min}`);
      }
    }

    if (rule.max !== undefined) {
      const num = parseFloat(value);
      if (!isNaN(num) && num > rule.max) {
        errors.push(`${fieldName} cannot exceed ${rule.max}`);
      }
    }

    // Date checks
    if (rule.maxFutureDays !== undefined && value) {
      const date = new Date(value);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + rule.maxFutureDays);
      if (date > maxDate) {
        errors.push(`Date cannot be more than ${rule.maxFutureDays} days in the future`);
      }
    }

    if (rule.afterField && value && allValues[rule.afterField]) {
      const thisDate = new Date(value);
      const otherDate = new Date(allValues[rule.afterField]);
      if (thisDate < otherDate) {
        errors.push(rule.message);
      }
    }

    // UUID format check
    if (rule.format === 'uuid' && value) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        errors.push(rule.message);
      }
    }

    // Pattern check
    if (rule.pattern && value) {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(value)) {
        errors.push(rule.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate entire invoice object
   */
  validateInvoice(invoice) {
    const errors = {};
    let hasErrors = false;

    for (const [field, rule] of Object.entries(this.rules)) {
      const result = this.validateField(field, invoice[field], invoice);
      if (!result.valid) {
        errors[field] = result.errors;
        hasErrors = true;
      }
    }

    return {
      valid: !hasErrors,
      errors
    };
  },

  /**
   * Check if status transition is allowed
   */
  canTransition(fromStatus, toStatus) {
    const allowed = this.statusTransitions[fromStatus];
    return allowed && allowed.includes(toStatus);
  },

  /**
   * Get available transitions for current status
   */
  getAvailableTransitions(currentStatus) {
    return this.statusTransitions[currentStatus] || [];
  },

  /**
   * Check pre-transition requirements
   */
  checkPreTransitionRequirements(targetStatus, invoice, allocations = []) {
    const requirements = this.preTransitionRequirements[targetStatus];
    if (!requirements) return { valid: true };

    const errors = [];

    // Check required fields
    if (requirements.fields) {
      for (const field of requirements.fields) {
        if (!invoice[field]) {
          errors.push(`${field.replace('_', ' ')} is required`);
        }
      }
    }

    // Check custom requirements
    if (requirements.custom === 'allocations_balanced') {
      const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      const invoiceAmount = parseFloat(invoice.amount || 0);
      // Only block over-allocation; under-allocation is allowed for partial work
      if (totalAllocated > invoiceAmount + 0.01) {
        errors.push(`Allocations ($${totalAllocated.toFixed(2)}) cannot exceed invoice amount ($${invoiceAmount.toFixed(2)})`);
      }
    }

    if (requirements.custom === 'draw_selected') {
      // This would need the draw_id passed in
      if (!invoice.draw_id) {
        errors.push('Must select a draw');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      message: errors.length > 0 ? requirements.message : null
    };
  },

  /**
   * Validate cost code allocations
   */
  validateAllocations(allocations, invoiceAmount) {
    const errors = [];
    const totalAmount = parseFloat(invoiceAmount || 0);

    if (!allocations || allocations.length === 0) {
      if (totalAmount > 0) {
        errors.push('At least one cost code allocation is required');
      }
      return { valid: errors.length === 0, errors };
    }

    let totalAllocated = 0;

    allocations.forEach((alloc, index) => {
      const amount = parseFloat(alloc.amount || 0);

      if (amount <= 0) {
        errors.push(`Allocation ${index + 1}: Amount must be greater than 0`);
      }

      if (!alloc.cost_code_id) {
        errors.push(`Allocation ${index + 1}: Cost code is required`);
      }

      totalAllocated += amount;
    });

    // Check balance
    // Only reject over-allocation, allow under-allocation
    if (totalAllocated > totalAmount + 0.01) {
      errors.push(`Allocations total ($${totalAllocated.toFixed(2)}) exceeds invoice amount ($${totalAmount.toFixed(2)})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      totalAllocated,
      difference: totalAmount - totalAllocated
    };
  },

  /**
   * Format currency for display
   */
  formatCurrency(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  },

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  /**
   * Parse currency input (removes $, commas)
   */
  parseCurrency(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[$,]/g, '')) || 0;
  },

  /**
   * Get status display info
   */
  getStatusInfo(status) {
    const statusMap = {
      received: { label: 'Received', color: 'gray', icon: '📥' },
      needs_approval: { label: 'Needs Approval', color: 'blue', icon: '📋' },
      approved: { label: 'Approved', color: 'green', icon: '✅' },
      denied: { label: 'Denied', color: 'red', icon: '❌' },
      in_draw: { label: 'In Draw', color: 'purple', icon: '📊' },
      paid: { label: 'Paid', color: 'emerald', icon: '💰' }
    };
    return statusMap[status] || { label: status, color: 'gray', icon: '❓' };
  },

  /**
   * Get confidence level label
   */
  getConfidenceLevel(score) {
    if (score >= 0.90) return { level: 'high', label: 'High Confidence', color: 'green' };
    if (score >= 0.60) return { level: 'medium', label: 'Medium Confidence', color: 'yellow' };
    return { level: 'low', label: 'Low Confidence', color: 'red' };
  }
};

// Export for use
window.Validation = Validation;
