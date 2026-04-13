"use client"

import { useRef, useEffect, useState } from "react"
import { Paperclip, Mic, Send, Square, X, FileText, Image } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Attachment {
  id: string
  name: string
  type: string
  size: number
}

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isLoading: boolean
  disabled?: boolean
  attachments?: Attachment[]
  onAttachmentsChange?: (attachments: Attachment[]) => void
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  disabled,
  attachments = [],
  onAttachmentsChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>(attachments)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && value.trim()) {
        onSend()
      }
    }
  }

  const handleAttachmentClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments = files.map((file) => ({
      id: Math.random().toString(36).substring(2, 15),
      name: file.name,
      type: file.type,
      size: file.size,
    }))
    
    const updated = [...localAttachments, ...newAttachments]
    setLocalAttachments(updated)
    onAttachmentsChange?.(updated)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveAttachment = (id: string) => {
    const updated = localAttachments.filter((a) => a.id !== id)
    setLocalAttachments(updated)
    onAttachmentsChange?.(updated)
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return Image
    return FileText
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 px-4 safe-area-bottom">
      <div className="max-w-3xl mx-auto">
        {/* Attachments preview */}
        {localAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {localAttachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.type)
              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm group animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <FileIcon className="w-4 h-4 text-primary" />
                  <span className="max-w-[120px] truncate text-foreground">
                    {attachment.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </span>
                  <button
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 p-2 rounded-2xl border border-border bg-card",
            "shadow-lg transition-all duration-300 focus-within:shadow-xl focus-within:border-primary/50",
            "hover:shadow-xl"
          )}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx,.csv,.json"
            onChange={handleFileChange}
          />

          {/* Attachment button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAttachmentClick}
            className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-95"
            disabled={disabled || isLoading}
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Noxis..."
            disabled={disabled || isLoading}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent border-0 outline-none",
              "text-sm md:text-base text-foreground placeholder:text-muted-foreground",
              "max-h-[200px] py-2 px-1"
            )}
          />

          {/* Voice input button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-95"
            disabled={disabled || isLoading}
          >
            <Mic className="w-5 h-5" />
          </Button>

          {/* Send/Stop button */}
          {isLoading ? (
            <Button
              type="button"
              onClick={onStop}
              size="icon"
              className="shrink-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSend}
              size="icon"
              disabled={disabled || !value.trim()}
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          Noxis AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  )
}
