import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  File,
  Image,
  Loader2,
  Eye,
  Settings2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  BidDocument,
  useUploadBidDocument,
  useDeleteBidDocument,
} from '@/hooks/useBidPackages';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { DocumentManagementDialog } from './DocumentManagementDialog';

interface BidPackageDocumentsSectionProps {
  bidPackageId: string;
  bidTitle?: string;
  documents: BidDocument[];
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return Image;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return FileText;
  return File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const canPreview = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
};

export function BidPackageDocumentsSection({
  bidPackageId,
  bidTitle = 'Bid',
  documents,
}: BidPackageDocumentsSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<BidDocument | null>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadDocument = useUploadBidDocument();
  const deleteDocument = useDeleteBidDocument();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      // Upload all selected files
      for (const file of Array.from(files)) {
        await uploadDocument.mutateAsync({
          bidId: bidPackageId,
          file,
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (docId: string) => {
    if (confirm('Delete this document?')) {
      deleteDocument.mutate({ docId, bidId: bidPackageId });
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
        <h4 className="font-medium text-sm">Upload Documents</h4>
        <p className="text-xs text-muted-foreground">
          Upload bid documents, proposals, and attachments (PDF, images)
        </p>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
            multiple
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </>
              )}
            </Button>
            {documents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManageDialog(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Manage
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No documents uploaded yet</p>
          <p className="text-xs">Upload bid documents, proposals, and attachments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.file_name);
            const previewable = canPreview(doc.file_name);
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => previewable && setPreviewDoc(doc)}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                      {doc.uploaded_at && ` • ${format(new Date(doc.uploaded_at), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {previewable && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setPreviewDoc(doc)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    asChild
                    title="Open in new tab"
                  >
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500"
                    onClick={() => handleDelete(doc.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        documents={documents.filter((d) => canPreview(d.file_name))}
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        onNavigate={setPreviewDoc}
      />

      {/* Management Dialog */}
      <DocumentManagementDialog
        bidPackageId={bidPackageId}
        bidTitle={bidTitle}
        documents={documents}
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
      />
    </div>
  );
}
