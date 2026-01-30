import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { BidDocument } from '@/hooks/useBidPackages';

interface DocumentPreviewModalProps {
  document: BidDocument | null;
  documents?: BidDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (doc: BidDocument) => void;
}

const isImage = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
};

const isPdf = (fileName: string) => {
  return fileName.toLowerCase().endsWith('.pdf');
};

export function DocumentPreviewModal({
  document,
  documents = [],
  open,
  onOpenChange,
  onNavigate,
}: DocumentPreviewModalProps) {
  const [imageError, setImageError] = useState(false);

  if (!document) return null;

  const currentIndex = documents.findIndex((d) => d.id === document.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < documents.length - 1;

  const handlePrev = () => {
    if (hasPrev && onNavigate) {
      onNavigate(documents[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      onNavigate(documents[currentIndex + 1]);
    }
  };

  const renderContent = () => {
    if (isPdf(document.file_name)) {
      return (
        <iframe
          src={`${document.file_url}#toolbar=1&navpanes=0`}
          className="w-full h-full border-0"
          title={document.file_name}
        />
      );
    }

    if (isImage(document.file_name) && !imageError) {
      return (
        <div className="flex items-center justify-center h-full bg-muted/30">
          <img
            src={document.file_url}
            alt={document.file_name}
            className="max-w-full max-h-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // Fallback for unsupported file types
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p>Preview not available for this file type</p>
        <Button asChild>
          <a href={document.file_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </a>
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium truncate pr-4">
              {document.file_name}
              {documents.length > 1 && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({currentIndex + 1} of {documents.length})
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {documents.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handlePrev}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleNext}
                    disabled={!hasNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                <a href={document.file_url} download={document.file_name}>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
