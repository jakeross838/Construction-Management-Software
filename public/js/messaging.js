/**
 * Messaging Page JavaScript
 * Handles conversations and real-time messaging
 */

// State
let conversations = [];
let jobs = [];
let currentConversation = null;
let currentUser = 'Jake Ross';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  try {
    await loadJobs().catch(err => console.error('Jobs failed:', err));
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }

  await loadConversations();
  loadStats();
});

// Event Listeners
function setupEventListeners() {
  document.getElementById('jobFilter').addEventListener('change', applyFilters);

  let debounceTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  // Enter to send message (shift+enter for new line)
  document.getElementById('messageInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Load Jobs for filters and dropdowns
async function loadJobs() {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error('Failed to load jobs');
  jobs = await res.json();

  const jobFilter = document.getElementById('jobFilter');
  const convJob = document.getElementById('convJob');

  jobs.forEach(job => {
    jobFilter.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    convJob.innerHTML += `<option value="${job.id}">${job.name}</option>`;
  });
}

// Load Conversations
async function loadConversations() {
  try {
    const res = await fetch('/api/messages/conversations?is_archived=false');
    if (!res.ok) throw new Error('Failed to load conversations');
    conversations = await res.json();
    renderConversations(conversations);
  } catch (err) {
    console.error('Error loading conversations:', err);
    showToast('Failed to load conversations', 'error');
  }
}

// Load Stats
async function loadStats() {
  try {
    const res = await fetch(`/api/messages/stats?user=${encodeURIComponent(currentUser)}`);
    if (!res.ok) throw new Error('Failed to load stats');
    const stats = await res.json();

    const badge = document.getElementById('unreadBadge');
    if (stats.unread_messages > 0) {
      badge.textContent = stats.unread_messages;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Render Conversations List
function renderConversations(data) {
  const container = document.getElementById('conversationsList');

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-conversations">
        <p>No conversations yet</p>
        <button class="btn btn-primary btn-sm" onclick="openNewConversation()">Start One</button>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(conv => `
    <div class="conversation-item ${conv.id === currentConversation?.id ? 'active' : ''}"
         onclick="openConversation('${conv.id}')">
      <div class="conversation-item-header">
        <span class="conversation-subject">${conv.subject}</span>
        ${conv.last_message ? `<span class="conversation-time">${formatTime(conv.last_message.created_at)}</span>` : ''}
      </div>
      <div class="conversation-item-meta">
        <span class="conversation-job">${conv.job?.name || 'General'}</span>
        <span class="conversation-count">${conv.message_count} messages</span>
      </div>
      ${conv.last_message ? `
        <div class="conversation-preview">
          <span class="preview-sender">${conv.last_message.sender}:</span>
          ${conv.last_message.content.substring(0, 50)}${conv.last_message.content.length > 50 ? '...' : ''}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Apply Filters
function applyFilters() {
  const jobId = document.getElementById('jobFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = conversations;

  if (jobId) {
    filtered = filtered.filter(c => c.job_id === jobId);
  }
  if (search) {
    filtered = filtered.filter(c =>
      (c.subject && c.subject.toLowerCase().includes(search)) ||
      (c.last_message?.content && c.last_message.content.toLowerCase().includes(search))
    );
  }

  renderConversations(filtered);
}

// Format Time
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  // Today
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // Yesterday
  if (diff < 172800000) {
    return 'Yesterday';
  }
  // This week
  if (diff < 604800000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  // Older
  return date.toLocaleDateString();
}

// Format Full Date
function formatFullDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString();
}

// ============================================================
// CONVERSATION FUNCTIONS
// ============================================================

// Open Conversation
async function openConversation(id) {
  try {
    const res = await fetch(`/api/messages/conversations/${id}`);
    if (!res.ok) throw new Error('Failed to load conversation');
    currentConversation = await res.json();

    // Update UI
    document.querySelector('.no-conversation-selected').style.display = 'none';
    document.getElementById('conversationView').style.display = 'flex';

    // Populate header
    document.getElementById('conversationSubject').textContent = currentConversation.subject;
    document.getElementById('conversationJob').textContent = currentConversation.job?.name || 'General';
    document.getElementById('conversationParticipants').textContent =
      currentConversation.participants?.join(', ') || '';

    // Render messages
    renderMessages(currentConversation.messages || []);

    // Mark conversation as active in list
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`.conversation-item[onclick="openConversation('${id}')"]`)?.classList.add('active');

    // Scroll to bottom
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;

    // Mark messages as read
    markMessagesAsRead();
  } catch (err) {
    console.error('Error opening conversation:', err);
    showToast('Failed to load conversation', 'error');
  }
}

// Render Messages
function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');

  if (!messages || messages.length === 0) {
    container.innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
    return;
  }

  container.innerHTML = messages.map(msg => `
    <div class="message ${msg.sender === currentUser ? 'message-own' : 'message-other'}">
      <div class="message-header">
        <span class="message-sender">${msg.sender}</span>
        <span class="message-time">${formatFullDate(msg.created_at)}</span>
      </div>
      <div class="message-content">${formatMessageContent(msg.content)}</div>
      ${msg.attachments?.length ? `
        <div class="message-attachments">
          ${msg.attachments.map(att => `
            <a href="${att.file_url}" target="_blank" class="attachment-link">${att.name}</a>
          `).join('')}
        </div>
      ` : ''}
      ${msg.reactions?.length ? `
        <div class="message-reactions">
          ${msg.reactions.map(r => `<span class="reaction">${r.reaction}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Format message content (convert URLs to links, newlines to br)
function formatMessageContent(content) {
  if (!content) return '';
  // Escape HTML
  let formatted = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Convert URLs to links
  formatted = formatted.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank">$1</a>'
  );
  // Convert newlines to br
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

// Send Message
async function sendMessage() {
  if (!currentConversation) return;

  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content) return;

  try {
    const res = await fetch(`/api/messages/conversations/${currentConversation.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sender: currentUser
      })
    });

    if (!res.ok) throw new Error('Failed to send message');

    input.value = '';

    // Reload conversation
    openConversation(currentConversation.id);
    loadConversations(); // Update list with latest message
  } catch (err) {
    console.error('Error sending message:', err);
    showToast(err.message, 'error');
  }
}

// Mark Messages as Read
async function markMessagesAsRead() {
  if (!currentConversation) return;

  const unreadMessages = (currentConversation.messages || []).filter(m =>
    !m.read_by || !m.read_by.includes(currentUser)
  );

  for (const msg of unreadMessages) {
    try {
      await fetch(`/api/messages/${msg.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser })
      });
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  }

  loadStats();
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================

// Open New Conversation Modal
function openNewConversation() {
  document.getElementById('newConversationForm').reset();

  const modal = document.getElementById('newConversationModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close New Conversation Modal
function closeNewConversationModal() {
  const modal = document.getElementById('newConversationModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Create Conversation
async function createConversation() {
  const subject = document.getElementById('convSubject').value.trim();
  const jobId = document.getElementById('convJob').value;
  const type = document.getElementById('convType').value;
  const participantsInput = document.getElementById('convParticipants').value.trim();
  const firstMessage = document.getElementById('convFirstMessage').value.trim();

  if (!subject) {
    showToast('Subject is required', 'error');
    return;
  }

  // Parse participants
  const participants = participantsInput
    ? participantsInput.split(',').map(p => p.trim()).filter(p => p)
    : [];

  // Add current user if not in list
  if (!participants.includes(currentUser)) {
    participants.push(currentUser);
  }

  try {
    const res = await fetch('/api/messages/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        job_id: jobId || null,
        type,
        participants,
        created_by: currentUser
      })
    });

    if (!res.ok) throw new Error('Failed to create conversation');

    const conversation = await res.json();

    // Send first message if provided
    if (firstMessage) {
      await fetch(`/api/messages/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: firstMessage,
          sender: currentUser
        })
      });
    }

    showToast('Conversation created', 'success');
    closeNewConversationModal();
    await loadConversations();
    openConversation(conversation.id);
  } catch (err) {
    console.error('Error creating conversation:', err);
    showToast(err.message, 'error');
  }
}

// Open Conversation Settings
function openConversationSettings() {
  if (!currentConversation) return;

  document.getElementById('settingsSubject').value = currentConversation.subject || '';
  document.getElementById('settingsParticipants').value =
    (currentConversation.participants || []).join(', ');

  const modal = document.getElementById('conversationSettingsModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close Conversation Settings Modal
function closeConversationSettingsModal() {
  const modal = document.getElementById('conversationSettingsModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Save Conversation Settings
async function saveConversationSettings() {
  if (!currentConversation) return;

  const subject = document.getElementById('settingsSubject').value.trim();
  const participantsInput = document.getElementById('settingsParticipants').value.trim();
  const participants = participantsInput
    ? participantsInput.split(',').map(p => p.trim()).filter(p => p)
    : [];

  try {
    const res = await fetch(`/api/messages/conversations/${currentConversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, participants })
    });

    if (!res.ok) throw new Error('Failed to update conversation');

    showToast('Conversation updated', 'success');
    closeConversationSettingsModal();
    await loadConversations();
    openConversation(currentConversation.id);
  } catch (err) {
    console.error('Error updating conversation:', err);
    showToast(err.message, 'error');
  }
}

// Archive Conversation
async function archiveConversation() {
  if (!currentConversation) return;

  if (!confirm('Are you sure you want to archive this conversation?')) return;

  try {
    const res = await fetch(`/api/messages/conversations/${currentConversation.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to archive conversation');

    showToast('Conversation archived', 'success');
    closeConversationSettingsModal();
    currentConversation = null;

    // Reset view
    document.querySelector('.no-conversation-selected').style.display = 'flex';
    document.getElementById('conversationView').style.display = 'none';

    await loadConversations();
  } catch (err) {
    console.error('Error archiving conversation:', err);
    showToast(err.message, 'error');
  }
}
