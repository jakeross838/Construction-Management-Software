import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IFCViewer } from './IFCViewer';

interface BIMViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName?: string;
}

export function BIMViewerDialog({
  open,
  onOpenChange,
  fileUrl,
  fileName,
}: BIMViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] lg:max-w-[1200px] xl:max-w-[1400px] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            3D Model Viewer
            {fileName && (
              <span className="text-sm font-normal text-muted-foreground">
                - {fileName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-2">
          <IFCViewer
            fileUrl={fileUrl}
            fileName={fileName}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BIMViewerDialog;
