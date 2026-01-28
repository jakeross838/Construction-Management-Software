import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Trash2,
  Folder,
  FolderOpen,
  Grid3X3,
  List,
} from 'lucide-react';
import { jobs } from '@/data/mockData';
import { useJob } from '@/contexts/JobContext';

type FileType = 'contract' | 'permit' | 'drawing' | 'photo' | 'invoice' | 'proposal' | 'other';

interface ProjectFile {
  id: string;
  jobId: string;
  name: string;
  type: FileType;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  folder?: string;
}

const files: ProjectFile[] = [
  { id: '1', jobId: '1', name: 'Construction_Contract_Drummond.pdf', type: 'contract', size: 2450000, uploadedBy: 'Jake Ross', uploadedAt: '2025-10-10', folder: 'Contracts' },
  { id: '2', jobId: '1', name: 'Building_Permit_501_74th.pdf', type: 'permit', size: 850000, uploadedBy: 'Sarah Chen', uploadedAt: '2025-10-12', folder: 'Permits' },
  { id: '3', jobId: '1', name: 'Architectural_Plans_v2.1.pdf', type: 'drawing', size: 15600000, uploadedBy: 'Sarah Chen', uploadedAt: '2025-09-05', folder: 'Drawings' },
  { id: '4', jobId: '1', name: 'Structural_Plans_v1.3.pdf', type: 'drawing', size: 8200000, uploadedBy: 'Sarah Chen', uploadedAt: '2025-09-08', folder: 'Drawings' },
  { id: '5', jobId: '1', name: 'Foundation_Progress_01.jpg', type: 'photo', size: 3200000, uploadedBy: 'Tom Smith', uploadedAt: '2025-10-15', folder: 'Photos' },
  { id: '6', jobId: '1', name: 'Foundation_Progress_02.jpg', type: 'photo', size: 2800000, uploadedBy: 'Tom Smith', uploadedAt: '2025-10-18', folder: 'Photos' },
  { id: '7', jobId: '1', name: 'Framing_Progress_01.jpg', type: 'photo', size: 3100000, uploadedBy: 'Tom Smith', uploadedAt: '2025-12-20', folder: 'Photos' },
  { id: '8', jobId: '2', name: 'Crews_Contract.pdf', type: 'contract', size: 2100000, uploadedBy: 'Jake Ross', uploadedAt: '2025-05-25', folder: 'Contracts' },
  { id: '9', jobId: '2', name: 'Siesta_Key_Permit.pdf', type: 'permit', size: 920000, uploadedBy: 'Sarah Chen', uploadedAt: '2025-05-28', folder: 'Permits' },
  { id: '10', jobId: '1', name: 'Invoice_Carpentry_Jan.pdf', type: 'invoice', size: 450000, uploadedBy: 'Mike Johnson', uploadedAt: '2026-01-18', folder: 'Invoices' },
];

const fileTypeConfig: Record<FileType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  contract: { icon: FileText, color: 'text-blue-500' },
  permit: { icon: FileText, color: 'text-green-500' },
  drawing: { icon: FileSpreadsheet, color: 'text-purple-500' },
  photo: { icon: Image, color: 'text-amber-500' },
  invoice: { icon: FileText, color: 'text-red-500' },
  proposal: { icon: FileText, color: 'text-cyan-500' },
  other: { icon: File, color: 'text-gray-500' },
};

const folders = ['All Files', 'Contracts', 'Permits', 'Drawings', 'Photos', 'Invoices'];

function formatFileSize(bytes: number): string {
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${bytes} B`;
}

const Files = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('All Files');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const matchesJob = !selectedJobId || file.jobId === selectedJobId;
      const matchesFolder = folderFilter === 'All Files' || file.folder === folderFilter;
      const matchesSearch = !searchQuery.trim() || 
        file.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesJob && matchesFolder && matchesSearch;
    });
  }, [searchQuery, selectedJobId, folderFilter]);

  const stats = useMemo(() => {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    return {
      total: files.length,
      totalSize,
      photos: files.filter(f => f.type === 'photo').length,
      documents: files.filter(f => f.type !== 'photo').length,
    };
  }, []);

  const getJobName = (jobId: string) => jobs.find(j => j.id === jobId)?.name || 'Unknown';

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
                  <p className="text-2xl font-semibold">{stats.total}</p>
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
                  <p className="text-2xl font-semibold">{formatFileSize(stats.totalSize)}</p>
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
                  <p className="text-2xl font-semibold">{stats.photos}</p>
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
                  <p className="text-2xl font-semibold">{stats.documents}</p>
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
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Folder" />
            </SelectTrigger>
            <SelectContent>
              {folders.map(folder => (
                <SelectItem key={folder} value={folder}>{folder}</SelectItem>
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

        {/* File List/Grid */}
        {viewMode === 'list' ? (
          <Card>
            <div className="divide-y">
              {filteredFiles.map((file) => {
                const FileIcon = fileTypeConfig[file.type].icon;
                return (
                  <div key={file.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className={`p-2 rounded-lg bg-muted ${fileTypeConfig[file.type].color}`}>
                      <FileIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{getJobName(file.jobId)}</span>
                        <span>•</span>
                        <span>{file.folder}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{formatFileSize(file.size)}</p>
                      <p>{new Date(file.uploadedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredFiles.map((file) => {
              const FileIcon = fileTypeConfig[file.type].icon;
              return (
                <Card key={file.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className={`p-4 rounded-lg bg-muted mb-3 flex items-center justify-center ${fileTypeConfig[file.type].color}`}>
                      <FileIcon className="h-8 w-8" />
                    </div>
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatFileSize(file.size)}</p>
                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="outline" className="text-xs">{file.folder}</Badge>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No files found</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Files;
