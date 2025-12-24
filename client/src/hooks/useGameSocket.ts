import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseGameSocketResult {
  socket: Socket | null;
  isConnected: boolean;
}

export function useGameSocket(token: string | null): UseGameSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // Use relative path - Socket.io will auto-detect the host
    // In dev, Vite proxy forwards /socket.io to localhost:3000
    // In production, it connects to the same domain
    const s = io({
      auth: {
        token: token,
      },
      query: {
        token: token,
      },
    });

    setSocket(s);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleError = (error: Error) => {
      console.error('Socket error:', error);
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        // Token invalid, clear it
        localStorage.removeItem('authToken');
      }
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('connect_error', handleError);

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('connect_error', handleError);
      s.disconnect();
    };
  }, [token]);

  return { socket, isConnected };
}


