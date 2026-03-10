import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, GameState, ServerMessage } from '../../worker/types';
import { getSessionId } from '../session';

function getWsUrl(roomId: string): string {
  const sessionId = getSessionId();
  const params = `?session=${sessionId}`;
  if (import.meta.env.DEV) return `ws://localhost:8787/ws/${roomId}${params}`;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws/${roomId}${params}`;
}

type SocketStatus = 'connecting' | 'connected' | 'disconnected';

export function useGameSocket(roomId: string, playerName: string) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  // Keep refs in sync so async callbacks (timers, visibilitychange) always use latest values
  const roomIdRef = useRef(roomId);
  const playerNameRef = useRef(playerName);
  roomIdRef.current = roomId;
  playerNameRef.current = playerName;

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      // Tear down any stale connection without triggering its onclose reconnect
      const stale = wsRef.current;
      if (stale) {
        stale.onclose = null;
        stale.onerror = null;
        stale.onopen = null;
        stale.onmessage = null;
        if (stale.readyState !== WebSocket.CLOSED) stale.close();
      }

      setStatus('connecting');
      const ws = new WebSocket(getWsUrl(roomIdRef.current));
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) return;
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        ws.send(JSON.stringify({ type: 'join', name: playerNameRef.current } satisfies ClientMessage));
      };

      ws.onmessage = (event) => {
        if (destroyed) return;
        const msg: ServerMessage = JSON.parse(event.data as string);
        if (msg.type === 'game_state') {
          setGameState(msg.state);
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        setStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (destroyed) return;
        setStatus('disconnected');
        // onclose fires after onerror, so reconnect is handled there
      };
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current || destroyed) return;
      // Exponential backoff: 1s, 2s, 4s, 8s, … capped at 30s
      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30_000);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      const ws = wsRef.current;
      const isGone = !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;
      if (isGone) {
        // Cancel any pending backoff timer and reconnect immediately
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        reconnectAttemptRef.current = 0;
        connect();
      }
    }

    connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      destroyed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null; // prevent reconnect on intentional teardown
        ws.close();
      }
    };
  }, [roomId, playerName]);

  function send(msg: ClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  return { gameState, status, error, send };
}
