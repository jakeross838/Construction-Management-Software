'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { AIHubPreview } from '@/components/skeleton/previews/ai-hub-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AIHubPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'preview' | 'spec'>('preview')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button onClick={() => setActiveTab('preview')} className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors', activeTab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
          <Eye className="h-4 w-4" />UI Preview
        </button>
        <button onClick={() => setActiveTab('spec')} className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors', activeTab === 'spec' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
          <BookOpen className="h-4 w-4" />Specification
        </button>
      </div>
      {activeTab === 'preview' ? (
        <AIHubPreview />
      ) : (
        <PageSpec
          title="AI Command Center"
          phase="Phase 2 - Intelligence"
          planFile="docs/architecture/ai-engine-design.md"
          description="Cross-cutting AI features that tie everything together — morning briefings, project health scores, scenario modeling, resource optimization, and the lessons learned database."
          workflow={['Receive AI morning briefing at 7am', 'Review project health scores', 'Run what-if scenarios for decisions', 'AI optimizes resources across jobs', 'Build lessons learned database over time']}
          features={['Morning Briefing (AI daily summary)', 'Project Health Score (0-100)', '"What If" Scenario Engine', 'Cross-Job Resource Optimizer', 'Lessons Learned Database', 'Risk Register with AI auto-population', 'Client Personality Profiler', 'Business Benchmarking (anonymous)', 'AI Voice Assistant']}
          connections={[
            { name: 'All Modules', type: 'input', description: 'Aggregates data from every part of RossOS' },
            { name: 'Trade Intuition AI', type: 'input', description: 'Knowledge engine powers all AI decisions' },
            { name: 'Dashboard', type: 'output', description: 'Health scores and alerts surface on main dashboard' },
          ]}
          aiFeatures={[
            { name: 'Morning Briefing', description: 'Daily AI-generated summary of schedule, deliveries, inspections, and top priorities' },
            { name: 'Scenario Engine', description: 'Model budget and schedule impact of decisions before committing' },
            { name: 'Resource Optimizer', description: 'Manages crews across all jobs to minimize delays and maximize utilization' },
          ]}
        />
      )}
    </div>
  )
}
