/**
 * AI Document Intelligence - Global Upload Button
 * High-tech document processing with editable results and routing approval
 */

(function() {
  'use strict';

  // Store current processing result for editing
  let currentResult = null;
  let currentDocumentId = null;

  // Processing stages for animation
  const STAGES = [
    { id: 'upload', label: 'Uploading', icon: '↑' },
    { id: 'analyze', label: 'Analyzing Structure', icon: '◎' },
    { id: 'classify', label: 'Classifying Document', icon: '◈' },
    { id: 'extract', label: 'Extracting Data', icon: '⬡' },
    { id: 'route', label: 'Determining Routes', icon: '⤳' }
  ];

  // Create and inject the floating action button
  function createFAB() {
    const fab = document.createElement('button');
    fab.className = 'ai-upload-fab';
    fab.id = 'aiUploadFab';
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      <span class="fab-text">AI Upload</span>
    `;
    fab.onclick = openAIUploadModal;
    document.body.appendChild(fab);
  }

  // Create and inject the upload modal
  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'aiUploadModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <div class="modal-title-row">
            <h2><span class="ai-icon">⬡</span> AI Document Intelligence</h2>
          </div>
          <button class="close-btn" onclick="window.AIUpload.close()">&times;</button>
        </div>
        <div class="modal-body" id="aiUploadBody">
          <!-- Dropzone -->
          <div class="ai-upload-dropzone" id="aiUploadDropzone">
            <div class="ai-upload-dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h3>Drop your document here</h3>
            <p>or click to browse files</p>
            <input type="file" id="aiUploadInput" accept="image/*,.pdf">
            <div class="ai-upload-formats">
              <strong>Supported:</strong> Invoices, Quotes, Proposals, Spec Sheets, Delivery Receipts, Warranties, Change Orders, and more
            </div>
          </div>

          <!-- High-tech Processing Animation -->
          <div class="ai-processing" id="aiUploadProgress">
            <div class="ai-processing-visual">
              <div class="ai-brain">
                <div class="ai-brain-core"></div>
                <div class="ai-brain-ring ai-brain-ring-1"></div>
                <div class="ai-brain-ring ai-brain-ring-2"></div>
                <div class="ai-brain-ring ai-brain-ring-3"></div>
                <div class="ai-scan-line"></div>
              </div>
            </div>
            <div class="ai-processing-stages" id="aiProcessingStages">
              ${STAGES.map(s => `
                <div class="ai-stage" id="aiStage-${s.id}">
                  <span class="ai-stage-icon">${s.icon}</span>
                  <span class="ai-stage-label">${s.label}</span>
                  <span class="ai-stage-status"></span>
                </div>
              `).join('')}
            </div>
            <div class="ai-processing-file" id="aiProcessingFile"></div>
          </div>

          <!-- Results Section -->
          <div class="ai-results" id="aiUploadResult">
            <!-- Header -->
            <div class="ai-results-header" id="aiResultsHeader">
              <div class="ai-results-badge" id="aiResultsBadge">
                <span class="ai-results-type" id="aiResultsType">Invoice</span>
                <span class="ai-results-confidence" id="aiResultsConfidence">95%</span>
              </div>
              <div class="ai-results-meta">
                <span id="aiResultsTime">Processed in 5.2s</span>
                <span id="aiResultsPages">2 pages analyzed</span>
              </div>
            </div>

            <!-- Extracted Data - Editable Form -->
            <div class="ai-results-section">
              <div class="ai-results-section-header">
                <h4>Extracted Information</h4>
                <button class="btn btn-ghost btn-sm" id="aiToggleEdit" onclick="window.AIUpload.toggleEdit()">
                  <span id="aiEditIcon">✎</span> Edit
                </button>
              </div>
              <div class="ai-results-fields" id="aiResultsFields">
                <!-- Filled dynamically -->
              </div>
            </div>

            <!-- Line Items -->
            <div class="ai-results-section" id="aiLineItemsSection" style="display: none;">
              <div class="ai-results-section-header">
                <h4>Line Items</h4>
                <span class="ai-results-count" id="aiLineItemsCount">0 items</span>
              </div>
              <div class="ai-line-items-table" id="aiLineItemsTable">
                <!-- Filled dynamically -->
              </div>
            </div>

            <!-- Routing Destinations -->
            <div class="ai-results-section">
              <div class="ai-results-section-header">
                <h4>Data Routing</h4>
              </div>
              <div class="ai-routing-cards" id="aiRoutingCards">
                <!-- Filled dynamically -->
              </div>
            </div>

            <!-- AI Insights -->
            <div class="ai-results-section" id="aiInsightsSection" style="display: none;">
              <div class="ai-results-section-header">
                <h4>AI Insights</h4>
              </div>
              <div class="ai-insights" id="aiInsights">
                <!-- Filled dynamically -->
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer" id="aiUploadFooter">
          <button class="btn btn-secondary" onclick="window.AIUpload.close()">Close</button>
          <button class="btn btn-ghost" id="aiUploadAnother" style="display: none;" onclick="window.AIUpload.reset()">
            Upload Another
          </button>
          <button class="btn btn-primary" id="aiConfirmRoute" style="display: none;" onclick="window.AIUpload.confirmRouting()">
            Confirm & Route Data
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Setup drag and drop
    const dropzone = document.getElementById('aiUploadDropzone');
    const input = document.getElementById('aiUploadInput');

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', (e) => {
      if (e.target.files[0]) handleFileUpload(e.target.files[0]);
    });

    // Close on backdrop
    modal.addEventListener('click', (e) => {
      if (e.target === modal) window.AIUpload.close();
    });
  }

  function openAIUploadModal() {
    const modal = document.getElementById('aiUploadModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('show');
      resetModal();
    }
  }

  function closeAIUploadModal() {
    const modal = document.getElementById('aiUploadModal');
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
    }
  }

  function resetModal() {
    currentResult = null;
    currentDocumentId = null;
    document.getElementById('aiUploadDropzone').style.display = 'block';
    document.getElementById('aiUploadProgress').style.display = 'none';
    document.getElementById('aiUploadResult').style.display = 'none';
    document.getElementById('aiUploadAnother').style.display = 'none';
    document.getElementById('aiConfirmRoute').style.display = 'none';
    document.getElementById('aiUploadInput').value = '';

    // Reset stages
    STAGES.forEach(s => {
      const el = document.getElementById(`aiStage-${s.id}`);
      if (el) {
        el.classList.remove('active', 'complete');
        el.querySelector('.ai-stage-status').textContent = '';
      }
    });
  }

  // Update processing stage
  function setStage(stageId, status = 'active') {
    STAGES.forEach((s, i) => {
      const el = document.getElementById(`aiStage-${s.id}`);
      if (!el) return;

      const stageIndex = STAGES.findIndex(x => x.id === stageId);
      const thisIndex = i;

      if (thisIndex < stageIndex) {
        el.classList.remove('active');
        el.classList.add('complete');
        el.querySelector('.ai-stage-status').textContent = '✓';
      } else if (thisIndex === stageIndex) {
        el.classList.add('active');
        el.classList.remove('complete');
        el.querySelector('.ai-stage-status').innerHTML = '<span class="ai-stage-spinner"></span>';
      } else {
        el.classList.remove('active', 'complete');
        el.querySelector('.ai-stage-status').textContent = '';
      }
    });
  }

  async function handleFileUpload(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      showToast?.('Invalid file type. Please upload an image or PDF.', 'error');
      return;
    }

    // Show processing
    document.getElementById('aiUploadDropzone').style.display = 'none';
    document.getElementById('aiUploadProgress').style.display = 'block';
    document.getElementById('aiProcessingFile').textContent = file.name;

    try {
      // Stage 1: Upload
      setStage('upload');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', 'User');

      // Simulate stage progression during upload
      await delay(300);
      setStage('analyze');
      await delay(500);
      setStage('classify');

      const response = await fetch('/api/document-hub/upload-and-process', {
        method: 'POST',
        body: formData
      });

      setStage('extract');
      await delay(300);
      setStage('route');

      const result = await response.json();
      await delay(200);

      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      // Mark all complete
      STAGES.forEach(s => {
        const el = document.getElementById(`aiStage-${s.id}`);
        if (el) {
          el.classList.remove('active');
          el.classList.add('complete');
          el.querySelector('.ai-stage-status').textContent = '✓';
        }
      });

      await delay(500);
      showResults(result);

    } catch (error) {
      console.error('AI Upload error:', error);
      showToast?.(error.message || 'Failed to process document', 'error');
      resetModal();
    }
  }

  function showResults(result) {
    currentResult = result;
    currentDocumentId = result.document?.id;

    document.getElementById('aiUploadProgress').style.display = 'none';
    document.getElementById('aiUploadResult').style.display = 'block';
    document.getElementById('aiUploadAnother').style.display = 'inline-flex';

    const processing = result.processing || {};
    const docType = processing.documentType || 'unknown';
    const confidence = processing.confidence || 0;
    const data = processing.extractedData || {};
    const destinations = processing.routingDestinations || [];

    // Header
    document.getElementById('aiResultsType').textContent = formatDocType(docType);
    document.getElementById('aiResultsConfidence').textContent = `${Math.round(confidence * 100)}%`;
    document.getElementById('aiResultsConfidence').className =
      `ai-results-confidence ${confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low'}`;
    document.getElementById('aiResultsTime').textContent =
      `Processed in ${(processing.processingTimeMs / 1000).toFixed(1)}s`;

    // Build editable fields
    buildEditableFields(docType, data);

    // Build line items
    buildLineItems(data.line_items || []);

    // Build routing cards
    buildRoutingCards(destinations);

    // Build insights
    buildInsights(data._metadata);

    // Show confirm button if there are pending routes
    const hasPendingRoutes = destinations.some(d => !d.auto_route);
    document.getElementById('aiConfirmRoute').style.display = hasPendingRoutes ? 'inline-flex' : 'none';
  }

  function buildEditableFields(docType, data) {
    const container = document.getElementById('aiResultsFields');
    container.innerHTML = '';

    const fieldDefs = [
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'invoice_number', label: 'Invoice #', type: 'text' },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date' },
      { key: 'due_date', label: 'Due Date', type: 'date' },
      { key: 'total_amount', label: 'Total Amount', type: 'currency' },
      { key: 'job_reference', label: 'Job Reference', type: 'text' },
      { key: 'po_reference', label: 'PO Reference', type: 'text' },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text' },
      { key: 'vendor_address', label: 'Vendor Address', type: 'text' },
      { key: 'quote_number', label: 'Quote #', type: 'text' },
      { key: 'proposal_number', label: 'Proposal #', type: 'text' },
      { key: 'change_order_number', label: 'CO #', type: 'text' },
      { key: 'product_name', label: 'Product', type: 'text' },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'model_number', label: 'Model #', type: 'text' },
      { key: 'warranty_period', label: 'Warranty', type: 'text' }
    ];

    fieldDefs.forEach(def => {
      const value = data[def.key];
      if (value !== undefined && value !== null && value !== '') {
        const field = document.createElement('div');
        field.className = 'ai-result-field';
        field.dataset.key = def.key;

        let displayValue = value;
        let inputType = 'text';

        if (def.type === 'currency') {
          displayValue = formatCurrency(value);
          inputType = 'number';
        } else if (def.type === 'date') {
          displayValue = formatDate(value);
          inputType = 'date';
        }

        field.innerHTML = `
          <label>${def.label}</label>
          <span class="ai-field-value">${displayValue}</span>
          <input type="${inputType}" class="ai-field-input" value="${value}"
                 ${def.type === 'currency' ? 'step="0.01"' : ''} style="display: none;">
        `;
        container.appendChild(field);
      }
    });
  }

  function buildLineItems(items) {
    const section = document.getElementById('aiLineItemsSection');
    const table = document.getElementById('aiLineItemsTable');
    const count = document.getElementById('aiLineItemsCount');

    if (!items || items.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    count.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    table.innerHTML = `
      <div class="ai-line-items-header">
        <span class="ai-li-desc">Description</span>
        <span class="ai-li-qty">Qty</span>
        <span class="ai-li-unit">Unit</span>
        <span class="ai-li-price">Price</span>
        <span class="ai-li-amount">Amount</span>
      </div>
      ${items.map((item, i) => `
        <div class="ai-line-item" data-index="${i}">
          <span class="ai-li-desc" title="${item.description}">${truncate(item.description, 50)}</span>
          <span class="ai-li-qty">${item.quantity || '-'}</span>
          <span class="ai-li-unit">${item.unit || '-'}</span>
          <span class="ai-li-price">${item.unit_price ? formatCurrency(item.unit_price) : '-'}</span>
          <span class="ai-li-amount">${item.amount ? formatCurrency(item.amount) : '-'}</span>
        </div>
      `).join('')}
      <div class="ai-line-items-total">
        <span>Total</span>
        <span>${formatCurrency(items.reduce((sum, i) => sum + (i.amount || 0), 0))}</span>
      </div>
    `;
  }

  function buildRoutingCards(destinations) {
    const container = document.getElementById('aiRoutingCards');
    container.innerHTML = '';

    if (!destinations || destinations.length === 0) {
      container.innerHTML = '<div class="ai-no-routes">No routing destinations identified</div>';
      return;
    }

    destinations.forEach(dest => {
      const card = document.createElement('div');
      card.className = `ai-routing-card ${dest.auto_route ? 'auto-routed' : 'pending'}`;
      card.dataset.destination = dest.destination;

      const fieldCount = Object.keys(dest.data || {}).length;
      const icon = getDestinationIcon(dest.destination);

      card.innerHTML = `
        <div class="ai-routing-card-header">
          <span class="ai-routing-icon">${icon}</span>
          <span class="ai-routing-name">${formatDestination(dest.destination)}</span>
          <span class="ai-routing-status ${dest.auto_route ? 'auto' : 'pending'}">
            ${dest.auto_route ? 'Auto-routed' : 'Pending approval'}
          </span>
        </div>
        <div class="ai-routing-card-body">
          <span class="ai-routing-fields">${fieldCount} field${fieldCount !== 1 ? 's' : ''} mapped</span>
          ${dest.auto_route ? '' : `
            <label class="ai-routing-toggle">
              <input type="checkbox" checked data-dest="${dest.destination}">
              <span>Include</span>
            </label>
          `}
        </div>
      `;
      container.appendChild(card);
    });
  }

  function buildInsights(metadata) {
    const section = document.getElementById('aiInsightsSection');
    const container = document.getElementById('aiInsights');

    if (!metadata) {
      section.style.display = 'none';
      return;
    }

    const insights = [];

    if (metadata.extraction_notes) {
      insights.push({ icon: '💡', text: metadata.extraction_notes });
    }
    if (metadata.missing_fields?.length > 0) {
      insights.push({
        icon: '⚠️',
        text: `Missing fields: ${metadata.missing_fields.join(', ')}`,
        type: 'warning'
      });
    }
    if (metadata.additional_data) {
      const extras = Object.entries(metadata.additional_data)
        .filter(([k, v]) => v && typeof v !== 'object')
        .slice(0, 3);
      if (extras.length > 0) {
        insights.push({
          icon: '📋',
          text: extras.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' • ')
        });
      }
    }

    if (insights.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = insights.map(i => `
      <div class="ai-insight ${i.type || ''}">
        <span class="ai-insight-icon">${i.icon}</span>
        <span class="ai-insight-text">${i.text}</span>
      </div>
    `).join('');
  }

  function toggleEdit() {
    const fields = document.querySelectorAll('.ai-result-field');
    const btn = document.getElementById('aiToggleEdit');
    const isEditing = btn.classList.toggle('editing');

    fields.forEach(field => {
      const span = field.querySelector('.ai-field-value');
      const input = field.querySelector('.ai-field-input');
      span.style.display = isEditing ? 'none' : 'block';
      input.style.display = isEditing ? 'block' : 'none';
    });

    btn.innerHTML = isEditing
      ? '<span id="aiEditIcon">✓</span> Done'
      : '<span id="aiEditIcon">✎</span> Edit';
  }

  async function confirmRouting() {
    if (!currentDocumentId || !currentResult) return;

    const btn = document.getElementById('aiConfirmRoute');
    btn.disabled = true;
    btn.textContent = 'Routing...';

    try {
      // Gather selected destinations
      const selectedDests = [];
      document.querySelectorAll('.ai-routing-card.pending input[type="checkbox"]:checked').forEach(cb => {
        selectedDests.push(cb.dataset.dest);
      });

      // Gather edited field values
      const editedData = {};
      document.querySelectorAll('.ai-result-field').forEach(field => {
        const key = field.dataset.key;
        const input = field.querySelector('.ai-field-input');
        if (input) {
          editedData[key] = input.type === 'number' ? parseFloat(input.value) : input.value;
        }
      });

      // Call confirm API
      const response = await fetch(`/api/document-hub/${currentDocumentId}/confirm-routing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinations: selectedDests,
          editedData: editedData,
          confirmedBy: 'User'
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast?.('Data routed successfully!', 'success');
        btn.textContent = 'Routed ✓';
        btn.classList.add('btn-success');

        // Update routing cards to show success
        document.querySelectorAll('.ai-routing-card.pending').forEach(card => {
          const dest = card.dataset.destination;
          if (selectedDests.includes(dest)) {
            card.classList.remove('pending');
            card.classList.add('routed');
            card.querySelector('.ai-routing-status').textContent = 'Routed ✓';
            card.querySelector('.ai-routing-status').className = 'ai-routing-status routed';
          }
        });
      } else {
        throw new Error(result.error || 'Routing failed');
      }

    } catch (error) {
      console.error('Routing error:', error);
      showToast?.(error.message || 'Failed to route data', 'error');
      btn.disabled = false;
      btn.textContent = 'Confirm & Route Data';
    }
  }

  // Utility functions
  function formatDocType(type) {
    const map = {
      'invoice': 'Invoice', 'quote': 'Quote', 'proposal': 'Proposal',
      'spec_sheet': 'Spec Sheet', 'delivery_receipt': 'Delivery Receipt',
      'warranty_doc': 'Warranty', 'change_order': 'Change Order',
      'permit': 'Permit', 'contract': 'Contract', 'unknown': 'Document'
    };
    return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatDestination(dest) {
    const map = {
      'invoices': 'Invoices', 'catalog': 'Catalog', 'pricing': 'Price Intelligence',
      'schedule': 'Schedule', 'knowledge_base': 'Knowledge Base',
      'daily_logs': 'Daily Logs', 'trade_scorecards': 'Trade Scorecards'
    };
    return map[dest] || dest.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function getDestinationIcon(dest) {
    const icons = {
      'invoices': '📄', 'catalog': '📦', 'pricing': '💰',
      'schedule': '📅', 'knowledge_base': '📚', 'daily_logs': '📝',
      'trade_scorecards': '⭐'
    };
    return icons[dest] || '📁';
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function truncate(str, len) {
    return str?.length > len ? str.substring(0, len) + '...' : str || '';
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Initialize
  function init() {
    createFAB();
    createModal();
  }

  // Export API
  window.AIUpload = {
    open: openAIUploadModal,
    close: closeAIUploadModal,
    reset: resetModal,
    toggleEdit: toggleEdit,
    confirmRouting: confirmRouting
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
