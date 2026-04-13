"use client"

import { useState } from "react"
import { Brain, Plus, Search, Pin, Pencil, Trash2, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Chat } from "./types"

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  chats: Chat[]
  currentChatId: string | null
  onNewChat: () => void
  onSelectChat: (chatId: string) => void
  onPinChat: (chatId: string) => void
  onRenameChat: (chatId: string, newTitle: string) => void
  onDeleteChat: (chatId: string) => void
  onOpenSettings: () => void
}

export function ChatSidebar({
  isOpen,
  onClose,
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onPinChat,
  onRenameChat,
  onDeleteChat,
  onOpenSettings,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pinnedChats = filteredChats.filter((chat) => chat.isPinned)
  const regularChats = filteredChats.filter((chat) => !chat.isPinned)

  const handleStartRename = (chat: Chat) => {
    setEditingId(chat.id)
    setEditTitle(chat.title)
  }

  const handleSaveRename = (chatId: string) => {
    if (editTitle.trim()) {
      onRenameChat(chatId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle("")
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border z-50",
          "flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-sidebar-foreground">Noxis AI</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-sidebar-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <Button
            onClick={() => {
              onNewChat()
              onClose()
            }}
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-sidebar-accent border-sidebar-border"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto noxis-scrollbar px-2 py-1">
          {/* Pinned Section */}
          {pinnedChats.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                Pinned
              </p>
              {pinnedChats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  isSelected={chat.id === currentChatId}
                  isEditing={editingId === chat.id}
                  editTitle={editTitle}
                  onEditTitleChange={setEditTitle}
                  onSelect={() => {
                    onSelectChat(chat.id)
                    onClose()
                  }}
                  onPin={() => onPinChat(chat.id)}
                  onStartRename={() => handleStartRename(chat)}
                  onSaveRename={() => handleSaveRename(chat.id)}
                  onDelete={() => onDeleteChat(chat.id)}
                />
              ))}
            </div>
          )}

          {/* Regular Section */}
          {regularChats.length > 0 && (
            <div>
              {pinnedChats.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                  Recent
                </p>
              )}
              {regularChats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  isSelected={chat.id === currentChatId}
                  isEditing={editingId === chat.id}
                  editTitle={editTitle}
                  onEditTitleChange={setEditTitle}
                  onSelect={() => {
                    onSelectChat(chat.id)
                    onClose()
                  }}
                  onPin={() => onPinChat(chat.id)}
                  onStartRename={() => handleStartRename(chat)}
                  onSaveRename={() => handleSaveRename(chat.id)}
                  onDelete={() => onDeleteChat(chat.id)}
                />
              ))}
            </div>
          )}

          {filteredChats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery ? "No chats found" : "No chats yet"}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={onOpenSettings}
            className="w-full justify-start gap-2 text-sidebar-foreground"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </aside>
    </>
  )
}

interface ChatItemProps {
  chat: Chat
  isSelected: boolean
  isEditing: boolean
  editTitle: string
  onEditTitleChange: (value: string) => void
  onSelect: () => void
  onPin: () => void
  onStartRename: () => void
  onSaveRename: () => void
  onDelete: () => void
}

function ChatItem({
  chat,
  isSelected,
  isEditing,
  editTitle,
  onEditTitleChange,
  onSelect,
  onPin,
  onStartRename,
  onSaveRename,
  onDelete,
}: ChatItemProps) {
  const lastMessage = chat.messages[chat.messages.length - 1]

  return (
    <div
      className={cn(
        "group relative rounded-lg px-2 py-2 cursor-pointer mb-0.5",
        "hover:bg-sidebar-accent transition-colors",
        isSelected && "bg-sidebar-accent"
      )}
      onClick={() => !isEditing && onSelect()}
    >
      {isEditing ? (
        <Input
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveRename()
            if (e.key === "Escape") onSaveRename()
          }}
          onBlur={onSaveRename}
          autoFocus
          className="h-6 text-sm py-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <p className="text-sm font-medium text-sidebar-foreground truncate pr-16">
            {chat.title}
          </p>
          {lastMessage && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {lastMessage.content.slice(0, 40)}
              {lastMessage.content.length > 40 ? "..." : ""}
            </p>
          )}
        </>
      )}

      {/* Actions */}
      {!isEditing && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation()
              onPin()
            }}
            className={cn(
              "h-6 w-6",
              chat.isPinned && "text-primary"
            )}
          >
            <Pin className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation()
              onStartRename()
            }}
            className="h-6 w-6"
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="h-6 w-6 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
