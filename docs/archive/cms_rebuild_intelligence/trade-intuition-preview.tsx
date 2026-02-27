'use client'

import { useState } from 'react'
import {
  Brain,
  Sparkles,
  Layers,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  Hammer,
  Wrench,
  Zap,
  DollarSign,
  Users,
  HardHat,
  Thermometer,
  Scale,
  GitBranch,
  Eye,
  MessageSquare,
  Target,
  Activity,
  Gauge,
  CircleDot,
  Lightbulb,
  Award,
  BookOpen,
  Truck,
  ClipboardCheck,
  Ruler,
  Droplets,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// ── Types ─────────────────────────────────────────────────────────────

interface CheckItem {
  label: string
  status: 'pass' | 'warn' | 'pending'
}

interface ValidationLayer {
  number: number
  name: string
  question: string
  color: string
  bgColor: string
  borderColor: string
  iconBg: string
  icon: React.ElementType
  checks: CheckItem[]
}

interface KnowledgeDomain {
  id: string
  name: string
  icon: React.ElementType
  color: string
  bgColor: string
  domainCount: number
  description: string
  examples: { name: string; description: string }[]
}

interface FlagType {
  emoji: string
  name: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  example: string
}

// ── Mock Data ─────────────────────────────────────────────────────────

const validationLayers: ValidationLayer[] = [
  {
    number: 1,
    name: 'Prerequisite Check',
    question: 'What needs to be TRUE before this can happen?',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconBg: 'bg-green-100',
    icon: CheckCircle,
    checks: [
      { label: 'Foundation inspection passed (2026-02-10)', status: 'pass' },
      { label: 'Structural steel delivered and staged', status: 'pass' },
      { label: 'Crane operator certified and available', status: 'pass' },
      { label: 'Soil compaction report meets spec', status: 'warn' },
    ],
  },
  {
    number: 2,
    name: 'Material Validation',
    question: 'Is the right stuff on site, in the right condition?',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100',
    icon: ClipboardCheck,
    checks: [
      { label: '4x LVL beams verified (16\' spec, delivered 16\')', status: 'pass' },
      { label: 'Concrete batch test: 4000 PSI at 28 days', status: 'pass' },
      { label: 'Vapor barrier inspection: no tears or punctures', status: 'warn' },
      { label: 'Rebar grade 60 — mill certs on file', status: 'pass' },
    ],
  },
  {
    number: 3,
    name: 'Trade Conflict Scan',
    question: 'Who else is working in this space at this time?',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-100',
    icon: Users,
    checks: [
      { label: 'Electrician rough-in complete in Zone B', status: 'pass' },
      { label: 'Plumber needs 2 more hours in Zone B ceiling', status: 'warn' },
      { label: 'HVAC ductwork clear of framing path', status: 'pass' },
    ],
  },
  {
    number: 4,
    name: 'Downstream Impact',
    question: 'What does this decision affect AFTER it happens?',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-100',
    icon: GitBranch,
    checks: [
      { label: 'Drywall hang can start 48h after framing complete', status: 'pass' },
      { label: 'Insulation inspection required before close-in', status: 'pass' },
      { label: 'Cabinet lead time: 6 weeks from framing sign-off', status: 'warn' },
      { label: 'Flooring acclimation needs 72h in conditioned space', status: 'pending' },
    ],
  },
  {
    number: 5,
    name: 'Cost & Budget',
    question: 'Does this decision have hidden cost implications?',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconBg: 'bg-orange-100',
    icon: DollarSign,
    checks: [
      { label: 'Overtime for Saturday pour: +$2,400 (within contingency)', status: 'warn' },
      { label: 'Material waste factor: 8% vs 12% budget — saving $1,100', status: 'pass' },
      { label: 'No change order required for current scope', status: 'pass' },
    ],
  },
  {
    number: 6,
    name: 'Quality & Warranty',
    question: 'What could go wrong, and how do we prevent it?',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconBg: 'bg-red-100',
    icon: Shield,
    checks: [
      { label: 'Moisture content below 19% — safe for framing', status: 'pass' },
      { label: 'Flashing detail matches manufacturer warranty spec', status: 'pass' },
      { label: 'Expansion gap at slab-to-wall: 1/2" minimum', status: 'warn' },
      { label: 'GC warranty coverage confirmed through 2028', status: 'pass' },
    ],
  },
  {
    number: 7,
    name: 'Client Communication',
    question: 'Does the client need to know anything?',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    iconBg: 'bg-indigo-100',
    icon: MessageSquare,
    checks: [
      { label: 'Selection deadline: tile choice needed by Feb 28', status: 'warn' },
      { label: 'Progress photos auto-sent for framing milestone', status: 'pass' },
      { label: 'No schedule impact to communicate', status: 'pass' },
    ],
  },
]

const knowledgeDomains: KnowledgeDomain[] = [
  {
    id: 'material-science',
    name: 'Material Science',
    icon: Thermometer,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    domainCount: 10,
    description: 'Deep understanding of how materials behave in real construction conditions',
    examples: [
      { name: 'Moisture & Curing', description: 'Concrete cure times by temp/humidity, wood acclimation requirements, adhesive open times' },
      { name: 'Thermal Expansion', description: 'Material movement calculations, expansion joint spacing, seasonal gap requirements' },
      { name: 'Load & Bearing', description: 'Structural capacity awareness, temporary shoring requirements, point load distribution' },
      { name: 'Chemical Compatibility', description: 'Material adjacency rules — galvanic corrosion, incompatible sealants, adhesive chemistry' },
    ],
  },
  {
    id: 'installation-sequences',
    name: 'Installation Sequences',
    icon: Layers,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    domainCount: 10,
    description: 'Correct order of operations for every trade and system',
    examples: [
      { name: 'Rough-In Sequencing', description: 'Plumbing top-out before electrical, HVAC trunk before branch lines, low-voltage after framing' },
      { name: 'Waterproofing Layers', description: 'Membrane before tile, flashing before siding, vapor barrier orientation by climate zone' },
      { name: 'Finish Sequences', description: 'Paint before flooring, trim after paint, fixtures after trim, punch after clean' },
      { name: 'Cure & Wait Times', description: 'Enforced delays: 28-day concrete cure, 48h grout cure, 72h sealant cure before traffic' },
    ],
  },
  {
    id: 'real-world-physics',
    name: 'Real-World Physics',
    icon: Scale,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    domainCount: 10,
    description: 'Physics that textbooks skip but superintendents know by experience',
    examples: [
      { name: 'Water Behavior', description: 'Water always wins — slope, drainage, capillary action, hydrostatic pressure awareness' },
      { name: 'Gravity & Settlement', description: 'Post-tension slab deflection, soil settlement, differential movement between materials' },
      { name: 'Temperature Effects', description: 'Cold weather concrete, hot weather pour modifications, material storage temperature limits' },
      { name: 'Wind & Weather', description: 'Crane wind limits, material staging for weather, temporary protection requirements' },
    ],
  },
  {
    id: 'problem-solving',
    name: 'Problem-Solving',
    icon: Lightbulb,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    domainCount: 10,
    description: 'Field-proven solutions to problems that happen on every job',
    examples: [
      { name: 'Common Defects', description: 'Crown molding gaps, tile lippage, drywall nail pops — causes and prevention' },
      { name: 'Rework Prevention', description: 'First-time quality protocols, pre-installation checklists, mock-up requirements' },
      { name: 'Warranty Traps', description: 'Manufacturer void conditions, improper installation signatures, documentation gaps' },
      { name: 'Substitution Analysis', description: 'Material alternatives when specs are unavailable — equal or better, never "close enough"' },
    ],
  },
  {
    id: 'trade-knowledge',
    name: 'Trade Knowledge',
    icon: Hammer,
    color: 'text-stone-600',
    bgColor: 'bg-stone-100',
    domainCount: 10,
    description: 'Trade-specific expertise across all construction disciplines',
    examples: [
      { name: 'Framing Intelligence', description: 'Stud spacing, header sizing, bearing wall identification, shear panel requirements' },
      { name: 'Electrical Awareness', description: 'Circuit load calculations, panel capacity, NEC code compliance, arc-fault requirements' },
      { name: 'Plumbing Systems', description: 'DWV slope requirements, fixture unit calculations, water heater sizing, backflow prevention' },
      { name: 'HVAC Integration', description: 'Duct sizing, return air requirements, equipment clearances, refrigerant line routing' },
    ],
  },
  {
    id: 'coordination',
    name: 'Coordination',
    icon: Target,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    domainCount: 10,
    description: 'Multi-trade orchestration and conflict prevention',
    examples: [
      { name: 'Trade Stacking', description: 'Who can work simultaneously, minimum clearances, zone-based scheduling' },
      { name: 'Inspection Sequencing', description: 'Required inspections before cover-up, call-ahead timing, inspector availability' },
      { name: 'Delivery Coordination', description: 'Staging areas, crane time allocation, material flow paths, just-in-time delivery' },
      { name: 'Subcontractor Handoffs', description: 'Clean workspace requirements, protection of finished work, responsibility transitions' },
    ],
  },
  {
    id: 'cost-intelligence',
    name: 'Cost Intelligence',
    icon: DollarSign,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    domainCount: 10,
    description: 'Real cost knowledge that drives better decisions',
    examples: [
      { name: 'Waste Factors', description: 'Material-specific waste percentages, cutting layout optimization, ordering accuracy' },
      { name: 'Labor Productivity', description: 'Trade-specific production rates, crew sizing, overtime impact on quality' },
      { name: 'Hidden Cost Triggers', description: 'Scope creep indicators, change order patterns, escalation clause awareness' },
      { name: 'Value Engineering', description: 'Cost-neutral upgrades, specification alternatives, long-term vs short-term cost analysis' },
    ],
  },
  {
    id: 'safety-compliance',
    name: 'Safety & Compliance',
    icon: HardHat,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    domainCount: 10,
    description: 'OSHA compliance and jobsite safety awareness in every recommendation',
    examples: [
      { name: 'Fall Protection', description: 'Leading edge protocol, guardrail requirements, personal fall arrest systems by height' },
      { name: 'Excavation Safety', description: 'Trench box requirements, soil classification, sloping angles, competent person duties' },
      { name: 'Electrical Safety', description: 'Lockout/tagout, GFCI requirements, temporary power standards, arc flash boundaries' },
      { name: 'Code Compliance', description: 'IRC/IBC awareness, local amendments, energy code requirements, accessibility standards' },
    ],
  },
]

const flagTypes: FlagType[] = [
  {
    emoji: '\u{1F534}',
    name: 'Safety Block',
    description: 'Cannot proceed — safety risk identified',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    example: 'Trench exceeds 5\' without shoring. Work must stop until trench box is installed.',
  },
  {
    emoji: '\u{1F7E0}',
    name: 'Strong Recommendation',
    description: 'Override requires documented reason',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    example: 'Concrete pour temperature below 40\u00b0F. Recommend hot water mix and blanket cure protocol.',
  },
  {
    emoji: '\u{1F7E1}',
    name: 'Suggestion',
    description: 'One-click dismiss',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    example: 'Consider scheduling tile delivery after drywall mud is dry to avoid dust contamination.',
  },
  {
    emoji: '\u{1F535}',
    name: 'Learning Nudge',
    description: 'Based on your historical data',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    example: 'Your last 3 projects had cabinet delays. Order 2 weeks earlier than your current schedule shows.',
  },
  {
    emoji: '\u26AA',
    name: 'Informational',
    description: 'Shown on hover — background context',
    color: 'text-stone-700',
    bgColor: 'bg-stone-50',
    borderColor: 'border-stone-200',
    example: 'This vendor\'s average lead time is 14 days. Current order was placed 10 days ago.',
  },
]

// ── Component ─────────────────────────────────────────────────────────

export function TradeIntuitionPreview(): React.ReactElement {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set(['material-science'])
  )

  const toggleDomain = (id: string): void => {
    setExpandedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Dark Gradient Header ──────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Brain className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Trade Intuition AI</h1>
              <p className="text-sm text-slate-400">
                The construction superintendent&apos;s brain — 30 years of trade knowledge embedded in every AI decision
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-400">80</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Knowledge Domains</div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">8</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Categories</div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-400">7</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Validation Layers</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {knowledgeDomains.map((domain) => (
          <div
            key={domain.id}
            className="flex items-center gap-2 bg-white rounded-lg border border-warm-200 p-3"
          >
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', domain.bgColor)}>
              <domain.icon className={cn('h-4 w-4', domain.color)} />
            </div>
            <div>
              <div className="text-lg font-bold text-warm-900">{domain.domainCount}</div>
              <div className="text-[10px] text-warm-500">{domain.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 7-Layer Thinking Engine ───────────────────────────── */}
      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Layers className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-warm-900">7-Layer Thinking Engine</div>
              <div className="text-xs text-warm-500">
                Every AI recommendation passes through all 7 validation layers before surfacing
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Example scenario context */}
          <div className="bg-warm-50 rounded-lg p-3 border border-warm-100">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-3.5 w-3.5 text-warm-500" />
              <span className="text-xs font-medium text-warm-700">Live Example: Framing Start Decision</span>
            </div>
            <p className="text-xs text-warm-500">
              Evaluating whether to begin second-floor framing on the Henderson Residence (Job #2026-018)
            </p>
          </div>

          {/* Validation layer cards */}
          {validationLayers.map((layer) => (
            <div
              key={layer.number}
              className={cn(
                'rounded-lg border overflow-hidden',
                layer.borderColor,
              )}
            >
              <div className={cn('px-4 py-3 flex items-center gap-3', layer.bgColor)}>
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold',
                  layer.iconBg,
                  layer.color,
                )}>
                  {layer.number}
                </div>
                <div className="flex-1">
                  <div className={cn('text-sm font-semibold', layer.color)}>{layer.name}</div>
                  <div className="text-xs text-warm-500 italic">&ldquo;{layer.question}&rdquo;</div>
                </div>
                <layer.icon className={cn('h-4 w-4', layer.color)} />
              </div>
              <div className="bg-white px-4 py-2 space-y-1.5">
                {layer.checks.map((check, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    {check.status === 'pass' && (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    )}
                    {check.status === 'warn' && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    {check.status === 'pending' && (
                      <CircleDot className="h-3.5 w-3.5 text-stone-400 mt-0.5 shrink-0" />
                    )}
                    <span className={cn(
                      'text-warm-700',
                      check.status === 'warn' && 'text-amber-700 font-medium',
                      check.status === 'pending' && 'text-stone-500',
                    )}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Summary bar */}
          <div className="flex items-center gap-3 bg-green-50 rounded-lg border border-green-200 p-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-green-800">
                Recommendation: Proceed with 1 condition
              </div>
              <div className="text-xs text-green-600">
                6 of 7 layers clear. Wait for plumber to complete Zone B ceiling work (~2 hours) before starting framing in that zone.
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-green-700">94%</div>
              <div className="text-[10px] text-green-600">Confidence</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Knowledge Domain Cards ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-stone-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-warm-900">Knowledge Domains</div>
              <div className="text-xs text-warm-500">
                80 specialized knowledge areas organized into 8 categories
              </div>
            </div>
          </div>
        </div>

        <div className="divide-y divide-warm-100">
          {knowledgeDomains.map((domain) => {
            const isExpanded = expandedDomains.has(domain.id)
            return (
              <div key={domain.id}>
                <button
                  onClick={() => toggleDomain(domain.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-warm-50 transition-colors"
                >
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', domain.bgColor)}>
                    <domain.icon className={cn('h-4 w-4', domain.color)} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-warm-900">{domain.name}</div>
                    <div className="text-xs text-warm-500">{domain.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded',
                      domain.bgColor,
                      domain.color,
                    )}>
                      {domain.domainCount} domains
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-warm-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-warm-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3">
                    <div className="grid grid-cols-2 gap-2 pl-11">
                      {domain.examples.map((example, idx) => (
                        <div
                          key={idx}
                          className="bg-warm-50 rounded-lg p-3 border border-warm-100"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className={cn('h-3 w-3', domain.color)} />
                            <span className="text-xs font-semibold text-warm-800">{example.name}</span>
                          </div>
                          <p className="text-[11px] text-warm-600 leading-relaxed">
                            {example.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Confidence & Override System ──────────────────────── */}
      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Gauge className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-warm-900">Confidence & Override System</div>
              <div className="text-xs text-warm-500">
                5 flag levels from safety blocks to informational nudges — every AI output is categorized
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {flagTypes.map((flag, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-lg border p-4',
                flag.bgColor,
                flag.borderColor,
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{flag.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-sm font-bold', flag.color)}>{flag.name}</span>
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded font-medium',
                      flag.color,
                      flag.bgColor,
                      'border',
                      flag.borderColor,
                    )}>
                      {flag.description}
                    </span>
                  </div>
                  <div className="bg-white/60 rounded p-2 mt-2">
                    <div className="flex items-start gap-2">
                      <Eye className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', flag.color)} />
                      <p className="text-xs text-warm-700 leading-relaxed">
                        <span className="font-medium">Example:</span> {flag.example}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Insights Bar ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 rounded-xl border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-200/50 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-amber-800 mb-1">
              Trade Intuition is Always Running
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              Every schedule change, material delivery, invoice, daily log, and weather forecast is continuously
              evaluated against the 7-layer thinking engine. Trade Intuition doesn&apos;t wait for you to ask —
              it surfaces warnings, suggestions, and opportunities in real time across every module.
              The system learns from your decisions: when you override a suggestion, it remembers why
              and adjusts future recommendations for your company&apos;s specific workflow.
            </p>
          </div>
        </div>
      </div>

      {/* ── How It Works — Live Example ──────────────────────── */}
      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Award className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-warm-900">How It Works — Every Module, Every Decision</div>
              <div className="text-xs text-warm-500">
                Trade Intuition enhances decisions across the entire platform
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                module: 'Scheduling',
                icon: Wrench,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                borderColor: 'border-blue-100',
                insight: 'Detects that drywall is scheduled before plumbing inspection. Auto-flags the conflict and suggests resequencing.',
              },
              {
                module: 'Invoices',
                icon: DollarSign,
                color: 'text-green-600',
                bg: 'bg-green-50',
                borderColor: 'border-green-100',
                insight: 'Invoice shows 50 LF of crown molding for a 12x14 room. AI knows the perimeter is 52 LF — waste factor is suspiciously low.',
              },
              {
                module: 'Daily Logs',
                icon: ClipboardCheck,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                borderColor: 'border-amber-100',
                insight: 'Log mentions "poured foundation" but no inspection record exists. Flags for verification before concrete work continues.',
              },
              {
                module: 'Change Orders',
                icon: GitBranch,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                borderColor: 'border-purple-100',
                insight: 'Client requests larger windows. AI calculates header size increase, structural engineering review, and cascading cost impacts.',
              },
              {
                module: 'Vendor Management',
                icon: Truck,
                color: 'text-orange-600',
                bg: 'bg-orange-50',
                borderColor: 'border-orange-100',
                insight: 'Vendor quoted 3-week lead time but their historical average is 5 weeks. Recommends ordering now with buffer.',
              },
              {
                module: 'Selections',
                icon: Ruler,
                color: 'text-teal-600',
                bg: 'bg-teal-50',
                borderColor: 'border-teal-100',
                insight: 'Client selected porcelain tile for a wood-framed shower. AI recommends membrane upgrade and deflection check.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className={cn('rounded-lg border p-3', item.bg, item.borderColor)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={cn('h-4 w-4', item.color)} />
                  <span className="text-xs font-semibold text-warm-800">{item.module}</span>
                </div>
                <p className="text-[11px] text-warm-600 leading-relaxed">
                  {item.insight}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Features Panel ────────────────────────────────── */}
      <AIFeaturesPanel
        features={[
          {
            feature: 'Self-Learning Trade Knowledge',
            insight: 'Trade Intuition learns from every decision on your projects. When you override a suggestion, it records the context and adjusts future recommendations. After 50 projects, the AI knows YOUR way of building.',
          },
          {
            feature: 'Cross-Module Intelligence',
            insight: 'Unlike siloed tools, Trade Intuition connects scheduling, budgets, vendor history, weather, and material science into a single decision engine. A material substitution in purchasing automatically re-evaluates warranty, cost, and installation sequence impacts.',
          },
          {
            feature: 'Confidence Calibration',
            insight: 'Every AI recommendation includes a confidence score and the specific knowledge domains that informed it. Low confidence flags are clearly marked so you always know when the AI is guessing vs. when it has strong data backing.',
          },
        ]}
      />
    </div>
  )
}
