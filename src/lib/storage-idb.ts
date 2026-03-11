import type { EngineState, StorageAdapter } from '../../shared/storage-adapter';

const DB_NAME = 'cartographers';
const DB_VERSION = 1;
const STORE_NAME = 'engine-state';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Browser IndexedDB storage adapter.
 * Keyed by roomId so multiple solo games can coexist in the same browser.
 */
export class IDBStorageAdapter implements StorageAdapter {
  constructor(private roomId: string) {}

  async getEngineState(): Promise<EngineState | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(this.roomId);
      req.onsuccess = () => resolve(req.result as EngineState | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async saveEngineState(state: EngineState): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(state, this.roomId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
