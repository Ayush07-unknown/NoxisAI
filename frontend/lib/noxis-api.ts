// Noxis API Client

// Configure this URL after deploying to Render

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

console.log("API BASE URL:", process.env.NEXT_PUBLIC_API_BASE_URL);

import { CONFIG } from "./config"

export type ModelType = "noxis-fast" | "noxis-pro" | "noxis-ultra"

interface ChatResponse {
  response: string
  model: string
}

interface TitleResponse {
  title: string
}

interface StreamChunk {
  token?: string
  reply?: string
  model?: string
  done?: boolean
  error?: string
}

/**
 * Send a chat message and get a streaming response
 */
export async function sendMessageStream(
  message: string,
  sessionId: string,
  model: ModelType = "noxis-pro",
  onChunk: (chunk: StreamChunk) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6)) as StreamChunk
            onChunk(data)
            if (data.error) {
              onError(data.error)
              return
            }
          } catch {
            // Ignore parse errors for malformed chunks
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : "Connection failed")
  }
}

/**
 * Send a chat message and get a non-streaming response
 */
export async function sendMessage(
  message: string,
  sessionId: string,
  model: ModelType = "noxis-pro"
): Promise<ChatResponse> {
  let finalReply = ""
  let finalModel = "unknown"
  await sendMessageStream(
    message,
    sessionId,
    model,
    (chunk) => {
      if (chunk.token) finalReply += chunk.token
      if (chunk.model) finalModel = chunk.model
      if (chunk.reply) finalReply = chunk.reply
    },
    (error) => {
      throw new Error(error)
    }
  )
  return { response: finalReply, model: finalModel }
}

/**
 * Generate a title for a conversation
 */
export async function generateTitle(
  userMessage: string,
  aiReply: string
): Promise<string> {
  return userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "")
}

/**
 * Clear session memory
 */
export async function clearMemory(sessionId: string): Promise<void> {
  await fetch(`${CONFIG.API_BASE_URL}/api/memory`, { method: "DELETE" })
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/health`, {
      method: "GET",
    })
    return response.ok
  } catch {
    return false
  }
}
