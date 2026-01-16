/**
 * Modal Helpers
 * Fixes the opacity:0 issue with modals across the app
 * Include this script before any page-specific modal code
 */

(function() {
  'use strict';

  // Show a modal by ID - handles opacity and transform
  window.showModal = function(id) {
    const modal = document.getElementById(id);
    if (!modal) {
      console.warn('Modal not found:', id);
      return;
    }

    modal.style.display = 'flex';
    modal.style.opacity = '1';

    const content = modal.querySelector('.modal-content');
    if (content) {
      content.style.transform = 'scale(1) translateY(0)';
      content.style.opacity = '1';
    }

    // Add show class for CSS transitions
    modal.classList.add('show');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  };

  // Hide a modal by ID
  window.hideModal = function(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.classList.remove('show');

    // Restore body scroll if no other modals are open
    const openModals = document.querySelectorAll('.modal[style*="display: flex"]');
    if (openModals.length === 0) {
      document.body.style.overflow = '';
    }
  };

  // Close modal when clicking backdrop
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal') && e.target.style.display === 'flex') {
      // Check if modal should close on backdrop click (default: yes)
      if (!e.target.dataset.noBackdropClose) {
        hideModal(e.target.id);
      }
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal[style*="display: flex"]');
      if (openModals.length > 0) {
        const lastModal = openModals[openModals.length - 1];
        if (!lastModal.dataset.noEscapeClose) {
          hideModal(lastModal.id);
        }
      }
    }
  });

})();
