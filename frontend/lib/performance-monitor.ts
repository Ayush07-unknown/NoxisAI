// Smart Adaptive Intelligence Layer - Performance Monitor
// Lightweight real-time performance monitoring system (< 2KB)

export type PerformanceStatus = "smooth" | "moderate" | "heavy"

export interface PerformanceState {
  status: PerformanceStatus
  fps: number
  lagCount: number
  shouldSuggestLite: boolean
}

type PerformanceCallback = (state: PerformanceState) => void

class PerformanceMonitor {
  private fps = 60
  private frames = 0
  private lastTime = 0
  private lagCount = 0
  private callback: PerformanceCallback | null = null
  private rafId: number | null = null
  private isRunning = false
  private enabled = true

  // Thresholds
  private readonly LAG_THRESHOLD = 5 // Suggest Lite after 5 lag events
  private readonly FPS_LOW = 30
  private readonly FPS_MODERATE = 45

  start(callback: PerformanceCallback) {
    if (typeof window === "undefined") return
    
    this.callback = callback
    this.isRunning = true
    this.lastTime = performance.now()
    this.measure()
  }

  stop() {
    this.isRunning = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) {
      this.reset()
    }
  }

  reset() {
    this.lagCount = 0
    this.fps = 60
  }

  private measure = () => {
    if (!this.isRunning) return

    const now = performance.now()
    this.frames++

    // Calculate FPS every second
    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastTime))
      this.frames = 0
      this.lastTime = now

      // Detect lag
      if (this.fps < this.FPS_LOW && this.enabled) {
        this.lagCount++
      } else if (this.fps >= this.FPS_MODERATE) {
        // Gradually recover if performance improves
        this.lagCount = Math.max(0, this.lagCount - 1)
      }

      // Notify callback
      if (this.callback && this.enabled) {
        this.callback(this.getState())
      }
    }

    this.rafId = requestAnimationFrame(this.measure)
  }

  getState(): PerformanceState {
    let status: PerformanceStatus = "smooth"
    
    if (this.fps < this.FPS_LOW) {
      status = "heavy"
    } else if (this.fps < this.FPS_MODERATE) {
      status = "moderate"
    }

    return {
      status,
      fps: this.fps,
      lagCount: this.lagCount,
      shouldSuggestLite: this.lagCount >= this.LAG_THRESHOLD,
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Helper to get stored adaptive setting
export function getAdaptiveEnabled(): boolean {
  if (typeof localStorage === "undefined") return true
  return localStorage.getItem("noxis-adaptive") !== "false"
}

export function setAdaptiveEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem("noxis-adaptive", enabled ? "true" : "false")
  performanceMonitor.setEnabled(enabled)
}

// Status colors and labels
export const STATUS_CONFIG = {
  smooth: { color: "text-green-500", bg: "bg-green-500", label: "Smooth" },
  moderate: { color: "text-yellow-500", bg: "bg-yellow-500", label: "Moderate" },
  heavy: { color: "text-red-500", bg: "bg-red-500", label: "Heavy" },
} as const
