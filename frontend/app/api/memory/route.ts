import { NextResponse } from "next/server"

// In-memory storage for demo
let memoryData: Array<{ key: string; value: string; timestamp: number }> = []

export async function GET() {
  return NextResponse.json({ 
    memory: memoryData,
    count: memoryData.length
  })
}

export async function DELETE() {
  memoryData = []
  
  return NextResponse.json({ 
    success: true,
    message: "Memory cleared"
  })
}
