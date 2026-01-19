/**
 * Notifications Page JavaScript
 * Handles notifications list and preferences
 */

// State
let notifications = [];
let preferences = null;
let currentUser = 'Jake Ross';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadNotifications();
  loadUnreadCount();
});

// Event Listeners
function setupEventListeners() {
  document.getElementById('readFilter').addEventListener('change', applyFilters);
  document.getElementById('typeFilter').addEventListener('change', applyFilters);

  let debounceTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });
}

// Load Notifications
async function loadNotifications() {
  try {
    const res = await fetch(`/api/notifications?user=${encodeURIComponent(currentUser)}`);
    if (!res.ok) throw new Error('Failed to load notifications');
    notifications = await res.json();
    renderNotifications(notifications);
  } catch (err) {
    console.error('Error loading notifications:', err);
    showToast('Failed to load notifications', 'error');
  }
}

// Load Unread Count
async function loadUnreadCount() {
  try {
    const res = await fetch(`/api/notifications/unread-count?user=${encodeURIComponent(currentUser)}`);
    if (!res.ok) throw new Error('Failed to load unread count');
    const { count } = await res.json();

    const badge = document.getElementById('unreadCount');
    if (count > 0) {
      badge.textContent = `${count} unread`;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    console.error('Error loading unread count:', err);
  }
}

// Render Notifications
function renderNotifications(data) {
  const container = document.getElementById('notificationsList');
  const emptyState = document.getElementById('emptyState');

  if (!data || data.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = data.map(notif => `
    <div class="notification-item ${notif.is_read ? 'read' : 'unread'}" onclick="handleNotificationClick('${notif.id}', '${notif.entity_link || ''}')">
      <div class="notification-icon ${getTypeClass(notif.type)}">
        ${getTypeIcon(notif.type)}
      </div>
      <div class="notification-content">
        <div class="notification-header">
          <span class="notification-title">${notif.title}</span>
          <span class="notification-time">${formatTime(notif.created_at)}</span>
        </div>
        <div class="notification-message">${notif.message}</div>
        ${notif.entity_type ? `<span class="notification-entity">${formatEntityType(notif.entity_type)}</span>` : ''}
      </div>
      <div class="notification-actions">
        ${!notif.is_read ? `<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); markAsRead('${notif.id}')">Mark Read</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteNotification('${notif.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// Get Type Icon
function getTypeIcon(type) {
  const icons = {
    'info': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    'success': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    'warning': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'error': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    'task': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    'rfi': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'submittal': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    'invoice': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    'po': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
  };
  return icons[type] || icons['info'];
}

// Get Type Class
function getTypeClass(type) {
  const classes = {
    'info': 'type-info',
    'success': 'type-success',
    'warning': 'type-warning',
    'error': 'type-error',
    'task': 'type-task',
    'rfi': 'type-rfi',
    'submittal': 'type-submittal',
    'invoice': 'type-invoice',
    'po': 'type-po'
  };
  return classes[type] || 'type-info';
}

// Format Entity Type
function formatEntityType(type) {
  const types = {
    'job': 'Job',
    'invoice': 'Invoice',
    'rfi': 'RFI',
    'submittal': 'Submittal',
    'task': 'Task',
    'po': 'Purchase Order',
    'draw': 'Draw',
    'message': 'Message'
  };
  return types[type] || type;
}

// Format Time
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  // Older
  return date.toLocaleDateString();
}

// Apply Filters
function applyFilters() {
  const isRead = document.getElementById('readFilter').value;
  const type = document.getElementById('typeFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = notifications;

  if (isRead !== '') {
    filtered = filtered.filter(n => n.is_read === (isRead === 'true'));
  }
  if (type) {
    filtered = filtered.filter(n => n.type === type);
  }
  if (search) {
    filtered = filtered.filter(n =>
      (n.title && n.title.toLowerCase().includes(search)) ||
      (n.message && n.message.toLowerCase().includes(search))
    );
  }

  renderNotifications(filtered);
}

// ============================================================
// NOTIFICATION ACTIONS
// ============================================================

// Handle Notification Click
async function handleNotificationClick(id, link) {
  // Mark as read
  await markAsRead(id);

  // Navigate if link provided
  if (link) {
    window.location.href = link;
  }
}

// Mark as Read
async function markAsRead(id) {
  try {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to mark as read');

    // Update local state
    const notif = notifications.find(n => n.id === id);
    if (notif) notif.is_read = true;

    renderNotifications(notifications.filter(applyCurrentFilters));
    loadUnreadCount();
  } catch (err) {
    console.error('Error marking as read:', err);
  }
}

// Apply current filter logic (for re-rendering)
function applyCurrentFilters(notif) {
  const isRead = document.getElementById('readFilter').value;
  const type = document.getElementById('typeFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  if (isRead !== '' && notif.is_read !== (isRead === 'true')) return false;
  if (type && notif.type !== type) return false;
  if (search) {
    if (!(notif.title?.toLowerCase().includes(search) || notif.message?.toLowerCase().includes(search))) {
      return false;
    }
  }
  return true;
}

// Mark All Read
async function markAllRead() {
  try {
    const res = await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: currentUser })
    });

    if (!res.ok) throw new Error('Failed to mark all as read');

    showToast('All notifications marked as read', 'success');
    await loadNotifications();
    loadUnreadCount();
  } catch (err) {
    console.error('Error marking all as read:', err);
    showToast(err.message, 'error');
  }
}

// Delete Notification
async function deleteNotification(id) {
  try {
    const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete notification');

    // Remove from local state
    notifications = notifications.filter(n => n.id !== id);
    renderNotifications(notifications.filter(applyCurrentFilters));
    loadUnreadCount();
  } catch (err) {
    console.error('Error deleting notification:', err);
    showToast(err.message, 'error');
  }
}

// Clear All Notifications
async function clearAllNotifications() {
  if (!confirm('Are you sure you want to clear all notifications?')) return;

  try {
    const res = await fetch(`/api/notifications/clear-all/${encodeURIComponent(currentUser)}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to clear notifications');

    showToast('All notifications cleared', 'success');
    notifications = [];
    renderNotifications([]);
    loadUnreadCount();
  } catch (err) {
    console.error('Error clearing notifications:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// PREFERENCES
// ============================================================

// Open Preferences Modal
async function openPreferencesModal() {
  try {
    const res = await fetch(`/api/notifications/preferences?user=${encodeURIComponent(currentUser)}`);
    if (!res.ok) throw new Error('Failed to load preferences');
    preferences = await res.json();

    // Populate form
    document.getElementById('prefEmailEnabled').checked = preferences.email_enabled;
    document.getElementById('prefEmailFrequency').value = preferences.email_frequency;
    document.getElementById('prefInAppEnabled').checked = preferences.in_app_enabled;

    // Type preferences
    const tp = preferences.type_preferences || {};
    document.getElementById('prefTaskAssigned').checked = tp.task_assigned !== false;
    document.getElementById('prefTaskDue').checked = tp.task_due !== false;
    document.getElementById('prefRfiReceived').checked = tp.rfi_received !== false;
    document.getElementById('prefRfiResponse').checked = tp.rfi_response !== false;
    document.getElementById('prefSubmittalReview').checked = tp.submittal_review !== false;
    document.getElementById('prefInvoiceApproved').checked = tp.invoice_approved !== false;
    document.getElementById('prefPoApproved').checked = tp.po_approved !== false;
    document.getElementById('prefMention').checked = tp.mention !== false;
    document.getElementById('prefMessage').checked = tp.message !== false;

    // Quiet hours
    document.getElementById('prefQuietStart').value = preferences.quiet_hours_start || '';
    document.getElementById('prefQuietEnd').value = preferences.quiet_hours_end || '';

    const modal = document.getElementById('preferencesModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading preferences:', err);
    showToast('Failed to load preferences', 'error');
  }
}

// Close Preferences Modal
function closePreferencesModal() {
  const modal = document.getElementById('preferencesModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Save Preferences
async function savePreferences() {
  const data = {
    user_name: currentUser,
    email_enabled: document.getElementById('prefEmailEnabled').checked,
    email_frequency: document.getElementById('prefEmailFrequency').value,
    in_app_enabled: document.getElementById('prefInAppEnabled').checked,
    type_preferences: {
      task_assigned: document.getElementById('prefTaskAssigned').checked,
      task_due: document.getElementById('prefTaskDue').checked,
      rfi_received: document.getElementById('prefRfiReceived').checked,
      rfi_response: document.getElementById('prefRfiResponse').checked,
      submittal_review: document.getElementById('prefSubmittalReview').checked,
      invoice_approved: document.getElementById('prefInvoiceApproved').checked,
      po_approved: document.getElementById('prefPoApproved').checked,
      mention: document.getElementById('prefMention').checked,
      message: document.getElementById('prefMessage').checked
    },
    quiet_hours_start: document.getElementById('prefQuietStart').value || null,
    quiet_hours_end: document.getElementById('prefQuietEnd').value || null
  };

  try {
    const res = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to save preferences');

    showToast('Preferences saved', 'success');
    closePreferencesModal();
  } catch (err) {
    console.error('Error saving preferences:', err);
    showToast(err.message, 'error');
  }
}
