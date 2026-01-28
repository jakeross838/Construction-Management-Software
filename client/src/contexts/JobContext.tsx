import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'selectedJob';

interface SelectedJob {
  id: string;
  name: string;
}

interface JobContextType {
  selectedJobId: string | null;
  selectedJobName: string | null;
  setSelectedJob: (job: SelectedJob | null) => void;
  // Legacy setter for backward compatibility
  setSelectedJobId: (jobId: string | null) => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export function JobProvider({ children }: { children: ReactNode }) {
  const [selectedJob, setSelectedJobState] = useState<SelectedJob | null>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored job:', e);
    }
    return null;
  });

  // Persist to localStorage when selection changes
  useEffect(() => {
    try {
      if (selectedJob) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedJob));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to persist job selection:', e);
    }
  }, [selectedJob]);

  const setSelectedJob = (job: SelectedJob | null) => {
    setSelectedJobState(job);
  };

  // Legacy setter that only has the ID - clears name if used
  const setSelectedJobId = (jobId: string | null) => {
    if (jobId === null) {
      setSelectedJobState(null);
    } else {
      // If only ID is provided, keep existing name if ID matches, otherwise clear it
      setSelectedJobState(prev => 
        prev?.id === jobId ? prev : { id: jobId, name: '' }
      );
    }
  };

  return (
    <JobContext.Provider value={{ 
      selectedJobId: selectedJob?.id ?? null,
      selectedJobName: selectedJob?.name ?? null,
      setSelectedJob,
      setSelectedJobId,
    }}>
      {children}
    </JobContext.Provider>
  );
}

export function useJob() {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
}

export function useJobFilter() {
  const { selectedJobId } = useJob();
  // Returns 'all' if no job selected, otherwise the job id
  return selectedJobId ?? 'all';
}
