import { NextRequest, NextResponse } from "next/server"

// Shared in-memory storage reference (in production, use database)
const chatHistory: Map<string, {
  id: string
  title: string
  messages: Array<{ id: string; role: string; content: string; timestamp: number }>
  isPinned: boolean
  createdAt: number
  updatedAt: number
}> = new Map()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params
  
  if (!chatHistory.has(cid)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  chatHistory.delete(cid)
  return NextResponse.json({ success: true })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params
  const chat = chatHistory.get(cid)
  
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  return NextResponse.json({ chat })
}
