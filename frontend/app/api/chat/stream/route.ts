import { NextRequest } from "next/server"

// Simulated AI responses for demo
const SAMPLE_RESPONSES = [
  "I understand your question. Let me think about that for a moment and provide you with a comprehensive answer that addresses all the key points you've raised.",
  "That's an interesting topic! Here's what I know about it based on my training data. There are several important aspects to consider when looking at this subject.",
  "Great question! There are several aspects to consider here. Let me break it down for you in a clear and organized way so you can understand the nuances.",
  "I'd be happy to help with that. Here's my analysis of the situation based on the information you've provided.",
  "Thanks for asking! This is a topic I find fascinating. Let me share my thoughts and insights with you.",
]

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message, model } = body

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const response = SAMPLE_RESPONSES[Math.floor(Math.random() * SAMPLE_RESPONSES.length)]
      const words = response.split(" ")

      // Send model info
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "model", model: model || "noxis-pro" })}\n\n`)
      )

      // Stream words with realistic delays
      for (let i = 0; i < words.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 40))
        
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "token", content: words[i] + (i < words.length - 1 ? " " : "") })}\n\n`)
        )
      }

      // Send done signal
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
