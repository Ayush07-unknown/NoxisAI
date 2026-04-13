"use client"

import { useEffect, useState, useCallback } from "react"
import { Brain } from "lucide-react"
import { resolveUIMode, getStoredUIMode, type UIMode } from "@/lib/ui-mode"
import { LiteUI } from "./lite-ui"

interface UIModeLoaderProps {
  children: React.ReactNode
}

type TransitionState = "idle" | "fading-out" | "switching" | "fading-in"

export function UIModeLoader({ children }: UIModeLoaderProps) {
  const [currentMode, setCurrentMode] = useState<UIMode | null>(null)
  const [resolvedMode, setResolvedMode] = useState<"lite" | "full" | null>(null)
  const [transitionState, setTransitionState] = useState<TransitionState>("idle")
  const [isInitialized, setIsInitialized] = useState(false)

  // Initial mode detection
  useEffect(() => {
    const mode = getStoredUIMode()
    const resolved = resolveUIMode()
    setCurrentMode(mode)
    setResolvedMode(mode === "auto" ? resolved : mode === "lite" ? "lite" : "full")
    
    // Small delay to ensure smooth initial render
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Listen for mode changes from settings panel
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "noxis-ui-mode" && e.newValue) {
        const newMode = e.newValue as UIMode
        handleModeSwitch(newMode)
      }
    }

    // Custom event for same-tab mode changes
    const handleModeChange = (e: CustomEvent<{ mode: UIMode }>) => {
      handleModeSwitch(e.detail.mode)
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("noxis-mode-change" as never, handleModeChange as EventListener)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("noxis-mode-change" as never, handleModeChange as EventListener)
    }
  }, [])

  const handleModeSwitch = useCallback((newMode: UIMode) => {
    const newResolved = newMode === "auto" ? resolveUIMode() : newMode === "lite" ? "lite" : "full"
    
    if (newResolved === resolvedMode) return

    // Start transition
    setTransitionState("fading-out")
    
    setTimeout(() => {
      setTransitionState("switching")
      setCurrentMode(newMode)
      setResolvedMode(newResolved)
      
      setTimeout(() => {
        setTransitionState("fading-in")
        
        setTimeout(() => {
          setTransitionState("idle")
        }, 300)
      }, 50)
    }, 300)
  }, [resolvedMode])

  // Expose mode switch function globally for settings panel
  useEffect(() => {
    (window as unknown as { __noxisSwitchMode?: (mode: UIMode) => void }).__noxisSwitchMode = handleModeSwitch
    return () => {
      delete (window as unknown as { __noxisSwitchMode?: (mode: UIMode) => void }).__noxisSwitchMode
    }
  }, [handleModeSwitch])

  // Loading state
  if (!isInitialized || resolvedMode === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">Noxis AI</span>
          </div>
        </div>
      </div>
    )
  }

  const getTransitionClasses = () => {
    switch (transitionState) {
      case "fading-out":
        return "opacity-0 scale-[0.98] blur-sm"
      case "switching":
        return "opacity-0 scale-[0.98] blur-sm"
      case "fading-in":
        return "opacity-100 scale-100 blur-0"
      default:
        return "opacity-100 scale-100 blur-0"
    }
  }

  return (
    <>
      {/* Transition overlay */}
      {transitionState !== "idle" && (
        <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">
              Switching to {resolvedMode === "lite" ? "Lite" : "Full"} UI...
            </span>
          </div>
        </div>
      )}

      {/* Main content with transition */}
      <div
        className={`transition-all duration-300 ease-out ${getTransitionClasses()}`}
        style={{ transformOrigin: "center center" }}
      >
        {resolvedMode === "lite" ? <LiteUI /> : children}
      </div>
    </>
  )
}

// Helper to trigger mode switch from anywhere
export function switchUIMode(mode: UIMode) {
  const switchFn = (window as unknown as { __noxisSwitchMode?: (mode: UIMode) => void }).__noxisSwitchMode
  if (switchFn) {
    switchFn(mode)
  }
}
