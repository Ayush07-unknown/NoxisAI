"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  performanceMonitor,
  type PerformanceState,
  STATUS_CONFIG,
  getAdaptiveEnabled,
} from "@/lib/performance-monitor"
import { setStoredUIMode } from "@/lib/ui-mode"
import { switchUIMode } from "./ui-mode-loader"

interface PerformanceIndicatorProps {
  showSuggestion?: boolean
}

export function PerformanceIndicator({ showSuggestion = true }: PerformanceIndicatorProps) {
  const [state, setState] = useState<PerformanceState>({
    status: "smooth",
    fps: 60,
    lagCount: 0,
    shouldSuggestLite: false,
  })
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(getAdaptiveEnabled())
    
    performanceMonitor.start((newState) => {
      setState(newState)
      
      // Show suggestion banner if device is struggling
      if (newState.shouldSuggestLite && !dismissed && showSuggestion) {
        setShowBanner(true)
      }
    })

    return () => performanceMonitor.stop()
  }, [dismissed, showSuggestion])

  const handleSwitchToLite = useCallback(() => {
    setStoredUIMode("lite")
    switchUIMode("lite")
    setShowBanner(false)
  }, [])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
    setDismissed(true)
    performanceMonitor.reset()
  }, [])

  if (!enabled) return null

  const config = STATUS_CONFIG[state.status]

  return (
    <>
      {/* Status indicator dot - shown in header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 cursor-default"
        title={`Performance: ${config.label} (${state.fps} FPS)`}
      >
        <div className={cn("w-2 h-2 rounded-full", config.bg)} />
        <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
          {state.fps} FPS
        </span>
      </div>

      {/* Suggestion banner */}
      {showBanner && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-card border border-border rounded-xl shadow-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">
                  Performance Notice
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your device seems under load. Switch to Lite Mode for better performance?
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleSwitchToLite}
                    className="h-8 text-xs gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    Switch to Lite
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="h-8 text-xs"
                  >
                    Ignore
                  </Button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
