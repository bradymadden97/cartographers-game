import type { Card, GameState } from './types';

/**
 * The full in-memory state managed by the game engine.
 * Persisted by whichever StorageAdapter is in use (CF Durable Object
 * storage on the server, IndexedDB in the browser).
 */
export type EngineState = {
  gameState: GameState;
  deck: Card[];
  deckIndex: number;
};

/**
 * Platform-agnostic persistence interface.
 *
 * Implementations:
 *   - CFStorageAdapter   (worker/storage.ts)  — Cloudflare Durable Object storage
 *   - IDBStorageAdapter  (src/lib/storage-idb.ts) — browser IndexedDB
 */
export interface StorageAdapter {
  getEngineState(): Promise<EngineState | undefined>;
  saveEngineState(state: EngineState): Promise<void>;
}
