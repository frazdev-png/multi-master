"use client"

import { Send, Search, RefreshCw, Download, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Message {
  id: number;
  text: string;
  sender: "me" | "other";
  timestamp: string;
}

interface Conversation {
  id: number;
  name: string;
  type: "Vendor" | "Customer";
  lastMessage: string;
  unread: number;
  date: string;
  messages: Message[];
}

export default function MessagesManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedConversation, setSelectedConversation] = useState<number>(1)
  const [messageInput, setMessageInput] = useState("")
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 1,
      name: "Tech Store Support",
      type: "Vendor",
      lastMessage: "Product approval request",
      unread: 3,
      date: "Dec 18, 2024",
      messages: [
        { id: 1, text: "Hi, can you check on our product approval?", sender: "other", timestamp: "10:30 AM" },
        { id: 2, text: "Your products are under review. Should be done by tomorrow.", sender: "me", timestamp: "10:32 AM" },
        { id: 3, text: "Thank you for the update!", sender: "other", timestamp: "10:33 AM" },
      ]
    },
    {
      id: 2,
      name: "John Doe",
      type: "Customer",
      lastMessage: "Order status inquiry",
      unread: 0,
      date: "Dec 17, 2024",
      messages: [
        { id: 1, text: "Where is my order?", sender: "other", timestamp: "2:15 PM" },
        { id: 2, text: "Your order has been shipped and should arrive in 2-3 days.", sender: "me", timestamp: "2:20 PM" },
      ]
    },
    {
      id: 3,
      name: "Fashion Hub",
      type: "Vendor",
      lastMessage: "Commission withdrawal request",
      unread: 1,
      date: "Dec 16, 2024",
      messages: [
        { id: 1, text: "I'd like to withdraw my commission.", sender: "other", timestamp: "9:00 AM" },
      ]
    },
  ])

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const currentConversation = conversations.find(conv => conv.id === selectedConversation)

  const handleSendMessage = () => {
    if (messageInput.trim() && currentConversation) {
      const newMessage: Message = {
        id: currentConversation.messages.length + 1,
        text: messageInput,
        sender: "me",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation
          ? { 
              ...conv, 
              messages: [...conv.messages, newMessage],
              lastMessage: messageInput,
              date: new Date().toLocaleDateString(),
              unread: 0
            }
          : conv
      ))

      setMessageInput("")
    }
  }

  const handleDeleteConversation = (conversationId: number) => {
    if (confirm("Are you sure you want to delete this conversation?")) {
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
      if (selectedConversation === conversationId && conversations.length > 1) {
        setSelectedConversation(conversations.find(conv => conv.id !== conversationId)?.id || 1)
      }
    }
  }

  const handleMarkAsRead = (conversationId: number) => {
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId ? { ...conv, unread: 0 } : conv
    ))
  }

  const handleRefresh = () => {
    alert("Messages refreshed!")
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Type,Last Message,Unread,Date\n" +
      conversations.map(conv => 
        `${conv.name},${conv.type},${conv.lastMessage},${conv.unread},${conv.date}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "messages.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">Support chat with customers and vendors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Search size={18} className="text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                />
              </div>

              <div className="max-h-96 overflow-y-auto">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`w-full p-4 border-b border-border hover:bg-muted transition-colors cursor-pointer ${
                      selectedConversation === conv.id ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      setSelectedConversation(conv.id)
                      handleMarkAsRead(conv.id)
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{conv.name}</span>
                      <div className="flex items-center gap-2">
                        {conv.unread > 0 && (
                          <Badge variant="default" className="text-xs">
                            {conv.unread}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteConversation(conv.id)
                          }}
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">{conv.type}</div>
                    <div className="text-sm text-muted-foreground truncate">{conv.lastMessage}</div>
                    <div className="text-xs text-muted-foreground mt-1">{conv.date}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[500px]">
            {currentConversation ? (
              <>
                <div className="p-4 border-b border-border">
                  <h3 className="font-bold">{currentConversation.name}</h3>
                  <p className="text-xs text-muted-foreground">{currentConversation.type} Chat</p>
                </div>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-background/50">
                  {currentConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`px-4 py-2 rounded-lg max-w-xs ${
                          message.sender === "me"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>
                        <span className={`text-xs ${message.sender === "me" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                          {message.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Type your message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={handleSendMessage}>
                      <Send size={18} />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to start chatting
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
