import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const useWebSocket = () => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  // WebSocket URL
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token) return;

    try {
      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setSocket(ws);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connection_established':
            console.log('Connection established with user:', data.user_id);
            break;

          case 'message':
            setMessages(prev => [...prev, data]);
            break;

          case 'typing':
            if (data.is_typing) {
              setTypingUsers(prev => new Set(prev).add(data.user_id));
            } else {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.user_id);
                return newSet;
              });
            }
            break;

          case 'read_receipt':
            setMessages(prev => prev.map(msg => 
              msg.id === data.message_id 
                ? { ...msg, is_read: true, read_at: data.read_at }
                : msg
            ));
            break;

          case 'user_status':
            if (data.is_online) {
              setOnlineUsers(prev => new Set(prev).add(data.user_id));
            } else {
              setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.user_id);
                return newSet;
              });
            }
            break;

          case 'error':
            console.error('WebSocket error:', data.message);
            break;

          default:
            console.log('Unknown message type:', data.type);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setSocket(null);

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, [token, wsUrl]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socket) {
      socket.close();
    }
    
    setIsConnected(false);
    setSocket(null);
    reconnectAttemptsRef.current = 0;
  }, [socket]);

  // Send message
  const sendMessage = useCallback((conversationId, content, messageType = 'text') => {
    if (!socket || !isConnected) {
      console.error('WebSocket not connected');
      return false;
    }

    const message = {
      type: 'message',
      conversation_id: conversationId,
      content: content,
      message_type: messageType
    };

    socket.send(JSON.stringify(message));
    return true;
  }, [socket, isConnected]);

  // Send typing indicator
  const sendTyping = useCallback((conversationId, isTyping) => {
    if (!socket || !isConnected) return;

    const message = {
      type: 'typing',
      conversation_id: conversationId,
      is_typing: isTyping
    };

    socket.send(JSON.stringify(message));
  }, [socket, isConnected]);

  // Mark message as read
  const markAsRead = useCallback((messageId) => {
    if (!socket || !isConnected) return;

    const message = {
      type: 'read_receipt',
      message_id: messageId
    };

    socket.send(JSON.stringify(message));
  }, [socket, isConnected]);

  // Update user status
  const updateStatus = useCallback((isOnline) => {
    if (!socket || !isConnected) return;

    const message = {
      type: 'user_status',
      is_online: isOnline
    };

    socket.send(JSON.stringify(message));
  }, [socket, isConnected]);

  // Connect when token is available
  useEffect(() => {
    if (token && user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [token, user, connect, disconnect]);

  // Update online status when connection changes
  useEffect(() => {
    if (isConnected && user) {
      updateStatus(true);
    }
    
    return () => {
      if (user) {
        updateStatus(false);
      }
    };
  }, [isConnected, user, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    messages,
    setMessages,
    conversations,
    setConversations,
    typingUsers,
    onlineUsers,
    sendMessage,
    sendTyping,
    markAsRead,
    updateStatus,
    connect,
    disconnect
  };
};

export default useWebSocket;
