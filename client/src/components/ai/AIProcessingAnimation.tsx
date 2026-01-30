/**
 * AI Processing Animation Component
 *
 * A visually engaging animation that shows AI is working on document processing.
 * Features concentric pulsing circles, floating sparkles, and step indicators.
 */

import { useEffect, useState } from 'react';
import { Sparkles, CheckCircle, Loader2, Brain, Scan, FileSearch, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'complete';
}

interface AIProcessingAnimationProps {
  /** Current status message */
  statusMessage?: string;
  /** Document type being processed */
  documentType?: string;
  /** Current step (0-based index) */
  currentStep?: number;
  /** Whether classification is complete */
  classificationComplete?: boolean;
  /** Whether processing is complete */
  processingComplete?: boolean;
}

export function AIProcessingAnimation({
  statusMessage = 'Analyzing document...',
  documentType,
  currentStep = 0,
  classificationComplete = false,
  processingComplete = false,
}: AIProcessingAnimationProps) {
  const [sparklePositions, setSparklePositions] = useState<Array<{ x: number; y: number; delay: number }>>([]);

  // Generate random sparkle positions on mount
  useEffect(() => {
    const positions = Array.from({ length: 8 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setSparklePositions(positions);
  }, []);

  const steps: ProcessingStep[] = [
    { id: 'scan', label: 'Scanning document', icon: <Scan className="h-4 w-4" />, status: 'pending' },
    { id: 'classify', label: 'Classifying type', icon: <Brain className="h-4 w-4" />, status: 'pending' },
    { id: 'extract', label: 'Extracting data', icon: <FileSearch className="h-4 w-4" />, status: 'pending' },
    { id: 'process', label: 'Processing', icon: <Wand2 className="h-4 w-4" />, status: 'pending' },
  ].map((step, idx) => ({
    ...step,
    status: idx < currentStep ? 'complete' : idx === currentStep ? 'active' : 'pending',
  }));

  return (
    <div className="relative py-8 px-4">
      {/* Floating sparkles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {sparklePositions.map((pos, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              animationDelay: `${pos.delay}s`,
              animationDuration: '2s',
            }}
          >
            <Sparkles
              className={cn(
                "h-3 w-3 text-primary/30",
                i % 2 === 0 && "text-purple-400/30",
                i % 3 === 0 && "text-blue-400/30"
              )}
            />
          </div>
        ))}
      </div>

      {/* Main animation container */}
      <div className="relative flex flex-col items-center">
        {/* Concentric circles animation */}
        <div className="relative w-32 h-32 mb-6">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping"
               style={{ animationDuration: '2s' }} />

          {/* Middle rotating ring */}
          <div className="absolute inset-2 rounded-full border-2 border-dashed border-primary/40 animate-spin"
               style={{ animationDuration: '8s' }} />

          {/* Inner pulsing ring */}
          <div className="absolute inset-4 rounded-full border-2 border-primary/30 animate-pulse" />

          {/* Gradient glow background */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-primary/20 via-purple-500/20 to-blue-500/20 animate-pulse" />

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {processingComplete ? (
              <CheckCircle className="h-12 w-12 text-green-500 animate-bounce" />
            ) : (
              <div className="relative">
                <Brain className="h-12 w-12 text-primary animate-pulse" />
                <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-yellow-400 animate-bounce"
                          style={{ animationDelay: '0.5s' }} />
              </div>
            )}
          </div>

          {/* Orbiting dots */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '5s' }}>
            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
          </div>
        </div>

        {/* Status message */}
        <div className="text-center mb-6">
          <p className="text-lg font-medium text-foreground mb-1">
            {statusMessage}
          </p>
          {documentType && classificationComplete && (
            <p className="text-sm text-muted-foreground">
              Detected: <span className="font-medium text-primary">{documentType}</span>
            </p>
          )}
        </div>

        {/* Processing steps */}
        <div className="w-full max-w-xs space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-all duration-300",
                step.status === 'active' && "bg-primary/10 scale-105",
                step.status === 'complete' && "bg-green-50 dark:bg-green-900/10",
              )}
            >
              {/* Step icon */}
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                step.status === 'pending' && "bg-muted text-muted-foreground",
                step.status === 'active' && "bg-primary text-primary-foreground",
                step.status === 'complete' && "bg-green-500 text-white",
              )}>
                {step.status === 'complete' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : step.status === 'active' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  step.icon
                )}
              </div>

              {/* Step label */}
              <span className={cn(
                "text-sm transition-colors",
                step.status === 'pending' && "text-muted-foreground",
                step.status === 'active' && "text-foreground font-medium",
                step.status === 'complete' && "text-green-600 dark:text-green-400",
              )}>
                {step.label}
              </span>

              {/* Active indicator */}
              {step.status === 'active' && (
                <div className="ml-auto flex gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version of the animation for inline use
 */
export function AIProcessingIndicator({
  message = 'Processing...',
  size = 'default'
}: {
  message?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "relative",
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
      )}>
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-full border border-primary/40 animate-ping"
             style={{ animationDuration: '1.5s' }} />
        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className={cn(
            "text-primary animate-pulse",
            size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
          )} />
        </div>
      </div>
      <span className={cn(
        "text-muted-foreground",
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}>
        {message}
      </span>
    </div>
  );
}
