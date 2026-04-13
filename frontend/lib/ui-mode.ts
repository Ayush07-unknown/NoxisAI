// UI Mode System - Auto, Lite, Full
export type UIMode = "auto" | "lite" | "full"

export interface DeviceCapability {
  memory: number | null
  cores: number | null
  connectionType: string | null
  saveData: boolean
  score: number
  recommendation: "lite" | "full"
}

const LITE_THRESHOLD = 4

// Lightweight device detection (< 2KB when minified)
export function detectDeviceCapability(): DeviceCapability {
  const nav = typeof navigator !== "undefined" ? navigator : null
  
  const memory = (nav as Navigator & { deviceMemory?: number })?.deviceMemory ?? null
  const cores = nav?.hardwareConcurrency ?? null
  const connection = (nav as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } })?.connection
  const connectionType = connection?.effectiveType ?? null
  const saveData = connection?.saveData ?? false
  
  let score = 0
  
  // Low memory (<=4GB) -> +2
  if (memory !== null && memory <= 4) score += 2
  
  // Low CPU (<=4 cores) -> +2
  if (cores !== null && cores <= 4) score += 2
  
  // Slow network (2g/slow-2g) -> +2
  if (connectionType === "2g" || connectionType === "slow-2g") score += 2
  
  // Data saver enabled -> +3
  if (saveData) score += 3
  
  return { memory, cores, connectionType, saveData, score, recommendation: score >= LITE_THRESHOLD ? "lite" : "full" }
}

export function shouldUseLiteUI(capability: DeviceCapability): boolean {
  return capability.score >= LITE_THRESHOLD
}

export function getStoredUIMode(): UIMode {
  if (typeof localStorage === "undefined") return "auto"
  return (localStorage.getItem("ui-mode") as UIMode) || "auto"
}

export function setStoredUIMode(mode: UIMode): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem("ui-mode", mode)
}

export function resolveUIMode(): "lite" | "full" {
  const mode = getStoredUIMode()
  
  if (mode === "lite") return "lite"
  if (mode === "full") return "full"
  
  // Auto mode - detect device capability
  const capability = detectDeviceCapability()
  return shouldUseLiteUI(capability) ? "lite" : "full"
}

// Mode labels for UI
export const UI_MODE_LABELS = {
  auto: { label: "Auto", icon: "🤖", description: "Intelligent selection based on device" },
  lite: { label: "Lite", icon: "⚡", description: "Best for low-end devices" },
  full: { label: "Full", icon: "🎨", description: "Best experience" },
} as const
