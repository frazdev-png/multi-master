"use client"

import { useState, useCallback } from "react"
import { getSupabaseClient } from "./supabase-client"

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface Conversation {
  id: string
  participant_1_id: string
  participant_2_id: string
  last_message_id: string | null
  last_message_at: string
}

export function useMessaging(userId: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = getSupabaseClient()

  // Subscribe to real-time messages
  const subscribeToMessages = useCallback(
    (conversationId: string) => {
      if (!userId) return

      const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message])
          },
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    },
    [userId, supabase],
  )

  // Subscribe to real-time conversations
  const subscribeToConversations = useCallback(() => {
    if (!userId) return

    const channel = supabase
      .channel("conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          setConversations((prev) => {
            const exists = prev.find((c) => c.id === payload.new.id)
            if (exists) {
              return prev.map((c) => (c.id === payload.new.id ? (payload.new as Conversation) : c))
            }
            return [...prev, payload.new as Conversation]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // Send message
  const sendMessage = async (receiverId: string, content: string) => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            sender_id: userId,
            receiver_id: receiverId,
            content,
            message_type: "text",
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  return {
    conversations,
    messages,
    loading,
    subscribeToMessages,
    subscribeToConversations,
    sendMessage,
  }
}
