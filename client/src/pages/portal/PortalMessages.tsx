import { useState, useEffect, useRef } from 'react';
import PortalLayout from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  Paperclip,
  User,
  Building2,
} from 'lucide-react';
import { PortalSession } from '@/hooks/useClientPortal';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  subject?: string;
  content: string;
  direction: 'client_to_builder' | 'builder_to_client';
  sender_name?: string;
  read_at?: string;
  attachments?: string[];
  created_at: string;
}

const PortalMessages = () => {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedSession = localStorage.getItem('portal_session');
    if (storedSession) {
      setSession(JSON.parse(storedSession));
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchMessages = async () => {
      try {
        const response = await fetch('/api/client-portal/portal/messages', {
          headers: {
            'Authorization': `Bearer ${session.session_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load messages');
        }

        const data = await response.json();
        setMessages(data.messages || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [session]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !session) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/client-portal/portal/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session_token}`,
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      setMessages([...messages, data.message]);
      setNewMessage('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  if (error) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load messages</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto">
        <Card className="h-[calc(100vh-200px)] flex flex-col">
          <CardHeader className="border-b flex-shrink-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Messages with {session?.builder.name}
            </CardTitle>
          </CardHeader>

          {/* Messages List */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4" />
                <p>No messages yet</p>
                <p className="text-sm">Send a message to start the conversation</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.direction === 'client_to_builder' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.direction === 'builder_to_client' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg p-3',
                        message.direction === 'client_to_builder'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {message.subject && (
                        <p className="font-medium text-sm mb-1">{message.subject}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs opacity-80">
                          <Paperclip className="h-3 w-3" />
                          {message.attachments.length} attachment(s)
                        </div>
                      )}

                      <p className={cn(
                        'text-xs mt-2',
                        message.direction === 'client_to_builder'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}>
                        {new Date(message.created_at).toLocaleString()}
                        {message.direction === 'builder_to_client' && message.sender_name && (
                          <span className="ml-2">• {message.sender_name}</span>
                        )}
                      </p>
                    </div>

                    {message.direction === 'client_to_builder' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>

          {/* Message Input */}
          <div className="border-t p-4 flex-shrink-0">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                className="self-end"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
};

export default PortalMessages;
