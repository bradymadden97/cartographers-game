import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, GameState, ServerMessage } from '../../shared/types';
import type { GameTransport } from '../../shared/transport';
import { FakeWebSocket } from '../lib/local-transport';
import { getSessionId } from '../session';

function getWsUrl(roomId: string): string {
  const sessionId = getSessionId();
  const params = `?session=${sessionId}`;
  if (import.meta.env.DEV) return `ws://localhost:8787/ws/${roomId}${params}`;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws/${roomId}${params}`;
}

// WebSocket ready-state constants (same values as the DOM WebSocket spec).
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

type SocketStatus = 'connecting' | 'connected' | 'disconnected';

export function useGameSocket(
  roomId: string,
  playerName: string,
  mode: 'remote' | 'local' = 'remote',
) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const transportRef = useRef<GameTransport | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  // Keep refs in sync so async callbacks always use the latest values.
  const roomIdRef = useRef(roomId);
  const playerNameRef = useRef(playerName);
  roomIdRef.current = roomId;
  playerNameRef.current = playerName;

  useEffect(() => {
    let destroyed = false;

    function createTransport(): GameTransport {
      if (mode === 'local') {
        // Offline / single-player: game engine runs in a local Web Worker.
        return new FakeWebSocket(roomIdRef.current, getSessionId());
      }
      // Multiplayer: real WebSocket to the Cloudflare Durable Object.
      // WebSocket satisfies the GameTransport interface structurally.
      return new WebSocket(getWsUrl(roomIdRef.current)) as unknown as GameTransport;
    }

    function connect() {
      if (destroyed) return;

      // Tear down any stale transport without triggering its onclose reconnect.
      const stale = transportRef.current;
      if (stale) {
        stale.onclose = null;
        stale.onerror = null;
        stale.onopen = null;
        stale.onmessage = null;
        if (stale.readyState !== WS_CLOSED) stale.close();
      }

      setStatus('connecting');
      const transport = createTransport();
      transportRef.current = transport;

      transport.onopen = () => {
        if (destroyed) return;
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        transport.send(
          JSON.stringify({ type: 'join', name: playerNameRef.current } satisfies ClientMessage),
        );
      };

      transport.onmessage = (event) => {
        if (destroyed) return;
        const msg: ServerMessage = JSON.parse(event.data as string);
        if (msg.type === 'game_state') {
          setGameState(msg.state);
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      };

      transport.onclose = () => {
        if (destroyed) return;
        setStatus('disconnected');
        // Local transport doesn't reconnect — the worker lives with the tab.
        if (mode === 'remote') scheduleReconnect();
      };

      transport.onerror = () => {
        if (destroyed) return;
        setStatus('disconnected');
        // onclose fires after onerror, reconnect is handled there.
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
      if (document.visibilityState !== 'visible' || mode !== 'remote') return;
      const t = transportRef.current;
      const isGone = !t || t.readyState === WS_CLOSED || t.readyState === WS_CLOSING;
      if (isGone) {
        // Cancel any pending backoff timer and reconnect immediately.
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
      const t = transportRef.current;
      if (t) {
        t.onclose = null; // prevent reconnect on intentional teardown
        t.close();
      }
    };
  }, [roomId, playerName, mode]);

  function send(msg: ClientMessage) {
    if (transportRef.current?.readyState === WS_OPEN) {
      transportRef.current.send(JSON.stringify(msg));
    }
  }

  return { gameState, status, error, send };
}
