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

import {
  createGrid,
  isValidPlacement,
  placeShape,
  resolveCoords,
  coversRuins,
  MOUNTAIN_POSITIONS,
  GRID_SIZE,
} from '../src/lib/grid';
import { EXPLORE_CARDS, AMBUSH_CARDS, getVariants } from '../src/lib/shapes';
import { computeSeasonScore } from './scoring';
import type {
  AmbushCard,
  Card,
  ClientMessage,
  ExploreCard,
  GameState,
  PlacementPayload,
  PlayerInfo,
  PlayerState,
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

/**
 * After any placement, award a coin for each mountain that is now fully
 * surrounded on all 4 orthogonal sides by non-empty terrain.  The coin flag
 * on the mountain cell prevents double-awarding.
 */
function checkMountainAdjacency(ps: PlayerState): void {
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [mr, mc] of MOUNTAIN_POSITIONS) {
    if (ps.grid[mr][mc].coin) continue; // already awarded
    const surrounded = dirs.every(([dr, dc]) => {
      const nr = mr + dr, nc = mc + dc;
      // Treat out-of-bounds as filled (edge mountains only need inner sides)
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return true;
      return ps.grid[nr][nc].terrain !== 'empty';
    });
    if (surrounded) {
      ps.grid[mr][mc].coin = true;
      ps.coins += 1;
    }
  }
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

      const firstSeason = SEASONS[0];
      state.gameState.round = {
        roundNumber: 1,
        currentCard: firstCard,
        season: firstSeason.name,
        seasonIndex: 0,
        elapsedTime: 0,
        placements,
        scoringCards: firstSeason.scoringCards as [string, string],
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
  const playerState = state.gameState.playerStates[playerId];
  if (!playerState) {
    return [sendTo(playerId, { type: 'error', message: 'Player state not found' })];
  }

  const terrain = payload.terrain ?? exploreCard.terrain;

  // ── Forced single-cell fallback (no valid shape placement existed) ──────────
  if (payload.forcedSingle) {
    const [r, c] = payload.origin;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) {
      return [sendTo(playerId, { type: 'error', message: 'Out of bounds' })];
    }
    const cell = playerState.grid[r][c];
    if (cell.terrain !== 'empty') {
      return [sendTo(playerId, { type: 'error', message: 'Cell is occupied' })];
    }
    playerState.grid = placeShape(playerState.grid, [[0, 0]], payload.origin, terrain);
    checkMountainAdjacency(playerState);
    round.placements[playerId] = 'placed';
    const outgoing: OutgoingMessage[] = [bcast({ type: 'game_state', state: state.gameState })];
    if (allPlaced(state.gameState)) outgoing.push(...advanceRound(state));
    return outgoing;
  }

  // ── Normal shape placement ───────────────────────────────────────────────────
  const shapeBase = exploreCard.shapes[payload.shapeIndex];
  if (!shapeBase) {
    return [sendTo(playerId, { type: 'error', message: 'Invalid shape index' })];
  }

  const variants = getVariants(shapeBase);
  const coords = variants[payload.variantIndex % variants.length];

  if (!isValidPlacement(playerState.grid, coords, payload.origin, terrain)) {
    return [sendTo(playerId, { type: 'error', message: 'Invalid placement' })];
  }

  // Award coin if player covered a ruins cell
  const resolved = resolveCoords(coords, payload.origin);
  if (coversRuins(playerState.grid, resolved)) {
    playerState.coins += 1;
  }

  // Award coin if the smaller shape option was chosen
  if (exploreCard.shapes.length > 1) {
    const chosenSize = exploreCard.shapes[payload.shapeIndex].length;
    const otherSize = exploreCard.shapes[1 - payload.shapeIndex].length;
    if (chosenSize < otherSize || (chosenSize === otherSize && payload.shapeIndex === 1)) {
      playerState.coins += 1;
    }
  }

  playerState.grid = placeShape(playerState.grid, coords, payload.origin, terrain);
  checkMountainAdjacency(playerState);
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
  checkMountainAdjacency(targetState);
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
    // Record real season score for ALL players (including winter)
    for (const ps of Object.values(state.gameState.playerStates)) {
      ps.seasonScores.push(computeSeasonScore(ps.grid, season.scoringCards as [string, string]));
    }

    const nextSeasonIndex = round.seasonIndex + 1;
    if (nextSeasonIndex >= SEASONS.length) {
      // All four seasons done — game over
      state.gameState.phase = 'finished';
      state.gameState.round = null;
      outgoing.push(bcast({ type: 'game_state', state: state.gameState }));
      return outgoing;
    }

    round.seasonIndex = nextSeasonIndex;
    round.season = SEASONS[nextSeasonIndex].name as SeasonName;
    round.scoringCards = SEASONS[nextSeasonIndex].scoringCards as [string, string];
    round.elapsedTime = 0;
  }

  // If the deck is exhausted mid-season, reshuffle explore cards and keep going.
  // The game only ends when all four seasons complete, never due to deck exhaustion.
  if (state.deckIndex >= state.deck.length) {
    state.deck = [...state.deck, ...shuffle([...EXPLORE_CARDS])];
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
    scoringCards: round.scoringCards,
  };

  outgoing.push(bcast({ type: 'game_state', state: state.gameState }));
  return outgoing;
}
