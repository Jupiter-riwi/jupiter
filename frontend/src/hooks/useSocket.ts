import { useEffect, useState } from 'react';

export function useSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, [url]);

  return { socket, isConnected };
}
