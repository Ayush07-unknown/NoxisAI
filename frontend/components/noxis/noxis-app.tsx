"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Menu, Brain, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatSidebar } from "./chat-sidebar"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { SettingsPanel } from "./settings-panel"
import { PerformanceIndicator } from "./performance-indicator"
import type { Chat, Message } from "./types"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_NOXIS_API_URL || "http://localhost:5000"

function generateId() {
  return Math.random().toString(36).substring(2, 15)
}

function createNewChat(): Chat {
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    isPinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function NoxisApp() {
  const [mounted, setMounted] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const currentChat = chats.find((c) => c.id === currentChatId)

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
    // Create initial chat
    const initialChat = createNewChat()
    setChats([initialChat])
    setCurrentChatId(initialChat.id)
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentChat?.messages])

  const handleNewChat = useCallback(() => {
    const newChat = createNewChat()
    setChats((prev) => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setInputValue("")
  }, [])

  const handleSelectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
  }, [])

  const handlePinChat = useCallback((chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, isPinned: !chat.isPinned } : chat
      )
    )
  }, [])

  const handleRenameChat = useCallback((chatId: string, newTitle: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, title: newTitle, updatedAt: Date.now() }
          : chat
      )
    )
  }, [])

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      setChats((prev) => {
        const filtered = prev.filter((chat) => chat.id !== chatId)
        if (filtered.length === 0) {
          const newChat = createNewChat()
          setCurrentChatId(newChat.id)
          return [newChat]
        }
        if (chatId === currentChatId) {
          setCurrentChatId(filtered[0].id)
        }
        return filtered
      })
    },
    [currentChatId]
  )

  const handleClearHistory = useCallback(() => {
    const newChat = createNewChat()
    setChats([newChat])
    setCurrentChatId(newChat.id)
    setIsSettingsOpen(false)
  }, [])

  // Stream response from API
  const streamResponse = useCallback(
    async (userMessage: string) => {
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      }

      // Add streaming message
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, assistantMessage],
                updatedAt: Date.now(),
              }
            : chat
        )
      )

      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No reader available")

        const decoder = new TextDecoder()
        let content = ""
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
                const data = JSON.parse(line.slice(6))
                if (data.token) {
                  content += data.token

                  // Update message content progressively
                  setChats((prev) =>
                    prev.map((chat) =>
                      chat.id === currentChatId
                        ? {
                            ...chat,
                            messages: chat.messages.map((msg) =>
                              msg.id === assistantMessage.id
                                ? { ...msg, content }
                                : msg
                            ),
                          }
                        : chat
                    )
                  )
                } else if (data.done) {
                  // Mark as complete
                  setChats((prev) =>
                    prev.map((chat) =>
                      chat.id === currentChatId
                        ? {
                            ...chat,
                            messages: chat.messages.map((msg) =>
                              msg.id === assistantMessage.id
                                ? { ...msg, isStreaming: false }
                                : msg
                            ),
                            title:
                              chat.title === "New Chat"
                                ? userMessage.slice(0, 30) +
                                  (userMessage.length > 30 ? "..." : "")
                                : chat.title,
                          }
                        : chat
                    )
                  )
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Stream error:", error)
          // Mark as complete on error
          setChats((prev) =>
            prev.map((chat) =>
              chat.id === currentChatId
                ? {
                    ...chat,
                    messages: chat.messages.map((msg) =>
                      msg.id === assistantMessage.id
                        ? {
                            ...msg,
                            isStreaming: false,
                            content: msg.content || "Sorry, an error occurred.",
                          }
                        : msg
                    ),
                  }
                : chat
            )
          )
        }
      }

      setIsLoading(false)
    },
    [currentChatId]
  )

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || !currentChatId || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [...chat.messages, userMessage],
              updatedAt: Date.now(),
            }
          : chat
      )
    )

    setInputValue("")
    setIsLoading(true)

    // Stream AI response
    streamResponse(inputValue.trim())
  }, [inputValue, currentChatId, isLoading, streamResponse])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsLoading(false)

    // Mark current streaming message as complete
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: chat.messages.map((msg) =>
                msg.isStreaming ? { ...msg, isStreaming: false } : msg
              ),
            }
          : chat
      )
    )
  }, [currentChatId])

  // Handle retry - resend the last user message
  const handleRetry = useCallback((messageId: string) => {
    if (!currentChat || isLoading) return

    // Find the message index
    const msgIndex = currentChat.messages.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return

    // Find the previous user message
    let userMessage: Message | undefined
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (currentChat.messages[i].role === "user") {
        userMessage = currentChat.messages[i]
        break
      }
    }

    if (!userMessage) return

    // Remove the assistant message and regenerate
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: chat.messages.filter((m) => m.id !== messageId),
            }
          : chat
      )
    )

    setIsLoading(true)
    streamResponse(userMessage.content)
  }, [currentChat, currentChatId, isLoading, streamResponse])

  // Handle feedback - just log for now (could send to API)
  const handleFeedback = useCallback((messageId: string, feedback: "like" | "dislike") => {
    console.log(`Feedback for message ${messageId}: ${feedback}`)
    // Could send to analytics API here
  }, [])

  // Show loading state to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <span className="text-lg font-semibold text-foreground">Noxis AI</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onPinChat={handlePinChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onOpenSettings={() => {
          setIsSidebarOpen(false)
          setIsSettingsOpen(true)
        }}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearHistory={handleClearHistory}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          className="text-foreground transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-medium text-foreground truncate max-w-[140px] sm:max-w-none">
            {currentChat?.title || "New Chat"}
          </h1>
          <PerformanceIndicator />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSettingsOpen(true)}
          className="text-foreground transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto noxis-scrollbar px-4 pt-4 pb-32">
        <div className="max-w-3xl mx-auto">
          {currentChat?.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-in zoom-in duration-300">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                How can I help you today?
              </h2>
              <p className="text-muted-foreground text-sm max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: "100ms" }}>
                Ask me anything. I&apos;m here to help with questions, creative ideas,
                analysis, and more.
              </p>
              
              {/* Quick prompts */}
              <div className="flex flex-wrap gap-2 mt-6 justify-center animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: "200ms" }}>
                {["Explain quantum computing", "Write a poem", "Help me code"].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInputValue(prompt)}
                    className="px-3 py-2 text-sm rounded-xl border border-border bg-card hover:bg-muted hover:border-primary/50 transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {currentChat?.messages.map((message, index) => (
                <div
                  key={message.id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ChatMessage
                    message={message}
                    onRetry={handleRetry}
                    onFeedback={handleFeedback}
                  />
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </main>

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onStop={handleStop}
        isLoading={isLoading}
      />
    </div>
  )
}
