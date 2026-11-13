import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // If explicit VITE_API_URL is configured (e.g. Vercel pointing to Render), use that;
    // otherwise default to live Render backend in production, or localhost:5000 in local dev.
    const configuredBackend =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.PROD ? 'https://apiproject-3ay5.onrender.com' : null);
    const socketUrl = configuredBackend
      ? configuredBackend.replace(/\/$/, '')
      : window.location.port === '5173'
      ? `http://${window.location.hostname}:5000`
      : window.location.origin;

    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('[SocketContext] Connected to API Sentinel real-time channel');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('[SocketContext] Disconnected from real-time channel');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

