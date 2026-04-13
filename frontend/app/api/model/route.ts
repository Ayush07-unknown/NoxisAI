import { NextRequest, NextResponse } from "next/server"

// In-memory model state (would use session/database in production)
let currentModel = "noxis-pro"

const AVAILABLE_MODELS = {
  "noxis-fast": { name: "Fast", description: "Quick responses for simple tasks" },
  "noxis-pro": { name: "Pro", description: "Balanced performance and quality" },
  "noxis-ultra": { name: "Ultra", description: "Maximum capability for complex tasks" },
}

export async function GET() {
  return NextResponse.json({ 
    model: currentModel,
    models: AVAILABLE_MODELS
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { model } = body

  if (!model || !Object.keys(AVAILABLE_MODELS).includes(model)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 })
  }

  currentModel = model
  
  return NextResponse.json({ 
    model: currentModel,
    info: AVAILABLE_MODELS[model as keyof typeof AVAILABLE_MODELS]
  })
}
