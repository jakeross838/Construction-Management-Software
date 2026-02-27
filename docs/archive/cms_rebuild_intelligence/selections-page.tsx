'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { SelectionsExperiencePreview } from '@/components/skeleton/previews/selections-experience-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SelectionsExperiencePage(): React.ReactElement {
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
        <SelectionsExperiencePreview />
      ) : (
        <PageSpec
          title="Selections Experience"
          phase="Phase 3 - Experience"
          planFile="docs/modules/21-selection-management.md"
          description="Making material selection fun — vibe boards, AR previews, couple decision mode, gamification, and AI style matching. Transform selections from a boring spreadsheet into an experience clients love."
          workflow={['Client creates vibe board from Pinterest/Houzz/photos', 'AI detects style and suggests products', 'Browse selection cards by room and category', 'Compare options side-by-side with budget impact', 'Couple mode: both rate independently, reveal matches', 'Lock selection with digital signature', 'Auto-create PO and update budget']}
          features={['Vibe board creator with Pinterest/Houzz import', 'AI style detection and product matching', 'Swipeable selection cards', 'Good/Better/Best tiers', 'Real-time budget impact', 'AR room preview', 'Paint color visualizer', 'Couple decision mode', 'Gamification and progress tracking', 'Compatibility checker', 'Lead time alerts', '3D room visualizer', 'Exterior visualizer']}
          connections={[
            { name: 'Budget', type: 'output', description: 'Selection costs update budget allowances in real-time' },
            { name: 'Purchase Orders', type: 'output', description: 'Locked selections auto-create POs' },
            { name: 'Trade Intuition AI', type: 'input', description: 'Validates material compatibility and installation requirements' },
          ]}
          aiFeatures={[
            { name: 'Style Detection', description: 'Analyzes vibe board photos to identify design style and suggest matching products' },
            { name: 'Compatibility Checker', description: 'Flags conflicts like undermount sink with tile countertop or mismatched metal finishes' },
            { name: 'Decision Fatigue Detector', description: 'Notices when clients are stuck and suggests design consultation' },
          ]}
        />
      )}
    </div>
  )
}
