'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import useWebSocket from '../../src/hooks/useWebSocket';

function ChatContent() {
  const { user } = useAuth();
  const {
    isConnected,
    messages,
    sendMessage,
    sendTyping,
    markAsRead,
    onlineUsers
  } = useWebSocket();
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/conversations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setConversations(data.conversations || []);
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      }
    };

    if (user) {
      fetchConversations();
    }
  }, [user, API_URL]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle typing indicator
  const handleTyping = (value: string) => {
    setMessageInput(value);
    
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      if (selectedConversation) {
        sendTyping(selectedConversation.conversation_id, true);
      }
    }

    if (value.length === 0) {
      setIsTyping(false);
      if (selectedConversation) {
        sendTyping(selectedConversation.conversation_id, false);
      }
    }

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing timeout to stop typing indicator after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (selectedConversation) {
        sendTyping(selectedConversation.conversation_id, false);
      }
    }, 1000);
  };

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !selectedConversation) return;

    const success = sendMessage(selectedConversation.conversation_id, messageInput.trim());
    
    if (success) {
      setMessageInput('');
      setIsTyping(false);
      if (selectedConversation) {
        sendTyping(selectedConversation.conversation_id, false);
      }
    }
  };

  // Select conversation
  const selectConversation = async (conversation: any) => {
    setSelectedConversation(conversation);
    
    // Fetch messages for this conversation
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/conversations/${conversation.conversation_id}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched messages:', data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Please login to access chat</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen border border-gray-300">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-300 overflow-y-auto">
        <div className="p-4 border-b border-gray-300 font-bold flex justify-between items-center">
          Conversations
          <span className={`text-sm ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        
        {conversations.map((conv: any) => (
          <div
            key={conv.conversation_id}
            onClick={() => selectConversation(conv)}
            className={`p-4 border-b border-gray-200 cursor-pointer ${
              selectedConversation?.conversation_id === conv.conversation_id ? 'bg-gray-100' : 'bg-white'
            }`}
          >
            <div className="font-bold flex justify-between items-center">
              {conv.other_user_name}
              <span className={`text-sm ${onlineUsers.has(conv.other_user_id) ? 'text-green-500' : 'text-gray-500'}`}>
                {onlineUsers.has(conv.other_user_id) ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="text-sm text-gray-600 truncate">
              {conv.last_message || 'No messages yet'}
            </div>
            {conv.unread_count > 0 && (
              <div className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full text-xs mt-2">
                {conv.unread_count}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-300 font-bold flex justify-between items-center">
              <div>
                {selectedConversation.other_user_name}
                <span className={`text-sm ml-2 ${onlineUsers.has(selectedConversation.other_user_id) ? 'text-green-500' : 'text-gray-500'}`}>
                  {onlineUsers.has(selectedConversation.other_user_id) ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              {messages.map((message: any) => (
                <div
                  key={message.id}
                  className={`mb-3 flex ${
                    message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-2xl ${
                      message.sender_id === user?.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'
                    }`}
                  >
                    <div>{message.content}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-300 flex">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full mr-2"
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || !isConnected}
                className={`px-4 py-2 rounded-full text-white ${
                  isConnected ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <AuthProvider>
      <ChatContent />
    </AuthProvider>
  );
}
