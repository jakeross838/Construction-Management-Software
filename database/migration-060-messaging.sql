-- Migration 060: Messaging
-- Internal project communication system

-- ============================================================
-- CONVERSATIONS (threads)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Conversation details
  subject TEXT NOT NULL,
  type TEXT DEFAULT 'general', -- general, job, rfi, submittal, task

  -- Related entities
  related_rfi_id UUID,
  related_submittal_id UUID,
  related_task_id UUID,
  related_po_id UUID,

  -- Participants (array of usernames/emails)
  participants TEXT[],

  -- Status
  is_archived BOOLEAN DEFAULT false,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES v2_conversations(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL,
  sender TEXT NOT NULL,

  -- Message type
  message_type TEXT DEFAULT 'text', -- text, file, system

  -- Read tracking
  read_by TEXT[], -- Array of users who have read this message

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- MESSAGE ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES v2_messages(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,

  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGE REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES v2_messages(id) ON DELETE CASCADE,

  reaction TEXT NOT NULL, -- emoji or reaction type
  user_name TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, user_name, reaction)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_conversations_job_id ON v2_conversations(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_conversations_type ON v2_conversations(type);
CREATE INDEX IF NOT EXISTS idx_v2_conversations_created_by ON v2_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_v2_messages_conversation_id ON v2_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_v2_messages_sender ON v2_messages(sender);
CREATE INDEX IF NOT EXISTS idx_v2_messages_created_at ON v2_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_v2_messages_deleted_at ON v2_messages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v2_message_attachments_message_id ON v2_message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_v2_message_reactions_message_id ON v2_message_reactions(message_id);

-- ============================================================
-- TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conversation_updated_at ON v2_conversations;
CREATE TRIGGER trigger_conversation_updated_at
  BEFORE UPDATE ON v2_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

CREATE OR REPLACE FUNCTION update_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_message_updated_at ON v2_messages;
CREATE TRIGGER trigger_message_updated_at
  BEFORE UPDATE ON v2_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_updated_at();

-- Update conversation updated_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE v2_conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON v2_messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON v2_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();
