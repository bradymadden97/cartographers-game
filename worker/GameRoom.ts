import type { ClientMessage, GameState, PlayerInfo, ServerMessage } from './types';

export class GameRoom {
  private state: DurableObjectState;
  private gameState: GameState;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.gameState = {
      roomId: state.id.toString(),
      players: [],
      status: 'waiting',
    };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    const playerId = crypto.randomUUID();
    this.state.acceptWebSocket(server, [playerId]);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const [playerId] = this.state.getTags(ws);

    try {
      const msg: ClientMessage = JSON.parse(message as string);

      switch (msg.type) {
        case 'join': {
          const player: PlayerInfo = { id: playerId, name: msg.name };
          this.gameState.players.push(player);
          this.broadcast({ type: 'game_state', state: this.gameState });
          break;
        }
        case 'start_game': {
          if (this.gameState.status === 'waiting' && this.gameState.players.length > 0) {
            this.gameState.status = 'playing';
            this.broadcast({ type: 'game_state', state: this.gameState });
          }
          break;
        }
        case 'player_action': {
          // TODO: implement game-specific action handling
          break;
        }
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' } satisfies ServerMessage));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const [playerId] = this.state.getTags(ws);
    this.gameState.players = this.gameState.players.filter((p) => p.id !== playerId);
    this.broadcast({ type: 'game_state', state: this.gameState });
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private broadcast(message: ServerMessage): void {
    const msg = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        // WebSocket may already be closed
      }
    }
  }
}
