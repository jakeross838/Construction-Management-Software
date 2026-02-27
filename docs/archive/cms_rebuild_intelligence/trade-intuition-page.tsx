'use client'

import { useState } from 'react'
import { PageSpec } from '@/components/skeleton/page-spec'
import { TradeIntuitionPreview } from '@/components/skeleton/previews/trade-intuition-preview'
import { Eye, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TradeIntuitionPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'preview' | 'spec'>('preview')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('preview')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
            activeTab === 'preview'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          <Eye className="h-4 w-4" />
          UI Preview
        </button>
        <button
          onClick={() => setActiveTab('spec')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
            activeTab === 'spec'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          <BookOpen className="h-4 w-4" />
          Specification
        </button>
      </div>

      {activeTab === 'preview' ? (
        <TradeIntuitionPreview />
      ) : (
        <PageSpec
          title="Trade Intuition AI"
          phase="Phase 2 - Intelligence"
          planFile="docs/architecture/ai-engine-design.md"
          description="The foundational construction knowledge engine that lives inside every AI feature in RossOS. 80 knowledge domains across 8 categories, powered by a 7-Layer Thinking Engine that validates every decision from prerequisites to client communication."
          workflow={[
            'Trade Intuition runs automatically on every AI decision',
            'Every schedule change, selection, bid, and task completion passes through 7 validation layers',
            'Flags are surfaced inline where decisions are made (schedule view, estimates, selections)',
            'PM can override non-safety flags with a reason — system tracks outcomes',
            'Engine learns from your actual data: waste rates, durations, punch items, inspections',
          ]}
          features={[
            '80 knowledge domains across 8 categories',
            '7-Layer Thinking Engine validates every decision',
            'Material Science & Compatibility (10 domains)',
            'Installation Sequences & Trade Coordination (10 domains)',
            'Real-World Constraints & Physics (10 domains)',
            'Problem-Solving Engine with multi-variance solutions (10 domains)',
            'Trade-Specific Deep Knowledge for 10 trades (10 domains)',
            'Coordination Intelligence for GC operations (10 domains)',
            'Cost & Time Intelligence with real rates (10 domains)',
            'Safety & Compliance per OSHA/NEC/IRC (10 domains)',
            'Confidence scoring with 5 flag severity levels',
            'Override tracking with outcome learning',
            'Self-learning from your actual project data',
          ]}
          connections={[
            { name: 'Scheduling AI', type: 'output', description: 'Validates task sequences, prerequisites, trade conflicts' },
            { name: 'Estimating AI', type: 'output', description: 'Catches hidden costs, validates waste factors, adds consumables' },
            { name: 'Selections AI', type: 'output', description: 'Material compatibility, weight, maintenance, lead times' },
            { name: 'All AI Features', type: 'bidirectional', description: 'Every AI decision queries Trade Intuition before responding' },
          ]}
          aiFeatures={[
            { name: 'Self-Learning Engine', description: 'Learns from YOUR waste rates, durations, punch items, inspection failures, and warranty claims' },
            { name: '7-Layer Validation', description: 'Prerequisites → Materials → Trade Conflicts → Downstream → Cost → Quality → Client — every decision checked from 7 angles' },
            { name: 'Confidence & Override', description: 'Safety blocks, strong recommendations, suggestions, learning nudges — each with tracked outcomes for continuous improvement' },
          ]}
        />
      )}
    </div>
  )
}
