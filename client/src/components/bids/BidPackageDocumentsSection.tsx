import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  File,
  Image,
  FileSpreadsheet,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  BidPackageDocument,
  useAddBidPackageDocument,
  useDeleteBidPackageDocument,
} from '@/hooks/useBidPackages';

interface BidPackageDocumentsSectionProps {
  bidPackageId: string;
  documents: BidPackageDocument[];
}

const DOCUMENT_TYPES = [
  { value: 'plans', label: 'Plans', icon: Image },
  { value: 'specifications', label: 'Specifications', icon: FileText },
  { value: 'scope', label: 'Scope of Work', icon: FileText },
  { value: 'contract', label: 'Contract', icon: File },
  { value: 'addendum', label: 'Addendum', icon: FileText },
  { value: 'other', label: 'Other', icon: File },
];

const getDocIcon = (type: string) => {
  const found = DOCUMENT_TYPES.find((d) => d.value === type);
  return found?.icon || File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function BidPackageDocumentsSection({
  bidPackageId,
  documents,
}: BidPackageDocumentsSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>('plans');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addDocument = useAddBidPackageDocument();
  const deleteDocument = useDeleteBidPackageDocument();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${bidPackageId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('bid-documents')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('bid-documents').getPublicUrl(path);

      await addDocument.mutateAsync({
        bid_package_id: bidPackageId,
        document_type: docType as any,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        description: description || null,
      });

      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this document?')) {
      deleteDocument.mutate({ id, bidPackageId });
    }
  };

  // Group documents by type
  const groupedDocs = DOCUMENT_TYPES.map((type) => ({
    ...type,
    docs: documents.filter((d) => d.document_type === type.value),
  })).filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
        <h4 className="font-medium text-sm">Upload Document</h4>
        <div className="grid grid-cols-2 gap-3">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger>
              <SelectValue placeholder="Document type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.jpg,.jpeg,.png"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Choose File'}
          </Button>
        </div>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No documents uploaded yet</p>
          <p className="text-xs">Upload plans, specs, and scope documents</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDocs.map((group) => (
            <div key={group.value}>
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h5>
              <div className="space-y-2">
                {group.docs.map((doc) => {
                  const Icon = getDocIcon(doc.document_type);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)} •{' '}
                            {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          asChild
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
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
