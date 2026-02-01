import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { JobsHeader } from '@/components/jobs/JobsHeader';
import { JobsStats } from '@/components/jobs/JobsStats';
import { JobCard } from '@/components/jobs/JobCard';
import { JobDetail } from '@/components/jobs/JobDetail';
import { JobFormDialog } from '@/components/jobs/JobFormDialog';
import { JobSpecsFormDialog } from '@/components/jobs/JobSpecsFormDialog';
import { useJobs, useDeleteJob, Job } from '@/hooks/useJobs';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { Job as JobType } from '@/types/job';

// Transform database job to UI job type
function transformJob(dbJob: Job): JobType {
  return {
    id: dbJob.id,
    name: dbJob.name,
    address: dbJob.address || '',
    client: dbJob.client || '',
    status: (dbJob.status as JobType['status']) || 'active',
    budget: dbJob.budget_amount || 0,
    spent: 0, // Would come from aggregated PO/Invoice data
    laborHours: 0, // Would come from time entries
    estimatedHours: 0,
    startDate: dbJob.start_date || '',
    targetCompletion: dbJob.end_date || '',
    margin: dbJob.target_margin || 0,
    phase: 'Pre-Construction', // Would come from schedule tasks
  };
}

const Jobs = () => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJob, setDeletingJob] = useState<Job | null>(null);
  const [specsJob, setSpecsJob] = useState<Job | null>(null);

  const { data: jobs = [], isLoading } = useJobs();
  const deleteJob = useDeleteJob();

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.name?.toLowerCase().includes(query) ||
        job.client?.toLowerCase().includes(query) ||
        job.address?.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  const transformedJobs = useMemo(
    () => filteredJobs.map(transformJob),
    [filteredJobs]
  );

  const selectedJob = selectedJobId
    ? filteredJobs.find((j) => j.id === selectedJobId)
    : null;

  const handleNewJob = () => {
    setEditingJob(null);
    setIsFormOpen(true);
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setIsFormOpen(true);
  };

  const handleEditSpecs = (job: Job) => {
    setSpecsJob(job);
  };

  const handleDeleteJob = async () => {
    if (deletingJob) {
      await deleteJob.mutateAsync(deletingJob.id);
      setDeletingJob(null);
    }
  };

  if (selectedJob) {
    return (
      <AppLayout>
        <JobDetail
          job={transformJob(selectedJob)}
          onBack={() => setSelectedJobId(null)}
          onEdit={() => handleEditJob(selectedJob)}
          onDelete={() => setDeletingJob(selectedJob)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <JobsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewJob={handleNewJob}
        />
        <JobsStats jobs={transformedJobs} />

        {/* Jobs grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {transformedJobs.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => setSelectedJobId(job.id)}
                onEdit={() => handleEditJob(filteredJobs[index])}
                onEditSpecs={() => handleEditSpecs(filteredJobs[index])}
                onDelete={() => setDeletingJob(filteredJobs[index])}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery
                ? `No jobs found matching "${searchQuery}"`
                : 'No jobs yet. Create your first job to get started.'}
            </p>
          </div>
        )}
      </div>

      <JobFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        job={editingJob}
      />

      {specsJob && (
        <JobSpecsFormDialog
          open={!!specsJob}
          onOpenChange={(open) => !open && setSpecsJob(null)}
          job={specsJob}
        />
      )}

      <AlertDialog open={!!deletingJob} onOpenChange={() => setDeletingJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingJob?.name}"? This action
              cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJob}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Jobs;
