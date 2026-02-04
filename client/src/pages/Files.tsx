import { useState, useMemo } from 'react';
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
  Search,
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Eye,
  Folder,
  Grid3X3,
  List,
  Loader2,
  AlertCircle,
  Box,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useDocuments, useDocumentStats, Document, DOCUMENT_CATEGORIES } from '@/hooks/useDocuments';
import { BIMViewerDialog } from '@/components/bim/BIMViewerDialog';

const categoryIcons: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  contracts: { icon: FileText, color: 'text-blue-500' },
  plans: { icon: FileSpreadsheet, color: 'text-purple-500' },
  permits: { icon: FileText, color: 'text-green-500' },
  insurance: { icon: FileText, color: 'text-cyan-500' },
  proposals: { icon: FileText, color: 'text-orange-500' },
  specs: { icon: FileText, color: 'text-indigo-500' },
  invoices: { icon: FileText, color: 'text-red-500' },
  warranties: { icon: FileText, color: 'text-teal-500' },
  correspondence: { icon: FileText, color: 'text-gray-500' },
  photos: { icon: Image, color: 'text-amber-500' },
  bim: { icon: Box, color: 'text-emerald-500' },
  other: { icon: File, color: 'text-gray-500' },
};

// Check if file is a BIM/IFC file
function isBIMFile(fileName: string | undefined): boolean {
  if (!fileName) return false;
  const ext = fileName.toLowerCase().split('.').pop();
  return ext === 'ifc' || ext === 'ifczip';
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '0 KB';
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${bytes} B`;
}

const Files = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // BIM Viewer state
  const [bimViewerOpen, setBimViewerOpen] = useState(false);
  const [selectedBIMFile, setSelectedBIMFile] = useState<{ url: string; name: string } | null>(null);

  const handleViewBIM = (fileUrl: string, fileName: string) => {
    setSelectedBIMFile({ url: fileUrl, name: fileName });
    setBimViewerOpen(true);
  };

  // Fetch documents with filters
  const { data: documents = [], isLoading, error } = useDocuments({
    job_id: selectedJobId || undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    search: searchQuery || undefined,
  });

  // Fetch stats for the selected job
  const { data: stats } = useDocumentStats(selectedJobId || undefined);

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const query = searchQuery.toLowerCase();
    return documents.filter(doc =>
      doc.name?.toLowerCase().includes(query) ||
      doc.file_name?.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query)
    );
  }, [documents, searchQuery]);

  const displayStats = useMemo(() => {
    const totalSize = documents.reduce((sum, d) => sum + (d.file_size || 0), 0);
    const photos = documents.filter(d => d.category === 'photos').length;
    return {
      total: documents.length,
      totalSize,
      photos,
      documents: documents.length - photos,
    };
  }, [documents]);

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load files</p>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Files</h1>
            <p className="text-sm text-muted-foreground">Project document management</p>
          </div>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Files</p>
                  <p className="text-2xl font-semibold">{displayStats.total}</p>
                </div>
                <File className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-semibold">{formatFileSize(displayStats.totalSize)}</p>
                </div>
                <Folder className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Photos</p>
                  <p className="text-2xl font-semibold">{displayStats.photos}</p>
                </div>
                <Image className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Documents</p>
                  <p className="text-2xl font-semibold">{displayStats.documents}</p>
                </div>
                <FileText className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              {DOCUMENT_CATEGORIES.map(category => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <Card>
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No files found</p>
            {searchQuery && <p className="text-sm text-muted-foreground">Try adjusting your search</p>}
          </div>
        ) : viewMode === 'list' ? (
          /* File List */
          <Card>
            <div className="divide-y">
              {filteredDocuments.map((doc) => {
                const categoryConfig = categoryIcons[doc.category] || categoryIcons.other;
                const FileIcon = categoryConfig.icon;
                return (
                  <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className={`p-2 rounded-lg bg-muted ${categoryConfig.color}`}>
                      <FileIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{doc.job?.name || '—'}</span>
                        <span>•</span>
                        <span className="capitalize">{doc.category}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{formatFileSize(doc.file_size)}</p>
                      <p>{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {doc.file_url && (
                        <>
                          {isBIMFile(doc.file_name) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewBIM(doc.file_url!, doc.file_name || doc.name);
                              }}
                              title="View 3D Model"
                            >
                              <Box className="h-4 w-4 text-emerald-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={doc.file_url} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          /* File Grid */
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredDocuments.map((doc) => {
              const categoryConfig = categoryIcons[doc.category] || categoryIcons.other;
              const FileIcon = categoryConfig.icon;
              return (
                <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className={`p-4 rounded-lg bg-muted mb-3 flex items-center justify-center ${categoryConfig.color}`}>
                      <FileIcon className="h-8 w-8" />
                    </div>
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatFileSize(doc.file_size)}</p>
                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="outline" className="text-xs capitalize">{doc.category}</Badge>
                      <div className="flex items-center gap-1">
                        {doc.file_url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={doc.file_url} download>
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* BIM Viewer Dialog */}
      {selectedBIMFile && (
        <BIMViewerDialog
          open={bimViewerOpen}
          onOpenChange={setBimViewerOpen}
          fileUrl={selectedBIMFile.url}
          fileName={selectedBIMFile.name}
        />
      )}
    </AppLayout>
  );
};

export default Files;
