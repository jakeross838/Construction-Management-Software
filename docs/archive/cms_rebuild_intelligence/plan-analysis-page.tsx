'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { PlanAnalysisPreview } from '@/components/skeleton/previews/plan-analysis-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PlanAnalysisPage(): React.ReactElement {
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
        <PlanAnalysisPreview />
      ) : (
        <PageSpec
          title="Plan Analysis & Takeoffs"
          phase="Phase 2 - Intelligence"
          planFile="docs/modules/20-estimating-engine.md"
          description="AI-powered plan reading, room detection, dimension extraction, and material quantification. Upload plan sets and get automatic takeoffs for framing, drywall, paint, flooring, tile, roofing, concrete, and more."
          workflow={['Upload plan set (PDF/DWG/DXF)', 'AI classifies pages and detects rooms', 'Dimensions extracted automatically', 'Material takeoffs generated per trade', 'Review and adjust quantities', 'Export to PO or estimate']}
          features={['Drag-drop plan upload with auto-classification', 'AI room detection from floor plans', 'Dimension extraction with auto-scaling', 'Plan version comparison (diff)', 'Material takeoffs for 10+ trades', 'Waste factor learning from actuals', 'Multi-vendor price comparison', 'On-plan SF/LF measurement tool']}
          connections={[
            { name: 'Estimating Engine', type: 'output', description: 'Takeoff quantities feed directly into estimates' },
            { name: 'Purchase Orders', type: 'output', description: 'Takeoffs convert to POs with one click' },
            { name: 'Trade Intuition AI', type: 'input', description: 'Validates quantities and catches missing items' },
          ]}
          aiFeatures={[
            { name: 'AI Plan Classification', description: 'Auto-detects page types: floor plan, elevation, electrical, plumbing, structural' },
            { name: 'Smart Takeoffs', description: 'Calculates materials with real waste factors learned from your actual usage' },
            { name: 'Version Diff', description: 'Highlights exactly what changed between plan revisions' },
          ]}
        />
      )}
    </div>
  )
}
