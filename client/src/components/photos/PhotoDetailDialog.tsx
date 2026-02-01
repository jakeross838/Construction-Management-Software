import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MapPin,
  Calendar,
  User,
  Tag,
  Trash2,
  Loader2,
  Download,
  Link2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Photo,
  usePhoto,
  useUpdatePhoto,
  useDeletePhoto,
  PhotoCategory,
  photoCategoryConfig,
} from '@/hooks/usePhotos';

interface PhotoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoId: string | null;
}

export function PhotoDetailDialog({
  open,
  onOpenChange,
  photoId,
}: PhotoDetailDialogProps) {
  const { data: photo, isLoading } = usePhoto(photoId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCategory, setEditCategory] = useState<PhotoCategory>('progress');

  const updatePhoto = useUpdatePhoto();
  const deletePhoto = useDeletePhoto();

  const handleStartEdit = () => {
    if (!photo) return;
    setEditCaption(photo.caption || '');
    setEditLocation(photo.location || '');
    setEditCategory(photo.category);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!photoId) return;
    await updatePhoto.mutateAsync({
      id: photoId,
      caption: editCaption || undefined,
      location: editLocation || undefined,
      category: editCategory,
      updated_by: 'Jake Ross',
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!photoId) return;
    await deletePhoto.mutateAsync(photoId);
    setDeleteOpen(false);
    onOpenChange(false);
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!photoId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : photo ? (
            <>
              {/* Header */}
              <DialogHeader className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg">
                      {photo.caption || photo.file_name || 'Photo'}
                    </DialogTitle>
                    <Badge
                      className={cn(
                        photoCategoryConfig[photo.category].bgColor,
                        photoCategoryConfig[photo.category].color,
                        'border-0'
                      )}
                    >
                      {photoCategoryConfig[photo.category].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={photo.file_url} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </a>
                    </Button>
                    {!isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartEdit}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {photo.job && (
                  <p className="text-sm text-muted-foreground">{photo.job.name}</p>
                )}
              </DialogHeader>

              {/* Image */}
              <div className="flex-1 overflow-hidden bg-black/5 flex items-center justify-center">
                <img
                  src={photo.file_url}
                  alt={photo.caption || 'Photo'}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>

              {/* Metadata */}
              <div className="px-6 py-4 border-t bg-muted/30">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Caption</Label>
                        <Input
                          value={editCaption}
                          onChange={(e) => setEditCaption(e.target.value)}
                          placeholder="Add a caption"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Input
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          placeholder="e.g., Kitchen, Master Bath"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={editCategory} onValueChange={(v) => setEditCategory(v as PhotoCategory)}>
                          <SelectTrigger>
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
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updatePhoto.isPending}
                      >
                        {updatePhoto.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {photo.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{photo.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDateTime(photo.taken_at || photo.created_at)}</span>
                    </div>
                    {photo.uploaded_by && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{photo.uploaded_by}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span>{photoCategoryConfig[photo.category].label}</span>
                    </div>
                  </div>
                )}

                {/* Entity Links */}
                {photo.links && photo.links.length > 0 && !isEditing && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Link2 className="h-4 w-4" />
                      <span>Linked to:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {photo.links.map((link) => (
                        <Badge key={link.id} variant="outline">
                          {link.entity_type.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-24 text-muted-foreground">
              Photo not found
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
