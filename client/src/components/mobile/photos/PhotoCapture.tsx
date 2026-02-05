/**
 * Photo Capture Component for Mobile PWA
 * Phase 1.1c: Photo capture with location
 */

import { useState, useEffect } from 'react';
import { usePhotoCapture, PhotoCategory } from '@/hooks/mobile/usePhotoCapture';
import { useJob } from '@/contexts/JobContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Upload,
  X,
  MapPin,
  Loader2,
  CheckCircle,
  Image as ImageIcon,
  FolderOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface Job {
  id: string;
  name: string;
}

const CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: 'progress', label: 'Progress' },
  { value: 'issue', label: 'Issue' },
  { value: 'safety', label: 'Safety' },
  { value: 'material', label: 'Material' },
  { value: 'before_after', label: 'Before/After' },
  { value: 'other', label: 'Other' },
];

export function PhotoCapture() {
  const { selectedJob, setSelectedJob } = useJob();
  const {
    capturedPhotos,
    uploading,
    uploadProgress,
    error,
    capturePhoto,
    removePhoto,
    clearPhotos,
    uploadAllPhotos,
    openCamera,
    inputRef,
  } = usePhotoCapture();

  const [selectedJobId, setSelectedJobId] = useState<string>(selectedJob?.id || '');
  const [category, setCategory] = useState<PhotoCategory>('progress');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Fetch jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v2_jobs')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data as Job[];
    },
  });

  // Sync selected job from context
  useEffect(() => {
    if (selectedJob?.id && !selectedJobId) {
      setSelectedJobId(selectedJob.id);
    }
  }, [selectedJob?.id, selectedJobId]);

  // Handle file input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      await capturePhoto(file);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedJobId) {
      toast({
        title: 'Select a job',
        description: 'Please select a job before uploading photos',
        variant: 'destructive',
      });
      return;
    }

    if (capturedPhotos.length === 0) {
      toast({
        title: 'No photos',
        description: 'Please capture or select photos first',
        variant: 'destructive',
      });
      return;
    }

    const uploaded = await uploadAllPhotos(selectedJobId, {
      caption: caption || undefined,
      location: location || undefined,
      category,
    });

    if (uploaded.length > 0) {
      setUploadSuccess(true);
      setCaption('');
      setLocation('');

      toast({
        title: 'Photos uploaded',
        description: `${uploaded.length} photo(s) uploaded successfully`,
      });

      // Reset success state after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Job Selection */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">Job</label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Capture Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={openCamera}
          variant="outline"
          className="h-20 flex-col gap-2"
        >
          <Camera className="h-6 w-6" />
          <span>Take Photo</span>
        </Button>
        <Button
          onClick={() => {
            // Open file picker for gallery
            if (inputRef.current) {
              inputRef.current.removeAttribute('capture');
              inputRef.current.click();
              // Restore capture attribute after
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.setAttribute('capture', 'environment');
                }
              }, 100);
            }
          }}
          variant="outline"
          className="h-20 flex-col gap-2"
        >
          <FolderOpen className="h-6 w-6" />
          <span>From Gallery</span>
        </Button>
      </div>

      {/* Photo Preview Grid */}
      {capturedPhotos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Photos ({capturedPhotos.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPhotos}
                className="text-muted-foreground h-auto py-1 px-2"
              >
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {capturedPhotos.map((photo, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={photo.preview}
                    alt={`Captured ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {photo.latitude && (
                    <Badge
                      variant="secondary"
                      className="absolute bottom-1 left-1 text-xs px-1 py-0"
                    >
                      <MapPin className="h-3 w-3" />
                    </Badge>
                  )}
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo Details */}
      {capturedPhotos.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={category === cat.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategory(cat.value)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Caption (optional)</label>
              <Textarea
                placeholder="Add a description..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Location (optional)</label>
              <Input
                placeholder="e.g., Kitchen, Master Bedroom"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {uploading && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {uploadSuccess && (
        <Card className="border-green-500 bg-green-500/5">
          <CardContent className="py-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-600">Photos uploaded successfully!</p>
          </CardContent>
        </Card>
      )}

      {/* Upload Button */}
      {capturedPhotos.length > 0 && (
        <Button
          onClick={handleUpload}
          disabled={uploading || !selectedJobId}
          className="w-full h-12"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Upload className="h-5 w-5 mr-2" />
          )}
          Upload {capturedPhotos.length} Photo{capturedPhotos.length > 1 ? 's' : ''}
        </Button>
      )}

      {/* Empty State */}
      {capturedPhotos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Take a photo or select from gallery
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PhotoCapture;
