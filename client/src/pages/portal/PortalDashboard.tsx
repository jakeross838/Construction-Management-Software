import { useState, useEffect } from 'react';
import PortalLayout from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Home,
  Calendar,
  Image,
  MessageSquare,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { PortalSession } from '@/hooks/useClientPortal';

interface DashboardData {
  project: {
    name: string;
    address: string;
    status: string;
    progress_percent: number;
    estimated_completion?: string;
    start_date?: string;
  };
  recent_photos: Array<{
    id: string;
    url: string;
    caption?: string;
    created_at: string;
  }>;
  upcoming_milestones: Array<{
    id: string;
    name: string;
    date: string;
    status: string;
  }>;
  recent_activity: Array<{
    id: string;
    type: string;
    description: string;
    created_at: string;
  }>;
  unread_messages: number;
  pending_selections: number;
}

const PortalDashboard = () => {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedSession = localStorage.getItem('portal_session');
    if (storedSession) {
      setSession(JSON.parse(storedSession));
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/client-portal/portal/dashboard', {
          headers: {
            'Authorization': `Bearer ${session.session_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load dashboard');
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [session]);

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
            <p className="text-lg font-medium">Failed to load dashboard</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  const { settings } = session || { settings: {} as any };

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back, {session?.client.name.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">
            {settings.welcome_message || 'Here\'s the latest on your project.'}
          </p>
        </div>

        {/* Project Overview */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5" />
                {dashboardData?.project.name || session?.job.name}
              </CardTitle>
              <Badge variant={
                dashboardData?.project.status === 'active' ? 'default' :
                dashboardData?.project.status === 'completed' ? 'secondary' : 'outline'
              }>
                {dashboardData?.project.status || 'In Progress'}
              </Badge>
            </div>
            <CardDescription>{dashboardData?.project.address || session?.job.address}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Project Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {dashboardData?.project.progress_percent || 0}%
                  </span>
                </div>
                <Progress value={dashboardData?.project.progress_percent || 0} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                {dashboardData?.project.start_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm font-medium">
                      {new Date(dashboardData.project.start_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {dashboardData?.project.estimated_completion && (
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Completion</p>
                    <p className="text-sm font-medium">
                      {new Date(dashboardData.project.estimated_completion).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {settings.show_photos && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Image className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">
                      {dashboardData?.recent_photos.length || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Recent Photos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {settings.allow_messaging && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">
                      {dashboardData?.unread_messages || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Unread Messages</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {settings.show_selections && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <FileText className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">
                      {dashboardData?.pending_selections || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Pending Selections</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Photos */}
        {settings.show_photos && dashboardData?.recent_photos && dashboardData.recent_photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Image className="h-5 w-5" />
                Recent Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboardData.recent_photos.slice(0, 4).map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Project photo'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Milestones */}
        {settings.show_schedule && dashboardData?.upcoming_milestones && dashboardData.upcoming_milestones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.upcoming_milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    {milestone.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{milestone.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(milestone.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={milestone.status === 'completed' ? 'secondary' : 'outline'}>
                      {milestone.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {dashboardData?.recent_activity && dashboardData.recent_activity.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.recent_activity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div>
                      <p>{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
};

export default PortalDashboard;
