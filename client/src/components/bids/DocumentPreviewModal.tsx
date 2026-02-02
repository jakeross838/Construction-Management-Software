import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { BidDocument } from '@/hooks/useBidPackages';

// Configure PDF.js worker - use https explicitly for CSP compliance
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setPdfLoading(false);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setPdfLoading(false);
    setPdfError('Failed to load PDF. Try opening in a new tab.');
  }, []);

  // Reset PDF state when document changes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPageNumber(1);
      setScale(1.0);
      setPdfLoading(true);
      setPdfError(null);
      setNumPages(0);
    }
    onOpenChange(isOpen);
  };

  if (!document) return null;

  const currentIndex = documents.findIndex((d) => d.id === document.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < documents.length - 1;

  const handlePrev = () => {
    if (hasPrev && onNavigate) {
      setPageNumber(1);
      setScale(1.0);
      setPdfLoading(true);
      setPdfError(null);
      onNavigate(documents[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      setPageNumber(1);
      setScale(1.0);
      setPdfLoading(true);
      setPdfError(null);
      onNavigate(documents[currentIndex + 1]);
    }
  };

  const goToPrevPage = () => setPageNumber((p) => Math.max(1, p - 1));
  const goToNextPage = () => setPageNumber((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.5, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));

  const renderContent = () => {
    if (isPdf(document.file_name)) {
      return (
        <div className="flex flex-col h-full">
          {/* PDF Controls */}
          <div className="flex items-center justify-center gap-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[100px] text-center">
                Page {pageNumber} of {numPages || '...'}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={zoomOut} disabled={scale <= 0.5}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
              <Button size="sm" variant="outline" onClick={zoomIn} disabled={scale >= 2.5}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-auto flex justify-center bg-muted/20 p-4">
            {pdfError ? (
              <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <p>{pdfError}</p>
                <Button asChild>
                  <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </a>
                </Button>
              </div>
            ) : (
              <Document
                file={`/api/proxy/pdf?url=${encodeURIComponent(document.file_url)}`}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading PDF...</span>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  loading={
                    <div className="flex items-center justify-center gap-2 text-muted-foreground p-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  }
                />
              </Document>
            )}
          </div>
        </div>
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
