"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { setStoredUIMode, type UIMode, detectDeviceCapability } from "@/lib/ui-mode"
import { useTheme } from "next-themes"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  isStreaming?: boolean
  feedback?: "like" | "dislike" | null
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  pinned: boolean
  updatedAt: number
}

// Simple copy-to-clipboard
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const textarea = document.createElement("textarea")
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  })
}

// Format timestamp
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Lightweight code block detection for Lite UI
function parseMessageContent(content: string): Array<{ type: "text" | "code"; content: string; language?: string }> {
  const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = []
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text.trim()) parts.push({ type: "text", content: text })
    }
    parts.push({ type: "code", language: match[1] || "code", content: match[2].trim() })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text.trim()) parts.push({ type: "text", content: text })
  }

  return parts.length > 0 ? parts : [{ type: "text", content }]
}

export function LiteUI() {
  const { theme, setTheme } = useTheme()
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [uiMode, setUiMode] = useState<UIMode>("lite")
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const currentChat = chats.find((c) => c.id === currentChatId)

  // Load from localStorage
  useEffect(() => {
    const savedChats = localStorage.getItem("noxis-lite-chats")
    
    if (savedChats) {
      const parsed = JSON.parse(savedChats)
      setChats(parsed)
      if (parsed.length > 0) {
        setCurrentChatId(parsed[0].id)
      }
    }
  }, [])

  // Save chats
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("noxis-lite-chats", JSON.stringify(chats))
    }
  }, [chats])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentChat?.messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  const createNewChat = useCallback(() => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      pinned: false,
      updatedAt: Date.now(),
    }
    setChats((prev) => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setSidebarOpen(false)
  }, [])

  const deleteChat = useCallback((chatId: string) => {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId)
      if (filtered.length === 0) {
        const newChat: Chat = {
          id: crypto.randomUUID(),
          title: "New Chat",
          messages: [],
          pinned: false,
          updatedAt: Date.now(),
        }
        setCurrentChatId(newChat.id)
        return [newChat]
      }
      if (currentChatId === chatId) {
        setCurrentChatId(filtered[0].id)
      }
      return filtered
    })
  }, [currentChatId])

  const togglePin = useCallback((chatId: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, pinned: !c.pinned } : c
      )
    )
  }, [])

  const renameChat = useCallback((chatId: string, newTitle: string) => {
    if (!newTitle.trim()) return
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, title: newTitle.trim(), updatedAt: Date.now() } : c
      )
    )
    setEditingChatId(null)
    setEditingTitle("")
  }, [])

  const handleCopyMessage = useCallback((messageId: string, content: string) => {
    copyToClipboard(content)
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleFeedback = useCallback((messageId: string, feedback: "like" | "dislike") => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === currentChatId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, feedback: m.feedback === feedback ? null : feedback }
                  : m
              ),
            }
          : c
      )
    )
  }, [currentChatId])

  const handleClearHistory = useCallback(() => {
    if (!showClearConfirm) {
      setShowClearConfirm(true)
      setTimeout(() => setShowClearConfirm(false), 3000)
      return
    }
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      pinned: false,
      updatedAt: Date.now(),
    }
    setChats([newChat])
    setCurrentChatId(newChat.id)
    setSettingsOpen(false)
    setShowClearConfirm(false)
  }, [showClearConfirm])

  const handleAttachment = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setInput((prev) => prev + (prev ? " " : "") + `[Attached: ${file.name}]`)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const streamResponse = useCallback(async (userMessage: string, chatId: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    }

    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, assistantMessage] }
          : c
      )
    )

    try {
      abortControllerRef.current = new AbortController()
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, chatId }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === "token" && parsed.content) {
                fullContent += parsed.content
                setChats((prev) =>
                  prev.map((c) =>
                    c.id === chatId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantMessage.id
                              ? { ...m, content: fullContent }
                              : m
                          ),
                        }
                      : c
                  )
                )
              } else if (parsed.type === "done") {
                setChats((prev) =>
                  prev.map((c) =>
                    c.id === chatId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantMessage.id
                              ? { ...m, isStreaming: false }
                              : m
                          ),
                        }
                      : c
                  )
                )
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: "Sorry, something went wrong. Please try again.", isStreaming: false }
                      : m
                  ),
                }
              : c
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [])

  const handleRetry = useCallback((messageId: string) => {
    if (!currentChat || isStreaming) return

    const msgIndex = currentChat.messages.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return

    let userMessage: Message | undefined
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (currentChat.messages[i].role === "user") {
        userMessage = currentChat.messages[i]
        break
      }
    }

    if (!userMessage) return

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

    setIsStreaming(true)
    streamResponse(userMessage.content, currentChatId!)
  }, [currentChat, currentChatId, isStreaming, streamResponse])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    let chatId = currentChatId
    if (!chatId) {
      const newChat: Chat = {
        id: crypto.randomUUID(),
        title: input.slice(0, 30) || "New Chat",
        messages: [],
        pinned: false,
        updatedAt: Date.now(),
      }
      setChats((prev) => [newChat, ...prev])
      chatId = newChat.id
      setCurrentChatId(chatId)
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    }

    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [...c.messages, userMessage],
              title: c.messages.length === 0 ? input.slice(0, 30) : c.title,
              updatedAt: Date.now(),
            }
          : c
      )
    )

    setInput("")
    setIsStreaming(true)
    streamResponse(input.trim(), chatId)
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleUIMode = (mode: UIMode) => {
    setUiMode(mode)
    setStoredUIMode(mode)
    
    setSettingsOpen(false)
    setTimeout(() => {
      const switchFn = (window as unknown as { __noxisSwitchMode?: (mode: string) => void }).__noxisSwitchMode
      if (switchFn) {
        switchFn(mode)
      } else {
        window.location.reload()
      }
    }, 150)
  }

  const filteredChats = searchQuery
    ? chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chats

  const pinnedChats = filteredChats.filter((c) => c.pinned)
  const recentChats = filteredChats.filter((c) => !c.pinned)

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,.pdf,.txt,.doc,.docx"
      />

      {/* Header */}
      <header className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0 bg-background/95 backdrop-blur safe-area-top">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted active:scale-95 transition-all"
            aria-label="Open menu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="font-medium text-sm">Noxis AI</span>
            <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded font-medium">Lite</span>
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted active:scale-95 transition-all"
          aria-label="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-3 py-4 noxis-scrollbar">
        {!currentChat || currentChat.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold mb-1">Hello!</h1>
            <p className="text-muted-foreground text-sm mb-4">How can I help you today?</p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
              {["Explain quantum computing", "Write a poem", "Help me code"].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted hover:border-primary/50 active:scale-95 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {currentChat.messages.map((message) => (
              <div
                key={message.id}
                className={`group flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[85%] rounded-xl px-3 py-2 transition-all duration-200 hover:shadow-md ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground hover:bg-primary/95"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
{/* Message content */}
                                  {!message.content ? (
                                    <span className="flex items-center gap-1">
                                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
                                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
                                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
                                    </span>
                                  ) : message.role === "user" || message.isStreaming ? (
                                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                                  ) : (
                                    parseMessageContent(message.content).map((part, i) => (
                                      part.type === "code" ? (
                                        <div key={i} className="my-2 rounded-lg overflow-hidden border border-border bg-background/50">
                                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50">
                                            <span className="text-[10px] font-medium text-muted-foreground uppercase">{part.language}</span>
                                            <button
                                              onClick={() => {
                                                copyToClipboard(part.content)
                                                setCopiedId(`code-${i}`)
                                                setTimeout(() => setCopiedId(null), 2000)
                                              }}
                                              className="text-[10px] text-muted-foreground hover:text-foreground"
                                            >
                                              {copiedId === `code-${i}` ? "Copied!" : "Copy"}
                                            </button>
                                          </div>
                                          <pre className="p-3 text-xs overflow-x-auto"><code>{part.content}</code></pre>
                                        </div>
                                      ) : (
                                        <p key={i} className="whitespace-pre-wrap break-words text-sm">{part.content}</p>
                                      )
                                    ))
                                  )}
                  
                  {/* Timestamp */}
                  <span className="text-[9px] opacity-60 mt-1 block">
                    {formatTime(message.timestamp)}
                  </span>

                  {/* Action buttons for assistant messages */}
                  {message.role === "assistant" && message.content && !message.isStreaming && (
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {/* Copy */}
                      <button
                        onClick={() => handleCopyMessage(message.id, message.content)}
                        className="p-1.5 rounded-lg hover:bg-background/50 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                        title="Copy"
                      >
                        {copiedId === message.id ? (
                          <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      
                      {/* Like */}
                      <button
                        onClick={() => handleFeedback(message.id, "like")}
                        className={`p-1.5 rounded-lg active:scale-95 transition-all ${
                          message.feedback === "like"
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-background/50 text-muted-foreground hover:text-foreground"
                        }`}
                        title="Like"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                      </button>
                      
                      {/* Dislike */}
                      <button
                        onClick={() => handleFeedback(message.id, "dislike")}
                        className={`p-1.5 rounded-lg active:scale-95 transition-all ${
                          message.feedback === "dislike"
                            ? "bg-destructive/10 text-destructive"
                            : "hover:bg-background/50 text-muted-foreground hover:text-foreground"
                        }`}
                        title="Dislike"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                      </button>
                      
                      {/* Retry */}
                      <button
                        onClick={() => handleRetry(message.id)}
                        className="p-1.5 rounded-lg hover:bg-background/50 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                        title="Retry"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </main>

      {/* Input */}
      <div className="border-t border-border p-3 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-secondary rounded-xl p-1.5 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/50">
            {/* Attachment button */}
            <button
              onClick={handleAttachment}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-muted-foreground hover:text-foreground"
              aria-label="Attach file"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none px-1 py-1.5 max-h-28 text-sm text-secondary-foreground placeholder:text-muted-foreground"
              style={{ minHeight: "32px" }}
            />
            
            <button
              onClick={isStreaming ? handleStop : handleSend}
              disabled={!input.trim() && !isStreaming}
              className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-all ${
                isStreaming
                  ? "bg-destructive text-destructive-foreground"
                  : input.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isStreaming ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 sm:w-64 bg-card border-r border-border h-full flex flex-col animate-in slide-in-from-left duration-200">
            <div className="p-3 border-b border-border flex items-center justify-between safe-area-top">
              <span className="font-medium text-sm">Chats</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-muted rounded-lg active:scale-95 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Search */}
            <div className="p-2">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1.5">
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={createNewChat}
                className="w-full py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                New Chat
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 noxis-scrollbar">
              {pinnedChats.length > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground px-2 py-1 uppercase tracking-wider">Pinned</p>
                  {pinnedChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group flex items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                        currentChatId === chat.id ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setCurrentChatId(chat.id)
                        setSidebarOpen(false)
                      }}
                    >
                      {editingChatId === chat.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => renameChat(chat.id, editingTitle)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameChat(chat.id, editingTitle)
                            if (e.key === "Escape") {
                              setEditingChatId(null)
                              setEditingTitle("")
                            }
                          }}
                          className="flex-1 bg-transparent text-xs outline-none border border-primary rounded px-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate text-xs">{chat.title}</span>
                      )}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingChatId(chat.id)
                            setEditingTitle(chat.title)
                          }}
                          className="p-1 hover:bg-background rounded active:scale-95 transition-all"
                          title="Rename"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePin(chat.id)
                          }}
                          className="p-1 hover:bg-background rounded active:scale-95 transition-all"
                          title="Unpin"
                        >
                          <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 4v4l3-2v8l-3-2v4h-2V4h2zm-8 4v8H6l2 2v4h2v-4l2-2V8H6z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteChat(chat.id)
                          }}
                          className="p-1 hover:bg-destructive/10 rounded text-destructive active:scale-95 transition-all"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {recentChats.length > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground px-2 py-1 mt-2 uppercase tracking-wider">Recent</p>
                  {recentChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group flex items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                        currentChatId === chat.id ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setCurrentChatId(chat.id)
                        setSidebarOpen(false)
                      }}
                    >
                      {editingChatId === chat.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => renameChat(chat.id, editingTitle)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameChat(chat.id, editingTitle)
                            if (e.key === "Escape") {
                              setEditingChatId(null)
                              setEditingTitle("")
                            }
                          }}
                          className="flex-1 bg-transparent text-xs outline-none border border-primary rounded px-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate text-xs">{chat.title}</span>
                      )}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingChatId(chat.id)
                            setEditingTitle(chat.title)
                          }}
                          className="p-1 hover:bg-background rounded active:scale-95 transition-all"
                          title="Rename"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePin(chat.id)
                          }}
                          className="p-1 hover:bg-background rounded active:scale-95 transition-all"
                          title="Pin"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteChat(chat.id)
                          }}
                          className="p-1 hover:bg-destructive/10 rounded text-destructive active:scale-95 transition-all"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Settings - Full width on mobile */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <aside className="relative w-full sm:w-72 bg-card border-l border-border h-full flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-3 border-b border-border flex items-center justify-between safe-area-top">
              <span className="font-medium text-sm">Settings</span>
              <button onClick={() => setSettingsOpen(false)} className="p-1.5 hover:bg-muted rounded-lg active:scale-95 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 noxis-scrollbar">
              {/* UI Mode */}
              <div>
                <p className="text-xs font-medium mb-2">UI Mode</p>
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <button
                    onClick={() => handleUIMode("auto")}
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium active:scale-95 transition-all ${
                      uiMode === "auto"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => handleUIMode("lite")}
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium active:scale-95 transition-all ${
                      uiMode === "lite"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Lite
                  </button>
                  <button
                    onClick={() => handleUIMode("full")}
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium active:scale-95 transition-all ${
                      uiMode === "full"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Full
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {uiMode === "auto" && `Auto-detected: ${detectDeviceCapability().recommendation === "lite" ? "Lite" : "Full"}`}
                  {uiMode === "lite" && "Lightweight, fast performance"}
                  {uiMode === "full" && "Full features, enhanced UI"}
                </p>
              </div>

              {/* Adaptive Intelligence */}
              <div>
                <p className="text-xs font-medium mb-2">Adaptive Intelligence</p>
                <button
                  onClick={() => {
                    const current = localStorage.getItem("noxis-adaptive") !== "false"
                    localStorage.setItem("noxis-adaptive", current ? "false" : "true")
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/50 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-xs">Auto-optimize</span>
                  </div>
                  <div className="w-8 h-5 rounded-full bg-primary p-0.5">
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm translate-x-3" />
                  </div>
                </button>
              </div>

              {/* Theme */}
              <div>
                <p className="text-xs font-medium mb-2">Appearance</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 active:scale-95 transition-all ${
                      theme === "light"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 active:scale-95 transition-all ${
                      theme === "dark"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Dark
                  </button>
                </div>
              </div>

              {/* Clear History */}
              <div>
                <p className="text-xs font-medium mb-2">Data</p>
                <button
                  onClick={handleClearHistory}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-medium active:scale-[0.98] transition-all ${
                    showClearConfirm
                      ? "bg-destructive text-destructive-foreground"
                      : "border border-destructive/30 text-destructive hover:bg-destructive/10"
                  }`}
                >
                  {showClearConfirm ? "Tap again to confirm" : "Clear All History"}
                </button>
              </div>

              {/* About */}
              <div>
                <p className="text-xs font-medium mb-2">About</p>
                <div className="p-3 rounded-xl border border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Noxis AI - Your intelligent AI assistant. Built for speed, privacy, and seamless conversations.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-border safe-area-bottom">
              <p className="text-[10px] text-muted-foreground text-center">Noxis AI v1.0.0 (Lite)</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
