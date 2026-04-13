"use client"

import { useState, useEffect, useMemo } from "react"
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CodeBlock, parseCodeBlocks } from "./code-block"
import type { Message } from "./types"

interface ChatMessageProps {
  message: Message
  onRetry?: (messageId: string) => void
  onFeedback?: (messageId: string, feedback: "like" | "dislike") => void
}

export function ChatMessage({ message, onRetry, onFeedback }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [formattedTime, setFormattedTime] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null)

  const isUser = message.role === "user"

  // Parse message content for code blocks
  const contentParts = useMemo(() => {
    if (isUser || message.isStreaming) {
      return [{ type: "text" as const, content: message.content }]
    }
    return parseCodeBlocks(message.content)
  }, [message.content, isUser, message.isStreaming])

  // Handle timestamp client-side only to avoid hydration errors
  useEffect(() => {
    const date = new Date(message.timestamp)
    setFormattedTime(
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    )
  }, [message.timestamp])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFeedback = (type: "like" | "dislike") => {
    setFeedback(feedback === type ? null : type)
    onFeedback?.(message.id, type)
  }

  const handleRetry = () => {
    onRetry?.(message.id)
  }

  return (
    <div
      className={cn(
        "group flex w-full mb-4 message-animate",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] rounded-2xl transition-all duration-200",
          "hover:shadow-md",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md hover:bg-primary/95 px-4 py-3"
            : "bg-secondary text-secondary-foreground rounded-bl-md hover:bg-secondary/80"
        )}
      >
        {/* Message content */}
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-1 px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-current typing-dot" />
            <span className="w-2 h-2 rounded-full bg-current typing-dot" />
            <span className="w-2 h-2 rounded-full bg-current typing-dot" />
          </div>
        ) : (
          <div className={cn(!isUser && "px-4 py-3")}>
            {contentParts.map((part, index) => (
              <div key={index}>
                {part.type === "code" ? (
                  <div className={cn(index > 0 && "mt-2", index < contentParts.length - 1 && "mb-2")}>
                    <CodeBlock
                      code={part.content}
                      language={part.language || "plaintext"}
                    />
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {part.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className={cn(
            "flex items-center gap-2 mt-2 px-4 pb-3",
            isUser ? "justify-end px-0 pb-0" : "justify-between"
          )}
        >
          {formattedTime && (
            <span
              className={cn(
                "text-xs",
                isUser ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {formattedTime}
            </span>
          )}

          {/* Action buttons for assistant messages */}
          {!isUser && !message.isStreaming && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {/* Copy button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all duration-200 hover:scale-110 active:scale-95"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>

              {/* Like button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleFeedback("like")}
                className={cn(
                  "h-7 w-7 transition-all duration-200 hover:scale-110 active:scale-95",
                  feedback === "like"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </Button>

              {/* Dislike button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleFeedback("dislike")}
                className={cn(
                  "h-7 w-7 transition-all duration-200 hover:scale-110 active:scale-95",
                  feedback === "dislike"
                    ? "text-destructive bg-destructive/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </Button>

              {/* Retry button */}
              {onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRetry}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
