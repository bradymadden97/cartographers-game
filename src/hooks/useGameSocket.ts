import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, GameState, ServerMessage } from '../../worker/types';

function getWsBase(): string {
  if (import.meta.env.DEV) return 'ws://localhost:8787/ws';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

type SocketStatus = 'connecting' | 'connected' | 'disconnected';

export function useGameSocket(roomId: string, playerName: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${getWsBase()}/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      send({ type: 'join', name: playerName });
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'game_state') {
        setGameState(msg.state);
      }
    };

    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('disconnected');

    return () => ws.close();
  }, [roomId, playerName]);

  function send(msg: ClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  return { gameState, status, send };
}
