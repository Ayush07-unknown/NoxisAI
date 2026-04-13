export type ModelType = "noxis-fast" | "noxis-pro" | "noxis-ultra"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  model?: ModelType
  timestamp: number
  isStreaming?: boolean
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  isPinned: boolean
  createdAt: number
  updatedAt: number
}

export const MODEL_INFO: Record<ModelType, { name: string; description: string }> = {
  "noxis-fast": {
    name: "Fast",
    description: "Quick responses for simple tasks"
  },
  "noxis-pro": {
    name: "Pro",
    description: "Balanced performance and quality"
  },
  "noxis-ultra": {
    name: "Ultra",
    description: "Maximum capability for complex tasks"
  }
}
