import { createGrid, isValidPlacement, placeShape, resolveCoords, coversRuins } from '../src/lib/grid';
import { EXPLORE_CARDS, AMBUSH_CARDS, getVariants } from '../src/lib/shapes';
import type {
  AmbushCard,
  Card,
  ClientMessage,
  ExploreCard,
  GameState,
  PlacementPayload,
  PlayerInfo,
  PlayerState,
  RoundState,
  Season,
  SeasonName,
  ServerMessage,
} from './types';

const SEASONS: Season[] = [
  { name: 'spring', timeThreshold: 8, scoringCards: ['A', 'B'] },
  { name: 'summer', timeThreshold: 8, scoringCards: ['B', 'C'] },
  { name: 'fall',   timeThreshold: 7, scoringCards: ['C', 'D'] },
  { name: 'winter', timeThreshold: 6, scoringCards: ['D', 'A'] },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  // Interleave one ambush card per season into a shuffled explore deck
  const explores: Card[] = shuffle([...EXPLORE_CARDS]);
  const ambushes: Card[] = shuffle([...AMBUSH_CARDS]).slice(0, 4);

  // Insert each ambush at the end of each "season chunk"
  const chunkSize = Math.ceil(explores.length / 4);
  const deck: Card[] = [];
  for (let i = 0; i < 4; i++) {
    const chunk = explores.slice(i * chunkSize, (i + 1) * chunkSize);
    deck.push(...chunk, ambushes[i]);
  }
  return deck;
}

export class GameRoom {
  private state: DurableObjectState;
  private gameState: GameState;
  private deck: Card[] = [];
  private deckIndex = 0;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.gameState = {
      roomId: state.id.toString(),
      players: [],
      playerStates: {},
      phase: 'waiting',
      round: null,
    };

    // Restore persisted state after hibernation
    this.state.blockConcurrencyWhile(async () => {
      const [savedState, savedDeck, savedDeckIndex] = await Promise.all([
        this.state.storage.get<GameState>('gameState'),
        this.state.storage.get<Card[]>('deck'),
        this.state.storage.get<number>('deckIndex'),
      ]);
      if (savedState) this.gameState = savedState;
      if (savedDeck) this.deck = savedDeck;
      if (savedDeckIndex !== undefined) this.deckIndex = savedDeckIndex;
    });
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
          // Avoid duplicate entries if client reconnects
          const existing = this.gameState.players.find((p) => p.id === playerId);
          if (!existing) {
            const player: PlayerInfo = { id: playerId, name: msg.name };
            this.gameState.players.push(player);
            this.gameState.playerStates[playerId] = {
              info: player,
              grid: createGrid(),
              coins: 0,
              seasonScores: [],
            };
          } else {
            // Update name in case it changed
            existing.name = msg.name;
            this.gameState.playerStates[playerId].info.name = msg.name;
          }
          await this.saveState();
          this.broadcast({ type: 'game_state', state: this.gameState });
          break;
        }

        case 'start_game': {
          if (this.gameState.phase !== 'waiting' || this.gameState.players.length === 0) break;

          this.deck = buildDeck();
          this.deckIndex = 0;

          const firstCard = this.deck[this.deckIndex++];
          const placements: Record<string, 'pending'> = {};
          for (const p of this.gameState.players) placements[p.id] = 'pending';

          const round: RoundState = {
            roundNumber: 1,
            currentCard: firstCard,
            season: 'spring',
            seasonIndex: 0,
            elapsedTime: 0,
            placements,
          };

          this.gameState.phase = 'playing';
          this.gameState.round = round;
          await this.saveState();
          this.broadcast({ type: 'game_state', state: this.gameState });
          break;
        }

        case 'place_terrain': {
          await this.handlePlaceTerrain(ws, playerId, msg.payload);
          break;
        }

        case 'place_monster': {
          await this.handlePlaceMonster(ws, playerId, msg.targetPlayerId, msg.payload);
          break;
        }
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' } satisfies ServerMessage));
    }
  }

  private async handlePlaceTerrain(ws: WebSocket, playerId: string, payload: PlacementPayload): Promise<void> {
    const { round } = this.gameState;
    if (!round || this.gameState.phase !== 'playing') return;
    if (round.placements[playerId] !== 'pending') return;

    const card = round.currentCard;
    if (card.terrain === 'monster') {
      ws.send(JSON.stringify({ type: 'error', message: 'Use place_monster for ambush cards' } satisfies ServerMessage));
      return;
    }

    const exploreCard = card as ExploreCard;
    const shapeBase = exploreCard.shapes[payload.shapeIndex];
    if (!shapeBase) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid shape index' } satisfies ServerMessage));
      return;
    }

    const variants = getVariants(shapeBase);
    const coords = variants[payload.variantIndex % variants.length];
    const playerState = this.gameState.playerStates[playerId];

    if (!isValidPlacement(playerState.grid, coords, payload.origin, exploreCard.terrain)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid placement' } satisfies ServerMessage));
      return;
    }

    // Award coin if placement covers a ruins cell
    const resolved = resolveCoords(coords, payload.origin);
    if (coversRuins(playerState.grid, resolved)) {
      playerState.coins += 1;
    }

    playerState.grid = placeShape(playerState.grid, coords, payload.origin, exploreCard.terrain);
    round.placements[playerId] = 'placed';

    this.broadcast({ type: 'game_state', state: this.gameState });

    if (this.allPlaced()) await this.advanceRound();
    else await this.saveState();
  }

  private async handlePlaceMonster(
    ws: WebSocket,
    playerId: string,
    targetPlayerId: string,
    payload: PlacementPayload,
  ): Promise<void> {
    const { round } = this.gameState;
    if (!round || this.gameState.phase !== 'playing') return;
    if (round.placements[playerId] !== 'pending') return;
    if (targetPlayerId === playerId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Cannot target yourself' } satisfies ServerMessage));
      return;
    }

    const card = round.currentCard;
    if (card.terrain !== 'monster') {
      ws.send(JSON.stringify({ type: 'error', message: 'Current card is not an ambush' } satisfies ServerMessage));
      return;
    }

    const ambushCard = card as AmbushCard;
    const variants = getVariants(ambushCard.shape);
    const coords = variants[payload.variantIndex % variants.length];
    const targetState = this.gameState.playerStates[targetPlayerId];

    if (!targetState) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid target player' } satisfies ServerMessage));
      return;
    }

    if (!isValidPlacement(targetState.grid, coords, payload.origin, 'monster')) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid placement on target map' } satisfies ServerMessage));
      return;
    }

    targetState.grid = placeShape(targetState.grid, coords, payload.origin, 'monster');
    round.placements[playerId] = 'placed';

    this.broadcast({ type: 'game_state', state: this.gameState });

    if (this.allPlaced()) await this.advanceRound();
    else await this.saveState();
  }

  private allPlaced(): boolean {
    const { round } = this.gameState;
    if (!round) return false;
    return Object.values(round.placements).every((s) => s !== 'pending');
  }

  private async advanceRound(): Promise<void> {
    const { round } = this.gameState;
    if (!round) return;

    this.broadcast({ type: 'round_end' });

    round.elapsedTime += round.currentCard.timeCost;

    const season = SEASONS[round.seasonIndex];
    if (round.elapsedTime >= season.timeThreshold) {
      // End of season
      const nextSeasonIndex = round.seasonIndex + 1;
      if (nextSeasonIndex >= SEASONS.length) {
        // Game over
        this.gameState.phase = 'finished';
        this.gameState.round = null;
        await this.saveState();
        this.broadcast({ type: 'game_state', state: this.gameState });
        return;
      }

      // Record a simple season score (placeholder — real scoring TBD)
      for (const ps of Object.values(this.gameState.playerStates)) {
        ps.seasonScores.push(ps.coins);
      }

      round.seasonIndex = nextSeasonIndex;
      round.season = SEASONS[nextSeasonIndex].name as SeasonName;
      round.elapsedTime = 0;
    }

    // Draw next card
    if (this.deckIndex >= this.deck.length) {
      // Deck exhausted — game over
      this.gameState.phase = 'finished';
      this.gameState.round = null;
      await this.saveState();
      this.broadcast({ type: 'game_state', state: this.gameState });
      return;
    }

    const nextCard = this.deck[this.deckIndex++];
    const placements: Record<string, 'pending'> = {};
    for (const p of this.gameState.players) placements[p.id] = 'pending';

    this.gameState.round = {
      roundNumber: round.roundNumber + 1,
      currentCard: nextCard,
      season: round.season,
      seasonIndex: round.seasonIndex,
      elapsedTime: round.elapsedTime,
      placements,
    };

    await this.saveState();
    this.broadcast({ type: 'game_state', state: this.gameState });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const [playerId] = this.state.getTags(ws);
    this.gameState.players = this.gameState.players.filter((p) => p.id !== playerId);
    delete this.gameState.playerStates[playerId];
    await this.saveState();
    this.broadcast({ type: 'game_state', state: this.gameState });
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private async saveState(): Promise<void> {
    await Promise.all([
      this.state.storage.put('gameState', this.gameState),
      this.state.storage.put('deck', this.deck),
      this.state.storage.put('deckIndex', this.deckIndex),
    ]);
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
