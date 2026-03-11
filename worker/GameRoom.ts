import { handleMessage, handleDisconnect, createInitialEngineState } from '../shared/game-engine';
import { CFStorageAdapter } from './storage';
import type { OutgoingMessage } from '../shared/game-engine';
import type { ClientMessage, ServerMessage } from '../shared/types';
import type { EngineState } from '../shared/storage-adapter';

/**
 * Cloudflare Durable Object — thin wrapper around the shared game engine.
 *
 * Responsibilities:
 *  1. Accept WebSocket connections and tag them with the player's session ID.
 *  2. Parse incoming JSON and delegate to handleMessage / handleDisconnect.
 *  3. Persist the returned EngineState via CFStorageAdapter.
 *  4. Dispatch outgoing messages to the correct WebSocket connections.
 *
 * All game logic lives in shared/game-engine.ts.
 */
export class GameRoom {
  private state: DurableObjectState;
  private storage: CFStorageAdapter;
  private engineState: EngineState;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = new CFStorageAdapter(state.storage);
    this.engineState = createInitialEngineState(state.id.toString());

    // Restore persisted state after hibernation
    this.state.blockConcurrencyWhile(async () => {
      const saved = await this.storage.getEngineState();
      if (saved) this.engineState = saved;
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Use the client-supplied session ID as the stable player identity.
    // Falls back to a random UUID if not provided (e.g. direct API access).
    const url = new URL(request.url);
    const playerId = url.searchParams.get('session') ?? crypto.randomUUID();
    this.state.acceptWebSocket(server, [playerId]);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const [playerId] = this.state.getTags(ws);
    try {
      const msg: ClientMessage = JSON.parse(message as string);
      const { state, outgoing } = handleMessage(this.engineState, msg, playerId);
      this.engineState = state;
      await this.storage.saveEngineState(state);
      this.dispatch(outgoing);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' } satisfies ServerMessage));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const [playerId] = this.state.getTags(ws);
    const { state, outgoing } = handleDisconnect(this.engineState, playerId);
    this.engineState = state;
    await this.storage.saveEngineState(state);
    this.dispatch(outgoing);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private dispatch(outgoing: OutgoingMessage[]): void {
    for (const { to, message } of outgoing) {
      const json = JSON.stringify(message);
      if (to === 'all') {
        for (const ws of this.state.getWebSockets()) {
          try { ws.send(json); } catch { /* already closed */ }
        }
      } else {
        const target = this.state.getWebSockets().find(
          (w) => this.state.getTags(w)[0] === to,
        );
        try { target?.send(json); } catch { /* already closed */ }
      }
    }
  }
}
