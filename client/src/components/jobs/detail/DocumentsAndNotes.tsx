import { useState } from 'react';
import { FileText, MessageSquare, Upload, Plus, Pin, ChevronDown, ChevronUp, Download, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { JobDocument, JobNote, JobActivity } from '@/types/job';

interface DocumentsAndNotesProps {
  documents: JobDocument[];
  notes: JobNote[];
  activities: JobActivity[];
}

const documentTypeIcons: Record<string, string> = {
  contract: '📄',
  permit: '📋',
  drawing: '📐',
  photo: '📷',
  invoice: '🧾',
  other: '📁',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  }
  return formatDate(timestamp);
}

export function DocumentsAndNotes({ documents, notes, activities }: DocumentsAndNotesProps) {
  const [newNote, setNewNote] = useState('');
  const pinnedNotes = notes.filter(n => n.isPinned);
  const otherNotes = notes.filter(n => !n.isPinned);

  const documentsByType = documents.reduce((acc, doc) => {
    if (!acc[doc.type]) {
      acc[doc.type] = [];
    }
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, JobDocument[]>);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Tabs defaultValue="documents" className="w-full">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <TabsList>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
              <Badge variant="secondary" className="ml-1">{documents.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Notes
              <Badge variant="secondary" className="ml-1">{notes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Documents Tab */}
        <TabsContent value="documents" className="m-0">
          <div className="p-6 border-b border-border bg-muted/30">
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          </div>
          
          <div className="divide-y divide-border">
            {Object.entries(documentsByType).map(([type, docs]) => (
              <div key={type}>
                <div className="px-6 py-2 bg-muted/20 flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">{type}s</span>
                  <Badge variant="outline" className="ml-auto">{docs.length}</Badge>
                </div>
                <div className="divide-y divide-border/50">
                  {docs.map((doc) => (
                    <div key={doc.id} className="px-6 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                      <span className="text-2xl">{documentTypeIcons[doc.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(doc.size)} • Uploaded by {doc.uploadedBy} on {formatDate(doc.uploadedAt)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {documents.length === 0 && (
            <div className="px-6 py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
            </div>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="m-0">
          <div className="p-6 border-b border-border bg-muted/30">
            <Textarea
              placeholder="Add a note about this job..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="mb-3"
            />
            <Button disabled={!newNote.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>

          {/* Pinned Notes */}
          {pinnedNotes.length > 0 && (
            <div className="border-b border-border">
              <div className="px-6 py-2 bg-primary/5 flex items-center gap-2">
                <Pin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Pinned</span>
              </div>
              <div className="divide-y divide-border">
                {pinnedNotes.map((note) => (
                  <NoteItem key={note.id} note={note} />
                ))}
              </div>
            </div>
          )}

          {/* Other Notes */}
          <div className="divide-y divide-border">
            {otherNotes.map((note) => (
              <NoteItem key={note.id} note={note} />
            ))}
          </div>

          {notes.length === 0 && (
            <div className="px-6 py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No notes yet</p>
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="m-0">
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <div key={activity.id} className="px-6 py-4 flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.user} • {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {activities.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-muted-foreground">No activity recorded yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoteItem({ note }: { note: JobNote }) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium">{note.author}</span>
        <Badge variant="outline" className="text-xs">{note.authorRole}</Badge>
        {note.isPinned && <Pin className="h-3 w-3 text-primary" />}
        <span className="text-xs text-muted-foreground ml-auto">
          {formatTimestamp(note.createdAt)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{note.content}</p>
    </div>
  );
}
