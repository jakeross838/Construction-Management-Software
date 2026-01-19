/**
 * Messaging API Routes
 * Handles conversations and messages
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// CONVERSATIONS
// ============================================================

/**
 * GET /api/messages/conversations
 * List conversations with optional filters
 */
router.get('/conversations', asyncHandler(async (req, res) => {
  const { job_id, type, participant, is_archived } = req.query;

  let query = supabase
    .from('v2_conversations')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .order('updated_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (type) query = query.eq('type', type);
  if (participant) query = query.contains('participants', [participant]);
  if (is_archived !== undefined) query = query.eq('is_archived', is_archived === 'true');

  const { data, error } = await query;
  if (error) throw error;

  // Get last message for each conversation
  const conversationsWithLastMessage = await Promise.all(
    (data || []).map(async (conv) => {
      const { data: lastMessage } = await supabase
        .from('v2_messages')
        .select('content, sender, created_at')
        .eq('conversation_id', conv.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count } = await supabase
        .from('v2_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .is('deleted_at', null);

      return {
        ...conv,
        last_message: lastMessage,
        message_count: count || 0
      };
    })
  );

  res.json(conversationsWithLastMessage);
}));

/**
 * GET /api/messages/conversations/:id
 * Get a single conversation with messages
 */
router.get('/conversations/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get conversation
  const { data: conversation, error: convError } = await supabase
    .from('v2_conversations')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', id)
    .single();

  if (convError) throw convError;
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Get messages
  const { data: messages } = await supabase
    .from('v2_messages')
    .select(`
      *,
      attachments:v2_message_attachments(*),
      reactions:v2_message_reactions(*)
    `)
    .eq('conversation_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  res.json({
    ...conversation,
    messages: messages || []
  });
}));

/**
 * POST /api/messages/conversations
 * Create a new conversation
 */
router.post('/conversations', asyncHandler(async (req, res) => {
  const {
    job_id,
    subject,
    type,
    participants,
    related_rfi_id,
    related_submittal_id,
    related_task_id,
    related_po_id,
    created_by
  } = req.body;

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  const { data, error } = await supabase
    .from('v2_conversations')
    .insert({
      job_id: job_id || null,
      subject,
      type: type || 'general',
      participants: participants || [],
      related_rfi_id,
      related_submittal_id,
      related_task_id,
      related_po_id,
      created_by: created_by || 'Jake Ross'
    })
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/messages/conversations/:id
 * Update a conversation
 */
router.patch('/conversations/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('v2_conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/messages/conversations/:id
 * Archive a conversation
 */
router.delete('/conversations/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_conversations')
    .update({ is_archived: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json({ success: true, message: 'Conversation archived' });
}));

// ============================================================
// MESSAGES
// ============================================================

/**
 * POST /api/messages/conversations/:id/messages
 * Send a message
 */
router.post('/conversations/:id/messages', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, sender, message_type } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const { data, error } = await supabase
    .from('v2_messages')
    .insert({
      conversation_id: id,
      content,
      sender: sender || 'Jake Ross',
      message_type: message_type || 'text',
      read_by: [sender || 'Jake Ross']
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/messages/:messageId
 * Update a message (edit)
 */
router.patch('/:messageId', asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  const { data, error } = await supabase
    .from('v2_messages')
    .update({ content })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Message not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/messages/:messageId
 * Soft delete a message
 */
router.delete('/:messageId', asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const { data, error } = await supabase
    .from('v2_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Message not found' });
  }

  res.json({ success: true, message: 'Message deleted' });
}));

/**
 * POST /api/messages/:messageId/read
 * Mark message as read
 */
router.post('/:messageId/read', asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { user } = req.body;
  const userName = user || 'Jake Ross';

  // Get current read_by
  const { data: message } = await supabase
    .from('v2_messages')
    .select('read_by')
    .eq('id', messageId)
    .single();

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const readBy = message.read_by || [];
  if (!readBy.includes(userName)) {
    readBy.push(userName);
  }

  const { data, error } = await supabase
    .from('v2_messages')
    .update({ read_by: readBy })
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

// ============================================================
// ATTACHMENTS
// ============================================================

/**
 * POST /api/messages/:messageId/attachments
 * Add attachment to message
 */
router.post('/:messageId/attachments', asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { name, file_url, file_type, file_size, uploaded_by } = req.body;

  if (!name || !file_url) {
    return res.status(400).json({ error: 'Name and file URL are required' });
  }

  const { data, error } = await supabase
    .from('v2_message_attachments')
    .insert({
      message_id: messageId,
      name,
      file_url,
      file_type,
      file_size,
      uploaded_by: uploaded_by || 'Jake Ross'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

// ============================================================
// REACTIONS
// ============================================================

/**
 * POST /api/messages/:messageId/reactions
 * Add reaction to message
 */
router.post('/:messageId/reactions', asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { reaction, user_name } = req.body;

  if (!reaction) {
    return res.status(400).json({ error: 'Reaction is required' });
  }

  const { data, error } = await supabase
    .from('v2_message_reactions')
    .insert({
      message_id: messageId,
      reaction,
      user_name: user_name || 'Jake Ross'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/messages/:messageId/reactions/:reactionId
 * Remove reaction
 */
router.delete('/:messageId/reactions/:reactionId', asyncHandler(async (req, res) => {
  const { reactionId } = req.params;

  const { error } = await supabase
    .from('v2_message_reactions')
    .delete()
    .eq('id', reactionId);

  if (error) throw error;
  res.json({ success: true, message: 'Reaction removed' });
}));

// ============================================================
// STATS
// ============================================================

/**
 * GET /api/messages/stats
 * Get messaging statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { user } = req.query;
  const userName = user || 'Jake Ross';

  // Total conversations
  const { count: totalConversations } = await supabase
    .from('v2_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false);

  // Unread messages count (messages not in read_by array)
  const { data: allMessages } = await supabase
    .from('v2_messages')
    .select('id, read_by')
    .is('deleted_at', null);

  const unreadCount = (allMessages || []).filter(m =>
    !m.read_by || !m.read_by.includes(userName)
  ).length;

  res.json({
    total_conversations: totalConversations || 0,
    unread_messages: unreadCount
  });
}));

module.exports = router;
