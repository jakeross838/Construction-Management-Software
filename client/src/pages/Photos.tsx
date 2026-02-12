import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Image,
  Loader2,
  Grid,
  List,
  Calendar,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJob } from '@/contexts/JobContext';
import { useJobs } from '@/hooks/useJobs';
import {
  usePhotos,
  usePhotoStats,
  Photo,
  PhotoCategory,
  photoCategoryConfig,
} from '@/hooks/usePhotos';
import { PhotoUploadDialog } from '@/components/photos/PhotoUploadDialog';
import { PhotoDetailDialog } from '@/components/photos/PhotoDetailDialog';

type ViewMode = 'grid' | 'list';

export default function Photos() {
  const { selectedJobId } = useJob();
  const { data: jobs } = useJobs();
  const [jobFilter, setJobFilter] = useState<string>(selectedJobId || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // Data fetching
  const filterJobId = jobFilter !== 'all' ? jobFilter : undefined;
  const filterCategory = categoryFilter !== 'all' ? (categoryFilter as PhotoCategory) : undefined;
  const { data: photosData, isLoading } = usePhotos({
    job_id: filterJobId,
    category: filterCategory,
    search: searchTerm || undefined,
    limit: 100,
  });
  const { data: stats } = usePhotoStats(filterJobId);

  const photos = photosData?.data || [];

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Photos</h1>
            <p className="text-sm text-muted-foreground">
              Job progress documentation and photo gallery
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Photos
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.total}</div>
              </CardContent>
            </Card>
            {(Object.keys(photoCategoryConfig) as PhotoCategory[]).map((cat) => (
              <Card key={cat}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-3 w-3 rounded-full', photoCategoryConfig[cat].bgColor)} />
                    <span className="text-sm text-muted-foreground">
                      {photoCategoryConfig[cat].label}
                    </span>
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {stats.by_category[cat] || 0}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center">
              <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search photos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(Object.keys(photoCategoryConfig) as PhotoCategory[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {photoCategoryConfig[cat].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo Grid/List */}
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-12">
                <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Photos Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || categoryFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Upload your first photo to get started'}
                </p>
                {!searchTerm && categoryFilter === 'all' && (
                  <Button onClick={() => setUploadOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Photos
                  </Button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer border hover:border-primary"
                    onClick={() => setSelectedPhotoId(photo.id)}
                  >
                    <img
                      src={photo.thumbnail_url || photo.file_url}
                      alt={photo.caption || 'Photo'}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.caption && (
                        <p className="text-sm font-medium truncate">{photo.caption}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <Badge
                          className={cn(
                            photoCategoryConfig[photo.category].bgColor,
                            photoCategoryConfig[photo.category].color,
                            'border-0 text-xs'
                          )}
                        >
                          {photoCategoryConfig[photo.category].label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelectedPhotoId(photo.id)}
                  >
                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={photo.thumbnail_url || photo.file_url}
                        alt={photo.caption || 'Photo'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {photo.caption || photo.file_name || 'Untitled'}
                        </span>
                        <Badge
                          className={cn(
                            photoCategoryConfig[photo.category].bgColor,
                            photoCategoryConfig[photo.category].color,
                            'border-0 text-xs'
                          )}
                        >
                          {photoCategoryConfig[photo.category].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {photo.job && <span>{photo.job.name}</span>}
                        {photo.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {photo.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(photo.taken_at || photo.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <PhotoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultJobId={jobFilter !== 'all' ? jobFilter : undefined}
      />

      {/* Detail Dialog */}
      <PhotoDetailDialog
        open={!!selectedPhotoId}
        onOpenChange={(open) => !open && setSelectedPhotoId(null)}
        photoId={selectedPhotoId}
      />
    </AppLayout>
  );
}
