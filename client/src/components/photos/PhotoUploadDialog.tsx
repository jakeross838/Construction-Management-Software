import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, X, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobs } from '@/hooks/useJobs';
import {
  useUploadPhoto,
  PhotoCategory,
  photoCategoryConfig,
} from '@/hooks/usePhotos';

interface PhotoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJobId?: string;
}

interface FilePreview {
  file: File;
  preview: string;
  caption: string;
  location: string;
  category: PhotoCategory;
}

export function PhotoUploadDialog({
  open,
  onOpenChange,
  defaultJobId,
}: PhotoUploadDialogProps) {
  const { data: jobs } = useJobs();
  const uploadPhoto = useUploadPhoto();
  const [jobId, setJobId] = useState(defaultJobId || '');
  const [files, setFiles] = useState<FilePreview[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      caption: '',
      location: '',
      category: 'progress' as PhotoCategory,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    },
    maxSize: 25 * 1024 * 1024, // 25MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateFile = (index: number, updates: Partial<FilePreview>) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], ...updates };
      return newFiles;
    });
  };

  const handleUpload = async () => {
    if (!jobId || files.length === 0) return;

    for (const fileData of files) {
      await uploadPhoto.mutateAsync({
        file: fileData.file,
        job_id: jobId,
        caption: fileData.caption || undefined,
        location: fileData.location || undefined,
        category: fileData.category,
        uploaded_by: 'Jake Ross',
      });
    }

    // Cleanup and close
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Selection */}
          <div className="space-y-2">
            <Label>Job *</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                {jobs?.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-primary">Drop the photos here...</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop photos here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to select files (max 25MB each)
                </p>
              </>
            )}
          </div>

          {/* File Previews */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Selected Photos ({files.length})</h4>
              <div className="space-y-4">
                {files.map((fileData, index) => (
                  <div
                    key={index}
                    className="flex gap-4 p-3 border rounded-lg"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <img
                        src={fileData.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 space-y-2">
                      <div className="text-sm font-medium truncate">
                        {fileData.file.name}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Caption</Label>
                          <Input
                            placeholder="Caption"
                            value={fileData.caption}
                            onChange={(e) => updateFile(index, { caption: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Location</Label>
                          <Input
                            placeholder="Location"
                            value={fileData.location}
                            onChange={(e) => updateFile(index, { location: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Select
                            value={fileData.category}
                            onValueChange={(value) => updateFile(index, { category: value as PhotoCategory })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(photoCategoryConfig) as PhotoCategory[]).map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {photoCategoryConfig[cat].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!jobId || files.length === 0 || uploadPhoto.isPending}
          >
            {uploadPhoto.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Image className="h-4 w-4 mr-2" />
            Upload {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
