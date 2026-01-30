import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, File, Image, Trash2, ArrowRight, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  BidDocument,
  BidPackage,
  useBidPackages,
  useMoveDocument,
  useDeleteBidDocument,
} from '@/hooks/useBidPackages';

interface DocumentManagementDialogProps {
  bidPackageId: string;
  bidTitle: string;
  documents: BidDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function DocumentManagementDialog({
  bidPackageId,
  bidTitle,
  documents,
  open,
  onOpenChange,
}: DocumentManagementDialogProps) {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [targetBidId, setTargetBidId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [bidSearchQuery, setBidSearchQuery] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: allBids = [] } = useBidPackages();
  const moveDocument = useMoveDocument();
  const deleteDocument = useDeleteBidDocument();

  // Filter out current bid from target options
  const targetBids = useMemo(() => {
    return allBids
      .filter((b) => b.id !== bidPackageId)
      .filter((b) =>
        !bidSearchQuery ||
        b.title.toLowerCase().includes(bidSearchQuery.toLowerCase()) ||
        b.vendor?.name?.toLowerCase().includes(bidSearchQuery.toLowerCase())
      );
  }, [allBids, bidPackageId, bidSearchQuery]);

  // Filter documents by search
  const filteredDocs = useMemo(() => {
    if (!searchQuery) return documents;
    return documents.filter((d) =>
      d.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  const toggleDoc = (docId: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedDocs.size === filteredDocs.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocs.map((d) => d.id)));
    }
  };

  const handleMove = async () => {
    if (!targetBidId || selectedDocs.size === 0) return;

    setIsMoving(true);
    try {
      for (const docId of selectedDocs) {
        await moveDocument.mutateAsync({
          docId,
          fromBidId: bidPackageId,
          toBidId: targetBidId,
        });
      }
      const targetBid = allBids.find((b) => b.id === targetBidId);
      toast.success(`Moved ${selectedDocs.size} document(s) to "${targetBid?.title}"`);
      setSelectedDocs(new Set());
      setTargetBidId('');
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsMoving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedDocs.size === 0) return;

    if (!confirm(`Delete ${selectedDocs.size} selected document(s)? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      for (const docId of selectedDocs) {
        await deleteDocument.mutateAsync({ docId, bidId: bidPackageId });
      }
      toast.success(`Deleted ${selectedDocs.size} document(s)`);
      setSelectedDocs(new Set());
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Documents - {bidTitle}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Select All */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedDocs.size === filteredDocs.length && filteredDocs.length > 0}
              onCheckedChange={selectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedDocs.size > 0
                ? `${selectedDocs.size} of ${filteredDocs.length} selected`
                : `${filteredDocs.length} documents`}
            </span>
          </div>
        </div>

        {/* Document List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1">
            {filteredDocs.map((doc) => {
              const Icon = getFileIcon(doc.file_name);
              const isSelected = selectedDocs.has(doc.id);
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${
                    isSelected ? 'bg-muted' : ''
                  }`}
                  onClick={() => toggleDoc(doc.id)}
                >
                  <Checkbox checked={isSelected} />
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                      {doc.uploaded_at &&
                        ` • ${format(new Date(doc.uploaded_at), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                </div>
              );
            })}
            {filteredDocs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No documents found</p>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        {selectedDocs.size > 0 && (
          <div className="border-t pt-4 space-y-3">
            {/* Move to another bid */}
            <div className="flex items-center gap-2">
              <Select value={targetBidId} onValueChange={setTargetBidId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select target bid..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search bids..."
                      value={bidSearchQuery}
                      onChange={(e) => setBidSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="h-[200px]">
                    {targetBids.map((bid) => (
                      <SelectItem key={bid.id} value={bid.id}>
                        <div className="flex flex-col">
                          <span>{bid.title}</span>
                          {bid.vendor?.name && (
                            <span className="text-xs text-muted-foreground">
                              {bid.vendor.name}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              <Button
                onClick={handleMove}
                disabled={!targetBidId || isMoving}
                className="gap-2"
              >
                {isMoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Move
              </Button>
            </div>

            {/* Delete */}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full gap-2"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete {selectedDocs.size} Selected
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
