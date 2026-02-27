'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { ProductionQualityPreview } from '@/components/skeleton/previews/production-quality-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ProductionPage(): React.ReactElement {
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
        <ProductionQualityPreview />
      ) : (
        <PageSpec
          title="Production & Quality Control"
          phase="Phase 2 - Intelligence"
          planFile="docs/modules/07-scheduling-calendar.md"
          description="Gantt charts with dependencies, quality checklists with photo verification, crew management, and AI-powered production intelligence that predicts delays and optimizes resources."
          workflow={['Build or clone schedule from template', 'AI generates realistic durations from your data', 'Track daily progress vs plan', 'Run quality checklists at each phase', 'AI predicts delays and suggests recovery', 'Optimize crew assignments across jobs']}
          features={['Gantt chart builder with drag-adjust', 'AI schedule generator from historical data', 'Critical path auto-calculation', 'Schedule vs actual tracking', 'Quality checklists by phase', 'Pre-drywall walkthrough (50+ items)', 'Task completion verification with photos', 'Daily crew board', 'Site logistics map', 'Production rate tracking']}
          connections={[
            { name: 'Trade Intuition AI', type: 'input', description: 'Validates task sequences and prerequisites' },
            { name: 'Daily Logs', type: 'bidirectional', description: 'Progress updates feed schedule tracking' },
            { name: 'Budget', type: 'output', description: 'Earned value analysis links schedule to cost' },
          ]}
          aiFeatures={[
            { name: 'Schedule Delay Predictor', description: 'Predicts actual completion dates based on current pace, weather, and sub availability' },
            { name: 'Cost Overrun Predictor', description: 'Alerts when spend rate will exceed budget before it happens' },
            { name: 'Crew Composition Optimizer', description: 'Identifies your most productive crews and assigns them to critical path work' },
          ]}
        />
      )}
    </div>
  )
}
