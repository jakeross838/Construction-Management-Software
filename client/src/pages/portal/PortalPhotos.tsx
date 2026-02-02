import { useState, useEffect } from 'react';
import PortalLayout from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Image,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { PortalSession } from '@/hooks/useClientPortal';

interface Photo {
  id: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  category?: string;
  taken_at?: string;
  created_at: string;
}

const PortalPhotos = () => {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    const storedSession = localStorage.getItem('portal_session');
    if (storedSession) {
      setSession(JSON.parse(storedSession));
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchPhotos = async () => {
      try {
        const response = await fetch('/api/client-portal/portal/photos', {
          headers: {
            'Authorization': `Bearer ${session.session_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load photos');
        }

        const data = await response.json();
        setPhotos(data.photos || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPhotos();
  }, [session]);

  // Get unique categories
  const categories = ['all', ...new Set(photos.map(p => p.category).filter(Boolean))];

  // Filter photos
  const filteredPhotos = photos.filter(photo => {
    const matchesSearch = !searchQuery ||
      photo.caption?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || photo.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group photos by date
  const photosByDate = filteredPhotos.reduce((acc, photo) => {
    const date = new Date(photo.taken_at || photo.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, Photo[]>);

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!selectedPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
    const newIndex = direction === 'prev'
      ? Math.max(0, currentIndex - 1)
      : Math.min(filteredPhotos.length - 1, currentIndex + 1);
    setSelectedPhoto(filteredPhotos[newIndex]);
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  if (error) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load photos</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Image className="h-6 w-6" />
            Project Photos
          </h1>
          <p className="text-muted-foreground">
            {photos.length} photos from your project
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search photos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {categories.length > 1 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Photos Grid by Date */}
        {filteredPhotos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Image className="h-12 w-12 mb-4" />
              <p>No photos found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(photosByDate).map(([date, datePhotos]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{date}</span>
                  <Badge variant="secondary">{datePhotos.length}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {datePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img
                        src={photo.thumbnail_url || photo.url}
                        alt={photo.caption || 'Project photo'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          {selectedPhoto && (
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Navigation Buttons */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                onClick={() => navigatePhoto('prev')}
                disabled={filteredPhotos.findIndex(p => p.id === selectedPhoto.id) === 0}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                onClick={() => navigatePhoto('next')}
                disabled={filteredPhotos.findIndex(p => p.id === selectedPhoto.id) === filteredPhotos.length - 1}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              {/* Image */}
              <div className="flex items-center justify-center min-h-[50vh] max-h-[80vh] p-8">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption || 'Project photo'}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Caption */}
              {selectedPhoto.caption && (
                <div className="p-4 text-white text-center">
                  <p>{selectedPhoto.caption}</p>
                  {selectedPhoto.category && (
                    <Badge variant="secondary" className="mt-2">
                      {selectedPhoto.category}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
};

export default PortalPhotos;
