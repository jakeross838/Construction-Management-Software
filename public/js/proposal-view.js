/**
 * Proposal View - Client-side logic
 * Handles loading proposal by token and acceptance workflow
 */

(function() {
  'use strict';

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // DOM elements
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const mainContent = document.getElementById('mainContent');
  const acceptanceForm = document.getElementById('acceptanceForm');
  const acceptedMessage = document.getElementById('acceptedMessage');

  // Format currency
  function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Show error state
  function showError(message, detail) {
    loadingState.style.display = 'none';
    mainContent.style.display = 'none';
    errorState.style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorDetail').textContent = detail || '';
  }

  // Show main content
  function showContent(proposal) {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    mainContent.style.display = 'block';

    // Update header
    document.getElementById('proposalNumber').textContent = proposal.proposal_number || '';

    // Update project info
    document.getElementById('projectName').textContent = proposal.job?.name || '-';
    document.getElementById('projectAddress').textContent = proposal.job?.address || '-';
    document.getElementById('projectTotal').textContent = formatMoney(proposal.estimate?.total_amount);
    document.getElementById('expiresAt').textContent = formatDate(proposal.share_expires_at);

    // Load PDF
    if (proposal.pdf_url) {
      document.getElementById('pdfViewer').src = proposal.pdf_url;
    }

    // Check if already accepted
    if (proposal.status === 'accepted') {
      acceptanceForm.style.display = 'none';
      acceptedMessage.style.display = 'block';
      document.getElementById('acceptedDate').textContent = formatDate(proposal.accepted_at);
      document.getElementById('acceptedBy').textContent = proposal.accepted_by_name || 'Client';
    }
  }

  // Load proposal by token
  async function loadProposal() {
    if (!token) {
      showError('Invalid Link', 'No proposal token provided. Please check your link.');
      return;
    }

    try {
      const response = await fetch(`/api/proposals/public/${token}`);

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 404) {
          showError('Proposal Not Found', 'This proposal may have been deleted or the link is invalid.');
        } else if (response.status === 410) {
          showError('Link Expired', 'This proposal link has expired. Please contact us for a new link.');
        } else {
          showError('Error Loading Proposal', data.error || 'Please try again later.');
        }
        return;
      }

      const proposal = await response.json();
      showContent(proposal);

    } catch (err) {
      console.error('Error loading proposal:', err);
      showError('Connection Error', 'Unable to connect to server. Please check your internet connection.');
    }
  }

  // Handle acceptance form submission
  async function handleAccept(e) {
    e.preventDefault();

    const btn = document.getElementById('acceptBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const name = document.getElementById('clientName').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    const notes = document.getElementById('notes').value.trim();

    if (!name || !email) {
      alert('Please enter your name and email.');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    try {
      const response = await fetch(`/api/proposals/public/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accepted_by_name: name,
          accepted_by_email: email,
          notes: notes
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept proposal');
      }

      // Show success
      acceptanceForm.style.display = 'none';
      acceptedMessage.style.display = 'block';
      document.getElementById('acceptedDate').textContent = formatDate(new Date());
      document.getElementById('acceptedBy').textContent = name;

    } catch (err) {
      console.error('Error accepting proposal:', err);
      alert('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // Handle decline (questions) button
  function handleDecline() {
    // For now, just show a message. Could open email or contact form.
    alert('Please contact us at info@rossbuilt.com or call (941) 555-0123 with any questions.');
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    loadProposal();

    document.getElementById('acceptForm').addEventListener('submit', handleAccept);
    document.getElementById('declineBtn').addEventListener('click', handleDecline);
  });

})();
