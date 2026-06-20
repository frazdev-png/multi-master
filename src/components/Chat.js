import React, { useState, useEffect, useRef } from 'react';
import useWebSocket from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';

const Chat = () => {
  const { user } = useAuth();
  const {
    isConnected,
    messages,
    sendMessage,
    sendTyping,
    markAsRead,
    onlineUsers
  } = useWebSocket();
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

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
  const handleTyping = (value) => {
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
  const handleSendMessage = (e) => {
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
  const selectConversation = async (conversation) => {
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
        // This would be handled by the WebSocket hook in a real implementation
        console.log('Fetched messages:', data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  return (
    <div style={{ display: 'flex', height: '500px', border: '1px solid #ccc' }}>
      {/* Conversations List */}
      <div style={{ width: '300px', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
          Conversations
          <span style={{ float: 'right', fontSize: '12px', color: isConnected ? 'green' : 'red' }}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        
        {conversations.map((conv) => (
          <div
            key={conv.conversation_id}
            onClick={() => selectConversation(conv)}
            style={{
              padding: '10px',
              borderBottom: '1px solid #eee',
              cursor: 'pointer',
              backgroundColor: selectedConversation?.conversation_id === conv.conversation_id ? '#f0f0f0' : 'white'
            }}
          >
            <div style={{ fontWeight: 'bold' }}>
              {conv.other_user_name}
              <span style={{ 
                float: 'right', 
                fontSize: '10px', 
                color: onlineUsers.has(conv.other_user_id) ? 'green' : 'gray' 
              }}>
                {onlineUsers.has(conv.other_user_id) ? 'Online' : 'Offline'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {conv.last_message || 'No messages yet'}
            </div>
            {conv.unread_count > 0 && (
              <div style={{ 
                backgroundColor: 'red', 
                color: 'white', 
                borderRadius: '50%', 
                width: '20px', 
                height: '20px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '12px',
                marginTop: '5px'
              }}>
                {conv.unread_count}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div style={{ 
              padding: '10px', 
              borderBottom: '1px solid #ccc', 
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                {selectedConversation.other_user_name}
                <span style={{ 
                  fontSize: '12px', 
                  color: onlineUsers.has(selectedConversation.other_user_id) ? 'green' : 'gray',
                  marginLeft: '10px'
                }}>
                  {onlineUsers.has(selectedConversation.other_user_id) ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ 
              flex: 1, 
              padding: '10px', 
              overflowY: 'auto',
              backgroundColor: '#f9f9f9'
            }}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: message.sender_id === user?.id ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '8px 12px',
                      borderRadius: '18px',
                      backgroundColor: message.sender_id === user?.id ? '#007bff' : '#e9ecef',
                      color: message.sender_id === user?.id ? 'white' : 'black'
                    }}
                  >
                    <div>{message.content}</div>
                    <div style={{ 
                      fontSize: '10px', 
                      opacity: 0.7,
                      marginTop: '4px'
                    }}>
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} style={{ 
              padding: '10px', 
              borderTop: '1px solid #ccc',
              display: 'flex'
            }}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '20px',
                  marginRight: '10px'
                }}
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || !isConnected}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isConnected ? '#007bff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: isConnected ? 'pointer' : 'not-allowed'
                }}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#666'
          }}>
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
