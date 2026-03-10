/**
 * Pure game-state machine.
 *
 * No I/O, no platform APIs.  All functions are (EngineState, …) → EngineResult,
 * making this module runnable in a Cloudflare Durable Object, a browser Web
 * Worker, or a browser Service Worker without modification.
 *
 * I/O (storage, sockets) is handled by the thin wrappers that call into here:
 *   - worker/GameRoom.ts   (Cloudflare Durable Object)
 *   - src/local-game-worker.ts  (browser Web Worker)
 */

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
  Season,
  SeasonName,
  ServerMessage,
} from './types';
import type { EngineState } from './storage-adapter';

export type { EngineState };

/** A message to be delivered to one player ('all' = broadcast). */
export type OutgoingMessage = {
  to: 'all' | string;
  message: ServerMessage;
};

export type EngineResult = {
  state: EngineState;
  outgoing: OutgoingMessage[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEASONS: Season[] = [
  { name: 'spring', timeThreshold: 8, scoringCards: ['A', 'B'] },
  { name: 'summer', timeThreshold: 8, scoringCards: ['B', 'C'] },
  { name: 'fall',   timeThreshold: 7, scoringCards: ['C', 'D'] },
  { name: 'winter', timeThreshold: 6, scoringCards: ['D', 'A'] },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  // One ambush card is inserted at the end of each quarter of the explore deck.
  const explores = shuffle([...EXPLORE_CARDS]);
  const ambushes = shuffle([...AMBUSH_CARDS]).slice(0, 4);
  const chunkSize = Math.ceil(explores.length / 4);
  const deck: Card[] = [];
  for (let i = 0; i < 4; i++) {
    deck.push(...explores.slice(i * chunkSize, (i + 1) * chunkSize), ambushes[i]);
  }
  return deck;
}

function bcast(message: ServerMessage): OutgoingMessage {
  return { to: 'all', message };
}

function sendTo(playerId: string, message: ServerMessage): OutgoingMessage {
  return { to: playerId, message };
}

function allPlaced(gameState: GameState): boolean {
  const { round } = gameState;
  if (!round) return false;
  return Object.values(round.placements).every((s) => s !== 'pending');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createInitialEngineState(roomId: string): EngineState {
  return {
    gameState: {
      roomId,
      players: [],
      playerStates: {},
      phase: 'waiting',
      round: null,
    },
    deck: [],
    deckIndex: 0,
  };
}

/**
 * Handle a client message.  Returns the new EngineState (deep-cloned from the
 * input) and the list of messages to dispatch.
 */
export function handleMessage(
  engineState: EngineState,
  msg: ClientMessage,
  playerId: string,
): EngineResult {
  // Clone once at the top so all sub-handlers can mutate freely.
  const state: EngineState = structuredClone(engineState);
  let outgoing: OutgoingMessage[] = [];

  switch (msg.type) {
    case 'join': {
      const existing = state.gameState.players.find((p) => p.id === playerId);
      if (existing) {
        // Reconnecting — update name in case it changed
        existing.name = msg.name;
        if (state.gameState.playerStates[playerId]) {
          state.gameState.playerStates[playerId].info.name = msg.name;
        }
      } else {
        const player: PlayerInfo = { id: playerId, name: msg.name };
        state.gameState.players.push(player);
        state.gameState.playerStates[playerId] = {
          info: player,
          grid: createGrid(),
          coins: 0,
          seasonScores: [],
        };
      }
      outgoing = [bcast({ type: 'game_state', state: state.gameState })];
      break;
    }

    case 'start_game': {
      if (state.gameState.phase !== 'waiting' || state.gameState.players.length === 0) break;

      state.deck = buildDeck();
      state.deckIndex = 0;

      const firstCard = state.deck[state.deckIndex++];
      const placements: Record<string, 'pending'> = {};
      for (const p of state.gameState.players) placements[p.id] = 'pending';

      state.gameState.round = {
        roundNumber: 1,
        currentCard: firstCard,
        season: 'spring',
        seasonIndex: 0,
        elapsedTime: 0,
        placements,
      };
      state.gameState.phase = 'playing';
      outgoing = [bcast({ type: 'game_state', state: state.gameState })];
      break;
    }

    case 'place_terrain': {
      outgoing = placeTerrain(state, playerId, msg.payload);
      break;
    }

    case 'place_monster': {
      outgoing = placeMonster(state, playerId, msg.targetPlayerId, msg.payload);
      break;
    }
  }

  return { state, outgoing };
}

/**
 * Handle a player disconnect.  Removes them from the waiting room; during a
 * game their state is preserved for reconnection.
 */
export function handleDisconnect(engineState: EngineState, playerId: string): EngineResult {
  const state: EngineState = structuredClone(engineState);
  if (state.gameState.phase === 'waiting') {
    state.gameState.players = state.gameState.players.filter((p) => p.id !== playerId);
    delete state.gameState.playerStates[playerId];
  }
  return { state, outgoing: [bcast({ type: 'game_state', state: state.gameState })] };
}

// ---------------------------------------------------------------------------
// Placement handlers (mutate the already-cloned state)
// ---------------------------------------------------------------------------

function placeTerrain(
  state: EngineState,
  playerId: string,
  payload: PlacementPayload,
): OutgoingMessage[] {
  const { round } = state.gameState;
  if (!round || state.gameState.phase !== 'playing') return [];
  if (round.placements[playerId] !== 'pending') return [];

  const card = round.currentCard;
  if (card.terrain === 'monster') {
    return [sendTo(playerId, { type: 'error', message: 'Use place_monster for ambush cards' })];
  }

  const exploreCard = card as ExploreCard;
  const shapeBase = exploreCard.shapes[payload.shapeIndex];
  if (!shapeBase) {
    return [sendTo(playerId, { type: 'error', message: 'Invalid shape index' })];
  }

  const variants = getVariants(shapeBase);
  const coords = variants[payload.variantIndex % variants.length];
  const playerState = state.gameState.playerStates[playerId];
  if (!playerState) {
    return [sendTo(playerId, { type: 'error', message: 'Player state not found' })];
  }

  // Honour terrain override (e.g. wild/rift-lands cards let the player choose).
  const terrain = payload.terrain ?? exploreCard.terrain;

  if (!isValidPlacement(playerState.grid, coords, payload.origin, terrain)) {
    return [sendTo(playerId, { type: 'error', message: 'Invalid placement' })];
  }

  const resolved = resolveCoords(coords, payload.origin);
  if (coversRuins(playerState.grid, resolved)) {
    playerState.coins += 1;
  }

  playerState.grid = placeShape(playerState.grid, coords, payload.origin, terrain);
  round.placements[playerId] = 'placed';

  const outgoing: OutgoingMessage[] = [bcast({ type: 'game_state', state: state.gameState })];
  if (allPlaced(state.gameState)) {
    outgoing.push(...advanceRound(state));
  }
  return outgoing;
}

function placeMonster(
  state: EngineState,
  playerId: string,
  targetPlayerId: string,
  payload: PlacementPayload,
): OutgoingMessage[] {
  const { round } = state.gameState;
  if (!round || state.gameState.phase !== 'playing') return [];
  if (round.placements[playerId] !== 'pending') return [];

  // Self-targeting is only blocked in multiplayer; solo games may target self.
  if (targetPlayerId === playerId && state.gameState.players.length > 1) {
    return [sendTo(playerId, { type: 'error', message: 'Cannot target yourself' })];
  }

  const card = round.currentCard;
  if (card.terrain !== 'monster') {
    return [sendTo(playerId, { type: 'error', message: 'Current card is not an ambush' })];
  }

  const ambushCard = card as AmbushCard;
  const variants = getVariants(ambushCard.shape);
  const coords = variants[payload.variantIndex % variants.length];
  const targetState = state.gameState.playerStates[targetPlayerId];
  if (!targetState) {
    return [sendTo(playerId, { type: 'error', message: 'Invalid target player' })];
  }

  if (!isValidPlacement(targetState.grid, coords, payload.origin, 'monster')) {
    return [sendTo(playerId, { type: 'error', message: 'Invalid placement on target map' })];
  }

  targetState.grid = placeShape(targetState.grid, coords, payload.origin, 'monster');
  round.placements[playerId] = 'placed';

  const outgoing: OutgoingMessage[] = [bcast({ type: 'game_state', state: state.gameState })];
  if (allPlaced(state.gameState)) {
    outgoing.push(...advanceRound(state));
  }
  return outgoing;
}

// ---------------------------------------------------------------------------
// Round advancement (mutates state, returns messages)
// ---------------------------------------------------------------------------

function advanceRound(state: EngineState): OutgoingMessage[] {
  const outgoing: OutgoingMessage[] = [];
  const { round } = state.gameState;
  if (!round) return outgoing;

  outgoing.push(bcast({ type: 'round_end' }));

  round.elapsedTime += round.currentCard.timeCost;

  const season = SEASONS[round.seasonIndex];
  if (round.elapsedTime >= season.timeThreshold) {
    const nextSeasonIndex = round.seasonIndex + 1;
    if (nextSeasonIndex >= SEASONS.length) {
      state.gameState.phase = 'finished';
      state.gameState.round = null;
      outgoing.push(bcast({ type: 'game_state', state: state.gameState }));
      return outgoing;
    }

    // Record placeholder season score (real scoring TBD)
    for (const ps of Object.values(state.gameState.playerStates)) {
      ps.seasonScores.push(ps.coins);
    }

    round.seasonIndex = nextSeasonIndex;
    round.season = SEASONS[nextSeasonIndex].name as SeasonName;
    round.elapsedTime = 0;
  }

  if (state.deckIndex >= state.deck.length) {
    state.gameState.phase = 'finished';
    state.gameState.round = null;
    outgoing.push(bcast({ type: 'game_state', state: state.gameState }));
    return outgoing;
  }

  const nextCard = state.deck[state.deckIndex++];
  const placements: Record<string, 'pending'> = {};
  for (const p of state.gameState.players) placements[p.id] = 'pending';

  state.gameState.round = {
    roundNumber: round.roundNumber + 1,
    currentCard: nextCard,
    season: round.season,
    seasonIndex: round.seasonIndex,
    elapsedTime: round.elapsedTime,
    placements,
  };

  outgoing.push(bcast({ type: 'game_state', state: state.gameState }));
  return outgoing;
}
