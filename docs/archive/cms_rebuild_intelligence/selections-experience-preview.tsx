'use client'

import {
  Palette,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle,
  Home,
  Star,
  Heart,
  Eye,
  Smartphone,
  Users,
  Layers,
  ShieldCheck,
  Truck,
  DollarSign,
  Tag,
  ImageIcon,
  Grip,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIFeaturesPanel } from '@/components/skeleton/ui'

// ── Room Progress Data ──────────────────────────────────────────

interface RoomProgress {
  name: string
  completed: number
  total: number
  highlights: string[]
}

const mockRoomProgress: RoomProgress[] = [
  { name: 'Kitchen', completed: 8, total: 9, highlights: ['Countertops', 'Cabinets', 'Sink', 'Faucet', 'Backsplash', 'Hardware', 'Lighting', 'Appliances'] },
  { name: 'Master Bath', completed: 10, total: 10, highlights: ['Tub', 'Shower Tile', 'Vanity', 'Faucets', 'Mirror', 'Lighting', 'Hardware', 'Flooring', 'Paint', 'Accessories'] },
  { name: 'Guest Bath', completed: 4, total: 10, highlights: ['Vanity', 'Faucet', 'Mirror', 'Lighting'] },
  { name: 'Living Room', completed: 3, total: 5, highlights: ['Flooring', 'Paint', 'Fireplace Surround'] },
  { name: 'Exterior', completed: 1, total: 5, highlights: ['Front Door'] },
]

// ── Vibe Board Data ─────────────────────────────────────────────

interface VibeBoard {
  name: string
  tags: string[]
  imageLabels: string[]
  saves: number
}

const mockVibeBoard: VibeBoard = {
  name: 'Coastal Modern Inspiration',
  tags: ['Warm Neutrals', 'Natural Wood', 'Brass Accents', 'White Marble', 'Soft Textures'],
  imageLabels: ['Marble Counter', 'Oak Flooring', 'Brass Hardware', 'Linen Drapes', 'Statement Light', 'Accent Tile'],
  saves: 24,
}

// ── Selection Tier Data ─────────────────────────────────────────

interface TierOption {
  label: string
  pricePerSF: number
  name: string
  highlight?: boolean
}

const mockTierOptions: TierOption[] = [
  { label: 'Good', pricePerSF: 12, name: 'Porcelain 12x24 Matte' },
  { label: 'Better', pricePerSF: 18, name: 'Natural Stone Honed', highlight: true },
  { label: 'Best', pricePerSF: 24, name: 'Calacatta Marble Polished' },
]

// ── Couple Mode Data ────────────────────────────────────────────

interface CoupleRating {
  item: string
  partnerA: { name: string; rating: number }
  partnerB: { name: string; rating: number }
  match: boolean
  matchMessage: string | null
}

const mockCoupleRatings: CoupleRating[] = [
  {
    item: 'Calacatta Marble Countertop',
    partnerA: { name: 'Sarah', rating: 5 },
    partnerB: { name: 'Mike', rating: 5 },
    match: true,
    matchMessage: "You both gave 5 stars! That's your pick!",
  },
  {
    item: 'Brass Pendant Light (Kitchen)',
    partnerA: { name: 'Sarah', rating: 4 },
    partnerB: { name: 'Mike', rating: 3 },
    match: false,
    matchMessage: null,
  },
  {
    item: 'Herringbone Backsplash',
    partnerA: { name: 'Sarah', rating: 5 },
    partnerB: { name: 'Mike', rating: 4 },
    match: false,
    matchMessage: null,
  },
]

// ── Stars Renderer ──────────────────────────────────────────────

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }): React.ReactElement {
  const starSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            starSize,
            i <= rating ? 'text-amber-400 fill-amber-400' : 'text-warm-200'
          )}
        />
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────

export function SelectionsExperiencePreview(): React.ReactElement {
  return (
    <div className="bg-warm-50 rounded-lg border border-warm-200 overflow-hidden">
      {/* ── Dark Header ─────────────────────────────────── */}
      <div className="bg-warm-900 px-6 py-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Palette className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Selections Experience</h3>
            <p className="text-sm text-warm-400">
              Making material selection fun — vibe boards, AR previews, couple mode, and AI matching
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats Cards (5 columns) ─────────────────────── */}
      <div className="bg-white border-b border-warm-200 px-4 py-4">
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-warm-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-warm-500 text-sm">
              <Layers className="h-4 w-4" />
              Active Selections
            </div>
            <div className="text-2xl font-bold text-warm-900 mt-1">34</div>
          </div>
          <div className="bg-warm-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-warm-500 text-sm">
              <Home className="h-4 w-4" />
              Rooms
            </div>
            <div className="text-2xl font-bold text-warm-900 mt-1">12</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <ImageIcon className="h-4 w-4" />
              Vibe Boards
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">6</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Completed
            </div>
            <div className="text-2xl font-bold text-green-700 mt-1">78%</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <Clock className="h-4 w-4" />
              Lead Time Alerts
            </div>
            <div className="text-2xl font-bold text-red-700 mt-1">3</div>
          </div>
        </div>
      </div>

      {/* ── Selection Progress by Room ───────────────────── */}
      <div className="bg-white border-b border-warm-200 px-6 py-5">
        <h4 className="font-semibold text-warm-900 mb-4 flex items-center gap-2">
          <Home className="h-4 w-4 text-warm-500" />
          Selection Progress by Room
        </h4>
        <div className="space-y-4">
          {mockRoomProgress.map(room => {
            const pct = Math.round((room.completed / room.total) * 100)
            const isComplete = pct === 100
            return (
              <div key={room.name} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-warm-900 text-sm">{room.name}</span>
                    {isComplete && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        All Done
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    isComplete ? "text-green-600" : pct >= 75 ? "text-warm-700" : pct >= 50 ? "text-amber-600" : "text-warm-500"
                  )}>
                    {room.completed} of {room.total} ({pct}%)
                  </span>
                </div>
                <div className="h-3 bg-warm-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isComplete
                        ? "bg-gradient-to-r from-green-400 to-emerald-500"
                        : pct >= 75
                          ? "bg-gradient-to-r from-stone-400 to-stone-500"
                          : pct >= 50
                            ? "bg-gradient-to-r from-amber-300 to-amber-400"
                            : "bg-gradient-to-r from-warm-300 to-warm-400"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {room.highlights.slice(0, 6).map((h, i) => (
                    <span
                      key={h}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        i < room.completed
                          ? "bg-green-50 text-green-700"
                          : "bg-warm-100 text-warm-400"
                      )}
                    >
                      {h}
                    </span>
                  ))}
                  {room.highlights.length > 6 && (
                    <span className="text-xs text-warm-400">+{room.highlights.length - 6} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Vibe Board Preview ───────────────────────────── */}
      <div className="bg-white border-b border-warm-200 px-6 py-5">
        <h4 className="font-semibold text-warm-900 mb-4 flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-400" />
          Vibe Board
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-normal ml-1">
            {mockVibeBoard.saves} saves
          </span>
        </h4>
        <div className="bg-warm-50 rounded-xl border border-warm-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium text-warm-800">{mockVibeBoard.name}</h5>
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-rose-400 fill-rose-400" />
              <span className="text-xs text-warm-500">{mockVibeBoard.saves}</span>
            </div>
          </div>

          {/* Mood Board Grid */}
          <div className="grid grid-cols-3 grid-rows-2 gap-2 mb-3">
            {mockVibeBoard.imageLabels.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "rounded-lg flex items-center justify-center text-center p-3 border border-warm-200 relative overflow-hidden",
                  i === 0 ? "row-span-2 bg-gradient-to-br from-stone-100 to-warm-200" :
                  i === 1 ? "bg-gradient-to-br from-amber-50 to-amber-100" :
                  i === 2 ? "bg-gradient-to-br from-warm-100 to-stone-100" :
                  i === 3 ? "bg-gradient-to-br from-stone-50 to-stone-100" :
                  i === 4 ? "bg-gradient-to-br from-amber-50 to-warm-100" :
                  "bg-gradient-to-br from-warm-100 to-warm-200"
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <ImageIcon className={cn(
                    "text-warm-300",
                    i === 0 ? "h-8 w-8" : "h-5 w-5"
                  )} />
                  <span className={cn(
                    "font-medium text-warm-500",
                    i === 0 ? "text-sm" : "text-xs"
                  )}>
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Style Tags */}
          <div className="flex flex-wrap gap-2">
            {mockVibeBoard.tags.map(tag => (
              <span
                key={tag}
                className="text-xs bg-white border border-warm-200 text-warm-600 px-2.5 py-1 rounded-full flex items-center gap-1"
              >
                <Tag className="h-3 w-3 text-warm-400" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Selection Card Preview (Good / Better / Best) ── */}
      <div className="bg-white border-b border-warm-200 px-6 py-5">
        <h4 className="font-semibold text-warm-900 mb-4 flex items-center gap-2">
          <Grip className="h-4 w-4 text-warm-500" />
          Selection Card Preview
          <span className="text-xs text-warm-400 font-normal">Master Bath Floor Tile</span>
        </h4>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {mockTierOptions.map(tier => (
            <div
              key={tier.label}
              className={cn(
                "rounded-xl border-2 p-4 transition-all cursor-pointer",
                tier.highlight
                  ? "border-amber-400 bg-amber-50/50 shadow-md ring-2 ring-amber-200"
                  : "border-warm-200 bg-white hover:border-warm-300 hover:shadow-sm"
              )}
            >
              {/* Tier Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded",
                  tier.label === 'Good' ? "bg-warm-100 text-warm-600" :
                  tier.label === 'Better' ? "bg-amber-100 text-amber-700" :
                  "bg-stone-100 text-stone-700"
                )}>
                  {tier.label}
                </span>
                {tier.highlight && (
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-medium">
                    Popular
                  </span>
                )}
              </div>

              {/* Image Placeholder */}
              <div className={cn(
                "h-28 rounded-lg mb-3 flex items-center justify-center border",
                tier.highlight
                  ? "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200"
                  : "bg-warm-50 border-warm-200"
              )}>
                <ImageIcon className="h-8 w-8 text-warm-300" />
              </div>

              {/* Product Name & Price */}
              <p className="text-sm font-medium text-warm-800 mb-1">{tier.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-warm-900">${tier.pricePerSF}</span>
                <span className="text-sm text-warm-500">/SF</span>
              </div>
            </div>
          ))}
        </div>

        {/* Budget Impact Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <span className="text-sm font-medium text-amber-800">Budget Impact: </span>
            <span className="text-sm text-amber-700">+$840 over allowance if &quot;Best&quot; is selected (120 SF x $4 overage)</span>
          </div>
        </div>

        {/* Lead Time & Compatibility Badges */}
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-flex items-center gap-1.5 text-xs bg-stone-100 text-stone-700 px-2.5 py-1 rounded font-medium">
            <Truck className="h-3.5 w-3.5" />
            Lead Time: 3-4 weeks
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compatible with selected grout and underlayment
          </span>
        </div>
      </div>

      {/* ── Couple Decision Mode ─────────────────────────── */}
      <div className="bg-white border-b border-warm-200 px-6 py-5">
        <h4 className="font-semibold text-warm-900 mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-rose-400" />
          Couple Decision Mode
          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-normal ml-1">
            Beta
          </span>
        </h4>

        <div className="space-y-3">
          {mockCoupleRatings.map(rating => (
            <div
              key={rating.item}
              className={cn(
                "rounded-xl border p-4",
                rating.match
                  ? "border-green-300 bg-green-50/50"
                  : "border-warm-200 bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-warm-800">{rating.item}</span>
                {rating.match && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Match
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Partner A */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-sm font-bold text-rose-600">
                    {rating.partnerA.name[0]}
                  </div>
                  <div>
                    <span className="text-sm text-warm-700 font-medium">{rating.partnerA.name}</span>
                    <StarRating rating={rating.partnerA.rating} />
                  </div>
                </div>
                {/* Partner B */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center text-sm font-bold text-stone-600">
                    {rating.partnerB.name[0]}
                  </div>
                  <div>
                    <span className="text-sm text-warm-700 font-medium">{rating.partnerB.name}</span>
                    <StarRating rating={rating.partnerB.rating} />
                  </div>
                </div>
              </div>
              {rating.match && rating.matchMessage && (
                <div className="mt-3 bg-green-100 rounded-lg px-4 py-2.5 text-center">
                  <span className="text-sm font-medium text-green-800">
                    {rating.matchMessage} {'\uD83C\uDF89'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Insights Bar ──────────────────────────────── */}
      <div className="bg-warm-50 border-t border-amber-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm text-amber-800">AI Stylist:</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-amber-700">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              Your vibe board matches 92% of &quot;Coastal Modern&quot; style
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              3 selections have long lead times -- order soon
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Current picks are $2,100 over total allowance
            </span>
          </div>
        </div>
      </div>

      {/* ── AI Features Panel ────────────────────────────── */}
      <div className="bg-white border-t border-warm-200 px-4 py-4">
        <AIFeaturesPanel
          title="AI Selection Experience Features"
          columns={2}
          features={[
            {
              feature: 'Style Matching',
              trigger: 'On board creation',
              insight: 'Analyzes your vibe board and suggests products that match your aesthetic from the catalog. Current board: 92% Coastal Modern confidence.',
              detail: 'Cross-references color palette, material textures, and design era across 6 saved inspiration images to generate style profile.',
              severity: 'success' as const,
              confidence: 92,
            },
            {
              feature: 'AR Room Preview',
              trigger: 'On selection',
              insight: 'Generates augmented reality preview of selected materials in your actual rooms using uploaded photos.',
              detail: 'Supports flooring, countertops, backsplash, paint colors, and cabinet finishes. Requires 3+ room photos for accurate rendering.',
              severity: 'info' as const,
              confidence: 88,
              action: {
                label: 'Try AR Preview',
                onClick: () => {},
              },
            },
            {
              feature: 'Couple Compatibility',
              trigger: 'After both rate',
              insight: 'Sarah and Mike agree on 8 of 12 rated selections (67% match rate). Biggest disagreement: Kitchen Pendant Light.',
              detail: 'AI suggests compromise options for disagreements and highlights strong matches to speed up decisions.',
              severity: 'info' as const,
              confidence: 100,
            },
            {
              feature: 'Lead Time Optimizer',
              trigger: 'Real-time',
              insight: 'Current selections require ordering by Feb 28 for on-schedule install. 3 items flagged with extended lead times.',
              severity: 'warning' as const,
              confidence: 95,
              action: {
                label: 'View Timeline',
                onClick: () => {},
              },
            },
            {
              feature: 'Budget Guard',
              trigger: 'On selection change',
              insight: 'Tracks running total vs allowance in real time. Suggests Good/Better alternatives when Best tier pushes over budget.',
              severity: 'warning' as const,
              confidence: 97,
            },
            {
              feature: 'Design Compatibility Check',
              trigger: 'On selection',
              insight: 'Validates that selected materials work together: color harmony, material durability pairing, and style consistency.',
              detail: 'Flagged: Matte black faucet may clash with brass hardware selections in Master Bath. Consider brushed brass faucet alternative.',
              severity: 'critical' as const,
              confidence: 85,
            },
          ]}
        />
      </div>
    </div>
  )
}
