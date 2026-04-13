import { NextRequest, NextResponse } from "next/server"

// Shared in-memory storage reference
const chatHistory: Map<string, {
  id: string
  title: string
  messages: Array<{ id: string; role: string; content: string; timestamp: number }>
  isPinned: boolean
  createdAt: number
  updatedAt: number
}> = new Map()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params
  const body = await request.json()
  const { title } = body

  const chat = chatHistory.get(cid)
  
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  chat.title = title || chat.title
  chat.updatedAt = Date.now()
  chatHistory.set(cid, chat)

  return NextResponse.json({ chat })
}
