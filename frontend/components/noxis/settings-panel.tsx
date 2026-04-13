"use client"

import { useState, useEffect } from "react"
import { X, Sun, Moon, Trash2, Check, Zap, Palette, Bot, Cpu, Info, Activity } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type UIMode,
  getStoredUIMode,
  setStoredUIMode,
  detectDeviceCapability,
  UI_MODE_LABELS,
} from "@/lib/ui-mode"
import { getAdaptiveEnabled, setAdaptiveEnabled } from "@/lib/performance-monitor"
import { switchUIMode } from "./ui-mode-loader"

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  onClearHistory: () => void
}

const UI_MODE_ICONS = {
  auto: Bot,
  lite: Zap,
  full: Palette,
} as const

export function SettingsPanel({
  isOpen,
  onClose,
  onClearHistory,
}: SettingsPanelProps) {
  const { theme, setTheme } = useTheme()
  const [uiMode, setUiMode] = useState<UIMode>("auto")
  const [deviceInfo, setDeviceInfo] = useState<string>("")
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [adaptiveEnabled, setAdaptiveEnabledState] = useState(true)

  useEffect(() => {
    setUiMode(getStoredUIMode())
    setAdaptiveEnabledState(getAdaptiveEnabled())
    const capability = detectDeviceCapability()
    const info = []
    if (capability.memory) info.push(`${capability.memory}GB RAM`)
    if (capability.cores) info.push(`${capability.cores} cores`)
    if (capability.connectionType) info.push(capability.connectionType)
    setDeviceInfo(info.join(" • ") || "Device info unavailable")
  }, [])

  const handleUIMode = (mode: UIMode) => {
    setUiMode(mode)
    setStoredUIMode(mode)
    
    // Close settings panel first, then trigger smooth transition
    onClose()
    setTimeout(() => {
      switchUIMode(mode)
    }, 150)
  }

  const handleAdaptiveToggle = () => {
    const newValue = !adaptiveEnabled
    setAdaptiveEnabledState(newValue)
    setAdaptiveEnabled(newValue)
  }

  const handleClearMemory = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true)
      setTimeout(() => setShowClearConfirm(false), 3000)
      return
    }
    
    try {
      await fetch("/api/memory", { method: "DELETE" })
      onClearHistory()
    } catch (error) {
      console.error("Failed to clear memory:", error)
      onClearHistory()
    }
    setShowClearConfirm(false)
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Panel - Full width on mobile, fixed width on desktop */}
      <aside
        className={cn(
          "fixed top-0 h-full bg-card border-l border-border z-50",
          "flex flex-col transition-transform duration-300 ease-out",
          "w-full sm:w-80 right-0",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border safe-area-top">
          <h2 className="font-semibold text-card-foreground">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto noxis-scrollbar p-4 space-y-6">
          {/* UI Mode Selection */}
          <section className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-sm font-medium text-card-foreground mb-2">
              UI Mode
            </h3>
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              {deviceInfo}
            </p>
            <div className="space-y-2">
              {(Object.keys(UI_MODE_LABELS) as UIMode[]).map((modeKey, index) => {
                const mode = UI_MODE_LABELS[modeKey]
                const isSelected = uiMode === modeKey
                const Icon = UI_MODE_ICONS[modeKey]

                return (
                  <button
                    key={modeKey}
                    onClick={() => handleUIMode(modeKey)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 text-left",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      "animate-in fade-in slide-in-from-right-4",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200",
                        isSelected
                          ? "border-primary bg-primary scale-110"
                          : "border-muted-foreground"
                      )}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "font-medium flex items-center gap-2",
                          isSelected ? "text-primary" : "text-card-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {mode.label}
                        {modeKey === "auto" && (
                          <span className="text-xs text-muted-foreground">(Recommended)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mode.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Adaptive Intelligence */}
          <section className="animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: "100ms" }}>
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              Adaptive Intelligence
            </h3>
            <button
              onClick={handleAdaptiveToggle}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200",
                "hover:scale-[1.01] active:scale-[0.99]",
                adaptiveEnabled
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  adaptiveEnabled ? "bg-primary/10" : "bg-muted"
                )}>
                  <Activity className={cn(
                    "w-4 h-4",
                    adaptiveEnabled ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Auto-optimize</p>
                  <p className="text-xs text-muted-foreground">
                    Monitor performance & suggest Lite mode
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "w-10 h-6 rounded-full p-1 transition-colors duration-200",
                  adaptiveEnabled ? "bg-primary" : "bg-muted"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    adaptiveEnabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </div>
            </button>
          </section>

          {/* Theme Toggle */}
          <section className="animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: "150ms" }}>
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              Appearance
            </h3>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 gap-2 transition-all duration-200 hover:scale-105 active:scale-95",
                  theme === "light" && "shadow-md"
                )}
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 gap-2 transition-all duration-200 hover:scale-105 active:scale-95",
                  theme === "dark" && "shadow-md"
                )}
              >
                <Moon className="w-4 h-4" />
                Dark
              </Button>
            </div>
          </section>

          {/* Clear History */}
          <section className="animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: "200ms" }}>
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              Data
            </h3>
            <Button
              variant={showClearConfirm ? "destructive" : "outline"}
              onClick={handleClearMemory}
              className={cn(
                "w-full gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                !showClearConfirm && "border-destructive/30 text-destructive hover:bg-destructive/10"
              )}
            >
              <Trash2 className="w-4 h-4" />
              {showClearConfirm ? "Tap again to confirm" : "Clear All History"}
            </Button>
          </section>

          {/* About */}
          <section className="animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: "250ms" }}>
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              About
            </h3>
            <div className="p-3 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Noxis AI</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your intelligent AI assistant. Built for speed, privacy, and seamless conversations.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border safe-area-bottom">
          <p className="text-xs text-muted-foreground text-center">
            Noxis AI v1.0.0 (Full)
          </p>
        </div>
      </aside>
    </>
  )
}
