import type { EngineState, StorageAdapter } from '../shared/storage-adapter';

/**
 * Cloudflare Durable Object storage adapter.
 * Persists the three engine state slices the same way the original
 * GameRoom did — three separate KV entries so large grids stay
 * serialisable as individual JSON values.
 */
export class CFStorageAdapter implements StorageAdapter {
  constructor(private storage: DurableObjectStorage) {}

  async getEngineState(): Promise<EngineState | undefined> {
    const [gameState, deck, deckIndex] = await Promise.all([
      this.storage.get<EngineState['gameState']>('gameState'),
      this.storage.get<EngineState['deck']>('deck'),
      this.storage.get<number>('deckIndex'),
    ]);
    if (!gameState) return undefined;
    return { gameState, deck: deck ?? [], deckIndex: deckIndex ?? 0 };
  }

  async saveEngineState(state: EngineState): Promise<void> {
    await Promise.all([
      this.storage.put('gameState', state.gameState),
      this.storage.put('deck', state.deck),
      this.storage.put('deckIndex', state.deckIndex),
    ]);
  }
}
