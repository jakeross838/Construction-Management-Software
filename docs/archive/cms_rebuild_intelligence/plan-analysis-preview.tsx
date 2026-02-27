'use client'

import {
  FileText,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Target,
  Ruler,
  Home,
  ArrowRight,
  TrendingUp,
  GitCompare,
  Plus,
  Minus,
  Move,
  DollarSign,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// ── Types ───────────────────────────────────────────────────────

type PlanStatus = 'analyzed' | 'processing' | 'pending'

interface PlanSet {
  id: string
  name: string
  pages: number
  roomsDetected: number
  status: PlanStatus
  date: string
}

interface TakeoffLine {
  category: string
  quantity: string
  unit: string
  estimatedCost: number
  wasteFactor: number
}

interface VersionChange {
  type: 'moved' | 'added' | 'removed' | 'resized'
  description: string
}

// ── Mock Data ───────────────────────────────────────────────────

const mockPlanSets: PlanSet[] = [
  { id: '1', name: 'Smith Residence - Full Set', pages: 42, roomsDetected: 28, status: 'analyzed', date: '2026-02-18' },
  { id: '2', name: 'Harbor View Condos Ph2', pages: 86, roomsDetected: 54, status: 'analyzed', date: '2026-02-15' },
  { id: '3', name: 'Coastal Office Bldg', pages: 64, roomsDetected: 38, status: 'processing', date: '2026-02-20' },
  { id: '4', name: 'Johnson Pool House', pages: 18, roomsDetected: 6, status: 'analyzed', date: '2026-02-12' },
  { id: '5', name: 'Palmetto Townhomes', pages: 130, roomsDetected: 60, status: 'pending', date: '2026-02-22' },
]

const mockTakeoffLines: TakeoffLine[] = [
  { category: 'Framing', quantity: '14,200', unit: 'BF lumber, 2,400 studs', estimatedCost: 38600, wasteFactor: 8 },
  { category: 'Drywall', quantity: '340', unit: 'sheets (4x12)', estimatedCost: 12240, wasteFactor: 10 },
  { category: 'Paint', quantity: '48', unit: 'gallons', estimatedCost: 2880, wasteFactor: 5 },
  { category: 'Flooring', quantity: '2,800', unit: 'SF', estimatedCost: 22400, wasteFactor: 7 },
  { category: 'Tile', quantity: '640', unit: 'SF', estimatedCost: 11520, wasteFactor: 12 },
  { category: 'Roofing', quantity: '34', unit: 'squares', estimatedCost: 27200, wasteFactor: 3 },
]

const mockVersionChanges: VersionChange[] = [
  { type: 'moved', description: '3 walls relocated in master suite' },
  { type: 'added', description: '2 windows added to east elevation' },
  { type: 'resized', description: 'Kitchen expanded 2\' toward dining area' },
  { type: 'removed', description: 'Pantry closet wall removed (open concept)' },
  { type: 'added', description: 'Outdoor shower added to pool deck plan' },
]

const statusConfig: Record<PlanStatus, { label: string; color: string }> = {
  analyzed: { label: 'Analyzed', color: 'bg-green-100 text-green-700' },
  processing: { label: 'Processing', color: 'bg-amber-100 text-amber-700' },
  pending: { label: 'Pending', color: 'bg-warm-100 text-warm-600' },
}

const changeTypeConfig: Record<string, { icon: typeof Move; color: string }> = {
  moved: { icon: Move, color: 'text-stone-600' },
  added: { icon: Plus, color: 'text-green-600' },
  removed: { icon: Minus, color: 'text-red-600' },
  resized: { icon: Ruler, color: 'text-amber-600' },
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M'
  if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K'
  return '$' + value.toFixed(0)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Component ──────────────────────────────────────────────

export function PlanAnalysisPreview(): React.ReactElement {
  const totalCost = mockTakeoffLines.reduce((sum, line) => sum + line.estimatedCost, 0)

  return (
    <div className="bg-warm-50 rounded-lg border border-warm-200 overflow-hidden">
      {/* Dark Header */}
      <div className="bg-stone-900 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-800 rounded-lg">
            <FileText className="h-5 w-5 text-stone-300" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">Plan Analysis & Takeoffs</h3>
            <p className="text-sm text-stone-400">
              AI-powered plan reading, room detection, dimension extraction, and material quantification
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bg-white border-b border-warm-200 px-4 py-3">
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-warm-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-warm-500 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Plans Uploaded
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">24</div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-stone-600 text-xs">
              <Home className="h-3.5 w-3.5" />
              Rooms Detected
            </div>
            <div className="text-xl font-bold text-stone-700 mt-1">186</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-green-600 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Takeoffs Generated
            </div>
            <div className="text-xl font-bold text-green-700 mt-1">42</div>
          </div>
          <div className="bg-warm-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-warm-500 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Sheets Indexed
            </div>
            <div className="text-xl font-bold text-warm-900 mt-1">340</div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-stone-600 text-xs">
              <Target className="h-3.5 w-3.5" />
              Accuracy Rate
            </div>
            <div className="text-xl font-bold text-stone-700 mt-1">96.2%</div>
          </div>
        </div>
      </div>

      {/* Plan Upload Zone */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="border-2 border-dashed border-warm-300 rounded-lg p-8 text-center hover:border-stone-400 hover:bg-warm-50/50 transition-colors cursor-pointer">
          <Upload className="h-10 w-10 text-warm-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-warm-700">Drag & drop plan sets (PDF, DWG, DXF)</p>
          <p className="text-xs text-warm-400 mt-1">or click to browse files -- up to 500 MB per upload</p>
        </div>
      </div>

      {/* Recent Plans Table */}
      <div className="bg-white border-b border-warm-200">
        <div className="px-4 py-3 border-b border-warm-100">
          <h4 className="font-medium text-warm-900 text-sm">Recent Plan Sets</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-warm-500 uppercase">Plan Set</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-warm-500 uppercase">Pages</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-warm-500 uppercase">Rooms Detected</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-warm-500 uppercase">Status</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-warm-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockPlanSets.map((plan) => {
                const status = statusConfig[plan.status]
                return (
                  <tr key={plan.id} className="border-b border-warm-50 hover:bg-warm-50/50 cursor-pointer">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-warm-400" />
                        <span className="font-medium text-warm-900">{plan.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-warm-600">{plan.pages}</td>
                    <td className="px-4 py-2.5 text-center text-warm-600">{plan.roomsDetected}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn('text-xs px-2 py-0.5 rounded font-medium', status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-warm-500">{formatDate(plan.date)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Takeoff Summary */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-stone-500" />
            <h4 className="font-medium text-warm-900 text-sm">AI Takeoff Summary</h4>
            <span className="text-xs bg-stone-50 text-stone-600 px-1.5 py-0.5 rounded">Smith Residence</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-warm-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span>Generated Feb 18, 2026</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {mockTakeoffLines.map((line) => (
            <div
              key={line.category}
              className="flex items-center justify-between p-3 bg-warm-50 rounded-lg border border-warm-100"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-24 font-medium text-warm-900 text-sm">{line.category}</div>
                <div className="flex items-center gap-1.5 text-warm-600 text-sm">
                  <Ruler className="h-3.5 w-3.5 text-warm-400" />
                  <span className="font-mono">{line.quantity}</span>
                  <span className="text-warm-400">{line.unit}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-warm-400">+{line.wasteFactor}% waste</span>
                <span className="font-medium text-warm-900 text-sm w-20 text-right">
                  {formatCurrency(line.estimatedCost)}
                </span>
              </div>
            </div>
          ))}
          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200 mt-1">
            <div className="font-semibold text-stone-700 text-sm">Material Total (estimated)</div>
            <div className="font-bold text-stone-700 text-sm">{formatCurrency(totalCost)}</div>
          </div>
        </div>
      </div>

      {/* Version Comparison */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="h-4 w-4 text-stone-500" />
          <h4 className="font-medium text-warm-900 text-sm">Version Comparison</h4>
          <span className="text-xs bg-warm-100 text-warm-600 px-1.5 py-0.5 rounded">Rev A</span>
          <ArrowRight className="h-3 w-3 text-warm-400" />
          <span className="text-xs bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded">Rev B</span>
          <span className="text-xs text-warm-400 ml-2">Smith Residence</span>
        </div>
        <div className="space-y-2">
          {mockVersionChanges.map((change, idx) => {
            const config = changeTypeConfig[change.type]
            const ChangeIcon = config.icon
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2.5 bg-warm-50 rounded-lg border border-warm-100"
              >
                <ChangeIcon className={cn('h-4 w-4', config.color)} />
                <span className="text-sm text-warm-700">{change.description}</span>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded font-medium ml-auto',
                  change.type === 'added' && 'bg-green-100 text-green-700',
                  change.type === 'removed' && 'bg-red-100 text-red-700',
                  change.type === 'moved' && 'bg-stone-100 text-stone-700',
                  change.type === 'resized' && 'bg-amber-100 text-amber-700',
                )}>
                  {change.type}
                </span>
              </div>
            )
          })}
          <div className="flex items-center gap-2 p-2 text-xs text-warm-500">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Net impact: +120 SF finished area, +$4,800 estimated material cost</span>
          </div>
        </div>
      </div>

      {/* AI Insights Bar */}
      <div className="bg-warm-50 border-t border-amber-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-800">Plan Intelligence:</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-700">
            <span className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              96.2% extraction accuracy across 340 sheets
            </span>
            <span className="text-amber-400">|</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              3 plan sets have unprocessed revisions
            </span>
            <span className="text-amber-400">|</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Avg processing time: 4.2 min per sheet
            </span>
            <span className="text-amber-400">|</span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              $2.1M total material quantified this month
            </span>
          </div>
        </div>
      </div>

      {/* AI Features Panel */}
      <div className="bg-white border-t border-warm-200 px-4 py-4">
        <AIFeaturesPanel
          title="Plan Analysis AI Features"
          columns={2}
          features={[
            {
              feature: 'Room Detection & Classification',
              trigger: 'on-submission',
              insight: 'Automatically identifies rooms, labels, and dimensions from architectural plans using computer vision.',
              detail: '186 rooms detected across 24 plan sets with 96.2% accuracy. Identifies room type (bedroom, bath, kitchen), calculates area, and extracts ceiling heights from section views.',
              confidence: 96,
              severity: 'success',
            },
            {
              feature: 'Material Quantification',
              trigger: 'on-change',
              insight: 'Extracts dimensions and calculates material quantities with waste factors from plan geometry.',
              detail: 'Automatically generates takeoffs for framing, drywall, flooring, paint, tile, and roofing. Applies configurable waste factors per material type. Cross-references with cost database for pricing.',
              confidence: 92,
              severity: 'info',
            },
            {
              feature: 'Revision Comparison',
              trigger: 'on-submission',
              insight: 'Detects and highlights differences between plan revisions with cost impact analysis.',
              detail: 'Compares plan versions sheet-by-sheet. Identifies moved walls, added/removed elements, dimension changes, and calculates net impact on material quantities and cost.',
              confidence: 89,
              severity: 'info',
            },
          ]}
        />
      </div>
    </div>
  )
}
