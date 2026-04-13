import { NextRequest, NextResponse } from "next/server"

// In-memory storage for demo (would use database in production)
const chatHistory: Map<string, {
  id: string
  title: string
  messages: Array<{ id: string; role: string; content: string; timestamp: number }>
  isPinned: boolean
  createdAt: number
  updatedAt: number
}> = new Map()

export async function GET() {
  const chats = Array.from(chatHistory.values())
    .sort((a, b) => {
      // Pinned first, then by updatedAt
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return b.updatedAt - a.updatedAt
    })
  
  return NextResponse.json({ chats })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, title, messages, isPinned } = body

  const now = Date.now()
  const chat = {
    id: id || crypto.randomUUID(),
    title: title || "New Chat",
    messages: messages || [],
    isPinned: isPinned || false,
    createdAt: now,
    updatedAt: now,
  }

  chatHistory.set(chat.id, chat)
  
  return NextResponse.json({ chat })
}
